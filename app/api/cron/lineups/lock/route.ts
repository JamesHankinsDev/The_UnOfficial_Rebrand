import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  computeLineupScore,
  loadPlayerMetaForLineup,
} from "@/lib/tcg-scoring";
import { LINEUP_SIZE } from "@/lib/firestore";
import { canFillSlot } from "@/lib/tcg-positions";
import {
  currentWeekWindow,
  previousWeekWindow,
  weekWindowFromId,
} from "@/lib/tcg-week";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

/**
 * Monday-morning cron. Two jobs:
 *   1. Finalize the week that just ended — recompute scores once more and
 *      flip `final: true` so the leaderboard locks.
 *   2. Lock in the new week — for every user with a valid G-G-F-F-C lineup,
 *      create `/lineupScores/{weekId}_{uid}` with frozen `playerIds`.
 *
 * Idempotent: running twice in the same week won't produce duplicates
 * (the doc id is deterministic, finalized docs are skipped).
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const now = new Date();
    const current = currentWeekWindow(now);
    const prior = previousWeekWindow(now);

    const finalized = await finalizeWeek(db, prior.weekId);
    const locked = await lockWeek(db, current.weekId);

    return NextResponse.json({
      currentWeek: current.weekId,
      priorWeek: prior.weekId,
      finalized,
      locked,
    });
  } catch (err) {
    console.error("Weekly lineup cron error:", err);
    return NextResponse.json({ error: "cron_failed" }, { status: 500 });
  }
}

async function finalizeWeek(
  db: FirebaseFirestore.Firestore,
  weekId: string,
): Promise<number> {
  const window = weekWindowFromId(weekId);
  const snap = await db
    .collection("lineupScores")
    .where("weekId", "==", weekId)
    .get();

  let count = 0;
  for (const doc of snap.docs) {
    const data = doc.data() as {
      playerIds: (number | null)[];
      uid: string;
      final?: boolean;
    };
    if (data.final) continue;

    const filled = data.playerIds.filter((id): id is number => id != null);
    const meta = await loadPlayerMetaForLineup(data.uid, filled);
    const { perPlayer, total } = await computeLineupScore(
      data.playerIds,
      window,
      meta,
    );
    await doc.ref.update({
      perPlayer,
      total,
      computedAt: Timestamp.now(),
      final: true,
    });
    count += 1;
  }
  return count;
}

async function lockWeek(
  db: FirebaseFirestore.Firestore,
  weekId: string,
): Promise<{ locked: number; skipped: number }> {
  const lineupsSnap = await db.collection("lineups").get();
  let locked = 0;
  let skipped = 0;

  for (const lineupDoc of lineupsSnap.docs) {
    const uid = lineupDoc.id;
    const data = lineupDoc.data() as { playerIds?: (number | null)[] };
    const playerIds = Array.isArray(data.playerIds)
      ? data.playerIds.slice(0, LINEUP_SIZE)
      : [];
    while (playerIds.length < LINEUP_SIZE) playerIds.push(null);

    // Skip any lineup that doesn't fully satisfy positional constraints.
    // These users simply don't get a snapshot this week — they see an empty
    // "This Week" panel in the UI with a nudge to complete their lineup.
    const valid = await isLineupValid(db, uid, playerIds);
    if (!valid) {
      skipped += 1;
      continue;
    }

    const scoreRef = db.collection("lineupScores").doc(`${weekId}_${uid}`);
    const existing = await scoreRef.get();
    if (existing.exists) {
      skipped += 1;
      continue;
    }

    // Pull a display name for the leaderboard row.
    const userSnap = await db.collection("users").doc(uid).get();
    const displayName = (userSnap.data()?.displayName as string) ?? "Anonymous";

    await scoreRef.set({
      weekId,
      uid,
      displayName,
      playerIds,
      perPlayer: [],
      total: 0,
      lockedAt: Timestamp.now(),
      computedAt: Timestamp.now(),
      final: false,
    });
    locked += 1;
  }

  return { locked, skipped };
}

async function isLineupValid(
  db: FirebaseFirestore.Firestore,
  uid: string,
  playerIds: (number | null)[],
): Promise<boolean> {
  if (playerIds.some((id) => id == null)) return false;
  const ids = playerIds as number[];
  if (new Set(ids).size !== ids.length) return false;

  // Fetch one card per rostered player to read its position.
  const cardSnap = await db
    .collection("cards")
    .where("ownerId", "==", uid)
    .where("playerId", "in", ids)
    .get();

  const posById = new Map<number, string>();
  for (const d of cardSnap.docs) {
    const pid = d.data().playerId as number;
    if (!posById.has(pid)) {
      posById.set(pid, (d.data().position as string) ?? "");
    }
  }

  // Ownership check + positional check.
  return ids.every(
    (pid, i) => posById.has(pid) && canFillSlot(posById.get(pid), i),
  );
}

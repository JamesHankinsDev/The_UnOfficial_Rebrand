import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyCallerUid } from "@/lib/api-auth";
import {
  computeLineupScore,
  loadPlayerMetaForLineup,
} from "@/lib/tcg-scoring";
import {
  currentWeekWindow,
  weekWindowFromId,
  type WeekWindow,
} from "@/lib/tcg-week";

export const runtime = "nodejs";
// BallDontLie pagination + admin SDK can take a bit.
export const maxDuration = 60;

/**
 * Recompute the locked lineup's score for a given week and upsert into
 * `/lineupScores/{weekId}_{uid}`. Returns 404 if no snapshot exists yet —
 * that means the user wasn't locked in for this week (first week of feature,
 * joined after Monday cron, or lineup was invalid).
 */
export async function POST(request: NextRequest) {
  try {
    const uid = await verifyCallerUid(request);

    const { searchParams } = new URL(request.url);
    const weekIdParam = searchParams.get("weekId");
    const window: WeekWindow = weekIdParam
      ? weekWindowFromId(weekIdParam)
      : currentWeekWindow();

    const db = getAdminDb();
    const docId = `${window.weekId}_${uid}`;
    const scoreRef = db.collection("lineupScores").doc(docId);
    const snap = await scoreRef.get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: "no_snapshot", weekId: window.weekId },
        { status: 404 },
      );
    }
    const existing = snap.data() as {
      playerIds: (number | null)[];
      final?: boolean;
    };

    // If the week has already been finalized by the weekly cron, return it
    // as-is — prevents unnecessary re-reads and protects historical stats.
    if (existing.final) {
      return NextResponse.json({ id: docId, ...existing });
    }

    const filled = existing.playerIds.filter((id): id is number => id != null);
    const meta = await loadPlayerMetaForLineup(uid, filled);
    const { perPlayer, total } = await computeLineupScore(
      existing.playerIds,
      window,
      meta,
    );

    const now = Timestamp.now();
    const weekEnded = Date.now() >= window.endUtc.getTime();
    await scoreRef.update({
      perPlayer,
      total,
      computedAt: now,
      final: weekEnded,
    });

    return NextResponse.json({
      id: docId,
      ...existing,
      perPlayer,
      total,
      computedAt: now.toMillis(),
      final: weekEnded,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "unauthorized") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    console.error("Lineup score error:", err);
    return NextResponse.json(
      { error: "Failed to compute lineup score" },
      { status: 500 },
    );
  }
}


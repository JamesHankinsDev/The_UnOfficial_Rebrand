import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  getNbaPersonIdMap,
  normalizePlayerName,
  resolvePreferredName,
} from "@/lib/nba-persons";

export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH_LIMIT = 500;

/**
 * One-shot backfill: re-resolves every card's `nbaId` by normalizing its
 * stored `playerName` against the NBA Stats person-id map. Fixes cards
 * pulled before the diacritic-normalization change (e.g. Jokić, Dončić).
 *
 * Fire once after deploy:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     https://YOUR_DOMAIN/api/admin/backfill-nba-ids
 *
 * Idempotent — only writes when the resolved id differs from what's stored,
 * and never clears an existing id if the lookup misses.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const map = await getNbaPersonIdMap();

    const snap = await db.collection("cards").get();

    let batch = db.batch();
    let opCount = 0;
    let updated = 0;
    let unchanged = 0;
    let unresolved = 0;
    const unresolvedNames = new Set<string>();

    for (const doc of snap.docs) {
      const card = doc.data() as {
        playerName?: string;
        nbaId?: number | null;
      };
      const name = card.playerName ?? "";
      const resolved = map.get(normalizePlayerName(name));
      const preferred = resolvePreferredName(name);

      const patch: Record<string, unknown> = {};
      if (resolved != null && card.nbaId !== resolved) {
        patch.nbaId = resolved;
      }
      if (name && preferred !== name) {
        patch.playerName = preferred;
      }

      if (resolved == null && Object.keys(patch).length === 0) {
        // Nothing to change and the lookup missed — surface the name so we can
        // extend the alias table later.
        unresolved++;
        if (name) unresolvedNames.add(name);
        continue;
      }

      if (Object.keys(patch).length === 0) {
        unchanged++;
        continue;
      }

      batch.update(doc.ref, patch);
      opCount++;
      updated++;

      if (opCount >= BATCH_LIMIT) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      total: snap.size,
      updated,
      unchanged,
      unresolved,
      unresolvedNames: Array.from(unresolvedNames).sort(),
    });
  } catch (err) {
    console.error("Backfill error:", err);
    return NextResponse.json(
      { error: "backfill_failed", message: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}

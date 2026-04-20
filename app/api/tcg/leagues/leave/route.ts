import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyCallerUid } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const uid = await verifyCallerUid(request);
    const body = (await request.json().catch(() => ({}))) as {
      leagueId?: string;
    };
    const leagueId = (body.leagueId ?? "").trim();
    if (!leagueId) {
      return NextResponse.json({ error: "missing_leagueId" }, { status: 400 });
    }

    const db = getAdminDb();
    const ref = db.collection("leagues").doc(leagueId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const data = snap.data() as {
      ownerUid: string;
      memberUids: string[];
    };

    if (!data.memberUids.includes(uid)) {
      return NextResponse.json({ error: "not_a_member" }, { status: 403 });
    }

    const remaining = data.memberUids.filter((m) => m !== uid);

    // Last member leaving — delete the league so the invite code can be recycled.
    if (remaining.length === 0) {
      await ref.delete();
      return NextResponse.json({ deleted: true });
    }

    // Owner handoff: promote the next member so the league keeps working.
    const nextOwner =
      data.ownerUid === uid ? remaining[0] : data.ownerUid;

    await ref.update({
      memberUids: FieldValue.arrayRemove(uid),
      memberCount: FieldValue.increment(-1),
      ownerUid: nextOwner,
    });

    return NextResponse.json({ left: true, nextOwner });
  } catch (err) {
    if (err instanceof Error && err.message === "unauthorized") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    console.error("League leave error:", err);
    return NextResponse.json({ error: "leave_failed" }, { status: 500 });
  }
}

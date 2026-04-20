import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyCallerUid } from "@/lib/api-auth";
import { normalizeInviteCode } from "@/lib/tcg-invite";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_MEMBERS = 20;

export async function POST(request: NextRequest) {
  try {
    const uid = await verifyCallerUid(request);
    const body = (await request.json().catch(() => ({}))) as {
      inviteCode?: string;
    };
    const code = normalizeInviteCode(body.inviteCode ?? "");
    if (code.length < 9) {
      return NextResponse.json(
        { error: "Invite code looks wrong." },
        { status: 400 },
      );
    }

    const db = getAdminDb();
    const hit = await db
      .collection("leagues")
      .where("inviteCode", "==", code)
      .limit(1)
      .get();
    if (hit.empty) {
      return NextResponse.json(
        { error: "No league matches that invite code." },
        { status: 404 },
      );
    }

    const ref = hit.docs[0].ref;
    const data = hit.docs[0].data() as {
      memberUids: string[];
      memberCount: number;
    };

    if (data.memberUids.includes(uid)) {
      return NextResponse.json({ id: ref.id, ...data, alreadyMember: true });
    }
    if (data.memberUids.length >= MAX_MEMBERS) {
      return NextResponse.json(
        { error: "This league is full." },
        { status: 403 },
      );
    }

    await ref.update({
      memberUids: FieldValue.arrayUnion(uid),
      memberCount: FieldValue.increment(1),
    });

    const fresh = (await ref.get()).data();
    return NextResponse.json({ id: ref.id, ...fresh });
  } catch (err) {
    if (err instanceof Error && err.message === "unauthorized") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    console.error("League join error:", err);
    return NextResponse.json({ error: "join_failed" }, { status: 500 });
  }
}

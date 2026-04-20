import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyCallerUid } from "@/lib/api-auth";
import { generateInviteCode } from "@/lib/tcg-invite";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_NAME_LENGTH = 40;
const MIN_NAME_LENGTH = 2;
const MAX_LEAGUES_PER_USER = 10;
const CODE_COLLISION_RETRIES = 3;

export async function POST(request: NextRequest) {
  try {
    const uid = await verifyCallerUid(request);
    const body = (await request.json().catch(() => ({}))) as { name?: string };
    const name = (body.name ?? "").trim();
    if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Name must be ${MIN_NAME_LENGTH}–${MAX_NAME_LENGTH} characters.` },
        { status: 400 },
      );
    }

    const db = getAdminDb();

    // Soft cap — stops someone from spamming league creation.
    const ownedSnap = await db
      .collection("leagues")
      .where("ownerUid", "==", uid)
      .count()
      .get();
    if (ownedSnap.data().count >= MAX_LEAGUES_PER_USER) {
      return NextResponse.json(
        { error: "You've hit the league creation cap." },
        { status: 403 },
      );
    }

    // Pull display name for the leaderboard row.
    const userDoc = await db.collection("users").doc(uid).get();
    const displayName = (userDoc.data()?.displayName as string) ?? "Anonymous";

    // Allocate a unique invite code.
    let inviteCode = "";
    for (let attempt = 0; attempt < CODE_COLLISION_RETRIES; attempt++) {
      const candidate = generateInviteCode();
      const collision = await db
        .collection("leagues")
        .where("inviteCode", "==", candidate)
        .limit(1)
        .get();
      if (collision.empty) {
        inviteCode = candidate;
        break;
      }
    }
    if (!inviteCode) {
      return NextResponse.json(
        { error: "Couldn't allocate an invite code. Try again." },
        { status: 503 },
      );
    }

    const ref = db.collection("leagues").doc();
    const data = {
      name,
      ownerUid: uid,
      ownerName: displayName,
      memberUids: [uid],
      memberCount: 1,
      inviteCode,
      createdAt: Timestamp.now(),
    };
    await ref.set(data);

    return NextResponse.json({ id: ref.id, ...data });
  } catch (err) {
    if (err instanceof Error && err.message === "unauthorized") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    console.error("League create error:", err);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getPlayerPool } from "@/app/api/tcg/player-pool/route";
import { generatePack } from "@/lib/tcg";

/**
 * POST /api/tcg/open-pack
 *
 * Server-side pack generation. Rolls 7 cards from the player pool with
 * weighted rarity odds. The client is responsible for writing the cards
 * and deducting bucks via Firestore transaction (see lib/firestore.ts → openPack).
 *
 * This separation keeps Firestore writes on the client (matching existing patterns)
 * while the randomization + player pool computation stays server-side.
 */
export async function POST() {
  try {
    const pool = await getPlayerPool();

    if (pool.length === 0) {
      return NextResponse.json(
        { error: "Player pool is empty. Try again later." },
        { status: 503 },
      );
    }

    const cards = generatePack(pool);

    return NextResponse.json({ cards });
  } catch (error) {
    console.error("Open pack error:", error);
    return NextResponse.json(
      { error: "Failed to generate pack" },
      { status: 500 },
    );
  }
}

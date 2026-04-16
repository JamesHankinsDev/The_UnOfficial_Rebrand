import { NextResponse } from "next/server";
import { CURRENT_SEASON } from "@/lib/balldontlie";

/**
 * Returns the list of available NBA seasons.
 * BallDontLie covers 1979–present.
 */
export async function GET() {
  const seasons: number[] = [];
  for (let y = CURRENT_SEASON; y >= 1979; y--) {
    seasons.push(y);
  }
  return NextResponse.json({ seasons, current: CURRENT_SEASON });
}

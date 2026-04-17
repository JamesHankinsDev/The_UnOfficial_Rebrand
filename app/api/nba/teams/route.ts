import { NextResponse } from "next/server";
import { getTeamsList } from "@/lib/balldontlie";
import { cacheHeaders, TTL } from "@/lib/api-cache";

export async function GET() {
  try {
    const teams = await getTeamsList();
    return NextResponse.json({ teams }, { headers: cacheHeaders(TTL.DAY) });
  } catch (error) {
    console.error("Teams error:", error);
    return NextResponse.json(
      { error: "Failed to fetch teams" },
      { status: 500 },
    );
  }
}

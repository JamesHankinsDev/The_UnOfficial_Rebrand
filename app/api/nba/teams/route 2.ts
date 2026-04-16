import { NextResponse } from "next/server";
import { cached, TTL } from "@/lib/api-cache";
import { getApi, getApiKey } from "@/lib/balldontlie";

interface RawTeam {
  id: number;
  abbreviation: string;
  city: string;
  conference: string;
  division: string;
  full_name: string;
  name: string;
}

export async function GET() {
  try {
    const teams = await cached<RawTeam[]>("nba-teams", TTL.DAY, async () => {
      const apiKey = getApiKey();
      const res = await fetch(`https://api.balldontlie.io/v1/teams`, {
        headers: { Authorization: apiKey },
      });
      if (!res.ok) throw new Error(`Teams API returned ${res.status}`);
      const json = await res.json();
      return json.data ?? json;
    });

    return NextResponse.json({ teams });
  } catch (error) {
    console.error("Teams error:", error);
    return NextResponse.json(
      { error: "Failed to fetch teams" },
      { status: 500 },
    );
  }
}

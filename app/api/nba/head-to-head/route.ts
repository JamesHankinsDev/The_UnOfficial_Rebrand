import { NextResponse } from "next/server";
import { cached, TTL } from "@/lib/api-cache";
import { getApi, getApiKey, CURRENT_SEASON } from "@/lib/balldontlie";

interface RawGame {
  id: number;
  date: string;
  status: string;
  home_team: { id: number; abbreviation: string };
  visitor_team: { id: number; abbreviation: string };
  home_team_score: number;
  visitor_team_score: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const team1 = searchParams.get("team1");
  const team2 = searchParams.get("team2");
  const season = searchParams.get("season") || String(CURRENT_SEASON);

  if (!team1 || !team2) {
    return NextResponse.json(
      { error: "Both team1 and team2 query params are required (team IDs)" },
      { status: 400 },
    );
  }

  try {
    const games = await cached<RawGame[]>(
      `h2h-${team1}-${team2}-${season}`,
      TTL.SHORT,
      async () => {
        const apiKey = getApiKey();
        const all: RawGame[] = [];
        let cursor: number | null = null;

        // Paginate through all games for the season between these teams
        do {
          const url = new URL("https://api.balldontlie.io/v1/games");
          url.searchParams.set("seasons[]", season);
          url.searchParams.set("team_ids[]", team1);
          url.searchParams.set("per_page", "100");
          if (cursor) url.searchParams.set("cursor", String(cursor));

          const res = await fetch(url.toString(), {
            headers: { Authorization: apiKey },
          });
          if (!res.ok)
            throw new Error(`Games API returned ${res.status}`);
          const json = await res.json();
          const games: RawGame[] = json.data ?? [];

          // Filter to only games involving BOTH teams
          const matched = games.filter(
            (g) =>
              (String(g.home_team.id) === team2 ||
                String(g.visitor_team.id) === team2),
          );
          all.push(...matched);

          cursor = json.meta?.next_cursor ?? null;
        } while (cursor);

        return all;
      },
    );

    // Compute head-to-head record
    const team1Id = Number(team1);
    let team1Wins = 0;
    let team2Wins = 0;

    const results = games
      .filter((g) => g.status === "Final")
      .map((g) => {
        const isHome = g.home_team.id === team1Id;
        const t1Score = isHome ? g.home_team_score : g.visitor_team_score;
        const t2Score = isHome ? g.visitor_team_score : g.home_team_score;
        if (t1Score > t2Score) team1Wins++;
        else team2Wins++;
        return {
          date: g.date,
          team1Score: t1Score,
          team2Score: t2Score,
          team1Home: isHome,
        };
      });

    return NextResponse.json({
      season: Number(season),
      team1: Number(team1),
      team2: Number(team2),
      team1Wins,
      team2Wins,
      gamesPlayed: results.length,
      games: results,
    });
  } catch (error) {
    console.error("H2H error:", error);
    return NextResponse.json(
      { error: "Failed to fetch head-to-head data" },
      { status: 500 },
    );
  }
}

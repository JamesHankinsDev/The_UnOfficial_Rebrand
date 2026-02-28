import { NextResponse } from "next/server";
import { getApiKey, CURRENT_SEASON } from "@/lib/balldontlie";
import { cached, TTL } from "@/lib/api-cache";

const BASE_URL = "https://api.balldontlie.io/v1";

interface TriviaStatPlayer {
  id: number;
  name: string;
  team: string;
  position: string;
  value: number;
}

interface RawLeader {
  player: {
    id: number;
    first_name: string;
    last_name: string;
    position: string;
    team_id: number;
  };
  value: number;
  games_played: number;
}

type TeamInfo = { id: number; abbreviation: string; full_name: string };

async function getTeamsMap(): Promise<Map<number, string>> {
  const teams = await cached<TeamInfo[]>("teams-list", TTL.DAY, async () => {
    const apiKey = getApiKey();
    const res = await fetch(`${BASE_URL}/teams`, {
      headers: { Authorization: apiKey },
    });
    if (!res.ok) throw new Error(`Teams API returned ${res.status}`);
    const json = await res.json();
    return json.data ?? json;
  });
  const map = new Map<number, string>();
  for (const t of teams) map.set(t.id, t.full_name);
  return map;
}

function fetchLeaders(statType: string): Promise<RawLeader[]> {
  return cached(`leaders-trivia-${statType}-${CURRENT_SEASON}`, TTL.DAY, async () => {
    const apiKey = getApiKey();
    const res = await fetch(
      `${BASE_URL}/leaders?stat_type=${statType}&season=${CURRENT_SEASON}`,
      { headers: { Authorization: apiKey } },
    );
    if (!res.ok) throw new Error(`Leaders API returned ${res.status}`);
    const json = await res.json();
    return json.data ?? json;
  });
}

async function buildPool(mode: "pra" | "stocks"): Promise<TriviaStatPlayer[]> {
  const statTypes = mode === "pra" ? ["pts", "reb", "ast"] : ["blk", "stl"];

  const leaderLists = await Promise.all(statTypes.map((st) => fetchLeaders(st)));
  const teams = await getTeamsMap();

  // Sum component values per player (same approach as leaders route)
  const playerMap = new Map<
    number,
    { player: RawLeader["player"]; components: Map<string, number> }
  >();

  for (let i = 0; i < statTypes.length; i++) {
    const st = statTypes[i];
    for (const leader of leaderLists[i]) {
      const existing = playerMap.get(leader.player.id);
      if (existing) {
        existing.components.set(st, leader.value);
      } else {
        const components = new Map<string, number>();
        components.set(st, leader.value);
        playerMap.set(leader.player.id, { player: leader.player, components });
      }
    }
  }

  const pool: TriviaStatPlayer[] = [];
  for (const [, data] of playerMap) {
    let value = 0;
    for (const st of statTypes) {
      value += data.components.get(st) ?? 0;
    }
    if (value <= 0) continue;

    pool.push({
      id: data.player.id,
      name: `${data.player.first_name} ${data.player.last_name}`,
      team: teams.get(data.player.team_id) ?? "Unknown",
      position: data.player.position || "N/A",
      value: Math.round(value * 10) / 10,
    });
  }

  pool.sort((a, b) => b.value - a.value);
  return pool;
}

function pickRandomPlayers(
  pool: TriviaStatPlayer[],
  count: number,
): TriviaStatPlayer[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    if (mode !== "pra" && mode !== "stocks") {
      return NextResponse.json(
        { error: "Invalid mode. Use ?mode=pra or ?mode=stocks" },
        { status: 400 },
      );
    }

    const pool = await cached(`trivia-stat-${mode}`, TTL.DAY, () =>
      buildPool(mode),
    );

    if (pool.length < 5) {
      return NextResponse.json(
        { error: "Not enough players available" },
        { status: 503 },
      );
    }

    const players = pickRandomPlayers(pool, 5);

    const clientPlayers = players.map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      position: p.position,
    }));

    const answers = Object.fromEntries(
      players.map((p) => [p.id, { value: p.value }]),
    );

    return NextResponse.json({ players: clientPlayers, answers });
  } catch (error) {
    console.error("Stat ranking trivia error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trivia data" },
      { status: 500 },
    );
  }
}

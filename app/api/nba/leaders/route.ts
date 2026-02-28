import { NextResponse } from "next/server";
import { getApiKey } from "@/lib/balldontlie";
import { cached, TTL } from "@/lib/api-cache";

const BASE_URL = "https://api.balldontlie.io/v1";

const CORE_STATS = ["pts", "reb", "ast", "blk", "stl"] as const;
type CoreStat = (typeof CORE_STATS)[number];
type ComputedStat = "pra" | "stocks";
type StatParam = CoreStat | ComputedStat;

interface LeaderEntry {
  player_id: number;
  first_name: string;
  last_name: string;
  position: string;
  team_abbreviation: string;
  team_full_name: string;
  value: number;
  games_played: number;
  rank: number;
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
  rank: number;
  season: number;
  games_played: number;
}

type TeamInfo = { id: number; abbreviation: string; full_name: string };

async function getTeamsMap(): Promise<
  Map<number, { abbreviation: string; full_name: string }>
> {
  // Cache the raw array (JSON-serializable), convert to Map locally
  const teams = await cached<TeamInfo[]>("teams-list", TTL.DAY, async () => {
    const apiKey = getApiKey();
    const res = await fetch(`${BASE_URL}/teams`, {
      headers: { Authorization: apiKey },
    });
    if (!res.ok) throw new Error(`Teams API returned ${res.status}`);
    const json = await res.json();
    return json.data ?? json;
  });
  const map = new Map<number, { abbreviation: string; full_name: string }>();
  for (const t of teams) {
    map.set(t.id, { abbreviation: t.abbreviation, full_name: t.full_name });
  }
  return map;
}

function isCoreStatType(stat: string): stat is CoreStat {
  return (CORE_STATS as readonly string[]).includes(stat);
}

function fetchLeadersFromApi(
  statType: string,
  season: number,
): Promise<RawLeader[]> {
  return cached(`leaders-${statType}-${season}`, TTL.MEDIUM, async () => {
    const apiKey = getApiKey();
    const res = await fetch(
      `${BASE_URL}/leaders?stat_type=${statType}&season=${season}`,
      { headers: { Authorization: apiKey } },
    );
    if (!res.ok) throw new Error(`Leaders API returned ${res.status}`);
    const json = await res.json();
    return json.data ?? json;
  });
}

async function fetchComputedLeaders(
  stat: ComputedStat,
  season: number,
): Promise<LeaderEntry[]> {
  return cached(`computed-${stat}-${season}`, TTL.LONG, async () => {
    // Fetch component stat leader lists (already cached individually at 10min)
    const statTypes: CoreStat[] =
      stat === "pra" ? ["pts", "reb", "ast"] : ["blk", "stl"];

    const leaderResults = await Promise.all(
      statTypes.map((st) => fetchLeadersFromApi(st, season)),
    );

    const teams = await getTeamsMap();

    // Build per-player data: sum component values from leader lists directly
    // (no season averages needed — each leader entry already has the per-game value)
    const playerMap = new Map<
      number,
      {
        player: RawLeader["player"];
        components: Map<string, number>;
        games_played: number;
      }
    >();

    for (let i = 0; i < statTypes.length; i++) {
      const st = statTypes[i];
      for (const leader of leaderResults[i]) {
        const existing = playerMap.get(leader.player.id);
        if (existing) {
          existing.components.set(st, leader.value);
          // Keep the highest games_played across lists
          existing.games_played = Math.max(
            existing.games_played,
            leader.games_played,
          );
        } else {
          const components = new Map<string, number>();
          components.set(st, leader.value);
          playerMap.set(leader.player.id, {
            player: leader.player,
            components,
            games_played: leader.games_played,
          });
        }
      }
    }

    // Compute combined value and build entries
    const entries: LeaderEntry[] = [];
    for (const [playerId, data] of playerMap) {
      // Sum all component values (0 for any stat the player didn't appear in)
      let value = 0;
      for (const st of statTypes) {
        value += data.components.get(st) ?? 0;
      }

      const team = teams.get(data.player.team_id);
      entries.push({
        player_id: playerId,
        first_name: data.player.first_name,
        last_name: data.player.last_name,
        position: data.player.position,
        team_abbreviation: team?.abbreviation ?? "—",
        team_full_name: team?.full_name ?? "—",
        value: Math.round(value * 10) / 10,
        games_played: data.games_played,
        rank: 0,
      });
    }

    entries.sort((a, b) => b.value - a.value);
    entries.forEach((e, i) => {
      e.rank = i + 1;
    });
    return entries.slice(0, 20);
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const stat = (searchParams.get("stat") || "pts") as StatParam;
    const season = parseInt(searchParams.get("season") || "2025", 10);

    // Computed stats
    if (stat === "pra" || stat === "stocks") {
      const leaders = await fetchComputedLeaders(stat, season);
      return NextResponse.json(leaders);
    }

    // Core stats
    if (!isCoreStatType(stat)) {
      return NextResponse.json({ error: "Invalid stat type" }, { status: 400 });
    }

    const raw = await fetchLeadersFromApi(stat, season);
    const teams = await getTeamsMap();

    const leaders: LeaderEntry[] = raw.slice(0, 20).map((l) => {
      const team = teams.get(l.player.team_id);
      return {
        player_id: l.player.id,
        first_name: l.player.first_name,
        last_name: l.player.last_name,
        position: l.player.position,
        team_abbreviation: team?.abbreviation ?? "—",
        team_full_name: team?.full_name ?? "—",
        value: Math.round(l.value * 10) / 10,
        games_played: l.games_played,
        rank: l.rank,
      };
    });

    return NextResponse.json(leaders);
  } catch (error) {
    console.error("Leaders error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaders" },
      { status: 500 },
    );
  }
}

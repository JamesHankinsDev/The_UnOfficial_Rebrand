import { NextResponse } from "next/server";
import { getApiKey, getTeamsList, CURRENT_SEASON } from "@/lib/balldontlie";
import { cached, TTL } from "@/lib/api-cache";
import { buildPlayerPool, type PoolPlayer } from "@/lib/tcg";
import { getNbaPersonIdMap } from "@/lib/nba-persons";

const BASE_URL = "https://api.balldontlie.io/v1";
const CORE_STATS = ["pts", "reb", "ast", "blk", "stl"] as const;

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

async function getTeamsFullMap(): Promise<Map<number, TeamInfo>> {
  const teams = await getTeamsList();
  const map = new Map<number, TeamInfo>();
  for (const t of teams) map.set(t.id, t);
  return map;
}

async function fetchLeaders(stat: string, season: number): Promise<RawLeader[]> {
  return cached(`leaders-${stat}-${season}`, TTL.MEDIUM, async () => {
    const apiKey = getApiKey();
    const res = await fetch(
      `${BASE_URL}/leaders?stat_type=${stat}&season=${season}`,
      { headers: { Authorization: apiKey } },
    );
    if (!res.ok) throw new Error(`Leaders API returned ${res.status}`);
    const json = await res.json();
    return json.data ?? json;
  });
}

/**
 * Builds a complete player pool with rarity tiers.
 * Cached for 1 day since season averages don't change rapidly.
 */
export async function getPlayerPool(season = CURRENT_SEASON): Promise<PoolPlayer[]> {
  return cached(`tcg-player-pool-${season}`, TTL.DAY, async () => {
    // Fetch all core stat leaders + NBA person IDs in parallel
    const [results, nbaPersonIds] = await Promise.all([
      Promise.all(CORE_STATS.map((stat) => fetchLeaders(stat, season))),
      getNbaPersonIdMap().catch(() => new Map<string, number>()),
    ]);

    const teams = await getTeamsFullMap();

    // Merge all leader lists into a single per-player record
    const playerMap = new Map<
      number,
      {
        player: RawLeader["player"];
        stats: Record<string, number>;
        games_played: number;
      }
    >();

    for (let i = 0; i < CORE_STATS.length; i++) {
      const stat = CORE_STATS[i];
      for (const leader of results[i]) {
        const existing = playerMap.get(leader.player.id);
        if (existing) {
          existing.stats[stat] = leader.value;
          existing.games_played = Math.max(existing.games_played, leader.games_played);
        } else {
          playerMap.set(leader.player.id, {
            player: leader.player,
            stats: { [stat]: leader.value },
            games_played: leader.games_played,
          });
        }
      }
    }

    // Convert to buildPlayerPool input format
    const players = Array.from(playerMap.values()).map((p) => {
      const team = teams.get(p.player.team_id);
      const fullName = `${p.player.first_name} ${p.player.last_name}`.toLowerCase();
      return {
        player_id: p.player.id,
        nba_id: nbaPersonIds.get(fullName),
        first_name: p.player.first_name,
        last_name: p.player.last_name,
        position: p.player.position,
        team_abbreviation: team?.abbreviation ?? "—",
        season,
        pts: p.stats.pts ?? 0,
        reb: p.stats.reb ?? 0,
        ast: p.stats.ast ?? 0,
        stl: p.stats.stl ?? 0,
        blk: p.stats.blk ?? 0,
        games_played: p.games_played,
      };
    });

    return buildPlayerPool(players);
  });
}

export async function GET() {
  try {
    const pool = await getPlayerPool();
    return NextResponse.json(pool);
  } catch (error) {
    console.error("Player pool error:", error);
    return NextResponse.json({ error: "Failed to build player pool" }, { status: 500 });
  }
}

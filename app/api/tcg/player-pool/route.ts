import { NextResponse } from "next/server";
import { getApiKey, getTeamsList, CURRENT_SEASON } from "@/lib/balldontlie";
import { cached, TTL } from "@/lib/api-cache";
import { buildPlayerPool, type PoolPlayer } from "@/lib/tcg";
import {
  getNbaPersonIdMap,
  normalizePlayerName,
  resolvePreferredName,
  splitFullName,
} from "@/lib/nba-persons";
import { getAlivePlayoffTeamIds } from "@/lib/playoff-teams";

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
  // Refreshes hourly so it picks up playoff eliminations without needing a deploy.
  return cached(`tcg-player-pool-${season}`, TTL.SHORT, async () => {
    // Fetch all core stat leaders + NBA person IDs + live playoff team set in parallel.
    const [results, nbaPersonIds, aliveTeamIds] = await Promise.all([
      Promise.all(CORE_STATS.map((stat) => fetchLeaders(stat, season))),
      getNbaPersonIdMap().catch(() => new Map<string, number>()),
      getAlivePlayoffTeamIds(season).catch(() => null),
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

    // Convert to buildPlayerPool input format.
    // When playoff data is available, restrict to teams still alive so the set
    // reads like a "postseason" drop. Fall back to all teams otherwise.
    const entries = Array.from(playerMap.values()).filter((p) =>
      aliveTeamIds ? aliveTeamIds.has(p.player.team_id) : true,
    );
    const players = entries.map((p) => {
      const team = teams.get(p.player.team_id);
      const rawFull = `${p.player.first_name} ${p.player.last_name}`;
      const lookupKey = normalizePlayerName(rawFull);
      // Prefer the "goes-by" name for display (e.g. Ace, Bub) while still
      // letting the alias map resolve the photo via either variant.
      const displayFull = resolvePreferredName(rawFull);
      const { firstName, lastName } = splitFullName(displayFull);
      return {
        player_id: p.player.id,
        nba_id: nbaPersonIds.get(lookupKey),
        first_name: firstName,
        last_name: lastName,
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

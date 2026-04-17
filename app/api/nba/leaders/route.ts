import { NextResponse } from "next/server";
import { getApiKey, getTeamsMap, CURRENT_SEASON } from "@/lib/balldontlie";
import { cached, TTL } from "@/lib/api-cache";

const BASE_URL = "https://api.balldontlie.io/v1";

const CORE_STATS = ["pts", "reb", "ast", "blk", "stl"] as const;
type CoreStat = (typeof CORE_STATS)[number];
type ComputedStat = "pra" | "stocks";
type StatParam = CoreStat | ComputedStat;
type Period = "season" | "week" | "month";

const MIN_MPG = 15;
const MIN_GAMES_PCT = 0.6;

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

// Parse BallDontLie "min" field: "32:15" → 32.25, "32" → 32, null → 0
function parseMin(min: string | null | undefined): number {
  if (!min) return 0;
  const parts = min.split(":");
  if (parts.length === 2) return parseInt(parts[0], 10) + parseInt(parts[1], 10) / 60;
  return parseFloat(min) || 0;
}

function periodDates(period: Period): { startDate: string; endDate: string } {
  const now = new Date();
  const end = formatDate(now);
  if (period === "week") {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { startDate: formatDate(start), endDate: end };
  }
  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: formatDate(start), endDate: end };
  }
  return { startDate: "", endDate: "" }; // season — use leaders endpoint
}

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
  draft_year?: number | null;
}

// Fetch draft_year for a set of player IDs (batched, 100 per request)
async function fetchDraftYears(
  playerIds: number[],
  apiKey: string,
): Promise<Map<number, number | null>> {
  const map = new Map<number, number | null>();
  const cacheKey = `draft-years-${[...playerIds].sort().join(",")}`;
  const cached_data = await cached<{ id: number; draft_year: number | null }[]>(
    cacheKey, TTL.DAY,
    async () => {
      const results: { id: number; draft_year: number | null }[] = [];
      // BallDontLie allows up to 100 player_ids[] per request
      for (let i = 0; i < playerIds.length; i += 100) {
        const batch = playerIds.slice(i, i + 100);
        const url = new URL(`${BASE_URL}/players`);
        for (const id of batch) url.searchParams.append("player_ids[]", String(id));
        url.searchParams.set("per_page", "100");
        const res = await fetch(url.toString(), { headers: { Authorization: apiKey } });
        if (!res.ok) continue;
        const json = await res.json();
        const players: { id: number; draft_year: number | null }[] = json.data ?? [];
        results.push(...players.map(p => ({ id: p.id, draft_year: p.draft_year ?? null })));
      }
      return results;
    },
  );
  for (const p of cached_data) map.set(p.id, p.draft_year);
  return map;
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
  limit: number,
): Promise<LeaderEntry[]> {
  return cached(`computed-${stat}-${season}-${limit}`, TTL.LONG, async () => {
    // Fetch component stat leader lists (already cached individually at 10min)
    const statTypes: CoreStat[] =
      stat === "pra" ? ["pts", "reb", "ast"] : ["blk", "stl"];

    const [leaderResults, minRaw] = await Promise.all([
      Promise.all(statTypes.map((st) => fetchLeadersFromApi(st, season))),
      fetchLeadersFromApi("min" as CoreStat, season).catch(() => [] as RawLeader[]),
    ]);

    const mpgMap = new Map<number, number>();
    for (const l of minRaw) mpgMap.set(l.player.id, l.value);

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

    // Qualification thresholds
    const allGames = Array.from(playerMap.values()).map(d => d.games_played);
    const maxGames = Math.max(...allGames, 1);
    const minGamesRequired = Math.ceil(maxGames * MIN_GAMES_PCT);

    // Compute combined value and build entries
    const entries: LeaderEntry[] = [];
    for (const [playerId, data] of playerMap) {
      if (data.games_played < minGamesRequired) continue;
      const mpg = mpgMap.get(playerId);
      if (mpg != null && mpg < MIN_MPG) continue;

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
    return entries.slice(0, limit);
  });
}

interface RawStat {
  pts: number; reb: number; ast: number; blk: number; stl: number; min: string;
  player: { id: number; first_name: string; last_name: string; position: string; team_id: number };
}

async function fetchRollingLeaders(
  stat: StatParam,
  startDate: string,
  endDate: string,
  season: number,
  limit: number,
): Promise<LeaderEntry[]> {
  const cacheKey = `rolling-${stat}-${startDate}-${endDate}-${limit}`;
  return cached(cacheKey, TTL.SHORT, async () => {
    const apiKey = getApiKey();
    const teams = await getTeamsMap();

    // Paginate through all stats in the date range
    const allStats: RawStat[] = [];
    let cursor: number | null = null;
    do {
      const url = new URL(`${BASE_URL}/stats`);
      url.searchParams.set("seasons[]", String(season));
      url.searchParams.set("start_date", startDate);
      url.searchParams.set("end_date", endDate);
      url.searchParams.set("per_page", "100");
      if (cursor != null) url.searchParams.set("cursor", String(cursor));

      const res = await fetch(url.toString(), { headers: { Authorization: apiKey } });
      if (!res.ok) break;
      const json = await res.json();
      const page: RawStat[] = json.data ?? [];
      allStats.push(...page);
      cursor = json.meta?.next_cursor ?? null;
    } while (cursor != null);

    // Aggregate per player
    const playerMap = new Map<number, {
      player: RawStat["player"];
      games: number;
      totalMin: number;
      totals: Record<string, number>;
    }>();

    for (const s of allStats) {
      const pid = s.player.id;
      const existing = playerMap.get(pid);
      const min = parseMin(s.min);
      if (existing) {
        existing.games++;
        existing.totalMin += min;
        existing.totals.pts += s.pts ?? 0;
        existing.totals.reb += s.reb ?? 0;
        existing.totals.ast += s.ast ?? 0;
        existing.totals.blk += s.blk ?? 0;
        existing.totals.stl += s.stl ?? 0;
      } else {
        playerMap.set(pid, {
          player: s.player,
          games: 1,
          totalMin: min,
          totals: { pts: s.pts ?? 0, reb: s.reb ?? 0, ast: s.ast ?? 0, blk: s.blk ?? 0, stl: s.stl ?? 0 },
        });
      }
    }

    // Qualification thresholds
    const maxGames = Math.max(...Array.from(playerMap.values()).map(d => d.games), 1);
    const minGamesRequired = Math.ceil(maxGames * MIN_GAMES_PCT);

    const statFields: Record<StatParam, string[]> = {
      pts: ["pts"], reb: ["reb"], ast: ["ast"], blk: ["blk"], stl: ["stl"],
      pra: ["pts", "reb", "ast"], stocks: ["blk", "stl"],
    };
    const fields = statFields[stat];

    const entries: LeaderEntry[] = [];
    for (const [playerId, data] of playerMap) {
      if (data.games < minGamesRequired) continue;
      const mpg = data.totalMin / data.games;
      if (mpg < MIN_MPG) continue;
      const total = fields.reduce((sum, f) => sum + (data.totals[f] ?? 0), 0);
      const avg = total / data.games;
      const team = teams.get(data.player.team_id);
      entries.push({
        player_id: playerId,
        first_name: data.player.first_name,
        last_name: data.player.last_name,
        position: data.player.position,
        team_abbreviation: team?.abbreviation ?? "—",
        team_full_name: team?.full_name ?? "—",
        value: Math.round(avg * 10) / 10,
        games_played: data.games,
        rank: 0,
      });
    }

    entries.sort((a, b) => b.value - a.value);
    entries.forEach((e, i) => { e.rank = i + 1; });
    return entries.slice(0, limit);
  });
}

async function enrichWithDraftYears(
  entries: LeaderEntry[],
  apiKey: string,
): Promise<LeaderEntry[]> {
  const ids = entries.map(e => e.player_id);
  const draftYears = await fetchDraftYears(ids, apiKey).catch(() => new Map<number, number | null>());
  return entries.map(e => ({ ...e, draft_year: draftYears.get(e.player_id) ?? null }));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const stat = (searchParams.get("stat") || "pts") as StatParam;
    const season = parseInt(searchParams.get("season") || String(CURRENT_SEASON), 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 200);
    const period = (searchParams.get("period") || "season") as Period;

    const apiKey = getApiKey();

    // Rolling period (week / month) — compute from raw stats
    if (period !== "season") {
      const { startDate, endDate } = periodDates(period);
      const leaders = await fetchRollingLeaders(stat, startDate, endDate, season, limit);
      return NextResponse.json(await enrichWithDraftYears(leaders, apiKey));
    }

    // Computed stats (season)
    if (stat === "pra" || stat === "stocks") {
      const leaders = await fetchComputedLeaders(stat, season, limit);
      return NextResponse.json(await enrichWithDraftYears(leaders, apiKey));
    }

    // Core stats (season)
    if (!isCoreStatType(stat)) {
      return NextResponse.json({ error: "Invalid stat type" }, { status: 400 });
    }

    // Fetch stat leaders + min leaders in parallel for qualification filtering
    const [raw, minRaw] = await Promise.all([
      fetchLeadersFromApi(stat, season),
      fetchLeadersFromApi("min" as CoreStat, season).catch(() => [] as RawLeader[]),
    ]);
    const teams = await getTeamsMap();

    // Build MPG map from min leaders (value = avg minutes)
    const mpgMap = new Map<number, number>();
    for (const l of minRaw) mpgMap.set(l.player.id, l.value);

    // Qualification: max games_played in this list → 60% threshold
    const maxGames = Math.max(...raw.map(l => l.games_played), 1);
    const minGamesRequired = Math.ceil(maxGames * MIN_GAMES_PCT);

    const leaders: LeaderEntry[] = raw
      .filter(l => {
        if (l.games_played < minGamesRequired) return false;
        const mpg = mpgMap.get(l.player.id);
        // If MPG data available, enforce 15 MPG; if not available, let it through
        if (mpg != null && mpg < MIN_MPG) return false;
        return true;
      })
      .slice(0, limit)
      .map((l) => {
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

    return NextResponse.json(await enrichWithDraftYears(leaders, apiKey));
  } catch (error) {
    console.error("Leaders error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaders" },
      { status: 500 },
    );
  }
}

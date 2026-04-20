import { NextResponse } from "next/server";
import { getApi, getApiKey, getTeamsList, CURRENT_SEASON } from "@/lib/balldontlie";
import { cached, TTL } from "@/lib/api-cache";

const BASE_URL = "https://api.balldontlie.io/v1";

function fmt(d: Date): string {
  return d.toISOString().split("T")[0];
}

// ── Standings (top 5 per conference) ─────────────────────────────────
async function getTopStandings() {
  const api = getApi();
  const res = await cached(`standings-${CURRENT_SEASON}`, TTL.MEDIUM, () =>
    api.nba.getStandings({ season: CURRENT_SEASON }),
  );

  const out: {
    conference: string;
    team: string;
    wins: number;
    losses: number;
  }[] = [];

  for (const conf of ["East", "West"]) {
    const top5 = res.data
      .filter(
        (s: { team: { conference: string } }) => s.team.conference === conf,
      )
      .sort(
        (
          a: { conference_rank: number },
          b: { conference_rank: number },
        ) => a.conference_rank - b.conference_rank,
      )
      .slice(0, 5);

    for (const s of top5) {
      out.push({
        conference: conf,
        team: s.team.abbreviation,
        wins: s.wins,
        losses: s.losses,
      });
    }
  }
  return out;
}

// ── Leaders (top 5 per stat) ─────────────────────────────────────────

interface RawLeader {
  player: {
    id: number;
    first_name: string;
    last_name: string;
    team_id: number;
  };
  value: number;
}

async function getTeamAbbrMap() {
  const teams = await getTeamsList();
  const map = new Map<number, string>();
  for (const t of teams) map.set(t.id, t.abbreviation);
  return map;
}

async function fetchLeaders(statType: string): Promise<RawLeader[]> {
  return cached(`leaders-${statType}-${CURRENT_SEASON}`, TTL.MEDIUM, async () => {
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

async function getComputedLeaders(
  stat: "pra" | "stocks",
  statTypes: string[],
  teams: Map<number, string>,
) {
  const lists = await Promise.all(statTypes.map((st) => fetchLeaders(st)));

  // Merge per-player values
  const playerMap = new Map<
    number,
    { name: string; team: string; total: number }
  >();

  for (const list of lists) {
    for (const l of list) {
      const existing = playerMap.get(l.player.id);
      if (existing) {
        existing.total += l.value;
      } else {
        playerMap.set(l.player.id, {
          name: l.player.last_name,
          team: teams.get(l.player.team_id) ?? "—",
          total: l.value,
        });
      }
    }
  }

  return Array.from(playerMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map((p) => ({
      name: p.name,
      team: p.team,
      value: Math.round(p.total * 10) / 10,
    }));
}

async function getAllLeaders() {
  const teams = await getTeamAbbrMap();

  const coreStats = [
    { stat: "pts", label: "PTS" },
    { stat: "reb", label: "REB" },
    { stat: "ast", label: "AST" },
    { stat: "blk", label: "BLK" },
    { stat: "stl", label: "STL" },
  ];

  // Fetch all core stat leaders in parallel
  const coreResults = await Promise.all(
    coreStats.map(async ({ stat, label }) => {
      const raw = await fetchLeaders(stat);
      const top5 = raw.slice(0, 5).map((l) => ({
        name: l.player.last_name,
        team: teams.get(l.player.team_id) ?? "—",
        value: Math.round(l.value * 10) / 10,
      }));
      return { stat, label, players: top5 };
    }),
  );

  // Computed stats
  const [pra, stocks] = await Promise.all([
    getComputedLeaders("pra", ["pts", "reb", "ast"], teams),
    getComputedLeaders("stocks", ["blk", "stl"], teams),
  ]);

  return [
    ...coreResults,
    { stat: "pra", label: "PRA", players: pra },
    { stat: "stocks", label: "STOCKS", players: stocks },
  ];
}

// ── Post-season leaders (aggregated from /stats?postseason=true) ────────────

interface PostseasonStatRow {
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  player: {
    id: number;
    first_name: string;
    last_name: string;
    team_id: number;
  };
}

async function isPostseasonActive(): Promise<boolean> {
  const api = getApi();
  return cached(
    `playoffs-active-${CURRENT_SEASON}`,
    TTL.MEDIUM,
    async () => {
      const res = await api.nba.getGames({
        seasons: [CURRENT_SEASON],
        postseason: true,
        per_page: 1,
      });
      return (res.data ?? []).length > 0;
    },
  );
}

async function fetchPostseasonStats(): Promise<PostseasonStatRow[]> {
  return cached(
    `postseason-stats-${CURRENT_SEASON}`,
    TTL.MEDIUM,
    async () => {
      const apiKey = getApiKey();
      const all: PostseasonStatRow[] = [];
      let cursor: number | null = null;
      for (let i = 0; i < 25; i++) {
        const url = new URL(`${BASE_URL}/stats`);
        url.searchParams.set("seasons[]", String(CURRENT_SEASON));
        url.searchParams.set("postseason", "true");
        url.searchParams.set("per_page", "100");
        if (cursor != null) url.searchParams.set("cursor", String(cursor));
        const res = await fetch(url.toString(), {
          headers: { Authorization: apiKey },
        });
        if (!res.ok) throw new Error(`Stats API returned ${res.status}`);
        const json = await res.json();
        all.push(...((json.data ?? []) as PostseasonStatRow[]));
        cursor = json.meta?.next_cursor ?? null;
        if (cursor == null) break;
      }
      return all;
    },
  );
}

async function getPostseasonLeaders() {
  const [teams, stats] = await Promise.all([
    getTeamAbbrMap(),
    fetchPostseasonStats(),
  ]);

  interface Agg {
    name: string;
    team: string;
    games: number;
    pts: number;
    reb: number;
    ast: number;
    stl: number;
    blk: number;
  }

  const agg = new Map<number, Agg>();
  for (const s of stats) {
    const existing = agg.get(s.player.id);
    if (existing) {
      existing.games += 1;
      existing.pts += s.pts ?? 0;
      existing.reb += s.reb ?? 0;
      existing.ast += s.ast ?? 0;
      existing.stl += s.stl ?? 0;
      existing.blk += s.blk ?? 0;
    } else {
      agg.set(s.player.id, {
        name: s.player.last_name,
        team: teams.get(s.player.team_id) ?? "—",
        games: 1,
        pts: s.pts ?? 0,
        reb: s.reb ?? 0,
        ast: s.ast ?? 0,
        stl: s.stl ?? 0,
        blk: s.blk ?? 0,
      });
    }
  }

  const players = Array.from(agg.values()).filter((p) => p.games > 0);
  const top5 = (pick: (p: Agg) => number) =>
    players
      .map((p) => ({
        name: p.name,
        team: p.team,
        value: Math.round(pick(p) * 10) / 10,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

  return [
    { stat: "pts", label: "POSTSEASON PTS", players: top5((p) => p.pts / p.games) },
    { stat: "reb", label: "POSTSEASON REB", players: top5((p) => p.reb / p.games) },
    { stat: "ast", label: "POSTSEASON AST", players: top5((p) => p.ast / p.games) },
    { stat: "blk", label: "POSTSEASON BLK", players: top5((p) => p.blk / p.games) },
    { stat: "stl", label: "POSTSEASON STL", players: top5((p) => p.stl / p.games) },
    {
      stat: "pra",
      label: "POSTSEASON PRA",
      players: top5((p) => (p.pts + p.reb + p.ast) / p.games),
    },
    {
      stat: "stocks",
      label: "POSTSEASON STOCKS",
      players: top5((p) => (p.stl + p.blk) / p.games),
    },
  ];
}

// ── Games (today + yesterday) ────────────────────────────────────────
async function getGamesForDate(date: string) {
  const api = getApi();
  return cached(`games-${date}-${date}`, TTL.SHORT, () =>
    api.nba.getGames({ start_date: date, end_date: date, per_page: 100 }),
  );
}

async function getTodayGames() {
  const today = fmt(new Date());
  const res = await getGamesForDate(today);
  return res.data.map(
    (g: {
      home_team: { abbreviation: string };
      visitor_team: { abbreviation: string };
      status: string;
      home_team_score: number;
      visitor_team_score: number;
    }) => ({
      home: g.home_team.abbreviation,
      visitor: g.visitor_team.abbreviation,
      status: g.status,
      homeScore: g.home_team_score,
      visitorScore: g.visitor_team_score,
    }),
  );
}

async function getYesterdayGames() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const res = await getGamesForDate(fmt(yesterday));
  return res.data.map(
    (g: {
      home_team: { abbreviation: string };
      visitor_team: { abbreviation: string };
      status: string;
      home_team_score: number;
      visitor_team_score: number;
    }) => ({
      home: g.home_team.abbreviation,
      homeScore: g.home_team_score,
      visitor: g.visitor_team.abbreviation,
      visitorScore: g.visitor_team_score,
      status: g.status,
    }),
  );
}

// ── GET handler ──────────────────────────────────────────────────────
export async function GET() {
  try {
    const postseasonActive = await isPostseasonActive();

    const [standings, leaders, todayGames, yesterdayGames] = await Promise.all([
      getTopStandings(),
      postseasonActive ? getPostseasonLeaders() : getAllLeaders(),
      getTodayGames(),
      getYesterdayGames(),
    ]);

    return NextResponse.json({
      standings,
      leaders,
      todayGames,
      yesterdayGames,
      postseason: postseasonActive,
    });
  } catch (error) {
    console.error("Ticker error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ticker data" },
      { status: 500 },
    );
  }
}

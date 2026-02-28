import { NextResponse } from "next/server";
import { getApi, getApiKey, CURRENT_SEASON } from "@/lib/balldontlie";
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

type TeamLookup = { id: number; abbreviation: string; full_name: string };

async function getTeamsMap() {
  const teams = await cached<TeamLookup[]>("teams-list", TTL.DAY, async () => {
    const apiKey = getApiKey();
    const res = await fetch(`${BASE_URL}/teams`, {
      headers: { Authorization: apiKey },
    });
    if (!res.ok) throw new Error(`Teams API returned ${res.status}`);
    const json = await res.json();
    return json.data ?? json;
  });
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
  const teams = await getTeamsMap();

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
    const [standings, leaders, todayGames, yesterdayGames] = await Promise.all([
      getTopStandings(),
      getAllLeaders(),
      getTodayGames(),
      getYesterdayGames(),
    ]);

    return NextResponse.json({
      standings,
      leaders,
      todayGames,
      yesterdayGames,
    });
  } catch (error) {
    console.error("Ticker error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ticker data" },
      { status: 500 },
    );
  }
}

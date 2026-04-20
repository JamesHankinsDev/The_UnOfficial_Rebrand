/**
 * Server-side lineup scoring.
 *
 * Scoring rule (v1, per user spec):
 *   For each rostered player, fetch every NBA game they played in the week
 *   window. Sum `pts + reb + ast + stl + blk` across those games, divide by
 *   games played. That per-game average is the player's score. The lineup's
 *   total is the sum of the five per-player scores.
 */

import { getAdminDb } from "./firebase-admin";
import { getApiKey, CURRENT_SEASON } from "./balldontlie";
import { LINEUP_SIZE, type PerPlayerScore } from "./firestore";
import { toIsoDate, type WeekWindow } from "./tcg-week";

const STATS_URL = "https://api.balldontlie.io/v1/stats";

interface StatRow {
  pts: number | null;
  reb: number | null;
  ast: number | null;
  stl: number | null;
  blk: number | null;
  min: string | null;
  player: {
    id: number;
    first_name: string;
    last_name: string;
    position: string;
    team_id: number;
  };
}

async function fetchStatsForPlayers(
  playerIds: number[],
  startDate: string,
  endDate: string,
  season: number,
): Promise<StatRow[]> {
  if (playerIds.length === 0) return [];

  const apiKey = getApiKey();
  const rows: StatRow[] = [];
  let cursor: number | null = null;

  do {
    const url = new URL(STATS_URL);
    url.searchParams.set("seasons[]", String(season));
    url.searchParams.set("start_date", startDate);
    url.searchParams.set("end_date", endDate);
    url.searchParams.set("per_page", "100");
    for (const pid of playerIds) {
      url.searchParams.append("player_ids[]", String(pid));
    }
    if (cursor != null) url.searchParams.set("cursor", String(cursor));

    const res = await fetch(url.toString(), {
      headers: { Authorization: apiKey },
    });
    if (!res.ok) {
      throw new Error(`BallDontLie stats API returned ${res.status}`);
    }
    const json = await res.json();
    rows.push(...((json.data ?? []) as StatRow[]));
    cursor = json.meta?.next_cursor ?? null;
  } while (cursor != null);

  return rows;
}

/**
 * Minutes string looks like "28:32" or sometimes just "28" / "0:00" / "". We
 * treat zero-minute / missing rows as a DNP (not counted as a game played).
 */
function playedInGame(min: string | null | undefined): boolean {
  if (!min) return false;
  const parts = min.split(":");
  const mins = parseInt(parts[0] ?? "0", 10);
  const secs = parseInt(parts[1] ?? "0", 10);
  return mins > 0 || secs > 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export interface PlayerMeta {
  playerId: number;
  playerName: string;
  teamAbbreviation: string;
  position: string;
}

/**
 * Compute the per-player and total scores for a lineup in a given week window.
 *
 * `playerMetaById` should provide player metadata for anything in `playerIds`
 * — we pull this from the user's frozen Firestore card docs so display data
 * survives even if the player later gets eliminated.
 */
export async function computeLineupScore(
  playerIds: (number | null)[],
  week: WeekWindow,
  playerMetaById: Map<number, PlayerMeta>,
  season: number = CURRENT_SEASON,
): Promise<{ perPlayer: PerPlayerScore[]; total: number }> {
  const activeIds = playerIds.filter((id): id is number => id != null);
  const startDate = toIsoDate(week.startUtc);
  // BallDontLie's end_date is inclusive; our endUtc is the next Monday 00:00
  // LA, so subtract a second to stay inside "Sunday" on the LA calendar.
  const endDate = toIsoDate(
    new Date(week.endUtc.getTime() - 1_000),
  );

  const rows = activeIds.length
    ? await fetchStatsForPlayers(activeIds, startDate, endDate, season)
    : [];

  // Aggregate rows → per-player totals.
  const agg = new Map<
    number,
    { games: number; pra: number; stocks: number; player: StatRow["player"] }
  >();
  for (const row of rows) {
    if (!playedInGame(row.min)) continue;
    const pid = row.player.id;
    const pra = (row.pts ?? 0) + (row.reb ?? 0) + (row.ast ?? 0);
    const stocks = (row.stl ?? 0) + (row.blk ?? 0);
    const entry = agg.get(pid);
    if (entry) {
      entry.games += 1;
      entry.pra += pra;
      entry.stocks += stocks;
    } else {
      agg.set(pid, { games: 1, pra, stocks, player: row.player });
    }
  }

  // Project into the output shape in lineup order, filling zeros for unfilled
  // slots so the response reflects the exact roster you locked in.
  const perPlayer: PerPlayerScore[] = [];
  let total = 0;
  for (const pid of activeIds) {
    const meta = playerMetaById.get(pid);
    const entry = agg.get(pid);
    const games = entry?.games ?? 0;
    const totalPra = entry?.pra ?? 0;
    const totalStocks = entry?.stocks ?? 0;
    const perGame = games > 0 ? (totalPra + totalStocks) / games : 0;
    const rounded = round1(perGame);
    total += rounded;

    const fallbackName = entry
      ? `${entry.player.first_name} ${entry.player.last_name}`
      : "Unknown Player";

    perPlayer.push({
      playerId: pid,
      playerName: meta?.playerName || fallbackName,
      teamAbbreviation: meta?.teamAbbreviation || "—",
      position: meta?.position || entry?.player.position || "",
      gamesPlayed: games,
      totalPra: round1(totalPra),
      totalStocks: round1(totalStocks),
      perGameAvg: rounded,
    });
  }

  return { perPlayer, total: round1(total) };
}

/**
 * Reads a user's most recently-acquired card per playerId so we can preserve
 * display metadata (name, team, position) when building a score doc — even
 * if the player later leaves the pool.
 */
export async function loadPlayerMetaForLineup(
  uid: string,
  playerIds: number[],
): Promise<Map<number, PlayerMeta>> {
  const map = new Map<number, PlayerMeta>();
  if (playerIds.length === 0) return map;

  const db = getAdminDb();
  // Firestore `in` queries cap at 30 items; our lineup is at most 5, so a
  // single query is always enough.
  const snap = await db
    .collection("cards")
    .where("ownerId", "==", uid)
    .where("playerId", "in", playerIds)
    .get();

  for (const d of snap.docs) {
    const data = d.data();
    const pid = data.playerId as number;
    if (!map.has(pid)) {
      map.set(pid, {
        playerId: pid,
        playerName: (data.playerName as string) ?? "",
        teamAbbreviation: (data.teamAbbreviation as string) ?? "—",
        position: (data.position as string) ?? "",
      });
    }
  }
  return map;
}

export { LINEUP_SIZE };

import type { NBAGame } from "@balldontlie/sdk";
import { getApi, CURRENT_SEASON } from "./balldontlie";
import { cached, TTL } from "./api-cache";

async function fetchPostseasonGames(season: number): Promise<NBAGame[]> {
  const api = getApi();
  const all: NBAGame[] = [];
  let cursor: number | undefined;
  for (let i = 0; i < 10; i++) {
    const res = await api.nba.getGames({
      seasons: [season],
      postseason: true,
      per_page: 100,
      cursor,
    });
    all.push(...(res.data ?? []));
    const next = res.meta?.next_cursor;
    if (!next) break;
    cursor = next;
  }
  return all;
}

/**
 * Returns the set of team IDs still alive in the playoffs: teams that have
 * appeared in a postseason game and have not yet lost a completed series.
 *
 * Returns `null` when no playoff data is available (pre-playoffs) so callers
 * can fall back to the full league pool instead of generating empty packs.
 */
export async function getAlivePlayoffTeamIds(
  season = CURRENT_SEASON,
): Promise<Set<number> | null> {
  return cached(`playoff-alive-teams-${season}`, TTL.SHORT, async () => {
    const games = await fetchPostseasonGames(season);
    if (games.length === 0) return null;

    // Group games by unordered team pair to reconstruct series.
    type SeriesEntry = { aId: number; bId: number; games: NBAGame[] };
    const bucket = new Map<string, SeriesEntry>();
    for (const g of games) {
      const [lo, hi] =
        g.home_team.id < g.visitor_team.id
          ? [g.home_team.id, g.visitor_team.id]
          : [g.visitor_team.id, g.home_team.id];
      const key = `${lo}-${hi}`;
      const entry = bucket.get(key);
      if (entry) entry.games.push(g);
      else bucket.set(key, { aId: lo, bId: hi, games: [g] });
    }

    const inPlayoffs = new Set<number>();
    const eliminated = new Set<number>();

    for (const { aId, bId, games: gs } of bucket.values()) {
      inPlayoffs.add(aId);
      inPlayoffs.add(bId);

      let winsA = 0;
      let winsB = 0;
      for (const g of gs) {
        const isFinal =
          typeof g.status === "string" && g.status.toLowerCase().includes("final");
        if (!isFinal) continue;
        const aIsHome = g.home_team.id === aId;
        const aScore = aIsHome ? g.home_team_score : g.visitor_team_score;
        const bScore = aIsHome ? g.visitor_team_score : g.home_team_score;
        if (aScore > bScore) winsA++;
        else if (bScore > aScore) winsB++;
      }

      if (winsA === 4) eliminated.add(bId);
      else if (winsB === 4) eliminated.add(aId);
    }

    const alive = new Set<number>();
    for (const id of inPlayoffs) {
      if (!eliminated.has(id)) alive.add(id);
    }
    return alive;
  });
}

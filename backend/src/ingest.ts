import { Timestamp } from 'firebase-admin/firestore'
import {
  fetchStats,
  BdlRateLimitError,
  type RawStatRow,
} from './sources/bdl.js'
import { writePlayerGames, type PlayerGameDoc } from './sinks/player-games.js'

const INGEST_WINDOW_DAYS = 14

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function parseMin(min: string | null | undefined): number {
  if (!min) return 0
  const parts = min.split(':')
  if (parts.length === 2) {
    return parseInt(parts[0], 10) + parseInt(parts[1], 10) / 60
  }
  return parseFloat(min) || 0
}

function toDoc(row: RawStatRow): PlayerGameDoc {
  const isHome = row.team.id === row.game.home_team_id
  const opponentId = isHome ? row.game.visitor_team_id : row.game.home_team_id
  const teamScore = isHome ? row.game.home_team_score : row.game.visitor_team_score
  const opponentScore = isHome
    ? row.game.visitor_team_score
    : row.game.home_team_score

  return {
    playerId: row.player.id,
    firstName: row.player.first_name,
    lastName: row.player.last_name,
    position: row.player.position ?? '',
    gameId: row.game.id,
    gameDate: row.game.date,
    season: row.game.season,
    postseason: row.game.postseason,
    teamId: row.team.id,
    teamAbbr: row.team.abbreviation,
    opponentId,
    opponentAbbr: '', // filled in later if we add a team map; not critical
    home: isHome,
    teamScore,
    opponentScore,
    status: row.game.status,
    min: parseMin(row.min),
    pts: row.pts ?? 0,
    reb: row.reb ?? 0,
    ast: row.ast ?? 0,
    stl: row.stl ?? 0,
    blk: row.blk ?? 0,
    turnover: row.turnover ?? 0,
    fgm: row.fgm ?? 0,
    fga: row.fga ?? 0,
    fg3m: row.fg3m ?? 0,
    fg3a: row.fg3a ?? 0,
    ftm: row.ftm ?? 0,
    fta: row.fta ?? 0,
    oreb: row.oreb ?? 0,
    dreb: row.dreb ?? 0,
    pf: row.pf ?? 0,
    updatedAt: Timestamp.now(),
  }
}

export interface IngestSummary {
  startDate: string
  endDate: string
  regularSeasonRows: number
  postseasonRows: number
  docsWritten: number
  rateLimitHits: number
  errors: number
  durationMs: number
}

/**
 * Ingest finished games from BallDontLie into Firestore for the trailing
 * `INGEST_WINDOW_DAYS`. Re-fetches each day every run so late stat
 * corrections land within ~a week of the original write.
 *
 * Writes to /player-games/{playerId}/games/{gameId} and is idempotent.
 */
export async function ingestRecentGames(): Promise<IngestSummary> {
  const startedAt = Date.now()
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - INGEST_WINDOW_DAYS)
  const startDate = formatDate(start)
  const endDate = formatDate(end)

  let regularSeasonRows = 0
  let postseasonRows = 0
  let rateLimitHits = 0
  let errors = 0
  const docs: PlayerGameDoc[] = []

  for (const postseason of [false, true]) {
    try {
      const rows = await fetchStats({ startDate, endDate, postseason })
      if (postseason) postseasonRows = rows.length
      else regularSeasonRows = rows.length
      for (const r of rows) docs.push(toDoc(r))
    } catch (err) {
      if (err instanceof BdlRateLimitError) {
        rateLimitHits += 1
        console.warn(
          `[ingest] rate-limited on ${postseason ? 'postseason' : 'regular'} pull; will retry next cycle`,
        )
      } else {
        errors += 1
        console.error('[ingest] fetch error:', err)
      }
    }
  }

  try {
    await writePlayerGames(docs)
  } catch (err) {
    errors += 1
    console.error('[ingest] firestore write error:', err)
  }

  return {
    startDate,
    endDate,
    regularSeasonRows,
    postseasonRows,
    docsWritten: docs.length,
    rateLimitHits,
    errors,
    durationMs: Date.now() - startedAt,
  }
}

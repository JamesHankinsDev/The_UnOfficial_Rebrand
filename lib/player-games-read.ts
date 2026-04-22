import { getAdminDb } from './firebase-admin'

export interface PlayerGameRow {
  playerId: number
  firstName: string
  lastName: string
  position: string
  gameId: number
  gameDate: string
  season: number
  postseason: boolean
  teamId: number
  teamAbbr: string
  min: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
}

export interface ReadPlayerGamesOptions {
  season: number
  postseason: boolean
  startDate: string // YYYY-MM-DD, inclusive
  endDate: string // YYYY-MM-DD, inclusive
}

/**
 * Collection-group query across all /player-games/{playerId}/games rows
 * matching the season/postseason flag and date range. Returns a flat array
 * the grid aggregator can consume the same way it consumes BDL stat rows.
 *
 * Requires a composite index on (season ASC, postseason ASC, gameDate ASC)
 * at the `games` collection-group scope — defined in firestore.indexes.json.
 */
export async function readPlayerGamesInRange(
  opts: ReadPlayerGamesOptions,
): Promise<PlayerGameRow[]> {
  const db = getAdminDb()
  const snap = await db
    .collectionGroup('games')
    .where('season', '==', opts.season)
    .where('postseason', '==', opts.postseason)
    .where('gameDate', '>=', opts.startDate)
    .where('gameDate', '<=', opts.endDate)
    .get()

  const rows: PlayerGameRow[] = []
  for (const doc of snap.docs) {
    const d = doc.data() as Record<string, unknown>
    rows.push({
      playerId: d.playerId as number,
      firstName: (d.firstName as string) ?? '',
      lastName: (d.lastName as string) ?? '',
      position: (d.position as string) ?? '',
      gameId: d.gameId as number,
      gameDate: d.gameDate as string,
      season: d.season as number,
      postseason: d.postseason as boolean,
      teamId: d.teamId as number,
      teamAbbr: (d.teamAbbr as string) ?? '',
      min: (d.min as number) ?? 0,
      pts: (d.pts as number) ?? 0,
      reb: (d.reb as number) ?? 0,
      ast: (d.ast as number) ?? 0,
      stl: (d.stl as number) ?? 0,
      blk: (d.blk as number) ?? 0,
    })
  }
  return rows
}

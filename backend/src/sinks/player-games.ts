import { Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from '../firestore.js'

export interface PlayerGameDoc {
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
  opponentId: number
  opponentAbbr: string
  home: boolean
  teamScore: number
  opponentScore: number
  status: string
  min: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  turnover: number
  fgm: number
  fga: number
  fg3m: number
  fg3a: number
  ftm: number
  fta: number
  oreb: number
  dreb: number
  pf: number
  updatedAt: Timestamp
}

const FIRESTORE_BATCH_LIMIT = 400 // safely under the 500-op ceiling

/**
 * Upsert PlayerGameDocs to /player-games/{playerId}/games/{gameId}.
 * Merges to preserve any additional fields already present on the doc,
 * and to make the write idempotent across re-runs (stat corrections,
 * duplicate schedules).
 */
export async function writePlayerGames(docs: PlayerGameDoc[]): Promise<void> {
  if (docs.length === 0) return
  const db = getAdminDb()
  const now = Timestamp.now()

  for (let i = 0; i < docs.length; i += FIRESTORE_BATCH_LIMIT) {
    const slice = docs.slice(i, i + FIRESTORE_BATCH_LIMIT)
    const batch = db.batch()
    for (const d of slice) {
      const ref = db
        .collection('player-games')
        .doc(String(d.playerId))
        .collection('games')
        .doc(String(d.gameId))
      batch.set(ref, { ...d, updatedAt: now }, { merge: true })
    }
    await batch.commit()
  }
}

import { Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from '../firestore.js'
import type { RawGame } from '../sources/bdl.js'

export interface GameDoc {
  gameId: number
  gameDate: string
  season: number
  postseason: boolean
  status: string
  period: number
  time: string | null
  scheduledTime: Timestamp | null
  homeTeam: { id: number; abbr: string; fullName: string }
  visitorTeam: { id: number; abbr: string; fullName: string }
  homeScore: number
  visitorScore: number
  updatedAt: Timestamp
}

const FIRESTORE_BATCH_LIMIT = 400

function rawToDoc(raw: RawGame): Omit<GameDoc, 'updatedAt'> {
  // BDL uses `status` to carry the scheduled ISO tipoff for pre-game, a
  // game-clock string while live, and "Final" when done. Parsing it into
  // a separate scheduledTime makes the frontend's life easier.
  let scheduledTime: Timestamp | null = null
  if (raw.datetime) {
    const d = new Date(raw.datetime)
    if (!isNaN(d.getTime())) scheduledTime = Timestamp.fromDate(d)
  }
  return {
    gameId: raw.id,
    gameDate: raw.date,
    season: raw.season,
    postseason: raw.postseason,
    status: raw.status ?? '',
    period: raw.period ?? 0,
    time: raw.time,
    scheduledTime,
    homeTeam: {
      id: raw.home_team.id,
      abbr: raw.home_team.abbreviation,
      fullName: raw.home_team.full_name,
    },
    visitorTeam: {
      id: raw.visitor_team.id,
      abbr: raw.visitor_team.abbreviation,
      fullName: raw.visitor_team.full_name,
    },
    homeScore: raw.home_team_score ?? 0,
    visitorScore: raw.visitor_team_score ?? 0,
  }
}

/**
 * Idempotent upsert to /games/{gameId}. Clients subscribe to this via
 * onSnapshot to get live score updates without polling our API.
 */
export async function writeGames(raws: RawGame[]): Promise<void> {
  if (raws.length === 0) return
  const db = getAdminDb()
  const now = Timestamp.now()

  for (let i = 0; i < raws.length; i += FIRESTORE_BATCH_LIMIT) {
    const slice = raws.slice(i, i + FIRESTORE_BATCH_LIMIT)
    const batch = db.batch()
    for (const raw of slice) {
      const ref = db.collection('games').doc(String(raw.id))
      const doc: GameDoc = { ...rawToDoc(raw), updatedAt: now }
      batch.set(ref, doc, { merge: true })
    }
    await batch.commit()
  }
}

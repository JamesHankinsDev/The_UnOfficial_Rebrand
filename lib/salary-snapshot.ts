import { Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from './firebase-admin'

const COLLECTION = 'salaries'

export interface SalaryDoc {
  playerId: number
  playerName: string
  salary: number | null
  capPct: number | null
  season: number
  source: 'balldontlie'
  updatedAt: Timestamp
}

/**
 * Read current-season salaries for the given player IDs from Firestore.
 * Returns a Map; missing player IDs are simply absent from the Map so
 * callers can decide whether to fall back or render null.
 */
export async function readSalaries(
  playerIds: number[],
): Promise<Map<number, SalaryDoc>> {
  const result = new Map<number, SalaryDoc>()
  if (playerIds.length === 0) return result

  const db = getAdminDb()
  const refs = playerIds.map((id) => db.collection(COLLECTION).doc(String(id)))
  // getAll handles any batch size; Firestore routes internally.
  const snaps = await db.getAll(...refs)
  for (const snap of snaps) {
    if (!snap.exists) continue
    const data = snap.data() as SalaryDoc
    result.set(data.playerId, data)
  }
  return result
}

/**
 * Write a batch of salary snapshots. Chunked at 400 to stay safely under
 * Firestore's 500-operation batch ceiling.
 */
export async function writeSalarySnapshots(
  docs: Omit<SalaryDoc, 'updatedAt' | 'source'>[],
): Promise<void> {
  if (docs.length === 0) return
  const db = getAdminDb()
  const now = Timestamp.now()
  const CHUNK = 400
  for (let i = 0; i < docs.length; i += CHUNK) {
    const slice = docs.slice(i, i + CHUNK)
    const batch = db.batch()
    for (const d of slice) {
      const ref = db.collection(COLLECTION).doc(String(d.playerId))
      const full: SalaryDoc = {
        ...d,
        source: 'balldontlie',
        updatedAt: now,
      }
      batch.set(ref, full, { merge: true })
    }
    await batch.commit()
  }
}

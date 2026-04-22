import { NextResponse } from 'next/server'
import { CURRENT_SEASON, SALARY_CAP_USD, getApiKey } from '@/lib/balldontlie'
import { bdlFetch, BdlRateLimitError } from '@/lib/bdl-fetch'
import { getActivePlayerIndex } from '@/lib/nba-persons'
import { writeSalarySnapshots } from '@/lib/salary-snapshot'

const BASE_URL_NBA = 'https://api.balldontlie.io/nba/v1'

export const runtime = 'nodejs'
export const maxDuration = 300

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization')
  return header === `Bearer ${secret}`
}

interface SalaryFetchResult {
  playerId: number
  playerName: string
  salary: number | null
  capPct: number | null
}

async function fetchSalaryForPlayer(
  playerId: number,
  playerName: string,
  apiKey: string,
): Promise<SalaryFetchResult> {
  const res = await bdlFetch(
    `${BASE_URL_NBA}/contracts/players?player_id=${playerId}&per_page=100`,
    apiKey,
  )
  if (!res.ok) return { playerId, playerName, salary: null, capPct: null }
  const data = await res.json()
  const records: Record<string, number>[] = data.data ?? []
  if (records.length === 0) {
    return { playerId, playerName, salary: null, capPct: null }
  }
  const current =
    records.find((r) => r.season === CURRENT_SEASON) ?? records[records.length - 1]
  const salary = (current.base_salary ?? current.cap_hit ?? null) as number | null
  const capPct =
    salary != null ? Math.round((salary / SALARY_CAP_USD) * 1000) / 10 : null
  return { playerId, playerName, salary, capPct }
}

/**
 * Daily snapshot: pull current-season salary for every active player from
 * BallDontLie and write to Firestore. The grid route reads from Firestore
 * first, so a successful run flips live BDL salary fetches off for most
 * requests.
 *
 * Rate-limit-safe via small parallel batches + inter-batch delay. Failures
 * for individual players are logged and counted but don't fail the run;
 * the next day's cron will retry them.
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  try {
    const players = await getActivePlayerIndex()
    const apiKey = getApiKey()

    const results: SalaryFetchResult[] = []
    let rateLimitHits = 0
    let failed = 0

    const BATCH = 5
    const BATCH_DELAY_MS = 400
    for (let i = 0; i < players.length; i += BATCH) {
      const slice = players.slice(i, i + BATCH)
      const settled = await Promise.allSettled(
        slice.map((p) => fetchSalaryForPlayer(p.bl_id, p.name, apiKey)),
      )
      for (const s of settled) {
        if (s.status === 'fulfilled') {
          results.push(s.value)
        } else if (s.reason instanceof BdlRateLimitError) {
          rateLimitHits += 1
        } else {
          failed += 1
          console.warn('[salary-cron] player fetch failed:', s.reason)
        }
      }
      if (i + BATCH < players.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
      }
    }

    await writeSalarySnapshots(
      results.map((r) => ({
        playerId: r.playerId,
        playerName: r.playerName,
        salary: r.salary,
        capPct: r.capPct,
        season: CURRENT_SEASON,
      })),
    )

    const durationMs = Date.now() - startedAt
    const summary = {
      totalPlayers: players.length,
      written: results.length,
      withSalary: results.filter((r) => r.salary != null).length,
      rateLimitHits,
      failed,
      durationMs,
    }
    console.log('[salary-cron] complete:', summary)
    return NextResponse.json(summary)
  } catch (err) {
    console.error('[salary-cron] fatal:', err)
    return NextResponse.json({ error: 'cron_failed' }, { status: 500 })
  }
}

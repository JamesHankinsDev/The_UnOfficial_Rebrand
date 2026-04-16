import { BalldontlieAPI } from '@balldontlie/sdk'

/** NBA season year (2025 = the 2025-26 season) */
export const CURRENT_SEASON = 2025

/** 2025-26 NBA salary cap, in US dollars. */
export const SALARY_CAP_USD = 154_647_000

const BASE_URL_V1 = 'https://api.balldontlie.io/v1'
const BASE_URL_NBA = 'https://api.balldontlie.io/nba/v1'

let api: BalldontlieAPI | null = null

export function getApi(): BalldontlieAPI {
  if (api) return api

  const key = process.env.BALLDONTLIE_API_KEY
  if (!key) {
    throw new Error('BALLDONTLIE_API_KEY is not configured')
  }

  api = new BalldontlieAPI({ apiKey: key })
  return api
}

export function getApiKey(): string {
  const key = process.env.BALLDONTLIE_API_KEY
  if (!key) {
    throw new Error('BALLDONTLIE_API_KEY is not configured')
  }
  return key
}

// ── Weekly snapshot collector (for Phase 1 Value Meal brief) ────────────────

export interface PlayerSnapshot {
  playerId: number
  firstName: string
  lastName: string
  fullName: string
  position: string
  team: string
  games: number
  mpg: number
  ppg: number
  rpg: number
  apg: number
  pra: number
  salary: number | null
  capPct: number | null
}

interface StatRow {
  pts: number
  reb: number
  ast: number
  min: string
  player: {
    id: number
    first_name: string
    last_name: string
    position: string
    team_id: number
  }
}

interface TeamRow {
  id: number
  abbreviation: string
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function parseMin(min: string | null | undefined): number {
  if (!min) return 0
  const parts = min.split(':')
  if (parts.length === 2) return parseInt(parts[0], 10) + parseInt(parts[1], 10) / 60
  return parseFloat(min) || 0
}

async function fetchTeamMap(apiKey: string): Promise<Map<number, string>> {
  const res = await fetch(`${BASE_URL_V1}/teams`, {
    headers: { Authorization: apiKey },
  })
  if (!res.ok) throw new Error(`Teams API returned ${res.status}`)
  const json = await res.json()
  const teams: TeamRow[] = json.data ?? []
  const map = new Map<number, string>()
  for (const t of teams) map.set(t.id, t.abbreviation)
  return map
}

async function fetchStatsRange(
  apiKey: string,
  startDate: string,
  endDate: string,
  season: number,
): Promise<StatRow[]> {
  const all: StatRow[] = []
  let cursor: number | null = null
  do {
    const url = new URL(`${BASE_URL_V1}/stats`)
    url.searchParams.set('seasons[]', String(season))
    url.searchParams.set('start_date', startDate)
    url.searchParams.set('end_date', endDate)
    url.searchParams.set('per_page', '100')
    if (cursor != null) url.searchParams.set('cursor', String(cursor))
    const res = await fetch(url.toString(), { headers: { Authorization: apiKey } })
    if (!res.ok) throw new Error(`Stats API returned ${res.status}`)
    const json = await res.json()
    all.push(...((json.data ?? []) as StatRow[]))
    cursor = json.meta?.next_cursor ?? null
  } while (cursor != null)
  return all
}

async function fetchPlayerSalary(
  apiKey: string,
  playerId: number,
  season: number,
): Promise<number | null> {
  try {
    const res = await fetch(
      `${BASE_URL_NBA}/contracts/players?player_id=${playerId}&per_page=100`,
      { headers: { Authorization: apiKey } },
    )
    if (!res.ok) return null
    const json = await res.json()
    const records: Array<Record<string, number>> = json.data ?? []
    if (!records.length) return null
    const current = records.find((r) => r.season === season) ?? records[records.length - 1]
    return (current.base_salary ?? current.cap_hit ?? null) as number | null
  } catch {
    return null
  }
}

interface WeeklySnapshotOptions {
  /** Minimum games played in the window to qualify. Default 3. */
  minGames?: number
  /** Minimum minutes per game to qualify. Default 15. */
  minMpg?: number
  /** How many top players (by PRA) to enrich with contract data. Default 20. */
  topN?: number
  /** Days of history to pull. Default 7. */
  days?: number
  /** Season. Default CURRENT_SEASON. */
  season?: number
}

/**
 * Fetches per-player stats over the last N days and returns a ranked snapshot
 * with PRA and CAP% for the top N players. Used to seed the Value Meal brief.
 */
export async function getWeeklyPlayerSnapshots(
  opts: WeeklySnapshotOptions = {},
): Promise<PlayerSnapshot[]> {
  const {
    minGames = 3,
    minMpg = 15,
    topN = 20,
    days = 7,
    season = CURRENT_SEASON,
  } = opts

  const apiKey = getApiKey()
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)

  const [stats, teamMap] = await Promise.all([
    fetchStatsRange(apiKey, formatDate(start), formatDate(end), season),
    fetchTeamMap(apiKey),
  ])

  interface Agg {
    player: StatRow['player']
    games: number
    totalMin: number
    totalPts: number
    totalReb: number
    totalAst: number
  }

  const byPlayer = new Map<number, Agg>()
  for (const s of stats) {
    const pid = s.player.id
    const min = parseMin(s.min)
    const existing = byPlayer.get(pid)
    if (existing) {
      existing.games++
      existing.totalMin += min
      existing.totalPts += s.pts ?? 0
      existing.totalReb += s.reb ?? 0
      existing.totalAst += s.ast ?? 0
    } else {
      byPlayer.set(pid, {
        player: s.player,
        games: 1,
        totalMin: min,
        totalPts: s.pts ?? 0,
        totalReb: s.reb ?? 0,
        totalAst: s.ast ?? 0,
      })
    }
  }

  const ranked: PlayerSnapshot[] = []
  for (const [pid, agg] of byPlayer) {
    if (agg.games < minGames) continue
    const mpg = agg.totalMin / agg.games
    if (mpg < minMpg) continue
    const ppg = agg.totalPts / agg.games
    const rpg = agg.totalReb / agg.games
    const apg = agg.totalAst / agg.games
    const pra = ppg + rpg + apg
    ranked.push({
      playerId: pid,
      firstName: agg.player.first_name,
      lastName: agg.player.last_name,
      fullName: `${agg.player.first_name} ${agg.player.last_name}`,
      position: agg.player.position,
      team: teamMap.get(agg.player.team_id) ?? '—',
      games: agg.games,
      mpg: Math.round(mpg * 10) / 10,
      ppg: Math.round(ppg * 10) / 10,
      rpg: Math.round(rpg * 10) / 10,
      apg: Math.round(apg * 10) / 10,
      pra: Math.round(pra * 10) / 10,
      salary: null,
      capPct: null,
    })
  }

  ranked.sort((a, b) => b.pra - a.pra)
  const topSlice = ranked.slice(0, topN)

  // Enrich top slice with contract data in parallel.
  const salaries = await Promise.all(
    topSlice.map((p) => fetchPlayerSalary(apiKey, p.playerId, season)),
  )
  for (let i = 0; i < topSlice.length; i++) {
    const salary = salaries[i]
    topSlice[i].salary = salary
    topSlice[i].capPct = salary != null ? salary / SALARY_CAP_USD : null
  }

  return topSlice
}

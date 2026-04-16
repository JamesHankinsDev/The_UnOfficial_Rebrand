import { NextResponse } from 'next/server'
import { getApiKey, CURRENT_SEASON, SALARY_CAP_USD } from '@/lib/balldontlie'
import { cached, TTL } from '@/lib/api-cache'

const BASE_URL = 'https://api.balldontlie.io/v1'
const BASE_URL_NBA = 'https://api.balldontlie.io/nba/v1'

const CORE_STATS = ['pts', 'reb', 'ast', 'blk', 'stl'] as const
const MIN_MPG = 15
const MIN_GAMES_PCT = 0.6

function parseMin(min: string | null | undefined): number {
  if (!min) return 0
  const parts = min.split(':')
  if (parts.length === 2) return parseInt(parts[0], 10) + parseInt(parts[1], 10) / 60
  return parseFloat(min) || 0
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

interface RawLeader {
  player: { id: number; first_name: string; last_name: string; position: string; team_id: number }
  value: number
  rank: number
  season: number
  games_played: number
}

type TeamInfo = { id: number; abbreviation: string; full_name: string }

async function getTeamsMap(): Promise<Map<number, { abbreviation: string; full_name: string }>> {
  const teams = await cached<TeamInfo[]>('teams-list', TTL.DAY, async () => {
    const apiKey = getApiKey()
    const res = await fetch(`${BASE_URL}/teams`, { headers: { Authorization: apiKey } })
    if (!res.ok) throw new Error(`Teams API returned ${res.status}`)
    const json = await res.json()
    return json.data ?? json
  })
  const map = new Map<number, { abbreviation: string; full_name: string }>()
  for (const t of teams) map.set(t.id, { abbreviation: t.abbreviation, full_name: t.full_name })
  return map
}

async function fetchLeadersForStat(stat: string, season: number): Promise<RawLeader[]> {
  return cached(`leaders-${stat}-${season}`, TTL.MEDIUM, async () => {
    const apiKey = getApiKey()
    const res = await fetch(`${BASE_URL}/leaders?stat_type=${stat}&season=${season}`, {
      headers: { Authorization: apiKey },
    })
    if (!res.ok) throw new Error(`Leaders API returned ${res.status}`)
    const json = await res.json()
    return json.data ?? json
  })
}

async function fetchDraftYears(playerIds: number[]): Promise<Map<number, number | null>> {
  const map = new Map<number, number | null>()
  const cacheKey = `draft-years-${[...playerIds].sort().join(',')}`
  const data = await cached<{ id: number; draft_year: number | null }[]>(cacheKey, TTL.DAY, async () => {
    const apiKey = getApiKey()
    const results: { id: number; draft_year: number | null }[] = []
    for (let i = 0; i < playerIds.length; i += 100) {
      const batch = playerIds.slice(i, i + 100)
      const url = new URL(`${BASE_URL}/players`)
      for (const id of batch) url.searchParams.append('player_ids[]', String(id))
      url.searchParams.set('per_page', '100')
      const res = await fetch(url.toString(), { headers: { Authorization: apiKey } })
      if (!res.ok) continue
      const json = await res.json()
      const players: { id: number; draft_year: number | null }[] = json.data ?? []
      results.push(...players.map(p => ({ id: p.id, draft_year: p.draft_year ?? null })))
    }
    return results
  })
  for (const p of data) map.set(p.id, p.draft_year)
  return map
}

async function fetchSalaries(playerIds: number[]): Promise<Map<number, number | null>> {
  const apiKey = getApiKey()
  const map = new Map<number, number | null>()

  // Fetch in batches to avoid too many parallel requests
  const batchSize = 20
  for (let i = 0; i < playerIds.length; i += batchSize) {
    const batch = playerIds.slice(i, i + batchSize)
    const results = await Promise.all(
      batch.map((id) =>
        cached(`contract-${id}`, TTL.DAY, async () => {
          try {
            const res = await fetch(
              `${BASE_URL_NBA}/contracts/players?player_id=${id}&per_page=100`,
              { headers: { Authorization: apiKey } },
            )
            if (!res.ok) return { player_id: id, salary: null as number | null }
            const data = await res.json()
            const records: Record<string, number>[] = data.data ?? []
            if (!records.length) return { player_id: id, salary: null as number | null }
            const current = records.find(r => r.season === CURRENT_SEASON) ?? records[records.length - 1]
            const salary = current.base_salary ?? current.cap_hit ?? null
            return { player_id: id, salary: salary as number | null }
          } catch {
            return { player_id: id, salary: null as number | null }
          }
        }),
      ),
    )
    for (const r of results) map.set(r.player_id, r.salary)
  }

  return map
}

interface GridPlayer {
  player_id: number
  first_name: string
  last_name: string
  position: string
  team_abbreviation: string
  team_full_name: string
  games_played: number
  draft_year: number | null
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  pra: number
  stocks: number
  salary: number | null
  cap_pct: number | null
}

interface RawStat {
  pts: number; reb: number; ast: number; blk: number; stl: number; min: string
  player: { id: number; first_name: string; last_name: string; position: string; team_id: number }
}

async function buildSeasonGrid(season: number): Promise<GridPlayer[]> {
  // Fetch all 5 stat leaders + minutes in parallel
  const [ptsRaw, rebRaw, astRaw, stlRaw, blkRaw, minRaw] = await Promise.all([
    fetchLeadersForStat('pts', season),
    fetchLeadersForStat('reb', season),
    fetchLeadersForStat('ast', season),
    fetchLeadersForStat('stl', season),
    fetchLeadersForStat('blk', season),
    fetchLeadersForStat('min', season).catch(() => [] as RawLeader[]),
  ])

  const teams = await getTeamsMap()

  // Build MPG map
  const mpgMap = new Map<number, number>()
  for (const l of minRaw) mpgMap.set(l.player.id, l.value)

  // Merge all stats into a player map
  const playerMap = new Map<number, {
    player: RawLeader['player']
    stats: Record<string, number>
    games_played: number
  }>()

  const statLists: [string, RawLeader[]][] = [
    ['pts', ptsRaw], ['reb', rebRaw], ['ast', astRaw], ['stl', stlRaw], ['blk', blkRaw],
  ]

  for (const [statKey, leaders] of statLists) {
    for (const l of leaders) {
      const existing = playerMap.get(l.player.id)
      if (existing) {
        existing.stats[statKey] = l.value
        existing.games_played = Math.max(existing.games_played, l.games_played)
      } else {
        playerMap.set(l.player.id, {
          player: l.player,
          stats: { [statKey]: l.value },
          games_played: l.games_played,
        })
      }
    }
  }

  // Qualification
  const allGames = Array.from(playerMap.values()).map(d => d.games_played)
  const maxGames = Math.max(...allGames, 1)
  const minGamesRequired = Math.ceil(maxGames * MIN_GAMES_PCT)

  const qualified: GridPlayer[] = []
  for (const [playerId, data] of playerMap) {
    if (data.games_played < minGamesRequired) continue
    const mpg = mpgMap.get(playerId)
    if (mpg != null && mpg < MIN_MPG) continue

    const pts = data.stats.pts ?? 0
    const reb = data.stats.reb ?? 0
    const ast = data.stats.ast ?? 0
    const stl = data.stats.stl ?? 0
    const blk = data.stats.blk ?? 0
    const team = teams.get(data.player.team_id)

    qualified.push({
      player_id: playerId,
      first_name: data.player.first_name,
      last_name: data.player.last_name,
      position: data.player.position,
      team_abbreviation: team?.abbreviation ?? '—',
      team_full_name: team?.full_name ?? '—',
      games_played: data.games_played,
      draft_year: null,
      pts: Math.round(pts * 10) / 10,
      reb: Math.round(reb * 10) / 10,
      ast: Math.round(ast * 10) / 10,
      stl: Math.round(stl * 10) / 10,
      blk: Math.round(blk * 10) / 10,
      pra: Math.round((pts + reb + ast) * 10) / 10,
      stocks: Math.round((stl + blk) * 10) / 10,
      salary: null,
      cap_pct: null,
    })
  }

  qualified.sort((a, b) => b.pts - a.pts)

  // Enrich with draft years
  const ids = qualified.map(p => p.player_id)
  const draftYears = await fetchDraftYears(ids).catch(() => new Map<number, number | null>())
  for (const p of qualified) p.draft_year = draftYears.get(p.player_id) ?? null

  // Enrich with salaries
  const salaries = await fetchSalaries(ids).catch(() => new Map<number, number | null>())
  for (const p of qualified) {
    const salary = salaries.get(p.player_id) ?? null
    p.salary = salary
    p.cap_pct = salary != null ? Math.round((salary / SALARY_CAP_USD) * 1000) / 10 : null
  }

  return qualified
}

async function buildRollingGrid(
  season: number,
  startDate: string,
  endDate: string,
  maxGamesPerPlayer?: number,
): Promise<GridPlayer[]> {
  const apiKey = getApiKey()
  const teams = await getTeamsMap()

  // Paginate through all stats in the date range
  const allStats: (RawStat & { game_date?: string })[] = []
  let cursor: number | null = null
  do {
    const url = new URL(`${BASE_URL}/stats`)
    url.searchParams.set('seasons[]', String(season))
    url.searchParams.set('start_date', startDate)
    url.searchParams.set('end_date', endDate)
    url.searchParams.set('per_page', '100')
    if (cursor != null) url.searchParams.set('cursor', String(cursor))
    const res = await fetch(url.toString(), { headers: { Authorization: apiKey } })
    if (!res.ok) break
    const json = await res.json()
    allStats.push(...((json.data ?? []) as (RawStat & { game_date?: string })[]))
    cursor = json.meta?.next_cursor ?? null
  } while (cursor != null)

  // Collect per-player game entries
  const playerGames = new Map<number, {
    player: RawStat['player']
    games: { pts: number; reb: number; ast: number; blk: number; stl: number; min: number; date: string }[]
  }>()

  for (const s of allStats) {
    const pid = s.player.id
    const min = parseMin(s.min)
    const gameDate = s.game_date ?? ''
    const entry = { pts: s.pts ?? 0, reb: s.reb ?? 0, ast: s.ast ?? 0, blk: s.blk ?? 0, stl: s.stl ?? 0, min, date: gameDate }
    const existing = playerGames.get(pid)
    if (existing) {
      existing.games.push(entry)
    } else {
      playerGames.set(pid, { player: s.player, games: [entry] })
    }
  }

  // If maxGamesPerPlayer is set, keep only the N most recent games per player
  if (maxGamesPerPlayer) {
    for (const data of playerGames.values()) {
      if (data.games.length > maxGamesPerPlayer) {
        data.games = data.games.slice(-maxGamesPerPlayer)
      }
    }
  }

  // Aggregate
  const minGamesRequired = maxGamesPerPlayer ?? Math.ceil(
    Math.max(...Array.from(playerGames.values()).map(d => d.games.length), 1) * MIN_GAMES_PCT,
  )

  const qualified: GridPlayer[] = []
  for (const [playerId, data] of playerGames) {
    const gameCount = data.games.length
    if (!maxGamesPerPlayer && gameCount < minGamesRequired) continue
    if (maxGamesPerPlayer && gameCount < maxGamesPerPlayer) continue
    const totalMin = data.games.reduce((s, g) => s + g.min, 0)
    const mpg = totalMin / gameCount
    if (!maxGamesPerPlayer && mpg < MIN_MPG) continue

    const totals = data.games.reduce((acc, g) => ({
      pts: acc.pts + g.pts, reb: acc.reb + g.reb, ast: acc.ast + g.ast,
      stl: acc.stl + g.stl, blk: acc.blk + g.blk,
    }), { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0 })

    const pts = totals.pts / gameCount
    const reb = totals.reb / gameCount
    const ast = totals.ast / gameCount
    const stl = totals.stl / gameCount
    const blk = totals.blk / gameCount
    const team = teams.get(data.player.team_id)

    qualified.push({
      player_id: playerId,
      first_name: data.player.first_name,
      last_name: data.player.last_name,
      position: data.player.position,
      team_abbreviation: team?.abbreviation ?? '—',
      team_full_name: team?.full_name ?? '—',
      games_played: gameCount,
      draft_year: null,
      pts: Math.round(pts * 10) / 10,
      reb: Math.round(reb * 10) / 10,
      ast: Math.round(ast * 10) / 10,
      stl: Math.round(stl * 10) / 10,
      blk: Math.round(blk * 10) / 10,
      pra: Math.round((pts + reb + ast) * 10) / 10,
      stocks: Math.round((stl + blk) * 10) / 10,
      salary: null,
      cap_pct: null,
    })
  }

  qualified.sort((a, b) => b.pts - a.pts)

  // Enrich with draft years + salaries
  const ids = qualified.map(p => p.player_id)
  const [draftYears, salaries] = await Promise.all([
    fetchDraftYears(ids).catch(() => new Map<number, number | null>()),
    fetchSalaries(ids).catch(() => new Map<number, number | null>()),
  ])
  for (const p of qualified) {
    p.draft_year = draftYears.get(p.player_id) ?? null
    const salary = salaries.get(p.player_id) ?? null
    p.salary = salary
    p.cap_pct = salary != null ? Math.round((salary / SALARY_CAP_USD) * 1000) / 10 : null
  }

  return qualified
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const season = parseInt(searchParams.get('season') || String(CURRENT_SEASON), 10)
    const period = searchParams.get('period') || 'season'

    if (period === 'season') {
      const grid = await cached(`player-grid-season-${season}`, TTL.LONG, () => buildSeasonGrid(season))
      return NextResponse.json(grid)
    }

    // Game-count periods (last1, last3, last5, last10) — fetch 30-day window, limit per player
    const gameCountMatch = period.match(/^last(\d+)$/)
    const now = new Date()
    const end = formatDate(now)

    if (gameCountMatch) {
      const maxGames = parseInt(gameCountMatch[1], 10)
      const d = new Date(now)
      d.setDate(d.getDate() - 45) // wide enough window to capture N games for all players
      const start = formatDate(d)
      const cacheKey = `player-grid-last${maxGames}-${end}`
      const grid = await cached(cacheKey, TTL.SHORT, () =>
        buildRollingGrid(season, start, end, maxGames),
      )
      return NextResponse.json(grid)
    }

    // Date-based rolling periods (week, month)
    let start: string
    if (period === 'week') {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      start = formatDate(d)
    } else {
      start = formatDate(new Date(now.getFullYear(), now.getMonth(), 1))
    }

    const cacheKey = `player-grid-${period}-${start}-${end}`
    const grid = await cached(cacheKey, TTL.SHORT, () => buildRollingGrid(season, start, end))
    return NextResponse.json(grid)
  } catch (error) {
    console.error('Player grid error:', error)
    return NextResponse.json({ error: 'Failed to fetch player grid' }, { status: 500 })
  }
}

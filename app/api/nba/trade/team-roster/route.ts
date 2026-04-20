import { NextResponse } from 'next/server'
import { getApi, getApiKey, getTeamsList, CURRENT_SEASON } from '@/lib/balldontlie'
import { cached, cacheHeaders, TTL } from '@/lib/api-cache'
import { getCapTier, type TradePlayer, type CapTier } from '@/lib/trade-rules'

const BASE_URL = 'https://api.balldontlie.io/v1'
const BASE_URL_NBA = 'https://api.balldontlie.io/nba/v1'

interface TeamRosterResponse {
  team: {
    id: number
    abbreviation: string
    full_name: string
    conference: string
    division: string
  }
  standings: {
    wins: number
    losses: number
    conference_rank: number
  }
  total_salary: number
  cap_tier: CapTier
  roster: TradePlayer[]
}

function parseMin(min: string | null | undefined): number {
  if (!min) return 0
  const parts = min.split(':')
  if (parts.length === 2) return parseInt(parts[0], 10) + parseInt(parts[1], 10) / 60
  return parseFloat(min) || 0
}

// ---------------------------------------------------------------------------
// Step 1: Get all player IDs for a team, then find who played this season
// ---------------------------------------------------------------------------

interface PlayerCandidate {
  id: number
  first_name: string
  last_name: string
  position: string
}

/** Fetch ALL player IDs associated with a team (paginated). */
async function fetchAllTeamPlayerIds(teamId: number, apiKey: string): Promise<PlayerCandidate[]> {
  const players: PlayerCandidate[] = []
  let cursor: number | null = null

  do {
    const url = new URL(`${BASE_URL}/players`)
    url.searchParams.set('team_ids[]', String(teamId))
    url.searchParams.set('per_page', '100')
    if (cursor != null) url.searchParams.set('cursor', String(cursor))

    const res = await fetch(url.toString(), { headers: { Authorization: apiKey } })
    if (!res.ok) break
    const json = await res.json()
    for (const p of json.data ?? []) {
      players.push({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        position: p.position ?? '',
      })
    }
    cursor = json.meta?.next_cursor ?? null
  } while (cursor != null)

  return players
}

/**
 * Batch-check season averages for players. Returns only those with games > 0.
 * Each call is individually cached so subsequent loads are instant.
 */
async function filterToActivePlayers(
  players: PlayerCandidate[],
  season: number,
  apiKey: string,
): Promise<Map<number, { mpg: number; games_played: number }>> {
  const active = new Map<number, { mpg: number; games_played: number }>()
  const batchSize = 50

  for (let i = 0; i < players.length; i += batchSize) {
    const batch = players.slice(i, i + batchSize)
    const results = await Promise.all(
      batch.map(p =>
        cached(`savg-${p.id}-${season}`, TTL.DAY, async () => {
          try {
            const res = await fetch(
              `${BASE_URL}/season_averages?season=${season}&player_id=${p.id}`,
              { headers: { Authorization: apiKey } },
            )
            if (!res.ok) return { id: p.id, mpg: 0, gp: 0 }
            const json = await res.json()
            const data = json.data ?? []
            if (!data.length) return { id: p.id, mpg: 0, gp: 0 }
            return {
              id: p.id,
              mpg: parseMin(data[0].min),
              gp: data[0].games_played ?? 0,
            }
          } catch {
            return { id: p.id, mpg: 0, gp: 0 }
          }
        }),
      ),
    )
    for (const r of results) {
      if (r.gp > 0) {
        active.set(r.id, { mpg: r.mpg, games_played: r.gp })
      }
    }
  }

  return active
}

// ---------------------------------------------------------------------------
// Step 2: Enrich active players with salary + advanced stats
// ---------------------------------------------------------------------------

async function fetchSalaryBatch(
  playerIds: number[],
  apiKey: string,
): Promise<Map<number, { salary: number | null; is_two_way: boolean }>> {
  const map = new Map<number, { salary: number | null; is_two_way: boolean }>()

  for (let i = 0; i < playerIds.length; i += 20) {
    const batch = playerIds.slice(i, i + 20)
    const results = await Promise.all(
      batch.map(id =>
        cached(`trade-contract-${id}`, TTL.HALF_DAY, async () => {
          try {
            const res = await fetch(
              `${BASE_URL_NBA}/contracts/players?player_id=${id}&per_page=100`,
              { headers: { Authorization: apiKey } },
            )
            if (!res.ok) return { player_id: id, salary: null as number | null, is_two_way: false }
            const data = await res.json()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const records: any[] = data.data ?? []
            if (!records.length) return { player_id: id, salary: null as number | null, is_two_way: false }
            const current = records.find((r: { season: number }) => r.season === CURRENT_SEASON) ?? records[records.length - 1]
            return {
              player_id: id,
              salary: (current.base_salary ?? current.cap_hit ?? null) as number | null,
              is_two_way: (current.is_two_way ?? false) as boolean,
            }
          } catch {
            return { player_id: id, salary: null as number | null, is_two_way: false }
          }
        }),
      ),
    )
    for (const r of results) map.set(r.player_id, { salary: r.salary, is_two_way: r.is_two_way })
  }
  return map
}

async function fetchAdvancedBatch(
  playerIds: number[],
  season: number,
  apiKey: string,
): Promise<Map<number, number>> {
  const map = new Map<number, number>()

  for (let i = 0; i < playerIds.length; i += 10) {
    const batch = playerIds.slice(i, i + 10)
    const results = await Promise.all(
      batch.map(id =>
        cached(`trade-adv-${id}-${season}`, TTL.MEDIUM, async () => {
          try {
            const res = await fetch(
              `${BASE_URL}/stats/advanced?player_ids[]=${id}&seasons[]=${season}&per_page=100`,
              { headers: { Authorization: apiKey } },
            )
            if (!res.ok) return { id, nr: null as number | null }
            const json = await res.json()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const games: any[] = json.data ?? []
            if (!games.length) return { id, nr: null as number | null }
            const vals = games.map((g: { net_rating?: number }) => g.net_rating).filter((v): v is number => v != null)
            return { id, nr: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null }
          } catch {
            return { id, nr: null as number | null }
          }
        }),
      ),
    )
    for (const r of results) {
      if (r.nr != null) map.set(r.id, r.nr)
    }
  }
  return map
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const teamIdParam = searchParams.get('team_id')

    if (!teamIdParam) {
      return NextResponse.json({ error: 'team_id is required' }, { status: 400 })
    }

    const teamId = parseInt(teamIdParam, 10)
    if (isNaN(teamId)) {
      return NextResponse.json({ error: 'Invalid team_id' }, { status: 400 })
    }

    const data = await cached<TeamRosterResponse>(
      `trade-roster-v5-${teamId}-${CURRENT_SEASON}`,
      TTL.LONG,
      async () => {
        const apiKey = getApiKey()
        const api = getApi()

        // Phase 1: Get team info, standings, and all player candidates in parallel
        const [allTeams, standingsRes, allPlayers] = await Promise.all([
          getTeamsList(),
          cached(`standings-${CURRENT_SEASON}`, TTL.MEDIUM, () =>
            api.nba.getStandings({ season: CURRENT_SEASON }),
          ),
          cached(`team-all-players-${teamId}`, TTL.MEDIUM, () =>
            fetchAllTeamPlayerIds(teamId, apiKey),
          ),
        ])

        // Find team info
        const teamData = allTeams.find(t => t.id === teamId)
        if (!teamData) {
          throw new Error(`Team ${teamId} not found`)
        }

        // Find standings
        const standingsData = standingsRes.data as Array<{ team?: { id: number }; wins?: number; losses?: number; conference_rank?: number }>
        const teamStandings = standingsData.find(s => s.team?.id === teamId)
        const wins = teamStandings?.wins ?? 0
        const losses = teamStandings?.losses ?? 0
        const conference_rank = teamStandings?.conference_rank ?? 0

        // Phase 2: Filter to players who actually played this season
        // This is the expensive step — cache the result for 24h
        const activePlayers = await cached(
          `team-active-roster-${teamId}-${CURRENT_SEASON}`,
          TTL.MEDIUM,
          () => filterToActivePlayers(allPlayers, CURRENT_SEASON, apiKey)
            .then(m => Array.from(m.entries()).map(([id, stats]) => ({ id, ...stats }))),
        )
        const activeMap = new Map(activePlayers.map(p => [p.id, { mpg: p.mpg, games_played: p.games_played }]))
        const activeIds = activePlayers.map(p => p.id)

        // Phase 3: Enrich active players with salaries and advanced stats
        const [salaries, advanced] = await Promise.all([
          fetchSalaryBatch(activeIds, apiKey),
          fetchAdvancedBatch(activeIds, CURRENT_SEASON, apiKey),
        ])

        // Build roster
        const playerLookup = new Map(allPlayers.map(p => [p.id, p]))
        const roster: TradePlayer[] = activeIds
          .map(id => {
            const p = playerLookup.get(id)!
            const stats = activeMap.get(id)!
            const sal = salaries.get(id)

            return {
              player_id: id,
              first_name: p.first_name,
              last_name: p.last_name,
              position: p.position,
              salary: sal?.salary ?? 0,
              is_two_way: sal?.is_two_way ?? false,
              team_id: teamId,
              team_abbreviation: teamData.abbreviation,
              net_rating: advanced.get(id) ?? null,
              minutes_per_game: stats.mpg > 0 ? stats.mpg : null,
              games_played: stats.games_played,
            }
          })
          .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0))

        const totalSalary = roster.reduce((s, p) => s + (p.salary ?? 0), 0)

        return {
          team: {
            id: teamData.id,
            abbreviation: teamData.abbreviation,
            full_name: teamData.full_name,
            conference: teamData.conference,
            division: teamData.division,
          },
          standings: { wins, losses, conference_rank },
          total_salary: totalSalary,
          cap_tier: getCapTier(totalSalary),
          roster,
        }
      },
    )

    return NextResponse.json(data, { headers: cacheHeaders(TTL.LONG) })
  } catch (error) {
    console.error('Trade roster error:', error)
    return NextResponse.json({ error: 'Failed to fetch team roster' }, { status: 500 })
  }
}

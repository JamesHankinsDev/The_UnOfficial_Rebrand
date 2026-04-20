import { NextResponse } from 'next/server'
import { getApiKey, CURRENT_SEASON } from '@/lib/balldontlie'
import { cached, TTL } from '@/lib/api-cache'

const BASE_URL = 'https://api.balldontlie.io/v1'

export interface AdvancedSeasonAverages {
  games_played: number
  pie: number
  true_shooting_percentage: number
  effective_field_goal_percentage: number
  net_rating: number
  offensive_rating: number
  defensive_rating: number
  usage_percentage: number
  assist_to_turnover: number
  assist_percentage: number
  defensive_rebound_percentage: number
  offensive_rebound_percentage: number
  rebound_percentage: number
  turnover_ratio: number
  pace: number
}

export interface PlayerInjury {
  status: string
  description: string
  return_date: string | null
}

export interface AdvancedResponse {
  averages: AdvancedSeasonAverages | null
  injury: PlayerInjury | null
}

function avg(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

async function fetchAdvancedAverages(
  playerId: number,
  season: number,
  apiKey: string,
  postseason = false,
): Promise<AdvancedSeasonAverages | null> {
  const postseasonParam = postseason ? '&postseason=true' : ''
  const res = await fetch(
    `${BASE_URL}/stats/advanced?player_ids[]=${playerId}&seasons[]=${season}&per_page=100${postseasonParam}`,
    { headers: { Authorization: apiKey } },
  )
  if (!res.ok) return null
  const json = await res.json()
  const games: Record<string, number>[] = json.data ?? []
  if (!games.length) return null

  const fields = [
    'pie', 'true_shooting_percentage', 'effective_field_goal_percentage',
    'net_rating', 'offensive_rating', 'defensive_rating', 'usage_percentage',
    'assist_to_turnover', 'assist_percentage', 'defensive_rebound_percentage',
    'offensive_rebound_percentage', 'rebound_percentage', 'turnover_ratio', 'pace',
  ] as const

  const result: Partial<AdvancedSeasonAverages> = { games_played: games.length }
  for (const field of fields) {
    const vals = games.map(g => g[field]).filter((v): v is number => v != null)
    result[field] = vals.length ? avg(vals) : 0
  }

  return result as AdvancedSeasonAverages
}

async function fetchInjuryStatus(
  playerId: number,
  apiKey: string,
): Promise<PlayerInjury | null> {
  const res = await fetch(
    `${BASE_URL}/player_injuries?player_ids[]=${playerId}`,
    { headers: { Authorization: apiKey } },
  )
  if (!res.ok) return null
  const json = await res.json()
  const record = json.data?.[0]
  if (!record) return null
  return {
    status: record.status ?? 'Unknown',
    description: record.description ?? '',
    return_date: record.return_date ?? null,
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const playerId = parseInt(id, 10)
    if (isNaN(playerId)) {
      return NextResponse.json({ error: 'Invalid player ID' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const season = parseInt(searchParams.get('season') || String(CURRENT_SEASON), 10)
    const postseason = searchParams.get('postseason') === 'true'
    const apiKey = getApiKey()

    const [averages, injury] = await Promise.all([
      cached(
        `advanced-avg-${playerId}-${season}${postseason ? '-ps' : ''}`,
        TTL.MEDIUM,
        () => fetchAdvancedAverages(playerId, season, apiKey, postseason),
      ),
      cached(`injury-${playerId}`, TTL.SHORT, () =>
        fetchInjuryStatus(playerId, apiKey),
      ),
    ])

    return NextResponse.json({ averages, injury } satisfies AdvancedResponse)
  } catch (error) {
    console.error('Advanced stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch advanced stats' }, { status: 500 })
  }
}

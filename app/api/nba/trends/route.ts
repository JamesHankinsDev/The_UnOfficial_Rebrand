import { NextResponse } from 'next/server'
import { CURRENT_SEASON } from '@/lib/constants'
import { cached, TTL } from '@/lib/api-cache'

const STATS_TO_CHECK = ['pts', 'reb', 'ast', 'stl', 'blk', 'pra', 'stocks'] as const
const DEVIATION_THRESHOLD = 15 // percent

interface GridPlayer {
  player_id: number
  first_name: string
  last_name: string
  position: string
  team_abbreviation: string
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  pra: number
  stocks: number
}

interface TrendDeviation {
  stat: string
  season_avg: number
  recent_avg: number
  pct_change: number
  direction: 'up' | 'down'
}

interface TrendPlayer {
  player_id: number
  first_name: string
  last_name: string
  team_abbreviation: string
  position: string
  deviations: TrendDeviation[]
  max_deviation: number
}

async function computeTrends(season: number, baseUrl: string, postseason = false) {
  const ps = postseason ? '&postseason=true' : ''
  const [seasonRes, recentRes] = await Promise.all([
    fetch(`${baseUrl}/api/nba/players/grid?season=${season}&period=season${ps}`),
    fetch(`${baseUrl}/api/nba/players/grid?season=${season}&period=last5${ps}`),
  ])

  if (!seasonRes.ok || !recentRes.ok) throw new Error('Failed to fetch grid data')

  const seasonData: GridPlayer[] = await seasonRes.json()
  const recentData: GridPlayer[] = await recentRes.json()

  // Index season data by player_id
  const seasonMap = new Map<number, GridPlayer>()
  for (const p of seasonData) seasonMap.set(p.player_id, p)

  const trendingUp: TrendPlayer[] = []
  const trendingDown: TrendPlayer[] = []

  for (const recent of recentData) {
    const season_p = seasonMap.get(recent.player_id)
    if (!season_p) continue

    const deviations: TrendDeviation[] = []

    for (const stat of STATS_TO_CHECK) {
      const seasonVal = season_p[stat]
      const recentVal = recent[stat]
      if (seasonVal === 0) continue // avoid division by zero

      const pctChange = Math.round(((recentVal - seasonVal) / seasonVal) * 1000) / 10

      if (Math.abs(pctChange) >= DEVIATION_THRESHOLD) {
        deviations.push({
          stat,
          season_avg: seasonVal,
          recent_avg: recentVal,
          pct_change: pctChange,
          direction: pctChange > 0 ? 'up' : 'down',
        })
      }
    }

    if (deviations.length === 0) continue

    const maxPositive = Math.max(...deviations.filter(d => d.direction === 'up').map(d => d.pct_change), 0)
    const maxNegative = Math.min(...deviations.filter(d => d.direction === 'down').map(d => d.pct_change), 0)

    const player: TrendPlayer = {
      player_id: recent.player_id,
      first_name: recent.first_name,
      last_name: recent.last_name,
      team_abbreviation: recent.team_abbreviation,
      position: recent.position,
      deviations,
      max_deviation: 0,
    }

    if (maxPositive > 0) {
      trendingUp.push({ ...player, max_deviation: maxPositive })
    }
    if (maxNegative < 0) {
      trendingDown.push({ ...player, max_deviation: maxNegative })
    }
  }

  trendingUp.sort((a, b) => b.max_deviation - a.max_deviation)
  trendingDown.sort((a, b) => a.max_deviation - b.max_deviation)

  return {
    trending_up: trendingUp.slice(0, 10),
    trending_down: trendingDown.slice(0, 10),
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const season = parseInt(searchParams.get('season') || String(CURRENT_SEASON), 10)
    const postseason = searchParams.get('postseason') === 'true'
    const baseUrl = new URL(request.url).origin

    const today = new Date().toISOString().split('T')[0]
    const cacheKey = postseason
      ? `trends-ps-${season}-${today}`
      : `trends-${season}`
    const ttl = postseason ? TTL.LIVE : TTL.SHORT
    const trends = await cached(cacheKey, ttl, () =>
      computeTrends(season, baseUrl, postseason),
    )
    return NextResponse.json(trends)
  } catch (error) {
    console.error('Trends error:', error)
    return NextResponse.json({ error: 'Failed to compute trends' }, { status: 500 })
  }
}

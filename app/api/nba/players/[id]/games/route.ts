import { NextResponse } from 'next/server'
import { getApiKey, CURRENT_SEASON } from '@/lib/balldontlie'
import { cached, TTL } from '@/lib/api-cache'

const BASE_URL = 'https://api.balldontlie.io/v1'

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0] // YYYY-MM-DD
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const playerId = parseInt(id, 10)
    if (isNaN(playerId)) {
      return NextResponse.json({ error: 'Invalid player ID' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const season = parseInt(searchParams.get('season') || String(CURRENT_SEASON), 10)

    // Fetch the most recent games by using date range (last 45 days)
    // This avoids the pagination issue where page 1 only has early-season games
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 45)

    const cacheKey = `player-games-${playerId}-${season}-${formatDate(endDate)}`

    const games = await cached(cacheKey, TTL.SHORT, async () => {
      const apiKey = getApiKey()
      const url = new URL(`${BASE_URL}/stats`)
      url.searchParams.set('player_ids[]', String(playerId))
      url.searchParams.set('seasons[]', String(season))
      url.searchParams.set('start_date', formatDate(startDate))
      url.searchParams.set('end_date', formatDate(endDate))
      url.searchParams.set('per_page', '25')

      const res = await fetch(url.toString(), {
        headers: { Authorization: apiKey },
      })
      if (!res.ok) throw new Error(`Stats API returned ${res.status}`)
      const json = await res.json()
      return json.data ?? json
    })

    const gameList = Array.isArray(games) ? games : []

    // Sort by game date descending (most recent first)
    const sorted = [...gameList].sort(
      (a, b) => new Date(b.game.date).getTime() - new Date(a.game.date).getTime()
    )

    return NextResponse.json(sorted)
  } catch (error) {
    console.error('Player games error:', error)
    return NextResponse.json({ error: 'Failed to fetch player games' }, { status: 500 })
  }
}

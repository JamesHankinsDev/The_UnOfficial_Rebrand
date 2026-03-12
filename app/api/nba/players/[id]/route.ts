import { NextResponse } from 'next/server'
import { getApi, CURRENT_SEASON } from '@/lib/balldontlie'
import { cached, TTL } from '@/lib/api-cache'

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

    const api = getApi()
    const [playerRes, averagesRes] = await Promise.all([
      cached(`player-${playerId}`, TTL.LONG, () =>
        api.nba.getPlayer(playerId)
      ),
      cached(`season-avg-${playerId}-${season}`, TTL.MEDIUM, () =>
        api.nba.getSeasonAverages({ season, player_id: playerId })
      ),
    ])

    // SDK may return { data: ... } wrapper or the object directly
    const player = playerRes?.data ?? playerRes
    if (!player || (typeof player === 'object' && 'error' in player)) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    const seasonAverages = Array.isArray(averagesRes?.data)
      ? averagesRes.data
      : Array.isArray(averagesRes)
        ? averagesRes
        : []

    return NextResponse.json({ player, seasonAverages })
  } catch (error) {
    console.error('Player detail error:', error)
    return NextResponse.json({ error: 'Failed to fetch player' }, { status: 500 })
  }
}

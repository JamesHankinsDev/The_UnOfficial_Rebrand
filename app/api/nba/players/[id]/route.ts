import { NextResponse } from 'next/server'
import { getApi } from '@/lib/balldontlie'

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
    const season = parseInt(searchParams.get('season') || '2024', 10)

    const api = getApi()
    const [playerRes, averagesRes] = await Promise.all([
      api.nba.getPlayer(playerId),
      api.nba.getSeasonAverages({ season, player_id: playerId }),
    ])

    return NextResponse.json({
      player: playerRes.data,
      seasonAverages: averagesRes.data,
    })
  } catch (error) {
    console.error('Player detail error:', error)
    return NextResponse.json({ error: 'Failed to fetch player' }, { status: 500 })
  }
}

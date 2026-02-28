import { NextResponse } from 'next/server'
import { getApi, CURRENT_SEASON } from '@/lib/balldontlie'
import { cached, TTL } from '@/lib/api-cache'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ids = searchParams.get('ids')
    const season = parseInt(searchParams.get('season') || String(CURRENT_SEASON), 10)

    if (!ids) {
      return NextResponse.json({ error: 'ids query param required (comma-separated)' }, { status: 400 })
    }

    const playerIds = ids.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id))
    if (playerIds.length !== 2) {
      return NextResponse.json({ error: 'Exactly 2 player IDs required' }, { status: 400 })
    }

    const api = getApi()
    const [player1Res, player2Res, avg1Res, avg2Res] = await Promise.all([
      cached(`player-${playerIds[0]}`, TTL.LONG, () =>
        api.nba.getPlayer(playerIds[0])
      ),
      cached(`player-${playerIds[1]}`, TTL.LONG, () =>
        api.nba.getPlayer(playerIds[1])
      ),
      cached(`season-avg-${playerIds[0]}-${season}`, TTL.MEDIUM, () =>
        api.nba.getSeasonAverages({ season, player_id: playerIds[0] })
      ),
      cached(`season-avg-${playerIds[1]}-${season}`, TTL.MEDIUM, () =>
        api.nba.getSeasonAverages({ season, player_id: playerIds[1] })
      ),
    ])

    return NextResponse.json({
      players: [player1Res.data, player2Res.data],
      averages: [avg1Res.data, avg2Res.data],
    })
  } catch (error) {
    console.error('Compare error:', error)
    return NextResponse.json({ error: 'Failed to compare players' }, { status: 500 })
  }
}

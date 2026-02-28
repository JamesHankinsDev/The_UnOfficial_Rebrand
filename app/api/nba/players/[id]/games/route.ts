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
    const res = await api.nba.getStats({
      player_ids: [playerId],
      seasons: [season],
      per_page: 25,
    })

    // Sort by game date descending (most recent first)
    const sorted = res.data.sort(
      (a, b) => new Date(b.game.date).getTime() - new Date(a.game.date).getTime()
    )

    return NextResponse.json(sorted)
  } catch (error) {
    console.error('Player games error:', error)
    return NextResponse.json({ error: 'Failed to fetch player games' }, { status: 500 })
  }
}

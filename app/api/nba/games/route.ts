import { NextResponse } from 'next/server'
import { getApi } from '@/lib/balldontlie'
import { cached, TTL } from '@/lib/api-cache'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!start || !end) {
      return NextResponse.json({ error: 'start and end dates required' }, { status: 400 })
    }

    const api = getApi()
    const res = await cached(`games-${start}-${end}`, TTL.SHORT, () =>
      api.nba.getGames({
        start_date: start,
        end_date: end,
        per_page: 100,
      })
    )

    return NextResponse.json(res.data)
  } catch (error) {
    console.error('Games error:', error)
    return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 })
  }
}

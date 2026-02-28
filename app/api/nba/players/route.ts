import { NextResponse } from 'next/server'
import { getApi } from '@/lib/balldontlie'
import { cached, TTL } from '@/lib/api-cache'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    if (!search) {
      return NextResponse.json({ error: 'search query required' }, { status: 400 })
    }

    const api = getApi()
    const res = await cached(`players-search-${search.toLowerCase()}`, TTL.SHORT, () =>
      api.nba.getPlayers({ search, per_page: 15 })
    )

    return NextResponse.json(res.data)
  } catch (error) {
    console.error('Players search error:', error)
    return NextResponse.json({ error: 'Failed to search players' }, { status: 500 })
  }
}

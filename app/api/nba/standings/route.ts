import { NextResponse } from 'next/server'
import { getApi } from '@/lib/balldontlie'
import { cached, TTL } from '@/lib/api-cache'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const season = parseInt(searchParams.get('season') || '2024', 10)

    const api = getApi()
    const res = await cached(`standings-${season}`, TTL.MEDIUM, () =>
      api.nba.getStandings({ season })
    )

    return NextResponse.json(res.data)
  } catch (error) {
    console.error('Standings error:', error)
    return NextResponse.json({ error: 'Failed to fetch standings' }, { status: 500 })
  }
}

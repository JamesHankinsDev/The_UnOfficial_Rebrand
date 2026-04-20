import { NextResponse } from 'next/server'
import { cacheHeaders, TTL } from '@/lib/api-cache'
import { getActivePlayerIndex } from '@/lib/nba-persons'

export async function GET() {
  try {
    const index = await getActivePlayerIndex()
    return NextResponse.json(index, { headers: cacheHeaders(TTL.DAY) })
  } catch (err) {
    console.error('Active players error:', err)
    return NextResponse.json({ error: 'Failed to fetch active players' }, { status: 500 })
  }
}

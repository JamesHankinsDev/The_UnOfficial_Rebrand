import { NextResponse } from 'next/server'
import { expandValuePlay } from '@/lib/generators/valueMealBrief'
import type { ValuePlay } from '@/lib/firestore'

export const runtime = 'nodejs'
export const maxDuration = 120

function isSignedIn(request: Request): boolean {
  // Match the existing middleware's presence-based __session cookie check.
  // Phase 1 — lax but consistent with the rest of the dashboard.
  const cookie = request.headers.get('cookie') ?? ''
  return /(?:^|;\s*)__session=[^;]/.test(cookie)
}

function isValuePlay(v: unknown): v is ValuePlay {
  if (!v || typeof v !== 'object') return false
  const p = v as Record<string, unknown>
  return (
    typeof p.playerId === 'number' &&
    typeof p.playerName === 'string' &&
    typeof p.team === 'string' &&
    typeof p.pra === 'number' &&
    typeof p.contextNote === 'string'
  )
}

export async function POST(request: Request) {
  if (!isSignedIn(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const play = body?.play
    const surroundingContext: string = body?.surroundingContext ?? ''
    if (!isValuePlay(play)) {
      return NextResponse.json({ error: 'Invalid play payload' }, { status: 400 })
    }

    const text = await expandValuePlay(play, surroundingContext)
    return NextResponse.json({ text })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[generate-brief/expand] failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

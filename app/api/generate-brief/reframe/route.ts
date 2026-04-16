import { NextResponse } from 'next/server'
import { reframePlays } from '@/lib/generators/shared'
import type { ValuePlay } from '@/lib/firestore'

export const runtime = 'nodejs'
export const maxDuration = 120

function isSignedIn(request: Request): boolean {
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
    const plays: unknown[] = body?.plays
    const narrativeHook: string = body?.narrativeHook ?? ''

    if (!Array.isArray(plays) || plays.length < 3 || plays.length > 5) {
      return NextResponse.json(
        { error: 'Select 3-5 players to reframe' },
        { status: 400 },
      )
    }

    if (!plays.every(isValuePlay)) {
      return NextResponse.json({ error: 'Invalid play payload' }, { status: 400 })
    }

    const text = await reframePlays(plays as ValuePlay[], narrativeHook)
    return NextResponse.json({ text })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[generate-brief/reframe] failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

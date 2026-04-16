import { NextResponse } from 'next/server'
import { getWeeklyPlayerSnapshots } from '@/lib/balldontlie'
import { generateValueMealBrief } from '@/lib/generators/valueMealBrief'
import { saveBrief } from '@/lib/briefs-server'

export const runtime = 'nodejs'
// Claude + web search + 40 contract fetches can exceed the default 10s limit.
export const maxDuration = 300

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization')
  return header === `Bearer ${secret}`
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const snapshots = await getWeeklyPlayerSnapshots()
    if (snapshots.length === 0) {
      return NextResponse.json(
        { error: 'No player snapshots available — nothing to brief' },
        { status: 500 },
      )
    }

    const content = await generateValueMealBrief(snapshots)
    const id = await saveBrief({
      day: 'monday',
      articleType: 'value_meal',
      content,
    })

    return NextResponse.json({ ok: true, id, playerCount: snapshots.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[generate-brief] failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Allow Vercel's cron invoker to use GET as well (it retries on both verbs).
export async function GET(request: Request) {
  return POST(request)
}

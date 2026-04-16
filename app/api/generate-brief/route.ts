import { NextResponse } from 'next/server'
import { getWeeklyPlayerSnapshots } from '@/lib/balldontlie'
import { generateValueMealBrief } from '@/lib/generators/valueMealBrief'
import { generateMixTapeBrief } from '@/lib/generators/mixTapeBrief'
import { generateResidueBrief } from '@/lib/generators/residueBrief'
import { generatePicksPopsBrief } from '@/lib/generators/picksPopsBrief'
import { saveBrief } from '@/lib/briefs-server'
import type { BriefArticleType, BriefDay, BriefContent } from '@/lib/firestore'

export const runtime = 'nodejs'
// Claude + web search + contract fetches can exceed the default 10s limit.
export const maxDuration = 300

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization')
  return header === `Bearer ${secret}`
}

const TYPE_TO_DAY: Record<BriefArticleType, BriefDay> = {
  value_meal: 'monday',
  mix_tape: 'wednesday',
  residue: 'friday',
  picks_pops_rolls: 'friday',
}

const GENERATORS: Record<
  BriefArticleType,
  (snapshots: Awaited<ReturnType<typeof getWeeklyPlayerSnapshots>>) => Promise<BriefContent>
> = {
  value_meal: generateValueMealBrief,
  mix_tape: generateMixTapeBrief,
  residue: generateResidueBrief,
  picks_pops_rolls: generatePicksPopsBrief,
}

/**
 * Determine the default article type based on the current day.
 * Monday → value_meal, Wednesday → mix_tape
 * Friday → picks_pops_rolls if first Friday of the month, otherwise residue
 */
function defaultArticleType(): BriefArticleType {
  const now = new Date()
  const etDay = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
  })
    .format(now)
    .toLowerCase()

  if (etDay === 'monday') return 'value_meal'
  if (etDay === 'wednesday') return 'mix_tape'
  if (etDay === 'friday') {
    // First Friday of the month → picks_pops_rolls
    const etDate = parseInt(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        day: 'numeric',
      }).format(now),
      10,
    )
    return etDate <= 7 ? 'picks_pops_rolls' : 'residue'
  }
  return 'value_meal'
}

async function handleGenerate(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const typeParam = searchParams.get('type') as BriefArticleType | null
    const articleType: BriefArticleType =
      typeParam && typeParam in GENERATORS ? typeParam : defaultArticleType()

    const snapshots = await getWeeklyPlayerSnapshots()
    if (snapshots.length === 0) {
      return NextResponse.json(
        { error: 'No player snapshots available — nothing to brief' },
        { status: 500 },
      )
    }

    const generate = GENERATORS[articleType]
    const content = await generate(snapshots)
    const id = await saveBrief({
      day: TYPE_TO_DAY[articleType],
      articleType,
      content,
    })

    return NextResponse.json({ ok: true, id, articleType, playerCount: snapshots.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[generate-brief] failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return handleGenerate(request)
}

export async function GET(request: Request) {
  return handleGenerate(request)
}

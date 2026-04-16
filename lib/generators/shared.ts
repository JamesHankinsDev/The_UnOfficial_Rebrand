import Anthropic from '@anthropic-ai/sdk'
import type { PlayerSnapshot } from '../balldontlie'
import type { BriefContent, ValuePlay } from '../firestore'

const MODEL = 'claude-haiku-4-5'
const EXPAND_MODEL = 'claude-haiku-4-5'
const MAX_TOKENS = 8000
const MAX_CONTINUATIONS = 4

export function jsonSchemaInstruction(
  opts?: { minPlays?: number; maxPlays?: number },
): string {
  const min = opts?.minPlays ?? 3
  const max = opts?.maxPlays ?? 5
  return `Return your analysis strictly as a JSON object wrapped in a \`\`\`json fenced code block, matching this shape:

{
  "narrativeHook": "string — the punchy opening line or two",
  "topValuePlays": [
    {
      "playerId": number,
      "playerName": "string",
      "team": "string (3-letter abbr)",
      "pra": number,
      "capPct": number | null,
      "salary": number | null,
      "contextNote": "string — 1-2 sentences on WHY this player is featured"
    }
  ],
  "dataAnomalies": [
    "string — each item is a short note about something statistically weird or worth flagging"
  ],
  "injuryContext": "string — a short paragraph summarizing who's out and how it changes the picture",
  "tweetableBlurbs": [
    "string — a tweet-length (≤280 chars) teaser the writer could post to promote the article. Punchy, opinionated, designed to spark engagement."
  ]
}

Rules:
- topValuePlays must contain ${min}-${max} items, sorted best pick first.
- tweetableBlurbs must contain 3-5 items. Each must be ≤280 characters. Write them as if tweeting from The UnOfficial's account — hot takes, stat drops, or provocative questions that make people click.
- playerId must match an id from the input data exactly — do not invent IDs.
- Do not include players currently ruled out for the upcoming week.
- Do not output anything outside the fenced JSON block.`
}

/** @deprecated Use jsonSchemaInstruction() instead */
export const JSON_SCHEMA_INSTRUCTION = jsonSchemaInstruction()

export function buildSnapshotPayload(snapshots: PlayerSnapshot[]): string {
  return JSON.stringify(
    snapshots.map((p) => ({
      playerId: p.playerId,
      name: p.fullName,
      team: p.team,
      position: p.position,
      games: p.games,
      mpg: p.mpg,
      ppg: p.ppg,
      rpg: p.rpg,
      apg: p.apg,
      pra: p.pra,
      salary: p.salary,
      capPct: p.capPct != null ? Number(p.capPct.toFixed(4)) : null,
    })),
    null,
    2,
  )
}

export function extractJson(text: string): unknown {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i)
  const raw = fenceMatch ? fenceMatch[1] : text
  return JSON.parse(raw.trim())
}

export function validateBrief(
  raw: unknown,
  snapshots: PlayerSnapshot[],
  opts?: { minPlays?: number; maxPlays?: number },
): BriefContent {
  const minPlays = opts?.minPlays ?? 1
  const maxPlays = opts?.maxPlays ?? Infinity

  if (!raw || typeof raw !== 'object') {
    throw new Error('Brief response was not a JSON object')
  }
  const r = raw as Record<string, unknown>
  if (typeof r.narrativeHook !== 'string') {
    throw new Error('Brief missing narrativeHook')
  }
  if (!Array.isArray(r.topValuePlays) || r.topValuePlays.length < minPlays) {
    throw new Error(`Brief needs at least ${minPlays} topValuePlays`)
  }
  if (r.topValuePlays.length > maxPlays) {
    throw new Error(`Brief exceeds ${maxPlays} topValuePlays`)
  }
  if (!Array.isArray(r.dataAnomalies)) {
    throw new Error('Brief missing dataAnomalies')
  }
  if (typeof r.injuryContext !== 'string') {
    throw new Error('Brief missing injuryContext')
  }

  const byId = new Map(snapshots.map((s) => [s.playerId, s]))

  const topValuePlays: ValuePlay[] = (
    r.topValuePlays as Array<Record<string, unknown>>
  ).map((p, i) => {
    if (!p || typeof p !== 'object') {
      throw new Error(`topValuePlays[${i}] is not an object`)
    }
    const source = byId.get(p.playerId as number)
    return {
      playerId: p.playerId as number,
      playerName: (p.playerName as string) ?? source?.fullName ?? 'Unknown',
      team: (p.team as string) ?? source?.team ?? '—',
      pra: typeof p.pra === 'number' ? p.pra : (source?.pra ?? 0),
      capPct: (p.capPct as number | null) ?? source?.capPct ?? null,
      salary: (p.salary as number | null) ?? source?.salary ?? null,
      contextNote: (p.contextNote as string) ?? '',
    }
  })

  const tweetableBlurbs = Array.isArray(r.tweetableBlurbs)
    ? (r.tweetableBlurbs as unknown[]).filter(
        (s): s is string => typeof s === 'string',
      )
    : []

  return {
    narrativeHook: r.narrativeHook as string,
    topValuePlays,
    dataAnomalies: (r.dataAnomalies as unknown[]).filter(
      (s): s is string => typeof s === 'string',
    ),
    injuryContext: r.injuryContext as string,
    tweetableBlurbs,
  }
}

interface GenerateBriefOptions {
  systemPrompt: string
  userMessage: string
  snapshots: PlayerSnapshot[]
  playsRange?: { minPlays?: number; maxPlays?: number }
}

/**
 * Shared generator: calls Claude (no web search — keeps cost low), extracts JSON, validates.
 */
export async function generateBrief(
  opts: GenerateBriefOptions,
): Promise<BriefContent> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: opts.systemPrompt,
    messages: [{ role: 'user', content: opts.userMessage }],
  })

  if (response.stop_reason !== 'end_turn') {
    throw new Error(`Unexpected stop_reason: ${response.stop_reason}`)
  }

  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  )
  const text = textBlocks.map((b) => b.text).join('\n').trim()
  if (!text) {
    throw new Error('Claude returned no text content')
  }

  const parsed = extractJson(text)
  return validateBrief(parsed, opts.snapshots, opts.playsRange)
}

/**
 * Generate a deeper breakdown of a single play, for the "Expand this angle"
 * modal. Used by all brief types.
 */
export async function expandPlay(
  play: ValuePlay,
  surroundingContext: string,
  briefTypeName: string,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const client = new Anthropic({ apiKey })

  const capPctText =
    play.capPct != null
      ? `${(play.capPct * 100).toFixed(2)}% of the cap`
      : 'salary unavailable'

  const response = await client.messages.create({
    model: EXPAND_MODEL,
    max_tokens: MAX_TOKENS,
    system: `You are a writer for The UnOfficial, an NBA newsletter. You are expanding on a ${briefTypeName} angle for the writer's draft. Write in a punchy, specific, barber-shop debate voice.`,
    tools: [{ type: 'web_search_20260209', name: 'web_search', allowed_callers: ['direct'] }],  // kept for expand — single targeted query, low cost
    messages: [
      {
        role: 'user',
        content: `Expand on this angle for the writer's draft. Give 3-4 paragraphs: the hook, the statistical case, the narrative/context (use web_search for recent games, lineup changes, or rotation news), and one sharp closing line the writer can steal.

Player: ${play.playerName} (${play.team})
PRA over the last 7 days: ${play.pra}
Cap footprint: ${capPctText}
Short context: ${play.contextNote}

Broader brief context: ${surroundingContext}

Write prose the writer can paste into a draft. Do not return JSON.`,
      },
    ],
  })

  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  )
  return textBlocks.map((b) => b.text).join('\n\n').trim()
}

/**
 * Reframe a set of selected plays into a cohesive narrative.
 * Used by the Mix Tape "Reframe Selected" feature.
 */
export async function reframePlays(
  plays: ValuePlay[],
  narrativeHook: string,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const client = new Anthropic({ apiKey })

  const playerList = plays
    .map((p, i) => {
      const capText =
        p.capPct != null
          ? `${(p.capPct * 100).toFixed(2)}% of cap`
          : 'salary unavailable'
      return `${i + 1}. ${p.playerName} (${p.team}) — PRA: ${p.pra}, Cap: ${capText} — ${p.contextNote}`
    })
    .join('\n')

  const response = await client.messages.create({
    model: EXPAND_MODEL,
    max_tokens: MAX_TOKENS,
    system: `You are a writer for The UnOfficial, an NBA newsletter. You are helping a writer find the narrative thread that connects a set of players selected for the Wednesday Mix Tape column. Write in a punchy, specific, barber-shop debate voice.`,
    tools: [{ type: 'web_search_20260209', name: 'web_search', allowed_callers: ['direct'] }],
    messages: [
      {
        role: 'user',
        content: `The writer selected these ${plays.length} tracks for this week's Mix Tape. Find the connective tissue — the angle that makes these players belong in the same column.

Look for:
- Historical context: Are any of these players on teams with shared history (trades, rivalries, playoff matchups)?
- League staples vs. newcomers: Is this a "new guard meets old guard" story?
- Team construction parallels: Do any of these players reveal something about how their teams are built?
- MVP / playoff / award implications: Do any of these performances shift a larger race?
- Statistical rhymes: Do any of these stat lines echo each other in an interesting way?
- Scheduling/calendar: Are any of these connected by the same stretch of games?

${playerList}

The brief's original narrative hook was: "${narrativeHook}"

Use web_search to check for any breaking news, recent game recaps, or injury updates that could sharpen the angle.

Write 4-6 paragraphs:
1. The unifying hook — one sentence that frames why these players belong together this week
2-4. The body — weave the players together, don't just go one-by-one. Cross-reference. Compare. Contrast.
5. The sharp closer — one line the writer can steal for the column's ending

Write prose the writer can use as a research foundation. Do not return JSON.`,
      },
    ],
  })

  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  )
  return textBlocks.map((b) => b.text).join('\n\n').trim()
}

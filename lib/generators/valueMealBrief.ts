import Anthropic from '@anthropic-ai/sdk'
import type { PlayerSnapshot } from '../balldontlie'
import type { BriefContent, ValuePlay } from '../firestore'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 8000
const MAX_CONTINUATIONS = 4

const SYSTEM_PROMPT = `You are a Value Meal analyst for The UnOfficial, an NBA newsletter that celebrates players delivering outsized production relative to their contract size.

Your analytical lens:
- "Value" means production per dollar. A rookie-deal star delivering 45 PRA is more valuable than a max-contract vet delivering 50 PRA.
- Surface players whose PRA/CAP% ratio is conspicuously high — especially rookie-scale deals, minimum contracts, and early-career extensions that haven't kicked in yet.
- Look for narrative angles: rookies breaking out, players in contract years, bench guys stealing starter minutes after an injury, trade-bait names quietly cooking.
- Be specific. Name the context. "Has quietly averaged 28 PRA since coach X went to a smaller rotation on Nov 10" beats "is playing well."
- Cross-reference injury reports and transactions — if a valuable producer is out, say so. If someone's value jumped because of a trade or a starter's absence, name it.

Your writing voice for the narrative hook: punchy, confident, barber-shop-debate energy. One or two sentences, no hedging.

You will be given:
1. A JSON payload of the top players from the last 7 days of games, with per-game PRA and CAP% (salary as a fraction of the $154.6M cap). CAP% is null when salary data is unavailable.
2. Access to the web_search tool. Use it to verify the current injury report and transactions from the last 48 hours before finalizing picks.

Return your analysis strictly as a JSON object wrapped in a \`\`\`json fenced code block, matching this shape:

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
      "contextNote": "string — 1-2 sentences on WHY this player is a Value Meal right now"
    }
  ],
  "dataAnomalies": [
    "string — each item is a short note about something statistically weird or worth flagging"
  ],
  "injuryContext": "string — a short paragraph summarizing who's out and how it changes the value picture"
}

Rules:
- topValuePlays must contain 3-5 items, sorted best value first.
- playerId must match an id from the input data exactly — do not invent IDs.
- Do not include players currently ruled out for the upcoming week.
- Do not output anything outside the fenced JSON block.`

function buildUserMessage(snapshots: PlayerSnapshot[]): string {
  const payload = snapshots.map((p) => ({
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
  }))

  const today = new Date().toISOString().split('T')[0]

  return `Today is ${today}.

Here is the last 7 days of NBA player data, already filtered to qualifying rotation players (≥15 MPG, ≥3 GP) and ranked by PRA:

\`\`\`json
${JSON.stringify(payload, null, 2)}
\`\`\`

Use the web_search tool to check:
1. Current NBA injury report — any players in the list above who are now ruled out.
2. Any notable transactions (trades, signings, waivers) from the last 48 hours that affect player value.

Then return the Value Meal brief as specified.`
}

function extractJson(text: string): unknown {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i)
  const raw = fenceMatch ? fenceMatch[1] : text
  return JSON.parse(raw.trim())
}

interface RawValuePlay {
  playerId: number
  playerName: string
  team: string
  pra: number
  capPct: number | null
  salary: number | null
  contextNote: string
}

interface RawBrief {
  narrativeHook: string
  topValuePlays: RawValuePlay[]
  dataAnomalies: string[]
  injuryContext: string
}

function validateBrief(raw: unknown, snapshots: PlayerSnapshot[]): BriefContent {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Brief response was not a JSON object')
  }
  const r = raw as Partial<RawBrief>
  if (typeof r.narrativeHook !== 'string') {
    throw new Error('Brief missing narrativeHook')
  }
  if (!Array.isArray(r.topValuePlays) || r.topValuePlays.length === 0) {
    throw new Error('Brief missing topValuePlays')
  }
  if (!Array.isArray(r.dataAnomalies)) {
    throw new Error('Brief missing dataAnomalies')
  }
  if (typeof r.injuryContext !== 'string') {
    throw new Error('Brief missing injuryContext')
  }

  const byId = new Map(snapshots.map((s) => [s.playerId, s]))

  const topValuePlays: ValuePlay[] = r.topValuePlays.map((p, i) => {
    if (!p || typeof p !== 'object') {
      throw new Error(`topValuePlays[${i}] is not an object`)
    }
    const source = byId.get(p.playerId)
    return {
      playerId: p.playerId,
      playerName: p.playerName ?? source?.fullName ?? 'Unknown',
      team: p.team ?? source?.team ?? '—',
      pra: typeof p.pra === 'number' ? p.pra : (source?.pra ?? 0),
      capPct: p.capPct ?? source?.capPct ?? null,
      salary: p.salary ?? source?.salary ?? null,
      contextNote: p.contextNote ?? '',
    }
  })

  return {
    narrativeHook: r.narrativeHook,
    topValuePlays,
    dataAnomalies: r.dataAnomalies.filter((s): s is string => typeof s === 'string'),
    injuryContext: r.injuryContext,
  }
}

/**
 * Generate the Monday Value Meal brief from a weekly player snapshot.
 * Calls Claude with the web_search tool enabled; parses the JSON response.
 */
export async function generateValueMealBrief(
  snapshots: PlayerSnapshot[],
): Promise<BriefContent> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const client = new Anthropic({ apiKey })

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: buildUserMessage(snapshots) },
  ]

  let response: Anthropic.Message | null = null
  for (let i = 0; i < MAX_CONTINUATIONS; i++) {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools: [{ type: 'web_search_20260209', name: 'web_search' }],
      messages,
    })

    if (response.stop_reason === 'pause_turn') {
      // Server-side tool loop hit its default iteration limit — re-send to resume.
      messages.push({ role: 'assistant', content: response.content })
      continue
    }

    break
  }

  if (!response) {
    throw new Error('Claude returned no response')
  }

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
  return validateBrief(parsed, snapshots)
}

/**
 * Generate a deeper breakdown of a single Value Play, for the "Expand this angle"
 * modal in the writer dashboard.
 */
export async function expandValuePlay(
  play: ValuePlay,
  surroundingContext: string,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const client = new Anthropic({ apiKey })

  const capPctText =
    play.capPct != null ? `${(play.capPct * 100).toFixed(2)}% of the cap` : 'salary unavailable'

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [{ type: 'web_search_20260209', name: 'web_search' }],
    messages: [
      {
        role: 'user',
        content: `Expand on this Value Meal angle for the writer's draft. Give 3-4 paragraphs: the hook, the statistical case, the narrative/context (use web_search for recent games, lineup changes, or rotation news), and one sharp closing line the writer can steal.

Player: ${play.playerName} (${play.team})
PRA over the last 7 days: ${play.pra}
Cap footprint: ${capPctText}
Short context from the weekly brief: ${play.contextNote}

Broader brief context: ${surroundingContext}

Write in The UnOfficial's Value Meal voice — punchy, specific, barber-shop debate. Do not return JSON. Write prose the writer can paste into a draft.`,
      },
    ],
  })

  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  )
  return textBlocks.map((b) => b.text).join('\n\n').trim()
}

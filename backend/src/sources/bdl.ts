const BASE_URL = 'https://api.balldontlie.io/v1'
const FETCH_TIMEOUT_MS = 10_000

export class BdlRateLimitError extends Error {
  readonly retryAfterSeconds: number
  constructor(retryAfter = 30) {
    super('BallDontLie rate limit')
    this.name = 'BdlRateLimitError'
    this.retryAfterSeconds = retryAfter
  }
}

function getApiKey(): string {
  const key = process.env.BALLDONTLIE_API_KEY
  if (!key) {
    throw new Error('BALLDONTLIE_API_KEY not set')
  }
  return key
}

async function bdlFetch(url: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { Authorization: getApiKey() },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (res.status === 429) {
    const header = res.headers.get('retry-after')
    const parsed = header ? parseInt(header, 10) : NaN
    throw new BdlRateLimitError(Number.isFinite(parsed) ? parsed : 30)
  }
  return res
}

export interface RawStatRow {
  id: number
  min: string | null
  pts: number | null
  reb: number | null
  ast: number | null
  stl: number | null
  blk: number | null
  turnover: number | null
  fgm: number | null
  fga: number | null
  fg3m: number | null
  fg3a: number | null
  ftm: number | null
  fta: number | null
  oreb: number | null
  dreb: number | null
  pf: number | null
  player: {
    id: number
    first_name: string
    last_name: string
    position: string
    team_id: number
  }
  team: {
    id: number
    abbreviation: string
    full_name: string
  }
  game: {
    id: number
    date: string
    season: number
    postseason: boolean
    home_team_id: number
    visitor_team_id: number
    home_team_score: number
    visitor_team_score: number
    status: string
  }
}

export interface FetchStatsOptions {
  startDate: string
  endDate: string
  postseason: boolean
  onPage?: (pageIndex: number, rowCount: number) => void
}

/**
 * Fetch all stat rows in a date range, paginating via cursor until exhausted.
 * Caller chooses regular-season vs postseason via the `postseason` flag.
 */
export async function fetchStats(
  opts: FetchStatsOptions,
): Promise<RawStatRow[]> {
  const all: RawStatRow[] = []
  let cursor: number | null = null
  let page = 0

  for (;;) {
    const url = new URL(`${BASE_URL}/stats`)
    url.searchParams.set('start_date', opts.startDate)
    url.searchParams.set('end_date', opts.endDate)
    url.searchParams.set('per_page', '100')
    if (opts.postseason) url.searchParams.set('postseason', 'true')
    if (cursor != null) url.searchParams.set('cursor', String(cursor))

    const res = await bdlFetch(url.toString())
    if (!res.ok) {
      throw new Error(`BDL /stats returned ${res.status} on page ${page}`)
    }
    const json = (await res.json()) as {
      data: RawStatRow[]
      meta: { next_cursor: number | null }
    }
    all.push(...json.data)
    opts.onPage?.(page, json.data.length)

    cursor = json.meta?.next_cursor ?? null
    if (cursor == null) break
    page += 1
  }

  return all
}

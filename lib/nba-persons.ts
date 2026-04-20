import { cached, TTL } from '@/lib/api-cache'
import { CURRENT_SEASON, getApi } from '@/lib/balldontlie'
import { NBA_NAME_ALIASES } from '@/lib/nba-name-aliases'
import seedPersonIds from '@/lib/data/nba-person-ids.json'

const NBA_STATS_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  Referer: 'https://www.nba.com/',
  Accept: 'application/json',
  Origin: 'https://www.nba.com',
} as const

/**
 * Lower-cases and strips diacritics so lookups match across feeds. NBA Stats
 * returns "Nikola Jokić" while BallDontLie returns "Nikola Jokic"; normalizing
 * both through NFD + combining-mark removal makes them collide.
 */
export function normalizePlayerName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * If the given name matches either side of an alias pair, returns the preferred
 * display variant (first element of the tuple). Otherwise returns the input
 * unchanged. Match is case + diacritic insensitive.
 */
export function resolvePreferredName(fullName: string): string {
  const key = normalizePlayerName(fullName)
  for (const [preferred, alt] of NBA_NAME_ALIASES) {
    if (normalizePlayerName(preferred) === key) return preferred
    if (normalizePlayerName(alt) === key) return preferred
  }
  return fullName
}

/** Split a full name into `{ firstName, lastName }` on the first whitespace. */
export function splitFullName(fullName: string): {
  firstName: string
  lastName: string
} {
  const trimmed = fullName.trim()
  const idx = trimmed.indexOf(' ')
  if (idx === -1) return { firstName: trimmed, lastName: '' }
  return {
    firstName: trimmed.slice(0, idx),
    lastName: trimmed.slice(idx + 1),
  }
}

/**
 * Fetches live NBA Stats rows, cached for one day. Throws on any upstream
 * failure so callers can decide whether to fall back.
 */
async function fetchLivePersonRows(): Promise<{ id: number; name: string }[]> {
  return cached<{ id: number; name: string }[]>(
    'nba-person-ids',
    TTL.DAY,
    async () => {
      const seasonStr = `${CURRENT_SEASON}-${String(CURRENT_SEASON + 1).slice(-2)}`
      const res = await fetch(
        `https://stats.nba.com/stats/commonallplayers?LeagueID=00&Season=${seasonStr}&IsOnlyCurrentSeason=1`,
        {
          headers: NBA_STATS_HEADERS,
          signal: AbortSignal.timeout(8000),
        },
      )
      if (!res.ok) throw new Error(`NBA Stats API returned ${res.status}`)
      const json = await res.json()
      const rs = json.resultSets?.[0]
      if (!rs?.headers || !Array.isArray(rs.rowSet)) {
        throw new Error('Unexpected NBA Stats response shape')
      }
      const personIdx: number = rs.headers.indexOf('PERSON_ID')
      const nameIdx: number = rs.headers.indexOf('DISPLAY_FIRST_LAST')
      if (personIdx === -1 || nameIdx === -1) {
        throw new Error('Expected columns missing from NBA Stats response')
      }
      return (rs.rowSet as unknown[][]).map((row) => ({
        id: row[personIdx] as number,
        name: row[nameIdx] as string,
      }))
    },
  )
}

/**
 * Returns a name→personId map, merging a checked-in seed (for reliability
 * when stats.nba.com is unreachable from Vercel) with a best-effort live
 * refresh. Live entries take priority so rookies/trades pick up as soon as
 * NBA Stats is reachable.
 *
 * Refresh the seed by running `node scripts/snapshot-nba-persons.mjs`.
 */
export async function getNbaPersonIdMap(): Promise<Map<string, number>> {
  const map = new Map<string, number>()

  // 1. Start from the checked-in seed — guaranteed baseline.
  for (const [name, id] of Object.entries(seedPersonIds as Record<string, number>)) {
    map.set(name, id)
  }

  // 2. Best-effort live refresh. On failure, log and continue with seed only.
  try {
    const rows = await fetchLivePersonRows()
    for (const { id, name } of rows) {
      map.set(normalizePlayerName(name), id)
    }
  } catch (err) {
    console.warn(
      '[nba-persons] Live fetch failed; using seed only.',
      err instanceof Error ? err.message : err,
    )
  }

  // 3. Register cross-feed aliases. For each pair, if either variant is in
  // the map, copy the id to the other variant too — so lookups succeed
  // regardless of which feed fed us the name.
  for (const [a, b] of NBA_NAME_ALIASES) {
    const na = normalizePlayerName(a)
    const nb = normalizePlayerName(b)
    const existing = map.get(na) ?? map.get(nb)
    if (existing != null) {
      map.set(na, existing)
      map.set(nb, existing)
    }
  }

  return map
}

/** Resolve a single player's NBA person id by name. */
export async function resolveNbaPersonId(
  firstName: string,
  lastName: string,
): Promise<number | null> {
  const map = await getNbaPersonIdMap().catch(() => null)
  if (!map) return null
  return map.get(normalizePlayerName(`${firstName} ${lastName}`)) ?? null
}

export interface NbaPlayerBio {
  nba_id: number
  birth_date: string | null
  age: number | null
  height_in: number | null
  weight_lb: number | null
  country: string | null
  school: string | null
  draft_year: number | null
  draft_round: number | null
  draft_number: number | null
}

/** Fetch bio (including birth date) for one NBA player. Cached for a day. */
export async function getNbaPlayerBio(
  nbaId: number,
): Promise<NbaPlayerBio | null> {
  return cached<NbaPlayerBio | null>(
    `nba-bio-${nbaId}`,
    TTL.DAY,
    async () => {
      const res = await fetch(
        `https://stats.nba.com/stats/commonplayerinfo?PlayerID=${nbaId}`,
        { headers: NBA_STATS_HEADERS },
      )
      if (!res.ok) return null
      const json = await res.json()
      const rs = json.resultSets?.find(
        (r: { name: string }) => r.name === 'CommonPlayerInfo',
      )
      if (!rs) return null
      const row: unknown[] | undefined = rs.rowSet?.[0]
      if (!row) return null
      const headers: string[] = rs.headers
      const get = (key: string) => {
        const i = headers.indexOf(key)
        return i >= 0 ? row[i] : null
      }

      const birthRaw = get('BIRTHDATE') as string | null
      const birth = birthRaw ? birthRaw.split('T')[0] : null
      const age = birth ? calcAge(birth) : null

      const heightStr = get('HEIGHT') as string | null
      const heightIn = parseFeetInches(heightStr)

      const weightStr = get('WEIGHT') as string | null
      const weightLb = weightStr ? parseInt(weightStr, 10) || null : null

      return {
        nba_id: nbaId,
        birth_date: birth,
        age,
        height_in: heightIn,
        weight_lb: weightLb,
        country: (get('COUNTRY') as string | null) ?? null,
        school: (get('SCHOOL') as string | null) ?? null,
        draft_year: toIntOrNull(get('DRAFT_YEAR')),
        draft_round: toIntOrNull(get('DRAFT_ROUND')),
        draft_number: toIntOrNull(get('DRAFT_NUMBER')),
      }
    },
  )
}

function calcAge(isoDate: string): number | null {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}

function parseFeetInches(str: string | null): number | null {
  if (!str) return null
  const m = str.match(/^(\d+)-(\d+)$/)
  if (!m) return null
  return parseInt(m[1], 10) * 12 + parseInt(m[2], 10)
}

function toIntOrNull(v: unknown): number | null {
  if (v == null || v === 'Undrafted') return null
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  return Number.isFinite(n) ? n : null
}

// ── Active-player index (for @-mention / hover-card detection) ─────────────

export interface ActivePlayerRow {
  bl_id: number
  nba_id: number | null
  first_name: string
  last_name: string
  name: string
  team_abbr: string | null
  position: string
}

async function buildActivePlayerIndex(): Promise<ActivePlayerRow[]> {
  const api = getApi()
  const rows: ActivePlayerRow[] = []
  let cursor: number | undefined
  for (let i = 0; i < 30; i++) {
    const res = await api.nba.getActivePlayers({ per_page: 100, cursor })
    for (const p of res.data ?? []) {
      rows.push({
        bl_id: p.id,
        nba_id: null,
        first_name: p.first_name,
        last_name: p.last_name,
        name: `${p.first_name} ${p.last_name}`,
        team_abbr: p.team?.abbreviation ?? null,
        position: p.position ?? '',
      })
    }
    const next = res.meta?.next_cursor
    if (!next) break
    cursor = next
  }

  const nbaMap = await getNbaPersonIdMap().catch(() => null)
  if (nbaMap) {
    for (const r of rows) {
      r.nba_id = nbaMap.get(normalizePlayerName(r.name)) ?? null
    }
  }

  return rows
}

export async function getActivePlayerIndex(): Promise<ActivePlayerRow[]> {
  return cached('players-active-index', TTL.DAY, buildActivePlayerIndex)
}

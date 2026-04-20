import { cached, TTL } from '@/lib/api-cache'
import { CURRENT_SEASON, getApi } from '@/lib/balldontlie'

const NBA_STATS_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  Referer: 'https://www.nba.com/',
  Accept: 'application/json',
  Origin: 'https://www.nba.com',
} as const

/** Fetches a name→personId map from the NBA Stats API. Cached for one day. */
export async function getNbaPersonIdMap(): Promise<Map<string, number>> {
  const rows = await cached<{ id: number; name: string }[]>(
    'nba-person-ids',
    TTL.DAY,
    async () => {
      const seasonStr = `${CURRENT_SEASON}-${String(CURRENT_SEASON + 1).slice(-2)}`
      const res = await fetch(
        `https://stats.nba.com/stats/commonallplayers?LeagueID=00&Season=${seasonStr}&IsOnlyCurrentSeason=1`,
        { headers: NBA_STATS_HEADERS },
      )
      if (!res.ok) throw new Error(`NBA Stats API returned ${res.status}`)
      const json = await res.json()
      const rs = json.resultSets?.[0]
      const personIdx: number = rs.headers.indexOf('PERSON_ID')
      const nameIdx: number = rs.headers.indexOf('DISPLAY_FIRST_LAST')
      return (rs.rowSet as unknown[][]).map((row) => ({
        id: row[personIdx] as number,
        name: row[nameIdx] as string,
      }))
    },
  )

  const map = new Map<string, number>()
  for (const { id, name } of rows) map.set(name.toLowerCase(), id)
  return map
}

/** Resolve a single player's NBA person id by name. */
export async function resolveNbaPersonId(
  firstName: string,
  lastName: string,
): Promise<number | null> {
  const map = await getNbaPersonIdMap().catch(() => null)
  if (!map) return null
  return map.get(`${firstName} ${lastName}`.toLowerCase()) ?? null
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
      r.nba_id = nbaMap.get(r.name.toLowerCase()) ?? null
    }
  }

  return rows
}

export async function getActivePlayerIndex(): Promise<ActivePlayerRow[]> {
  return cached('players-active-index', TTL.DAY, buildActivePlayerIndex)
}

import { NextResponse } from 'next/server'
import { getApi, getApiKey, CURRENT_SEASON } from '@/lib/balldontlie'
import { cached, cacheHeaders, TTL } from '@/lib/api-cache'
import { bdlFetch, rateLimitResponse } from '@/lib/bdl-fetch'
import { resolveNbaPersonId, getNbaPlayerBio } from '@/lib/nba-persons'

const BASE_URL = 'https://api.balldontlie.io/v1'

export interface QuickViewStats {
  games_played: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  fg_pct: number
  fg3_pct: number
}

export interface QuickViewPayload {
  player_id: number
  nba_id: number | null
  first_name: string
  last_name: string
  position: string
  team: { abbreviation: string; full_name: string } | null
  jersey_number: string | null
  age: number | null
  height: string | null
  weight: string | null
  regular_season: QuickViewStats | null
  postseason: QuickViewStats | null
}

interface RawStat {
  min: string
  fgm: number; fga: number; fg_pct: number
  fg3m: number; fg3a: number; fg3_pct: number
  pts: number; reb: number; ast: number; stl: number; blk: number
}

async function aggregatePostseason(
  playerId: number,
  season: number,
): Promise<QuickViewStats | null> {
  const apiKey = getApiKey()
  const all: RawStat[] = []
  let cursor: number | null = null
  for (let i = 0; i < 5; i++) {
    const url = new URL(`${BASE_URL}/stats`)
    url.searchParams.set('player_ids[]', String(playerId))
    url.searchParams.set('seasons[]', String(season))
    url.searchParams.set('postseason', 'true')
    url.searchParams.set('per_page', '100')
    if (cursor != null) url.searchParams.set('cursor', String(cursor))
    const res = await bdlFetch(url.toString(), apiKey)
    if (!res.ok) break
    const json = await res.json()
    all.push(...((json.data ?? []) as RawStat[]))
    cursor = json.meta?.next_cursor ?? null
    if (cursor == null) break
  }
  const games = all.length
  if (games === 0) return null
  const totals = all.reduce((acc, s) => ({
    pts: acc.pts + (s.pts ?? 0),
    reb: acc.reb + (s.reb ?? 0),
    ast: acc.ast + (s.ast ?? 0),
    stl: acc.stl + (s.stl ?? 0),
    blk: acc.blk + (s.blk ?? 0),
    fgm: acc.fgm + (s.fgm ?? 0),
    fga: acc.fga + (s.fga ?? 0),
    fg3m: acc.fg3m + (s.fg3m ?? 0),
    fg3a: acc.fg3a + (s.fg3a ?? 0),
  }), { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0 })
  return {
    games_played: games,
    pts: totals.pts / games,
    reb: totals.reb / games,
    ast: totals.ast / games,
    stl: totals.stl / games,
    blk: totals.blk / games,
    fg_pct: totals.fga > 0 ? totals.fgm / totals.fga : 0,
    fg3_pct: totals.fg3a > 0 ? totals.fg3m / totals.fg3a : 0,
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const playerId = parseInt(id, 10)
    if (isNaN(playerId)) {
      return NextResponse.json({ error: 'Invalid player ID' }, { status: 400 })
    }

    const season = CURRENT_SEASON
    const api = getApi()

    const [playerRes, rsAvgRes, psAvg] = await Promise.all([
      cached(`player-${playerId}`, TTL.LONG, () => api.nba.getPlayer(playerId)),
      cached(`season-avg-${playerId}-${season}`, TTL.MEDIUM, () =>
        api.nba.getSeasonAverages({ season, player_id: playerId }),
      ).catch(() => null),
      cached(`quick-view-ps-${playerId}-${season}`, TTL.SHORT, () =>
        aggregatePostseason(playerId, season),
      ).catch(() => null),
    ])

    const player = playerRes?.data ?? playerRes
    if (!player || (typeof player === 'object' && 'error' in player)) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }
    const p = player as {
      id: number; first_name: string; last_name: string; position: string
      height: string; weight: string; jersey_number: string
      team?: { abbreviation: string; full_name: string }
    }

    const rsArr = Array.isArray(rsAvgRes)
      ? rsAvgRes
      : (rsAvgRes && typeof rsAvgRes === 'object' && 'data' in rsAvgRes
          ? (rsAvgRes as { data: unknown[] }).data
          : [])
    const rsRaw = (rsArr[0] ?? null) as (QuickViewStats & { games_played: number }) | null
    const regularSeason: QuickViewStats | null = rsRaw
      ? {
          games_played: rsRaw.games_played ?? 0,
          pts: rsRaw.pts ?? 0,
          reb: rsRaw.reb ?? 0,
          ast: rsRaw.ast ?? 0,
          stl: rsRaw.stl ?? 0,
          blk: rsRaw.blk ?? 0,
          fg_pct: rsRaw.fg_pct ?? 0,
          fg3_pct: rsRaw.fg3_pct ?? 0,
        }
      : null

    const nbaId = await resolveNbaPersonId(p.first_name, p.last_name).catch(() => null)
    const bio = nbaId ? await getNbaPlayerBio(nbaId).catch(() => null) : null

    const payload: QuickViewPayload = {
      player_id: p.id,
      nba_id: nbaId,
      first_name: p.first_name,
      last_name: p.last_name,
      position: p.position ?? '',
      team: p.team
        ? { abbreviation: p.team.abbreviation, full_name: p.team.full_name }
        : null,
      jersey_number: p.jersey_number ?? null,
      age: bio?.age ?? null,
      height: p.height ?? null,
      weight: p.weight ?? null,
      regular_season: regularSeason,
      postseason: psAvg,
    }

    return NextResponse.json(payload, { headers: cacheHeaders(TTL.SHORT) })
  } catch (err) {
    const rateLimit = rateLimitResponse(err)
    if (rateLimit) return rateLimit
    console.error('Quick-view error:', err)
    return NextResponse.json({ error: 'Failed to fetch quick view' }, { status: 500 })
  }
}

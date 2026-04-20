import { NextResponse } from 'next/server'
import { getApi, getApiKey, CURRENT_SEASON } from '@/lib/balldontlie'
import { cached, TTL } from '@/lib/api-cache'
import { resolveNbaPersonId, getNbaPlayerBio } from '@/lib/nba-persons'

const BASE_URL = 'https://api.balldontlie.io/v1'

interface RawStat {
  min: string
  fgm: number; fga: number; fg_pct: number
  fg3m: number; fg3a: number; fg3_pct: number
  ftm: number; fta: number; ft_pct: number
  oreb: number; dreb: number; reb: number
  ast: number; stl: number; blk: number
  turnover: number; pts: number
}

function parseMin(min: string | null | undefined): number {
  if (!min) return 0
  const parts = min.split(':')
  if (parts.length === 2) return parseInt(parts[0], 10) + parseInt(parts[1], 10) / 60
  return parseFloat(min) || 0
}

async function computePostseasonAverages(playerId: number, season: number) {
  const apiKey = getApiKey()
  const all: RawStat[] = []
  let cursor: number | null = null
  for (let i = 0; i < 10; i++) {
    const url = new URL(`${BASE_URL}/stats`)
    url.searchParams.set('player_ids[]', String(playerId))
    url.searchParams.set('seasons[]', String(season))
    url.searchParams.set('postseason', 'true')
    url.searchParams.set('per_page', '100')
    if (cursor != null) url.searchParams.set('cursor', String(cursor))
    const res = await fetch(url.toString(), { headers: { Authorization: apiKey } })
    if (!res.ok) break
    const json = await res.json()
    all.push(...((json.data ?? []) as RawStat[]))
    cursor = json.meta?.next_cursor ?? null
    if (cursor == null) break
  }
  const games = all.length
  if (games === 0) return { data: [] }

  const totals = all.reduce((acc, s) => ({
    min: acc.min + parseMin(s.min),
    fgm: acc.fgm + (s.fgm ?? 0), fga: acc.fga + (s.fga ?? 0),
    fg3m: acc.fg3m + (s.fg3m ?? 0), fg3a: acc.fg3a + (s.fg3a ?? 0),
    ftm: acc.ftm + (s.ftm ?? 0), fta: acc.fta + (s.fta ?? 0),
    oreb: acc.oreb + (s.oreb ?? 0), dreb: acc.dreb + (s.dreb ?? 0),
    reb: acc.reb + (s.reb ?? 0), ast: acc.ast + (s.ast ?? 0),
    stl: acc.stl + (s.stl ?? 0), blk: acc.blk + (s.blk ?? 0),
    turnover: acc.turnover + (s.turnover ?? 0), pts: acc.pts + (s.pts ?? 0),
  }), {
    min: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0,
    oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, turnover: 0, pts: 0,
  })
  const pct = (n: number, d: number) => (d > 0 ? n / d : 0)
  const minutes = totals.min / games
  const minsStr = `${Math.floor(minutes)}:${String(Math.round((minutes % 1) * 60)).padStart(2, '0')}`
  return {
    data: [{
      games_played: games,
      pts: totals.pts / games,
      ast: totals.ast / games,
      reb: totals.reb / games,
      stl: totals.stl / games,
      blk: totals.blk / games,
      turnover: totals.turnover / games,
      min: minsStr,
      fgm: totals.fgm / games,
      fga: totals.fga / games,
      fg_pct: pct(totals.fgm, totals.fga),
      fg3m: totals.fg3m / games,
      fg3a: totals.fg3a / games,
      fg3_pct: pct(totals.fg3m, totals.fg3a),
      ftm: totals.ftm / games,
      fta: totals.fta / games,
      ft_pct: pct(totals.ftm, totals.fta),
      oreb: totals.oreb / games,
      dreb: totals.dreb / games,
      player_id: playerId,
      season,
    }],
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ids = searchParams.get('ids')
    const season = parseInt(searchParams.get('season') || String(CURRENT_SEASON), 10)
    const postseason = searchParams.get('postseason') === 'true'

    if (!ids) {
      return NextResponse.json({ error: 'ids query param required (comma-separated)' }, { status: 400 })
    }

    const playerIds = ids.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id))
    if (playerIds.length !== 2) {
      return NextResponse.json({ error: 'Exactly 2 player IDs required' }, { status: 400 })
    }

    const api = getApi()
    const fetchAvg = (pid: number) => {
      if (postseason) {
        return cached(`season-avg-ps-${pid}-${season}`, TTL.SHORT, () =>
          computePostseasonAverages(pid, season),
        )
      }
      return cached(`season-avg-${pid}-${season}`, TTL.MEDIUM, () =>
        api.nba.getSeasonAverages({ season, player_id: pid }),
      )
    }

    const [player1Res, player2Res, avg1Res, avg2Res] = await Promise.all([
      cached(`player-${playerIds[0]}`, TTL.LONG, () =>
        api.nba.getPlayer(playerIds[0])
      ),
      cached(`player-${playerIds[1]}`, TTL.LONG, () =>
        api.nba.getPlayer(playerIds[1])
      ),
      fetchAvg(playerIds[0]),
      fetchAvg(playerIds[1]),
    ])

    const resolveBio = async (p: { first_name?: string; last_name?: string } | null) => {
      if (!p?.first_name || !p?.last_name) return { nba_id: null, bio: null }
      const nbaId = await resolveNbaPersonId(p.first_name, p.last_name).catch(() => null)
      const bio = nbaId ? await getNbaPlayerBio(nbaId).catch(() => null) : null
      return { nba_id: nbaId, bio }
    }

    const [bio1, bio2] = await Promise.all([
      resolveBio(player1Res.data),
      resolveBio(player2Res.data),
    ])

    return NextResponse.json({
      players: [player1Res.data, player2Res.data],
      averages: [avg1Res.data, avg2Res.data],
      nba_ids: [bio1.nba_id, bio2.nba_id],
      bios: [bio1.bio, bio2.bio],
    })
  } catch (error) {
    console.error('Compare error:', error)
    return NextResponse.json({ error: 'Failed to compare players' }, { status: 500 })
  }
}

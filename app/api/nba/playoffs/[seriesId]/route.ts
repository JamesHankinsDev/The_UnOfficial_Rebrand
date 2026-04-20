import { NextRequest, NextResponse } from 'next/server'
import type { NBAGame, NBATeam, NBAStats } from '@balldontlie/sdk'
import { getApi, CURRENT_SEASON } from '@/lib/balldontlie'
import { cached, cacheHeaders, TTL } from '@/lib/api-cache'

export interface SeriesGameRow {
  id: number
  date: string
  status: string
  isFinal: boolean
  home_team: NBATeam
  visitor_team: NBATeam
  home_team_score: number
  visitor_team_score: number
  winner: 'home' | 'visitor' | null
}

export interface SeriesLeaderRow {
  playerId: number
  name: string
  teamAbbr: string
  teamId: number
  games: number
  total: number
  perGame: number
}

export interface SeriesDetailPayload {
  seriesId: string
  teamA: NBATeam
  teamB: NBATeam
  winsA: number
  winsB: number
  status: 'active' | 'completed'
  winner: 'A' | 'B' | null
  round: number
  games: SeriesGameRow[]
  leaders: {
    pts: SeriesLeaderRow[]
    reb: SeriesLeaderRow[]
    ast: SeriesLeaderRow[]
  }
}

async function fetchAllPostseasonGames(season: number): Promise<NBAGame[]> {
  const api = getApi()
  const all: NBAGame[] = []
  let cursor: number | undefined
  for (let i = 0; i < 10; i++) {
    const res = await api.nba.getGames({
      seasons: [season],
      postseason: true,
      per_page: 100,
      cursor,
    })
    all.push(...(res.data ?? []))
    const next = res.meta?.next_cursor
    if (!next) break
    cursor = next
  }
  return all
}

async function fetchStatsForGames(gameIds: number[]): Promise<NBAStats[]> {
  if (gameIds.length === 0) return []
  const api = getApi()
  const all: NBAStats[] = []
  let cursor: number | undefined
  for (let i = 0; i < 20; i++) {
    const res = await api.nba.getStats({
      game_ids: gameIds,
      per_page: 100,
      postseason: true,
      cursor,
    })
    all.push(...(res.data ?? []))
    const next = res.meta?.next_cursor
    if (!next) break
    cursor = next
  }
  return all
}

function parsePairKey(raw: string): [number, number] | null {
  const parts = raw.split('-').map(Number)
  if (parts.length !== 2) return null
  if (!Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null
  const lo = Math.min(parts[0], parts[1])
  const hi = Math.max(parts[0], parts[1])
  return [lo, hi]
}

function buildLeaders(
  stats: NBAStats[],
  key: 'pts' | 'reb' | 'ast',
): SeriesLeaderRow[] {
  const agg = new Map<number, SeriesLeaderRow>()
  for (const s of stats) {
    const pid = s.player.id
    const existing = agg.get(pid)
    const delta = (s[key] as number | undefined) ?? 0
    if (existing) {
      existing.total += delta
      existing.games += 1
    } else {
      agg.set(pid, {
        playerId: pid,
        name: `${s.player.first_name} ${s.player.last_name}`,
        teamAbbr: s.team?.abbreviation ?? '—',
        teamId: s.team?.id ?? 0,
        games: 1,
        total: delta,
        perGame: 0,
      })
    }
  }
  return Array.from(agg.values())
    .map((r) => ({
      ...r,
      perGame: r.games > 0 ? r.total / r.games : 0,
    }))
    .sort((a, b) => b.perGame - a.perGame)
    .slice(0, 5)
    .map((r) => ({
      ...r,
      total: Math.round(r.total * 10) / 10,
      perGame: Math.round(r.perGame * 10) / 10,
    }))
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ seriesId: string }> },
) {
  try {
    const { seriesId } = await ctx.params
    const pair = parsePairKey(seriesId)
    if (!pair) {
      return NextResponse.json({ error: 'Invalid series id' }, { status: 400 })
    }
    const [idLo, idHi] = pair

    const allGames = await cached(
      `playoffs-games-${CURRENT_SEASON}`,
      TTL.SHORT,
      () => fetchAllPostseasonGames(CURRENT_SEASON),
    )

    const seriesGames = allGames
      .filter(
        (g) =>
          (g.home_team.id === idLo && g.visitor_team.id === idHi) ||
          (g.home_team.id === idHi && g.visitor_team.id === idLo),
      )
      .sort((a, b) => a.date.localeCompare(b.date))

    if (seriesGames.length === 0) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 })
    }

    const first = seriesGames[0]
    const teamA = first.home_team.id === idLo ? first.home_team : first.visitor_team
    const teamB = first.home_team.id === idHi ? first.home_team : first.visitor_team

    let winsA = 0
    let winsB = 0
    for (const g of seriesGames) {
      const isFinal = typeof g.status === 'string' && g.status.toLowerCase().includes('final')
      if (!isFinal) continue
      const aIsHome = g.home_team.id === teamA.id
      const aScore = aIsHome ? g.home_team_score : g.visitor_team_score
      const bScore = aIsHome ? g.visitor_team_score : g.home_team_score
      if (aScore > bScore) winsA++
      else if (bScore > aScore) winsB++
    }

    // Round = number of distinct opponents either team has played so far
    const priorSeriesCount = (teamId: number) => {
      const opponents = new Set<number>()
      for (const g of allGames) {
        if (g.home_team.id === teamId) opponents.add(g.visitor_team.id)
        else if (g.visitor_team.id === teamId) opponents.add(g.home_team.id)
      }
      return opponents.size
    }
    const round = Math.max(priorSeriesCount(teamA.id), priorSeriesCount(teamB.id), 1)

    const gameIds = seriesGames.map((g) => g.id)
    const stats = await cached(
      `playoffs-stats-${CURRENT_SEASON}-${idLo}-${idHi}`,
      TTL.SHORT,
      () => fetchStatsForGames(gameIds),
    )

    const leaders = {
      pts: buildLeaders(stats, 'pts'),
      reb: buildLeaders(stats, 'reb'),
      ast: buildLeaders(stats, 'ast'),
    }

    const completed = winsA === 4 || winsB === 4

    const gameRows: SeriesGameRow[] = seriesGames.map((g) => {
      const isFinal = typeof g.status === 'string' && g.status.toLowerCase().includes('final')
      let winner: SeriesGameRow['winner'] = null
      if (isFinal) {
        if (g.home_team_score > g.visitor_team_score) winner = 'home'
        else if (g.visitor_team_score > g.home_team_score) winner = 'visitor'
      }
      return {
        id: g.id,
        date: g.date,
        status: g.status,
        isFinal,
        home_team: g.home_team,
        visitor_team: g.visitor_team,
        home_team_score: g.home_team_score,
        visitor_team_score: g.visitor_team_score,
        winner,
      }
    })

    const payload: SeriesDetailPayload = {
      seriesId: `${idLo}-${idHi}`,
      teamA,
      teamB,
      winsA,
      winsB,
      status: completed ? 'completed' : 'active',
      winner: completed ? (winsA === 4 ? 'A' : 'B') : null,
      round,
      games: gameRows,
      leaders,
    }

    return NextResponse.json(payload, { headers: cacheHeaders(TTL.SHORT) })
  } catch (err) {
    console.error('Series detail error:', err)
    return NextResponse.json({ error: 'Failed to fetch series' }, { status: 500 })
  }
}

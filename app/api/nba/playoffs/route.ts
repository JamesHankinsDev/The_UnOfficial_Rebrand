import { NextResponse } from 'next/server'
import type { NBAGame, NBATeam } from '@balldontlie/sdk'
import { getApi, CURRENT_SEASON } from '@/lib/balldontlie'
import { cached, cacheHeaders, TTL } from '@/lib/api-cache'

export interface PlayoffSeriesDTO {
  id: string
  round: number
  conference: 'East' | 'West' | 'Finals'
  teamA: NBATeam
  teamB: NBATeam
  winsA: number
  winsB: number
  status: 'active' | 'completed'
  winner: 'A' | 'B' | null
  firstGameDate: string
  lastGameDate: string
  totalGames: number
}

export interface PlayoffsPayload {
  season: number
  series: PlayoffSeriesDTO[]
  updatedAt: string
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

async function fetchAllPostseasonGames(season: number): Promise<NBAGame[]> {
  const api = getApi()
  const all: NBAGame[] = []
  let cursor: number | undefined
  // Cap pagination to a safe number of pages to avoid runaway loops.
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

export async function GET() {
  try {
    const games = await cached(
      `playoffs-games-${CURRENT_SEASON}`,
      TTL.SHORT,
      () => fetchAllPostseasonGames(CURRENT_SEASON),
    )

    const bucket = new Map<string, { teamA: NBATeam; teamB: NBATeam; games: NBAGame[] }>()
    for (const g of games) {
      const key = pairKey(g.home_team.id, g.visitor_team.id)
      const existing = bucket.get(key)
      if (existing) {
        existing.games.push(g)
      } else {
        bucket.set(key, { teamA: g.home_team, teamB: g.visitor_team, games: [g] })
      }
    }

    interface RawSeries {
      key: string
      teamA: NBATeam
      teamB: NBATeam
      winsA: number
      winsB: number
      games: NBAGame[]
      firstGameDate: string
      lastGameDate: string
    }

    const raw: RawSeries[] = []
    for (const [key, entry] of bucket) {
      const gs = entry.games.slice().sort((a, b) => a.date.localeCompare(b.date))
      let winsA = 0
      let winsB = 0
      for (const g of gs) {
        const isFinal = typeof g.status === 'string' && g.status.toLowerCase().includes('final')
        if (!isFinal) continue
        const aIsHome = g.home_team.id === entry.teamA.id
        const aScore = aIsHome ? g.home_team_score : g.visitor_team_score
        const bScore = aIsHome ? g.visitor_team_score : g.home_team_score
        if (aScore > bScore) winsA++
        else if (bScore > aScore) winsB++
      }
      raw.push({
        key,
        teamA: entry.teamA,
        teamB: entry.teamB,
        winsA,
        winsB,
        games: gs,
        firstGameDate: gs[0]?.date ?? '',
        lastGameDate: gs[gs.length - 1]?.date ?? '',
      })
    }

    // Round = 1 + count of this team's prior series (by first-game date)
    const teamSeries = new Map<number, RawSeries[]>()
    for (const s of raw) {
      for (const tid of [s.teamA.id, s.teamB.id]) {
        const arr = teamSeries.get(tid) ?? []
        arr.push(s)
        teamSeries.set(tid, arr)
      }
    }
    for (const arr of teamSeries.values()) {
      arr.sort((a, b) => a.firstGameDate.localeCompare(b.firstGameDate))
    }

    const series: PlayoffSeriesDTO[] = raw.map((s) => {
      const rA = (teamSeries.get(s.teamA.id) ?? []).findIndex((x) => x.key === s.key) + 1
      const rB = (teamSeries.get(s.teamB.id) ?? []).findIndex((x) => x.key === s.key) + 1
      const round = Math.max(rA, rB, 1)
      const sameConf = s.teamA.conference === s.teamB.conference
      const conference: PlayoffSeriesDTO['conference'] = sameConf
        ? (s.teamA.conference as 'East' | 'West')
        : 'Finals'
      const completed = s.winsA === 4 || s.winsB === 4
      return {
        id: s.key,
        round,
        conference,
        teamA: s.teamA,
        teamB: s.teamB,
        winsA: s.winsA,
        winsB: s.winsB,
        status: completed ? 'completed' : 'active',
        winner: completed ? (s.winsA === 4 ? 'A' : 'B') : null,
        firstGameDate: s.firstGameDate,
        lastGameDate: s.lastGameDate,
        totalGames: s.games.length,
      }
    })

    series.sort((a, b) => a.firstGameDate.localeCompare(b.firstGameDate))

    const payload: PlayoffsPayload = {
      season: CURRENT_SEASON,
      series,
      updatedAt: new Date().toISOString(),
    }

    return NextResponse.json(payload, { headers: cacheHeaders(TTL.SHORT) })
  } catch (err) {
    console.error('Playoffs error:', err)
    return NextResponse.json({ error: 'Failed to fetch playoffs' }, { status: 500 })
  }
}

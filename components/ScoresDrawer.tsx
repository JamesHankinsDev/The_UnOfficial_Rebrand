'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { formatGameStatus, isGameLive, localDateString, parseLocalDate } from '@/lib/utils'

interface GameDoc {
  gameId: number
  gameDate: string
  season: number
  postseason: boolean
  status: string
  period: number
  time: string | null
  homeTeam: { id: number; abbr: string; fullName: string }
  visitorTeam: { id: number; abbr: string; fullName: string }
  homeScore: number
  visitorScore: number
}

function weekRange(offset: number): { monday: Date; sunday: Date } {
  const now = new Date()
  const dow = now.getDay() // 0 = Sun, 1 = Mon
  const daysSinceMonday = (dow + 6) % 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - daysSinceMonday + offset * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { monday, sunday }
}

function formatWeekLabel(monday: Date, sunday: Date): string {
  const sameMonth = monday.getMonth() === sunday.getMonth()
  const m = monday.toLocaleDateString('en-US', { month: 'short' })
  const s = sunday.toLocaleDateString('en-US', { month: 'short' })
  if (sameMonth) return `${m} ${monday.getDate()}–${sunday.getDate()}`
  return `${m} ${monday.getDate()} – ${s} ${sunday.getDate()}`
}

function formatDayHeader(date: Date, isToday: boolean): string {
  if (isToday) return 'Today'
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

export function ScoresDrawer() {
  const [open, setOpen] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [games, setGames] = useState<GameDoc[]>([])

  const { monday, sunday } = useMemo(() => weekRange(weekOffset), [weekOffset])
  const startDate = useMemo(() => localDateString(monday), [monday])
  const endDate = useMemo(() => localDateString(sunday), [sunday])
  const today = useMemo(() => localDateString(new Date()), [])

  // Live Firestore subscription for the selected week. Each cadence tick
  // from the Railway poller surfaces here automatically — no polling.
  useEffect(() => {
    const q = query(
      collection(db, 'games'),
      where('gameDate', '>=', startDate),
      where('gameDate', '<=', endDate),
      orderBy('gameDate'),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: GameDoc[] = []
        for (const doc of snap.docs) rows.push(doc.data() as GameDoc)
        setGames(rows)
      },
      (err) => {
        console.warn('[scores] snapshot error:', err)
      },
    )
    return unsub
  }, [startDate, endDate])

  const liveCount = games.filter((g) => isGameLive(g.status)).length

  // Group games by gameDate for day-by-day rendering.
  const byDay = useMemo(() => {
    const groups = new Map<string, GameDoc[]>()
    for (const g of games) {
      const list = groups.get(g.gameDate) ?? []
      list.push(g)
      groups.set(g.gameDate, list)
    }
    // Emit Mon → Sun even when a day has no games, so the layout is
    // stable and users can see "no games" rather than a gap.
    const days: { dateStr: string; date: Date; games: GameDoc[] }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const dateStr = localDateString(d)
      days.push({ dateStr, date: d, games: groups.get(dateStr) ?? [] })
    }
    return days
  }, [games, monday])

  const totalGames = games.length
  if (totalGames === 0 && weekOffset === 0) {
    // No current-week data yet (cold start). Hide the toggle rather than
    // render an empty drawer; it reappears as soon as the poller writes.
    return null
  }

  const weekLabel =
    weekOffset === 0 ? 'This Week' : formatWeekLabel(monday, sunday)

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-50 bg-[#111118] border border-r-0 border-[#1e1e2a] rounded-l-lg px-1.5 py-4 flex flex-col items-center gap-1.5 hover:bg-[#1e1e2a] transition-colors"
        style={{ writingMode: 'vertical-rl' }}
      >
        <span className="font-mono text-[10px] font-bold text-[#fbbf24] tracking-widest uppercase">
          Scores
        </span>
        {liveCount > 0 && (
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        )}
      </button>

      <div
        className={`fixed top-0 right-0 h-full w-80 z-40 bg-[#0a0a0f] border-l border-[#1e1e2a] transform transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        } overflow-y-auto`}
        aria-hidden={!open}
      >
        <div className="sticky top-0 bg-[#0a0a0f] border-b border-[#1e1e2a] px-4 py-3 flex items-center justify-between z-10">
          <h2 className="font-mono text-sm font-bold text-[#e8e6e3] tracking-wide">
            Scoreboard
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="font-mono text-[#5a5a64] hover:text-[#e8e6e3] text-lg transition-colors"
            aria-label="Close scoreboard"
          >
            &times;
          </button>
        </div>

        {/* Week navigation */}
        <div className="sticky top-[49px] bg-[#0a0a0f] border-b border-[#1e1e2a] px-4 py-2.5 flex items-center justify-between z-10">
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            className="font-mono text-[#8a8a94] hover:text-[#fbbf24] transition-colors text-sm px-2 py-1"
            aria-label="Previous week"
          >
            ◀
          </button>
          <div className="flex flex-col items-center">
            <span className="font-mono text-[10px] text-[#5a5a64] tracking-widest uppercase">
              {weekLabel}
            </span>
            <span className="font-mono text-[9px] text-[#3a3a44]">
              {formatWeekLabel(monday, sunday)}
            </span>
          </div>
          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            className="font-mono text-[#8a8a94] hover:text-[#fbbf24] transition-colors text-sm px-2 py-1"
            aria-label="Next week"
          >
            ▶
          </button>
        </div>

        <div className="px-4 py-4">
          {byDay.map(({ dateStr, date, games: dayGames }) => {
            const isToday = dateStr === today
            return (
              <div key={dateStr} className="mb-5">
                <h3
                  className={`font-mono text-[10px] font-bold tracking-widest uppercase mb-2 ${
                    isToday ? 'text-[#fbbf24]' : 'text-[#5a5a64]'
                  }`}
                >
                  {formatDayHeader(parseLocalDate(dateStr) ?? date, isToday)}
                </h3>
                {dayGames.length === 0 ? (
                  <p className="font-mono text-xs text-[#3a3a44]">No games</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {dayGames.map((g) => (
                      <GameCard key={g.gameId} game={g} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  )
}

function GameCard({ game }: { game: GameDoc }) {
  const live = isGameLive(game.status)
  const final = game.status === 'Final'
  const homeWon = final && game.homeScore > game.visitorScore
  const visitorWon = final && game.visitorScore > game.homeScore
  const hasScore = game.homeScore + game.visitorScore > 0

  return (
    <div
      className={`rounded-lg border p-3 ${
        live
          ? 'border-green-500/40 bg-green-500/5'
          : 'border-[#1e1e2a] bg-[#111118]'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className={`font-mono text-[10px] font-bold tracking-wide ${
            live ? 'text-green-400' : 'text-[#5a5a64]'
          }`}
        >
          {live && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse mr-1.5 align-middle" />
          )}
          {formatGameStatus(game.status)}
        </span>
        {game.postseason && (
          <span className="font-mono text-[9px] tracking-widest text-[#fbbf24] uppercase">
            Playoffs
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span
            className={`font-mono text-sm ${
              visitorWon ? 'text-[#e8e6e3] font-bold' : 'text-[#8a8a94]'
            }`}
          >
            {game.visitorTeam.abbr}
          </span>
          <span
            className={`font-mono text-sm tabular-nums ${
              visitorWon ? 'text-[#e8e6e3] font-bold' : 'text-[#8a8a94]'
            }`}
          >
            {hasScore ? game.visitorScore : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span
            className={`font-mono text-sm ${
              homeWon ? 'text-[#e8e6e3] font-bold' : 'text-[#8a8a94]'
            }`}
          >
            {game.homeTeam.abbr}
          </span>
          <span
            className={`font-mono text-sm tabular-nums ${
              homeWon ? 'text-[#e8e6e3] font-bold' : 'text-[#8a8a94]'
            }`}
          >
            {hasScore ? game.homeScore : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}

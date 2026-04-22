'use client'

import { useEffect, useState, useCallback } from 'react'

interface Game {
  id: number
  date: string
  status: string
  home_team: { abbreviation: string }
  visitor_team: { abbreviation: string }
  home_team_score: number
  visitor_team_score: number
}

function fmt(d: Date): string {
  return d.toISOString().split('T')[0]
}

function isLive(status: string): boolean {
  return status !== 'Final' && status !== '' && !/^\d{4}/.test(status)
}

function formatStatus(status: string): string {
  if (status === 'Final') return 'FINAL'
  if (status === '' || /^\d{1,2}:\d{2}/.test(status)) return status || 'TBD'
  return status
}

export function ScoresDrawer() {
  const [open, setOpen] = useState(false)
  const [todayGames, setTodayGames] = useState<Game[]>([])
  const [yesterdayGames, setYesterdayGames] = useState<Game[]>([])
  const [hasLive, setHasLive] = useState(false)

  const fetchGames = useCallback(async () => {
    try {
      const today = new Date()
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const [todayRes, yesterdayRes] = await Promise.all([
        fetch(`/api/nba/games?start=${fmt(today)}&end=${fmt(today)}`),
        fetch(`/api/nba/games?start=${fmt(yesterday)}&end=${fmt(yesterday)}`),
      ])

      if (todayRes.ok) {
        const data: Game[] = await todayRes.json()
        setTodayGames(data)
        setHasLive(data.some(g => isLive(g.status)))
      }
      if (yesterdayRes.ok) {
        setYesterdayGames(await yesterdayRes.json())
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchGames()
  }, [fetchGames])

  // Poll every 60s when games are live
  useEffect(() => {
    if (!hasLive) return
    const interval = setInterval(fetchGames, 60_000)
    return () => clearInterval(interval)
  }, [hasLive, fetchGames])

  const totalGames = todayGames.length + yesterdayGames.length
  if (totalGames === 0) return null

  const liveCount = todayGames.filter(g => isLive(g.status)).length

  return (
    <>
      {/* Toggle tab — fixed to right edge */}
      <button
        onClick={() => setOpen(o => !o)}
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

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 z-40 bg-[#0a0a0f] border-l border-[#1e1e2a] transform transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        } overflow-y-auto`}
        aria-hidden={!open}
      >
        <div className="sticky top-0 bg-[#0a0a0f] border-b border-[#1e1e2a] px-4 py-3 flex items-center justify-between">
          <h2 className="font-mono text-sm font-bold text-[#e8e6e3] tracking-wide">
            Scoreboard
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="font-mono text-[#5a5a64] hover:text-[#e8e6e3] text-lg transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Today's games */}
        <div className="px-4 pt-4 pb-2">
          <h3 className="font-mono text-[10px] font-bold text-[#fbbf24] tracking-widest uppercase mb-3">
            Today
          </h3>
          {todayGames.length === 0 ? (
            <p className="font-mono text-xs text-[#3a3a44]">No games scheduled</p>
          ) : (
            <div className="flex flex-col gap-2">
              {todayGames.map(g => (
                <GameCard key={g.id} game={g} />
              ))}
            </div>
          )}
        </div>

        <div className="mx-4 h-px bg-[#1e1e2a]" />

        {/* Yesterday's games */}
        <div className="px-4 pt-4 pb-6">
          <h3 className="font-mono text-[10px] font-bold text-[#5a5a64] tracking-widest uppercase mb-3">
            Yesterday
          </h3>
          {yesterdayGames.length === 0 ? (
            <p className="font-mono text-xs text-[#3a3a44]">No games</p>
          ) : (
            <div className="flex flex-col gap-2">
              {yesterdayGames.map(g => (
                <GameCard key={g.id} game={g} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  )
}

function GameCard({ game }: { game: Game }) {
  const live = isLive(game.status)
  const final = game.status === 'Final'
  const homeWon = final && game.home_team_score > game.visitor_team_score
  const visitorWon = final && game.visitor_team_score > game.home_team_score

  return (
    <div className={`rounded-lg border p-3 ${
      live
        ? 'border-green-500/40 bg-green-500/5'
        : 'border-[#1e1e2a] bg-[#111118]'
    }`}>
      {/* Status bar */}
      <div className="flex items-center justify-between mb-2">
        <span className={`font-mono text-[10px] font-bold tracking-wide ${
          live ? 'text-green-400' : 'text-[#5a5a64]'
        }`}>
          {live && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse mr-1.5 align-middle" />}
          {formatStatus(game.status)}
        </span>
      </div>

      {/* Teams & scores */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className={`font-mono text-sm ${
            visitorWon ? 'text-[#e8e6e3] font-bold' : 'text-[#8a8a94]'
          }`}>
            {game.visitor_team.abbreviation}
          </span>
          <span className={`font-mono text-sm tabular-nums ${
            visitorWon ? 'text-[#e8e6e3] font-bold' : 'text-[#8a8a94]'
          }`}>
            {game.home_team_score + game.visitor_team_score > 0 ? game.visitor_team_score : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`font-mono text-sm ${
            homeWon ? 'text-[#e8e6e3] font-bold' : 'text-[#8a8a94]'
          }`}>
            {game.home_team.abbreviation}
          </span>
          <span className={`font-mono text-sm tabular-nums ${
            homeWon ? 'text-[#e8e6e3] font-bold' : 'text-[#8a8a94]'
          }`}>
            {game.home_team_score + game.visitor_team_score > 0 ? game.home_team_score : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}

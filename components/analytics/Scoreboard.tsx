'use client'

import React, { useEffect, useState } from 'react'

interface Game {
  id: number
  date: string
  season: number
  status: string
  period: number
  time: string
  postseason: boolean
  home_team_score: number
  visitor_team_score: number
  home_team: {
    id: number
    abbreviation: string
    full_name: string
    city: string
    name: string
  }
  visitor_team: {
    id: number
    abbreviation: string
    full_name: string
    city: string
    name: string
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function Scoreboard() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 3)

    const fmt = (d: Date) => d.toISOString().split('T')[0]

    fetch(`/api/nba/games?start=${fmt(start)}&end=${fmt(end)}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load')
        return res.json()
      })
      .then(data => {
        setGames(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load recent games')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="font-mono text-sm text-[#5a5a64] animate-pulse">Loading scores...</span>
      </div>
    )
  }

  if (error) {
    return <div className="font-mono text-sm text-red-400 text-center py-8">{error}</div>
  }

  if (games.length === 0) {
    return (
      <div className="font-mono text-sm text-[#5a5a64] text-center py-8">
        No recent games found
      </div>
    )
  }

  // Group games by date
  const grouped = games.reduce<Record<string, Game[]>>((acc, game) => {
    const date = game.date.split('T')[0]
    if (!acc[date]) acc[date] = []
    acc[date].push(game)
    return acc
  }, {})

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-6">
      {sortedDates.map(date => (
        <div key={date}>
          <h4 className="font-mono text-xs text-[#5a5a64] uppercase tracking-wider mb-3">
            {formatDate(date)}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {grouped[date].map(game => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function GameCard({ game }: { game: Game }) {
  const homeWon = game.home_team_score > game.visitor_team_score
  const isFinal = game.status === 'Final'

  return (
    <div className="border border-[#1e1e2a] rounded-xl p-4 bg-[#111118] hover:border-[#3a3a44] transition-colors">
      {/* Status badge */}
      <div className="flex justify-between items-center mb-3">
        <span className={`font-mono text-xs px-2 py-0.5 rounded ${
          isFinal
            ? 'bg-[#1e1e2a] text-[#8a8a94]'
            : 'bg-emerald-500/20 text-emerald-400'
        }`}>
          {game.status}
        </span>
        {game.postseason && (
          <span className="font-mono text-xs text-[#fbbf24]">Playoffs</span>
        )}
      </div>

      {/* Teams & scores */}
      <div className="space-y-2">
        <div className={`flex items-center justify-between ${isFinal && !homeWon ? 'opacity-60' : ''}`}>
          <span className="font-mono text-sm font-bold text-[#e8e6e3] truncate mr-2">
            {game.visitor_team.abbreviation}
          </span>
          <span className="font-mono text-sm font-bold text-[#e8e6e3]">
            {game.visitor_team_score}
          </span>
        </div>
        <div className={`flex items-center justify-between ${isFinal && homeWon ? '' : isFinal ? 'opacity-60' : ''}`}>
          <span className="font-mono text-sm font-bold text-[#e8e6e3] truncate mr-2">
            {game.home_team.abbreviation}
          </span>
          <span className="font-mono text-sm font-bold text-[#e8e6e3]">
            {game.home_team_score}
          </span>
        </div>
      </div>
    </div>
  )
}

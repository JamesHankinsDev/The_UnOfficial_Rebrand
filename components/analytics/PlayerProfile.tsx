'use client'

import React, { useEffect, useState } from 'react'
import { PointsTrendChart } from './StatChart'

interface PlayerData {
  id: number
  first_name: string
  last_name: string
  position: string
  height: string
  weight: string
  jersey_number: string
  college: string
  country: string
  draft_year: number
  draft_round: number
  draft_number: number
  team: {
    full_name: string
    abbreviation: string
    conference: string
    division: string
  }
}

interface SeasonAvg {
  games_played: number
  pts: number
  ast: number
  reb: number
  stl: number
  blk: number
  turnover: number
  min: string
  fgm: number
  fga: number
  fg_pct: number
  fg3m: number
  fg3a: number
  fg3_pct: number
  ftm: number
  fta: number
  ft_pct: number
  oreb: number
  dreb: number
}

interface GameStat {
  id: number
  min: string
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  turnover: number
  fgm: number
  fga: number
  fg_pct: number
  fg3m: number
  fg3a: number
  fg3_pct: number
  ftm: number
  fta: number
  ft_pct: number
  pf: number
  game: {
    id: number
    date: string
    home_team: { abbreviation: string }
    visitor_team: { abbreviation: string }
    home_team_score: number
    visitor_team_score: number
  }
  team: { abbreviation: string }
}

interface PlayerProfileProps {
  playerId: number
  season: number
  onBack: () => void
}

export function PlayerProfile({ playerId, season, onBack }: PlayerProfileProps) {
  const [player, setPlayer] = useState<PlayerData | null>(null)
  const [averages, setAverages] = useState<SeasonAvg[]>([])
  const [games, setGames] = useState<GameStat[]>([])
  const [loading, setLoading] = useState(true)
  const [gamesLoading, setGamesLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setGamesLoading(true)

    fetch(`/api/nba/players/${playerId}?season=${season}`)
      .then(res => res.json())
      .then(data => {
        setPlayer(data.player)
        setAverages(data.seasonAverages || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))

    fetch(`/api/nba/players/${playerId}/games?season=${season}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setGames(data.slice(0, 10))
        setGamesLoading(false)
      })
      .catch(() => setGamesLoading(false))
  }, [playerId, season])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="font-mono text-sm text-[#5a5a64] animate-pulse">Loading player...</span>
      </div>
    )
  }

  if (!player) {
    return <div className="font-mono text-sm text-red-400 text-center py-8">Player not found</div>
  }

  const avg = averages[0]

  // Build points trend from game log (reversed so oldest first)
  const trendData = [...games].reverse().map(g => ({
    label: new Date(g.game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: g.pts,
  }))

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBack}
        className="font-mono text-xs text-[#8a8a94] hover:text-[#fbbf24] transition-colors mb-4 flex items-center gap-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to search
      </button>

      {/* Player header */}
      <div className="border border-[#1e1e2a] rounded-xl p-5 mb-6 bg-[#111118]">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#1e1e2a] flex items-center justify-center flex-shrink-0">
            <span className="font-mono text-xl font-bold text-[#fbbf24]">
              {player.jersey_number || '#'}
            </span>
          </div>
          <div className="flex-1">
            <h2 className="font-mono font-bold text-[#e8e6e3] text-xl sm:text-2xl">
              {player.first_name} {player.last_name}
            </h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
              <span className="font-mono text-sm text-[#8a8a94]">
                {player.team.full_name}
              </span>
              <span className="font-mono text-sm text-[#5a5a64]">
                {player.position || '—'}
              </span>
              {player.height && (
                <span className="font-mono text-sm text-[#5a5a64]">{player.height}</span>
              )}
              {player.weight && (
                <span className="font-mono text-sm text-[#5a5a64]">{player.weight} lbs</span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
              {player.college && (
                <span className="font-mono text-xs text-[#5a5a64]">{player.college}</span>
              )}
              {player.draft_year && (
                <span className="font-mono text-xs text-[#5a5a64]">
                  {player.draft_year} Draft — Rd {player.draft_round}, Pick {player.draft_number}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Season averages */}
      {avg ? (
        <div className="border border-[#1e1e2a] rounded-xl p-5 mb-6">
          <h3 className="font-mono font-bold text-[#fbbf24] text-sm mb-4">
            {season}-{(season + 1).toString().slice(-2)} Season Averages
            <span className="text-[#5a5a64] font-normal ml-2">({avg.games_played} GP)</span>
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-4">
            <StatBadge label="PTS" value={avg.pts.toFixed(1)} highlight />
            <StatBadge label="REB" value={avg.reb.toFixed(1)} />
            <StatBadge label="AST" value={avg.ast.toFixed(1)} />
            <StatBadge label="STL" value={avg.stl.toFixed(1)} />
            <StatBadge label="BLK" value={avg.blk.toFixed(1)} />
            <StatBadge label="FG%" value={(avg.fg_pct * 100).toFixed(1)} />
            <StatBadge label="3P%" value={(avg.fg3_pct * 100).toFixed(1)} />
            <StatBadge label="FT%" value={(avg.ft_pct * 100).toFixed(1)} />
            <StatBadge label="TO" value={avg.turnover.toFixed(1)} />
          </div>
        </div>
      ) : (
        <div className="border border-[#1e1e2a] rounded-xl p-5 mb-6">
          <p className="font-mono text-sm text-[#5a5a64] text-center">
            No season averages available for {season}-{(season + 1).toString().slice(-2)}
          </p>
        </div>
      )}

      {/* Points trend chart */}
      {trendData.length > 1 && (
        <div className="border border-[#1e1e2a] rounded-xl p-5 mb-6">
          <h3 className="font-mono font-bold text-[#fbbf24] text-sm mb-4">Points Trend (Last {trendData.length} Games)</h3>
          <PointsTrendChart data={trendData} />
        </div>
      )}

      {/* Game log table */}
      <div className="border border-[#1e1e2a] rounded-xl overflow-hidden">
        <div className="bg-[#111118] px-4 py-3 border-b border-[#1e1e2a]">
          <h3 className="font-mono font-bold text-[#fbbf24] text-sm">Recent Game Log</h3>
        </div>
        {gamesLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="font-mono text-sm text-[#5a5a64] animate-pulse">Loading games...</span>
          </div>
        ) : games.length === 0 ? (
          <div className="py-8 text-center">
            <span className="font-mono text-sm text-[#5a5a64]">No game data available</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e2a] text-[#5a5a64] font-mono text-xs">
                  <th className="text-left px-3 py-2.5">Date</th>
                  <th className="text-left px-3 py-2.5">Matchup</th>
                  <th className="text-center px-2 py-2.5">MIN</th>
                  <th className="text-center px-2 py-2.5">PTS</th>
                  <th className="text-center px-2 py-2.5">REB</th>
                  <th className="text-center px-2 py-2.5">AST</th>
                  <th className="text-center px-2 py-2.5 hidden sm:table-cell">STL</th>
                  <th className="text-center px-2 py-2.5 hidden sm:table-cell">BLK</th>
                  <th className="text-center px-2 py-2.5 hidden md:table-cell">FG</th>
                  <th className="text-center px-2 py-2.5 hidden md:table-cell">3PT</th>
                </tr>
              </thead>
              <tbody>
                {games.map(g => {
                  const isHome = g.team.abbreviation === g.game.home_team.abbreviation
                  const opponent = isHome ? g.game.visitor_team.abbreviation : g.game.home_team.abbreviation
                  const won = isHome
                    ? g.game.home_team_score > g.game.visitor_team_score
                    : g.game.visitor_team_score > g.game.home_team_score

                  return (
                    <tr key={g.id} className="border-b border-[#1e1e2a] last:border-0 hover:bg-[#111118] transition-colors">
                      <td className="px-3 py-2.5 font-mono text-xs text-[#8a8a94] whitespace-nowrap">
                        {new Date(g.game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">
                        <span className={won ? 'text-emerald-400' : 'text-red-400'}>
                          {won ? 'W' : 'L'}
                        </span>
                        <span className="text-[#8a8a94] ml-1.5">
                          {isHome ? 'vs' : '@'} {opponent}
                        </span>
                      </td>
                      <td className="text-center px-2 py-2.5 font-mono text-xs text-[#8a8a94]">{g.min}</td>
                      <td className="text-center px-2 py-2.5 font-mono text-xs font-bold text-[#e8e6e3]">{g.pts}</td>
                      <td className="text-center px-2 py-2.5 font-mono text-xs text-[#e8e6e3]">{g.reb}</td>
                      <td className="text-center px-2 py-2.5 font-mono text-xs text-[#e8e6e3]">{g.ast}</td>
                      <td className="text-center px-2 py-2.5 font-mono text-xs text-[#8a8a94] hidden sm:table-cell">{g.stl}</td>
                      <td className="text-center px-2 py-2.5 font-mono text-xs text-[#8a8a94] hidden sm:table-cell">{g.blk}</td>
                      <td className="text-center px-2 py-2.5 font-mono text-xs text-[#8a8a94] hidden md:table-cell">
                        {g.fgm}/{g.fga}
                      </td>
                      <td className="text-center px-2 py-2.5 font-mono text-xs text-[#8a8a94] hidden md:table-cell">
                        {g.fg3m}/{g.fg3a}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatBadge({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <div className="text-[#5a5a64] font-mono text-[10px] uppercase tracking-wider mb-1">{label}</div>
      <div className={`font-mono text-lg font-bold ${highlight ? 'text-[#fbbf24]' : 'text-[#e8e6e3]'}`}>
        {value}
      </div>
    </div>
  )
}

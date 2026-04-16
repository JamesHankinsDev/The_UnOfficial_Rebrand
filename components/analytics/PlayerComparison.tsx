'use client'

import React, { useState, useEffect } from 'react'
import { PlayerSearch } from './PlayerSearch'
import { ComparisonBarChart, MultiStatTrendChart, STAT_COLORS } from './StatChart'

interface Player {
  id: number
  first_name: string
  last_name: string
  position: string
  team: {
    full_name: string
    abbreviation: string
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
  fg_pct: number
  fg3_pct: number
  ft_pct: number
  min: string
  oreb: number
  dreb: number
  fgm: number
  fga: number
  fg3m: number
  fg3a: number
  ftm: number
  fta: number
}

interface CompareResult {
  players: Array<{
    id: number
    first_name: string
    last_name: string
    position: string
    height: string
    weight: string
    jersey_number: string
    team: { full_name: string; abbreviation: string }
  }>
  averages: [SeasonAvg[], SeasonAvg[]]
}

interface GameStat {
  id: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  game: { date: string }
}

const PLAYER_COLORS = ['#fbbf24', '#8b5cf6']

const trendStats = [
  { key: 'pts', label: 'PTS' },
  { key: 'reb', label: 'REB' },
  { key: 'ast', label: 'AST' },
  { key: 'stl', label: 'STL' },
  { key: 'blk', label: 'BLK' },
  { key: 'pra', label: 'PRA' },
  { key: 'stocks', label: 'STOCKS' },
] as const

type TrendStatKey = (typeof trendStats)[number]['key']

function getGameStatValue(g: GameStat, key: TrendStatKey): number {
  switch (key) {
    case 'pts': return g.pts
    case 'reb': return g.reb
    case 'ast': return g.ast
    case 'stl': return g.stl
    case 'blk': return g.blk
    case 'pra': return g.pts + g.reb + g.ast
    case 'stocks': return g.stl + g.blk
  }
}

export function PlayerComparison({ season }: { season: number }) {
  const [player1, setPlayer1] = useState<Player | null>(null)
  const [player2, setPlayer2] = useState<Player | null>(null)
  const [result, setResult] = useState<CompareResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Trend state
  const [trendStat, setTrendStat] = useState<TrendStatKey>('pts')
  const [gameLogs, setGameLogs] = useState<[GameStat[], GameStat[]]>([[], []])
  const [gamesLoading, setGamesLoading] = useState(false)

  const handleCompare = async () => {
    if (!player1 || !player2) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/nba/players/compare?ids=${player1.id},${player2.id}&season=${season}`)
      if (!res.ok) throw new Error('Failed to compare')
      const data: CompareResult = await res.json()
      setResult(data)
    } catch {
      setError('Failed to compare players')
    } finally {
      setLoading(false)
    }
  }

  // Fetch game logs for both players once comparison loads
  useEffect(() => {
    if (!result || !player1 || !player2) {
      setGameLogs([[], []])
      return
    }

    setGamesLoading(true)
    Promise.all([
      fetch(`/api/nba/players/${player1.id}/games?season=${season}`).then(r => r.json()).catch(() => []),
      fetch(`/api/nba/players/${player2.id}/games?season=${season}`).then(r => r.json()).catch(() => []),
    ]).then(([g1, g2]) => {
      setGameLogs([
        Array.isArray(g1) ? g1.slice(0, 15) : [],
        Array.isArray(g2) ? g2.slice(0, 15) : [],
      ])
    }).finally(() => setGamesLoading(false))
  }, [result, player1, player2, season])

  const avg1 = result?.averages[0]?.[0]
  const avg2 = result?.averages[1]?.[0]

  const chartData = avg1 && avg2
    ? [
        { stat: 'PTS', player1: avg1.pts, player2: avg2.pts },
        { stat: 'REB', player1: avg1.reb, player2: avg2.reb },
        { stat: 'AST', player1: avg1.ast, player2: avg2.ast },
        { stat: 'STL', player1: avg1.stl, player2: avg2.stl },
        { stat: 'BLK', player1: avg1.blk, player2: avg2.blk },
      ]
    : []

  const p1Name = player1 ? `${player1.first_name} ${player1.last_name}` : 'Player 1'
  const p2Name = player2 ? `${player2.first_name} ${player2.last_name}` : 'Player 2'

  // Build trend chart data
  const maxGames = Math.max(gameLogs[0].length, gameLogs[1].length)
  const trendLabels = Array.from({ length: maxGames }, (_, i) => `G${maxGames - i}`)
  const trendSeries = [
    {
      key: 'player1',
      label: p1Name,
      color: PLAYER_COLORS[0],
      data: [...gameLogs[0]].reverse().map(g => getGameStatValue(g, trendStat)),
    },
    {
      key: 'player2',
      label: p2Name,
      color: PLAYER_COLORS[1],
      data: [...gameLogs[1]].reverse().map(g => getGameStatValue(g, trendStat)),
    },
  ].filter(s => s.data.length > 0)

  const trendStatLabel = trendStats.find(s => s.key === trendStat)?.label ?? trendStat.toUpperCase()

  return (
    <div>
      {/* Search inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="font-mono text-xs text-[#5a5a64] uppercase tracking-wider mb-2 block">Player 1</label>
          <PlayerSearch
            onSelect={(p) => { setPlayer1(p); setResult(null) }}
            placeholder="Search player 1..."
          />
          {player1 && (
            <div className="mt-2 flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-[#fbbf24]">
                {player1.first_name} {player1.last_name}
              </span>
              <span className="font-mono text-xs text-[#5a5a64]">{player1.team?.abbreviation}</span>
            </div>
          )}
        </div>
        <div>
          <label className="font-mono text-xs text-[#5a5a64] uppercase tracking-wider mb-2 block">Player 2</label>
          <PlayerSearch
            onSelect={(p) => { setPlayer2(p); setResult(null) }}
            placeholder="Search player 2..."
          />
          {player2 && (
            <div className="mt-2 flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-[#8b5cf6]">
                {player2.first_name} {player2.last_name}
              </span>
              <span className="font-mono text-xs text-[#5a5a64]">{player2.team?.abbreviation}</span>
            </div>
          )}
        </div>
      </div>

      {/* Compare button */}
      {player1 && player2 && !result && (
        <div className="text-center mb-6">
          <button
            onClick={handleCompare}
            disabled={loading}
            className="px-6 py-2.5 font-mono font-bold text-sm rounded-lg bg-[#fbbf24] text-[#0a0a0f] hover:bg-[#f59e0b] transition-colors disabled:opacity-60 disabled:cursor-wait"
          >
            {loading ? 'Comparing...' : 'Compare Players'}
          </button>
        </div>
      )}

      {error && (
        <div className="font-mono text-sm text-red-400 text-center py-4">{error}</div>
      )}

      {/* Comparison results */}
      {result && avg1 && avg2 && (
        <div className="space-y-6">
          {/* Bar chart */}
          <div className="border border-[#1e1e2a] rounded-xl p-5">
            <h3 className="font-mono font-bold text-[#e8e6e3] text-sm mb-4">
              {season}-{(season + 1).toString().slice(-2)} Comparison
            </h3>
            <ComparisonBarChart
              data={chartData}
              player1Name={p1Name}
              player2Name={p2Name}
            />
          </div>

          {/* Trend comparison */}
          <div className="border border-[#1e1e2a] rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="font-mono font-bold text-[#e8e6e3] text-sm">
                  {trendStatLabel} Trend (Last {maxGames} Games)
                </h3>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="flex items-center gap-1.5 font-mono text-[10px] text-[#8a8a94]">
                    <span className="w-2.5 h-0.5 rounded-full" style={{ backgroundColor: PLAYER_COLORS[0] }} />
                    {p1Name}
                  </span>
                  <span className="flex items-center gap-1.5 font-mono text-[10px] text-[#8a8a94]">
                    <span className="w-2.5 h-0.5 rounded-full" style={{ backgroundColor: PLAYER_COLORS[1] }} />
                    {p2Name}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {trendStats.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setTrendStat(key)}
                    className={`px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
                      trendStat === key
                        ? 'text-[#0a0a0f]'
                        : 'bg-[#111118] border border-[#1e1e2a] text-[#5a5a64] hover:text-[#8a8a94] hover:border-[#3a3a44]'
                    }`}
                    style={trendStat === key ? { backgroundColor: STAT_COLORS[key] } : undefined}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {gamesLoading ? (
              <div className="flex items-center justify-center py-12">
                <span className="font-mono text-sm text-[#5a5a64] animate-pulse">Loading game logs...</span>
              </div>
            ) : trendSeries.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <span className="font-mono text-sm text-[#5a5a64]">No game log data available</span>
              </div>
            ) : (
              <MultiStatTrendChart
                labels={trendLabels}
                series={trendSeries}
                activeSeries={trendSeries.map(s => s.key)}
              />
            )}
          </div>

          {/* Stat table */}
          <div className="border border-[#1e1e2a] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e2a] bg-[#111118]">
                  <th className="text-left px-4 py-3 font-mono text-xs text-[#5a5a64]">Stat</th>
                  <th className="text-center px-4 py-3 font-mono text-xs text-[#fbbf24]">{p1Name}</th>
                  <th className="text-center px-4 py-3 font-mono text-xs text-[#8b5cf6]">{p2Name}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Games', v1: avg1.games_played, v2: avg2.games_played },
                  { label: 'PPG', v1: avg1.pts, v2: avg2.pts },
                  { label: 'RPG', v1: avg1.reb, v2: avg2.reb },
                  { label: 'APG', v1: avg1.ast, v2: avg2.ast },
                  { label: 'SPG', v1: avg1.stl, v2: avg2.stl },
                  { label: 'BPG', v1: avg1.blk, v2: avg2.blk },
                  { label: 'TOPG', v1: avg1.turnover, v2: avg2.turnover },
                  { label: 'FG%', v1: avg1.fg_pct * 100, v2: avg2.fg_pct * 100 },
                  { label: '3P%', v1: avg1.fg3_pct * 100, v2: avg2.fg3_pct * 100 },
                  { label: 'FT%', v1: avg1.ft_pct * 100, v2: avg2.ft_pct * 100 },
                ].map(row => {
                  const isHigher1 = row.label === 'TOPG' ? row.v1 < row.v2 : row.v1 > row.v2
                  const isHigher2 = row.label === 'TOPG' ? row.v2 < row.v1 : row.v2 > row.v1

                  return (
                    <tr key={row.label} className="border-b border-[#1e1e2a] last:border-0">
                      <td className="px-4 py-2.5 font-mono text-xs text-[#8a8a94]">{row.label}</td>
                      <td className={`text-center px-4 py-2.5 font-mono text-sm font-bold ${
                        isHigher1 ? 'text-[#fbbf24]' : 'text-[#8a8a94]'
                      }`}>
                        {typeof row.v1 === 'number' ? row.v1.toFixed(1) : row.v1}
                      </td>
                      <td className={`text-center px-4 py-2.5 font-mono text-sm font-bold ${
                        isHigher2 ? 'text-[#8b5cf6]' : 'text-[#8a8a94]'
                      }`}>
                        {typeof row.v2 === 'number' ? row.v2.toFixed(1) : row.v2}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Compare again */}
          <div className="text-center">
            <button
              onClick={() => setResult(null)}
              className="font-mono text-xs text-[#8a8a94] hover:text-[#fbbf24] transition-colors"
            >
              Compare different players
            </button>
          </div>
        </div>
      )}

      {/* No data warning */}
      {result && (!avg1 || !avg2) && (
        <div className="border border-[#1e1e2a] rounded-xl p-6 text-center">
          <p className="font-mono text-sm text-[#8a8a94]">
            {!avg1 && !avg2
              ? 'No season averages available for either player.'
              : !avg1
              ? `No season averages for ${p1Name}.`
              : `No season averages for ${p2Name}.`}
          </p>
          <button
            onClick={() => setResult(null)}
            className="mt-3 font-mono text-xs text-[#fbbf24] hover:text-[#f59e0b] transition-colors"
          >
            Try different players
          </button>
        </div>
      )}
    </div>
  )
}

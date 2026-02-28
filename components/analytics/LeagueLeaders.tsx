'use client'

import React, { useEffect, useState, useCallback } from 'react'

interface LeaderEntry {
  player_id: number
  first_name: string
  last_name: string
  position: string
  team_abbreviation: string
  team_full_name: string
  value: number
  games_played: number
  rank: number
}

interface ContractInfo {
  player_id: number
  salary: number | null
}

const statCategories = [
  { id: 'pts', label: 'PTS' },
  { id: 'reb', label: 'REB' },
  { id: 'ast', label: 'AST' },
  { id: 'blk', label: 'BLK' },
  { id: 'stl', label: 'STL' },
  { id: 'pra', label: 'PRA' },
  { id: 'stocks', label: 'Stocks' },
] as const

type StatId = (typeof statCategories)[number]['id']

function formatSalary(amount: number | null | undefined): string {
  if (amount == null) return '—'
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`
  }
  return `$${amount.toLocaleString()}`
}

interface LeagueLeadersProps {
  season: number
  onSelectPlayer: (playerId: number) => void
}

export function LeagueLeaders({ season, onSelectPlayer }: LeagueLeadersProps) {
  const [stat, setStat] = useState<StatId>('pts')
  const [leaders, setLeaders] = useState<LeaderEntry[]>([])
  const [salaries, setSalaries] = useState<Map<number, number | null>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Fetch leaders when stat or season changes
  useEffect(() => {
    setLoading(true)
    setError('')
    setSalaries(new Map())

    fetch(`/api/nba/leaders?stat=${stat}&season=${season}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load')
        return res.json()
      })
      .then((data: LeaderEntry[]) => {
        setLeaders(data)
        setLoading(false)

        // Fetch salaries for the loaded leaders
        if (data.length > 0) {
          const ids = data.map(l => l.player_id).join(',')
          fetchSalaries(ids)
        }
      })
      .catch(() => {
        setError('Failed to load leaders')
        setLoading(false)
      })
  }, [stat, season])

  const fetchSalaries = useCallback((ids: string) => {
    fetch(`/api/nba/contracts?player_ids=${ids}`)
      .then(res => res.json())
      .then((data: ContractInfo[]) => {
        if (Array.isArray(data)) {
          const map = new Map<number, number | null>()
          for (const c of data) {
            map.set(c.player_id, c.salary)
          }
          setSalaries(map)
        }
      })
      .catch(() => {
        // Silently fail — salary column will show "—"
      })
  }, [])

  const statLabel = statCategories.find(c => c.id === stat)?.label ?? stat.toUpperCase()

  return (
    <div>
      {/* Stat category pills */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {statCategories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setStat(cat.id)}
            className={`px-3 py-1.5 font-mono text-xs font-bold rounded-lg transition-colors ${
              stat === cat.id
                ? 'bg-[#fbbf24] text-[#0a0a0f]'
                : 'bg-[#111118] border border-[#1e1e2a] text-[#8a8a94] hover:text-[#e8e6e3] hover:border-[#3a3a44]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Leaders table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="font-mono text-sm text-[#5a5a64] animate-pulse">Loading leaders...</span>
        </div>
      ) : error ? (
        <div className="font-mono text-sm text-red-400 text-center py-8">{error}</div>
      ) : leaders.length === 0 ? (
        <div className="font-mono text-sm text-[#5a5a64] text-center py-8">
          No leader data available for this season
        </div>
      ) : (
        <div className="border border-[#1e1e2a] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e2a] text-[#5a5a64] font-mono text-xs bg-[#111118]">
                <th className="text-left px-4 py-2.5">#</th>
                <th className="text-left px-4 py-2.5">Player</th>
                <th className="text-left px-3 py-2.5 hidden sm:table-cell">Team</th>
                <th className="text-center px-3 py-2.5">{statLabel}</th>
                <th className="text-center px-3 py-2.5 hidden sm:table-cell">GP</th>
                <th className="text-right px-4 py-2.5">Salary</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((leader, idx) => {
                const salary = salaries.get(leader.player_id)

                return (
                  <tr
                    key={leader.player_id}
                    onClick={() => onSelectPlayer(leader.player_id)}
                    className="border-b border-[#1e1e2a] last:border-0 transition-colors hover:bg-[#111118] cursor-pointer group"
                  >
                    <td className="px-4 py-3 font-mono text-[#5a5a64] text-xs">
                      {leader.rank || idx + 1}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div>
                        <span className="font-mono font-bold text-[#e8e6e3] text-sm group-hover:text-[#fbbf24] transition-colors">
                          {leader.first_name} {leader.last_name}
                        </span>
                        <span className="font-mono text-xs text-[#5a5a64] ml-2 sm:hidden">
                          {leader.team_abbreviation}
                        </span>
                        {leader.position && (
                          <span className="font-mono text-xs text-[#5a5a64] ml-1.5 hidden md:inline">
                            {leader.position}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-[#8a8a94] hidden sm:table-cell">
                      {leader.team_abbreviation}
                    </td>
                    <td className="text-center px-3 py-3 font-mono font-bold text-[#fbbf24]">
                      {leader.value.toFixed(1)}
                    </td>
                    <td className="text-center px-3 py-3 font-mono text-xs text-[#8a8a94] hidden sm:table-cell">
                      {leader.games_played}
                    </td>
                    <td className="text-right px-4 py-3 font-mono text-xs text-[#8a8a94]">
                      {salaries.size > 0 ? formatSalary(salary) : (
                        <span className="inline-block w-3 h-3 border-2 border-[#3a3a44] border-t-[#8a8a94] rounded-full animate-spin" />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Stat description */}
      <div className="mt-3 text-center">
        <span className="font-mono text-[10px] text-[#3a3a44]">
          {stat === 'pra' && 'PRA = Points + Rebounds + Assists per game'}
          {stat === 'stocks' && 'Stocks = Blocks + Steals per game'}
          {stat !== 'pra' && stat !== 'stocks' && `${statLabel} per game`}
        </span>
      </div>
    </div>
  )
}

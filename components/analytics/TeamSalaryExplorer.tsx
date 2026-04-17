'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { SALARY_CAP_USD } from '@/lib/constants'
import { useNBATeams } from '@/hooks/useNBATeams'
import { StatHeader } from '@/components/ui/StatHeader'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

interface RosterPlayer {
  player_id: number
  first_name: string
  last_name: string
  position: string
  salary: number
  is_two_way: boolean
  team_id: number
  team_abbreviation: string
  net_rating: number | null
  minutes_per_game: number | null
  games_played: number | null
}

interface TeamRosterData {
  team: {
    id: number
    abbreviation: string
    full_name: string
    conference: string
    division: string
  }
  standings: { wins: number; losses: number; conference_rank: number }
  total_salary: number
  cap_tier: string
  roster: RosterPlayer[]
}

const POS_COLORS: Record<string, string> = {
  Guard: '#fbbf24',
  Forward: '#3b82f6',
  Center: '#10b981',
  Other: '#8a8a94',
}

function formatSalary(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toLocaleString()}`
}

function positionGroup(pos: string): string {
  if (!pos) return 'Other'
  const first = pos.charAt(0).toUpperCase()
  if (first === 'G') return 'Guard'
  if (first === 'F') return 'Forward'
  if (first === 'C') return 'Center'
  return 'Other'
}

interface TeamSalaryExplorerProps {
  season: number
  onSelectPlayer: (playerId: number) => void
}

export function TeamSalaryExplorer({ season, onSelectPlayer }: TeamSalaryExplorerProps) {
  const { teams: allTeams, loading: teamsLoading } = useNBATeams()
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [teamData, setTeamData] = useState<TeamRosterData | null>(null)
  const [rosterLoading, setRosterLoading] = useState(false)

  // Fetch roster when team changes
  useEffect(() => {
    if (!selectedTeamId) {
      setTeamData(null)
      return
    }
    setRosterLoading(true)
    fetch(`/api/nba/trade/team-roster?team_id=${selectedTeamId}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: TeamRosterData | null) => setTeamData(data))
      .catch(() => setTeamData(null))
      .finally(() => setRosterLoading(false))
  }, [selectedTeamId, season])

  const roster = teamData?.roster ?? []

  // Summary stats
  const totalSalary = teamData?.total_salary ?? 0
  const capSpace = SALARY_CAP_USD - totalSalary
  const playerCount = roster.length

  // Position breakdown for chart
  const posBreakdown = useMemo(() => {
    const groups: Record<string, { salary: number; count: number }> = {}
    for (const p of roster) {
      const group = positionGroup(p.position)
      if (!groups[group]) groups[group] = { salary: 0, count: 0 }
      groups[group].salary += p.salary ?? 0
      groups[group].count++
    }
    return ['Guard', 'Forward', 'Center']
      .filter(g => groups[g])
      .map(g => ({
        position: g,
        salary: groups[g].salary,
        count: groups[g].count,
        color: POS_COLORS[g],
      }))
  }, [roster])

  return (
    <div>
      {/* Team selector */}
      <div className="flex items-center gap-3 mb-6">
        <label className="font-mono text-xs text-[#5a5a64] uppercase tracking-wider">Team</label>
        <select
          value={selectedTeamId ?? ''}
          onChange={(e) => {
            const id = parseInt(e.target.value, 10)
            setSelectedTeamId(isNaN(id) ? null : id)
          }}
          disabled={teamsLoading}
          className="bg-[#0a0a0f] border border-[#1e1e2a] text-[#e8e6e3] text-sm font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-[#fbbf24] transition-colors min-w-[200px]"
        >
          <option value="">Select a team...</option>
          {allTeams.map(t => (
            <option key={t.id} value={t.id}>{t.full_name}</option>
          ))}
        </select>
      </div>

      {teamsLoading || rosterLoading ? (
        <div className="flex items-center justify-center py-16">
          <span className="font-mono text-sm text-[#5a5a64] animate-pulse">Loading{rosterLoading ? ' roster' : ''}...</span>
        </div>
      ) : !selectedTeamId ? (
        <div className="text-center py-16 font-mono text-sm text-[#5a5a64]">
          Select a team to explore their salary breakdown.
        </div>
      ) : !teamData ? (
        <div className="text-center py-16 font-mono text-sm text-[#5a5a64]">
          Failed to load roster data.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-4">
            <div className="border border-[#1e1e2a] rounded-xl p-4 bg-[#111118] text-center">
              <div className="font-mono text-[10px] text-[#5a5a64] uppercase tracking-wider mb-1">Team Salary</div>
              <div className="font-mono text-lg font-bold text-[#fbbf24]">{formatSalary(totalSalary)}</div>
            </div>
            <div className="border border-[#1e1e2a] rounded-xl p-4 bg-[#111118] text-center">
              <div className="font-mono text-[10px] text-[#5a5a64] uppercase tracking-wider mb-1">Cap Space</div>
              <div className={`font-mono text-lg font-bold ${capSpace >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {capSpace >= 0 ? formatSalary(capSpace) : `-${formatSalary(Math.abs(capSpace))}`}
              </div>
            </div>
            <div className="border border-[#1e1e2a] rounded-xl p-4 bg-[#111118] text-center">
              <div className="font-mono text-[10px] text-[#5a5a64] uppercase tracking-wider mb-1">Players</div>
              <div className="font-mono text-lg font-bold text-[#e8e6e3]">{playerCount}</div>
            </div>
          </div>

          {/* Record + cap tier */}
          <div className="flex items-center justify-center gap-4 font-mono text-xs text-[#8a8a94]">
            <span>Record: {teamData.standings.wins}-{teamData.standings.losses}</span>
            <span>|</span>
            <span>Conf Rank: #{teamData.standings.conference_rank}</span>
            <span>|</span>
            <span className={
              teamData.cap_tier === 'under_cap' ? 'text-emerald-400' :
              teamData.cap_tier === 'over_cap' ? 'text-[#fbbf24]' :
              teamData.cap_tier === 'luxury_tax' ? 'text-[#f97316]' :
              'text-red-400'
            }>
              {teamData.cap_tier.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </span>
          </div>

          {/* Position breakdown chart */}
          {posBreakdown.length > 0 && (
            <div className="border border-[#1e1e2a] rounded-xl p-5 bg-[#111118]">
              <h3 className="font-mono font-bold text-sm text-[#e8e6e3] mb-4">Salary by Position</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={posBreakdown} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <XAxis
                    type="number"
                    tick={{ fill: '#5a5a64', fontSize: 10, fontFamily: 'Space Mono, monospace' }}
                    stroke="#1e1e2a"
                    tickFormatter={(v) => `$${(v / 1_000_000).toFixed(0)}M`}
                  />
                  <YAxis
                    type="category"
                    dataKey="position"
                    tick={{ fill: '#8a8a94', fontSize: 11, fontFamily: 'Space Mono, monospace' }}
                    stroke="#1e1e2a"
                    width={70}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111118', border: '1px solid #1e1e2a',
                      borderRadius: 8, fontFamily: 'Space Mono, monospace', fontSize: 12, color: '#e8e6e3',
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => formatSalary(value as number)}
                  />
                  <Bar dataKey="salary" radius={[0, 4, 4, 0]}>
                    {posBreakdown.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-4 mt-2">
                {posBreakdown.map(g => (
                  <span key={g.position} className="flex items-center gap-1.5 font-mono text-[10px] text-[#5a5a64]">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                    {g.position} ({g.count})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Roster table */}
          <div className="border border-[#1e1e2a] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e2a] bg-[#111118] font-mono text-[10px] text-[#5a5a64] uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">#</th>
                  <StatHeader label="Player" align="left" className="px-4" />
                  <StatHeader label="Pos" />
                  <StatHeader label="GP" />
                  <StatHeader label="MPG" />
                  <StatHeader label="Salary" align="right" />
                  <StatHeader label="Cap%" align="right" />
                  <StatHeader label="Net Rtg" align="right" className="px-4" />
                </tr>
              </thead>
              <tbody>
                {roster.map((p, idx) => {
                  const capPct = p.salary > 0
                    ? Math.round((p.salary / SALARY_CAP_USD) * 1000) / 10
                    : null

                  return (
                    <tr
                      key={p.player_id}
                      onClick={() => onSelectPlayer(p.player_id)}
                      className="border-b border-[#1e1e2a] last:border-0 hover:bg-[#111118] cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-[#5a5a64]">{idx + 1}</td>
                      <td className="px-4 py-2.5 font-mono text-xs font-bold text-[#e8e6e3] group-hover:text-[#fbbf24] transition-colors whitespace-nowrap">
                        {p.first_name} {p.last_name}
                        {p.is_two_way && (
                          <span className="ml-1.5 text-[10px] text-[#5a5a64] font-normal">2W</span>
                        )}
                      </td>
                      <td className="text-center px-3 py-2.5 font-mono text-xs text-[#8a8a94]">{p.position || '—'}</td>
                      <td className="text-center px-3 py-2.5 font-mono text-xs text-[#8a8a94]">{p.games_played ?? '—'}</td>
                      <td className="text-center px-3 py-2.5 font-mono text-xs text-[#8a8a94]">
                        {p.minutes_per_game != null ? p.minutes_per_game.toFixed(1) : '—'}
                      </td>
                      <td className="text-right px-3 py-2.5 font-mono text-xs text-[#e8e6e3] font-bold">{formatSalary(p.salary)}</td>
                      <td className="text-right px-3 py-2.5 font-mono text-xs text-[#8a8a94]">
                        {capPct != null ? `${capPct.toFixed(1)}%` : '—'}
                      </td>
                      <td className="text-right px-4 py-2.5 font-mono text-xs font-bold">
                        {p.net_rating != null ? (
                          <span className={p.net_rating >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {p.net_rating >= 0 ? '+' : ''}{p.net_rating.toFixed(1)}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="font-mono text-[10px] text-[#3a3a44] text-center">
            Net Rtg = point differential per 100 possessions. Positive = team outscores opponents with this player on court. Cap: ${(SALARY_CAP_USD / 1_000_000).toFixed(1)}M.
          </p>
        </div>
      )}
    </div>
  )
}

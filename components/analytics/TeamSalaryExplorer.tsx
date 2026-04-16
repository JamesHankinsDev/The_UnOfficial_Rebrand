'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { SALARY_CAP_USD } from '@/lib/constants'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

interface GridPlayer {
  player_id: number
  first_name: string
  last_name: string
  position: string
  team_abbreviation: string
  team_full_name: string
  games_played: number
  mpg: number
  pts: number
  reb: number
  ast: number
  pra: number
  salary: number | null
  cap_pct: number | null
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
  const [allPlayers, setAllPlayers] = useState<GridPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTeam, setSelectedTeam] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/nba/players/grid?season=${season}&period=season&qualified=false`)
      .then(r => r.ok ? r.json() : [])
      .then((data: GridPlayer[]) => setAllPlayers(data))
      .catch(() => setAllPlayers([]))
      .finally(() => setLoading(false))
  }, [season])

  // Unique teams sorted alphabetically
  const teams = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of allPlayers) map.set(p.team_abbreviation, p.team_full_name)
    return Array.from(map.entries())
      .map(([abbr, name]) => ({ abbr, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [allPlayers])

  // Filtered roster
  const roster = useMemo(() => {
    if (!selectedTeam) return []
    return allPlayers
      .filter(p => p.team_abbreviation === selectedTeam)
      .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0))
  }, [allPlayers, selectedTeam])

  // Summary stats
  const totalSalary = roster.reduce((s, p) => s + (p.salary ?? 0), 0)
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
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          disabled={loading}
          className="bg-[#0a0a0f] border border-[#1e1e2a] text-[#e8e6e3] text-sm font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-[#fbbf24] transition-colors min-w-[200px]"
        >
          <option value="">Select a team...</option>
          {teams.map(t => (
            <option key={t.abbr} value={t.abbr}>{t.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="font-mono text-sm text-[#5a5a64] animate-pulse">Loading player data...</span>
        </div>
      ) : !selectedTeam ? (
        <div className="text-center py-16 font-mono text-sm text-[#5a5a64]">
          Select a team to explore their salary breakdown.
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
                  <th className="text-left px-4 py-2.5">Player</th>
                  <th className="text-center px-3 py-2.5">Pos</th>
                  <th className="text-center px-3 py-2.5">MPG</th>
                  <th className="text-right px-3 py-2.5">Salary</th>
                  <th className="text-right px-3 py-2.5">Cap%</th>
                  <th className="text-center px-3 py-2.5">PRA</th>
                  <th className="text-right px-4 py-2.5">MAV</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((p, idx) => {
                  const mav = p.cap_pct != null && p.cap_pct > 0 && p.mpg > 0
                    ? Math.round((p.pra / p.cap_pct) * (p.mpg / 36) * 100) / 100
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
                      </td>
                      <td className="text-center px-3 py-2.5 font-mono text-xs text-[#8a8a94]">{p.position || '—'}</td>
                      <td className="text-center px-3 py-2.5 font-mono text-xs text-[#8a8a94]">{p.mpg.toFixed(1)}</td>
                      <td className="text-right px-3 py-2.5 font-mono text-xs text-[#e8e6e3] font-bold">{formatSalary(p.salary)}</td>
                      <td className="text-right px-3 py-2.5 font-mono text-xs text-[#8a8a94]">
                        {p.cap_pct != null ? `${p.cap_pct.toFixed(1)}%` : '—'}
                      </td>
                      <td className="text-center px-3 py-2.5 font-mono text-xs text-[#fbbf24] font-bold">{p.pra.toFixed(1)}</td>
                      <td className="text-right px-4 py-2.5 font-mono text-xs font-bold">
                        {mav != null ? (
                          <span className={mav >= 4 ? 'text-emerald-400' : mav >= 1.5 ? 'text-[#e8e6e3]' : 'text-red-400'}>
                            {mav.toFixed(2)}
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
            MAV = (PRA / Cap%) x (MPG / 36). Higher = more production per dollar per minute. Cap: ${(SALARY_CAP_USD / 1_000_000).toFixed(1)}M.
          </p>
        </div>
      )}
    </div>
  )
}

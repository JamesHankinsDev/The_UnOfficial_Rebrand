'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { SALARY_CAP_USD } from '@/lib/constants'
import { StatHeader } from '@/components/ui/StatHeader'

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
  draft_year?: number | null
}

// Players drafted within the last 4 seasons are on rookie deals
const ROOKIE_CUTOFF_YEAR = 2022  // 2025-26 season: 2022–2025 draftees

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
type ViewMode = 'stat' | 'value'
type Period = 'season' | 'week' | 'month'
type ContractFilter = 'all' | 'rookie' | 'vet'

const periodLabels: Record<Period, string> = {
  season: 'This Season',
  week: 'Last 7 Days',
  month: 'This Month',
}

function formatSalary(amount: number | null | undefined): string {
  if (amount == null) return '—'
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`
  return `$${amount.toLocaleString()}`
}

interface LeagueLeadersProps {
  season: number
  onSelectPlayer: (playerId: number) => void
  teamFilter?: { abbreviation: string; full_name: string } | null
}

export function LeagueLeaders({ season, onSelectPlayer, teamFilter }: LeagueLeadersProps) {
  const [stat, setStat] = useState<StatId>('pts')
  const [period, setPeriod] = useState<Period>('season')
  const [contractFilter, setContractFilter] = useState<ContractFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('stat')
  // stat leaders (top 20) for display in stat mode
  const [leaders, setLeaders] = useState<LeaderEntry[]>([])
  // wider pool (top 150) used for cap value ranking
  const [valuePool, setValuePool] = useState<LeaderEntry[]>([])
  const [salaries, setSalaries] = useState<Map<number, number | null>>(new Map())
  const [salariesLoading, setSalariesLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    setSalaries(new Map())
    setValuePool([])

    const controller = new AbortController()
    const { signal } = controller

    const periodParam = `&period=${period}`

    // Fetch top 20 for the stat leaders display
    const statFetch = fetch(`/api/nba/leaders?stat=${stat}&season=${season}&limit=20${periodParam}`, { signal })
      .then(res => { if (!res.ok) throw new Error('Failed to load'); return res.json() })
      .then((data: LeaderEntry[]) => { setLeaders(data); setLoading(false); return data })

    // Fetch top 150 for cap value ranking in parallel
    const poolFetch = fetch(`/api/nba/leaders?stat=${stat}&season=${season}&limit=150${periodParam}`, { signal })
      .then(res => res.ok ? res.json() : [])
      .then((data: LeaderEntry[]) => { setValuePool(data); return data })
      .catch(() => [])

    // Once both resolve, fetch salaries for the full pool
    Promise.all([statFetch, poolFetch])
      .then(([, pool]) => {
        if (!pool.length) return
        setSalariesLoading(true)
        const ids = pool.map((l: LeaderEntry) => l.player_id).join(',')
        fetch(`/api/nba/contracts?player_ids=${ids}`, { signal })
          .then(r => r.json())
          .then((contracts: ContractInfo[]) => {
            if (Array.isArray(contracts)) {
              const map = new Map<number, number | null>()
              for (const c of contracts) map.set(c.player_id, c.salary)
              setSalaries(map)
            }
          })
          .catch(() => {})
          .finally(() => setSalariesLoading(false))
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        setError('Failed to load leaders')
        setLoading(false)
      })

    return () => controller.abort()
  }, [stat, season, period])

  // Apply contract filter to any array of leaders
  function applyContractFilter(list: LeaderEntry[]): LeaderEntry[] {
    if (contractFilter === 'all') return list
    return list.filter(l => {
      const dy = l.draft_year
      const isRookie = dy != null && dy >= ROOKIE_CUTOFF_YEAR
      return contractFilter === 'rookie' ? isRookie : !isRookie
    })
  }

  // Apply team filter to any array of leaders
  function applyTeamFilter(list: LeaderEntry[]): LeaderEntry[] {
    if (!teamFilter) return list
    return list.filter(l => l.team_abbreviation === teamFilter.abbreviation)
  }

  // In value mode: rank the full pool by stat per 1% of cap, show top 20
  const displayLeaders = useMemo(() => {
    // When team filter is active in stat mode, draw from the larger pool so results aren't empty
    const source = (teamFilter && viewMode === 'stat')
      ? (valuePool.length > 0 ? valuePool : leaders)
      : (viewMode === 'stat' ? leaders : (valuePool.length > 0 ? valuePool : leaders))
    const filtered = applyTeamFilter(applyContractFilter(source))

    if (viewMode === 'stat') {
      return filtered.map((l, i) => ({ ...l, rank: i + 1 }))
    }
    if (salaries.size === 0) return filtered

    return [...filtered]
      .map(l => {
        const salary = salaries.get(l.player_id) ?? null
        const capPct = salary != null ? (salary / SALARY_CAP_USD) * 100 : null
        const efficiency = capPct != null && capPct > 0 ? l.value / capPct : null
        return { ...l, efficiency, salary, capPct }
      })
      .filter(l => l.efficiency != null)
      .sort((a, b) => (b.efficiency ?? 0) - (a.efficiency ?? 0))
      .slice(0, 20)
      .map((l, i) => ({ ...l, rank: i + 1 }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaders, valuePool, salaries, viewMode, contractFilter, teamFilter])

  const statLabel = statCategories.find(c => c.id === stat)?.label ?? stat.toUpperCase()
  const salariesReady = salaries.size > 0

  return (
    <div>
      {/* Period filter */}
      <div className="flex items-center gap-1 mb-4 bg-brand-black border border-brand-border rounded-lg p-0.5 self-start w-fit">
        {(Object.keys(periodLabels) as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider rounded-md transition-colors ${
              period === p
                ? 'bg-[#fbbf24] text-[#0a0a0f] font-bold'
                : 'text-[#5a5a64] hover:text-[#e8e6e3]'
            }`}
          >
            {periodLabels[p]}
          </button>
        ))}
      </div>

      {/* Contract filter */}
      <div className="flex items-center gap-1 mb-4 bg-brand-black border border-brand-border rounded-lg p-0.5 self-start w-fit">
        {([
          { id: 'all', label: 'All Contracts' },
          { id: 'rookie', label: 'Rookie' },
          { id: 'vet', label: 'Veteran' },
        ] as { id: ContractFilter; label: string }[]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setContractFilter(id)}
            className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider rounded-md transition-colors ${
              contractFilter === id
                ? 'bg-[#fbbf24] text-[#0a0a0f] font-bold'
                : 'text-[#5a5a64] hover:text-[#e8e6e3]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stat category pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
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

      {/* View mode toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 bg-[#0a0a0f] border border-[#1e1e2a] rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('stat')}
            className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider rounded-md transition-colors ${
              viewMode === 'stat'
                ? 'bg-[#fbbf24] text-[#0a0a0f] font-bold'
                : 'text-[#5a5a64] hover:text-[#e8e6e3]'
            }`}
          >
            Stat Leaders
          </button>
          <button
            onClick={() => setViewMode('value')}
            disabled={!salariesReady}
            className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider rounded-md transition-colors ${
              viewMode === 'value'
                ? 'bg-[#fbbf24] text-[#0a0a0f] font-bold'
                : !salariesReady
                ? 'text-[#3a3a44] cursor-not-allowed'
                : 'text-[#5a5a64] hover:text-[#e8e6e3]'
            }`}
          >
            Cap Value
          </button>
        </div>
        {viewMode === 'value' && (
          <span className="font-mono text-[10px] text-[#5a5a64]">
            {statLabel} per 1% of ${SALARY_CAP_USD / 1_000_000}M cap
          </span>
        )}
      </div>

      {/* Leaders table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="font-mono text-sm text-[#5a5a64] animate-pulse">Loading leaders...</span>
        </div>
      ) : error ? (
        <div className="font-mono text-sm text-red-400 text-center py-8">{error}</div>
      ) : displayLeaders.length === 0 ? (
        <div className="font-mono text-sm text-[#5a5a64] text-center py-8">
          {viewMode === 'value' ? 'No salary data available to rank by value' : 'No leader data available for this season'}
        </div>
      ) : (
        <div className="border border-[#1e1e2a] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e2a] text-[#5a5a64] font-mono text-xs bg-[#111118]">
                <th className="text-left px-4 py-2.5">#</th>
                <th className="text-left px-4 py-2.5">Player</th>
                <th className="text-left px-3 py-2.5 hidden sm:table-cell">Team</th>
                <StatHeader label={statLabel} />
                {viewMode === 'value' ? (
                  <>
                    <StatHeader label="Cap%" className="hidden sm:table-cell" />
                    <StatHeader label={`${statLabel}/1%`} align="right" className="px-4 text-[#fbbf24]" tooltip={`${statLabel} per 1% of salary cap — higher = more efficient`} />
                  </>
                ) : (
                  <>
                    <StatHeader label="GP" className="hidden sm:table-cell" />
                    <StatHeader label="Salary" align="right" className="px-4" />
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {displayLeaders.map((leader, idx) => {
                const salary = salaries.get(leader.player_id) ?? null
                const capPct = salary != null ? (salary / SALARY_CAP_USD) * 100 : null
                const efficiency = capPct != null && capPct > 0 ? leader.value / capPct : null

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
                    {viewMode === 'value' ? (
                      <>
                        <td className="text-center px-3 py-3 font-mono text-xs text-[#8a8a94] hidden sm:table-cell">
                          {capPct != null ? `${capPct.toFixed(1)}%` : '—'}
                          <span className="block text-[10px] text-[#5a5a64]">{formatSalary(salary)}</span>
                        </td>
                        <td className="text-right px-4 py-3 font-mono font-bold text-emerald-400">
                          {efficiency != null ? efficiency.toFixed(2) : '—'}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="text-center px-3 py-3 font-mono text-xs text-[#8a8a94] hidden sm:table-cell">
                          {leader.games_played}
                        </td>
                        <td className="text-right px-4 py-3 font-mono text-xs text-[#8a8a94]">
                          {salariesLoading ? (
                            <span className="inline-block w-3 h-3 border-2 border-[#3a3a44] border-t-[#8a8a94] rounded-full animate-spin" />
                          ) : formatSalary(salary)}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 text-center">
        <span className="font-mono text-[10px] text-[#3a3a44]">
          {viewMode === 'value'
            ? `${statLabel}/1% cap — top 20 from ${valuePool.length || leaders.length} players · $${SALARY_CAP_USD / 1_000_000}M cap`
            : stat === 'pra' ? 'PRA = Points + Rebounds + Assists per game'
            : stat === 'stocks' ? 'Stocks = Blocks + Steals per game'
            : `${statLabel} per game`}
        </span>
      </div>
    </div>
  )
}

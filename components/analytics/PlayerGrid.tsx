'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { STAT_DESCRIPTIONS } from '@/components/ui/StatHeader'
import { Headshot } from './Headshot'

interface GridPlayer {
  player_id: number
  nba_id: number | null
  first_name: string
  last_name: string
  position: string
  team_abbreviation: string
  team_full_name: string
  games_played: number
  mpg: number
  draft_year: number | null
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  pra: number
  stocks: number
  salary: number | null
  cap_pct: number | null
}

// Rookie cutoff: drafted within last 4 seasons
const ROOKIE_CUTOFF_YEAR = 2022

type SortKey = keyof GridPlayer | 'name' | 'mav'
type SortDir = 'asc' | 'desc'
type Period = 'season' | 'last1' | 'last3' | 'last5' | 'last10' | 'week' | 'month'
type PositionFilter = '' | 'G' | 'F' | 'C'
type ContractFilter = 'all' | 'rookie' | 'vet'

interface ColumnDef {
  key: string
  label: string
  shortLabel?: string
  sortKey: SortKey
  defaultVisible: boolean
  align: 'left' | 'center' | 'right'
  format: (p: GridPlayer) => string
  highlight?: boolean
}

function computeMAV(p: GridPlayer): number | null {
  if (p.cap_pct == null || p.cap_pct <= 0 || p.mpg <= 0) return null
  return (p.pra / p.cap_pct) * (p.mpg / 36)
}

const COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Player', sortKey: 'name', defaultVisible: true, align: 'left',
    format: (p) => `${p.first_name} ${p.last_name}` },
  { key: 'team', label: 'Team', sortKey: 'team_abbreviation', defaultVisible: true, align: 'left',
    format: (p) => p.team_abbreviation },
  { key: 'position', label: 'Pos', sortKey: 'position', defaultVisible: false, align: 'center',
    format: (p) => p.position || '—' },
  { key: 'gp', label: 'GP', sortKey: 'games_played', defaultVisible: true, align: 'center',
    format: (p) => String(p.games_played) },
  { key: 'mpg', label: 'MPG', sortKey: 'mpg', defaultVisible: false, align: 'center',
    format: (p) => p.mpg.toFixed(1) },
  { key: 'pts', label: 'PTS', sortKey: 'pts', defaultVisible: true, align: 'center',
    format: (p) => p.pts.toFixed(1), highlight: true },
  { key: 'reb', label: 'REB', sortKey: 'reb', defaultVisible: true, align: 'center',
    format: (p) => p.reb.toFixed(1) },
  { key: 'ast', label: 'AST', sortKey: 'ast', defaultVisible: true, align: 'center',
    format: (p) => p.ast.toFixed(1) },
  { key: 'stl', label: 'STL', sortKey: 'stl', defaultVisible: false, align: 'center',
    format: (p) => p.stl.toFixed(1) },
  { key: 'blk', label: 'BLK', sortKey: 'blk', defaultVisible: false, align: 'center',
    format: (p) => p.blk.toFixed(1) },
  { key: 'pra', label: 'PRA', sortKey: 'pra', defaultVisible: true, align: 'center',
    format: (p) => p.pra.toFixed(1), highlight: true },
  { key: 'stocks', label: 'STOCKS', shortLabel: 'STK', sortKey: 'stocks', defaultVisible: false, align: 'center',
    format: (p) => p.stocks.toFixed(1) },
  { key: 'salary', label: 'Salary', sortKey: 'salary', defaultVisible: true, align: 'right',
    format: (p) => formatSalary(p.salary) },
  { key: 'cap_pct', label: 'Cap%', sortKey: 'cap_pct', defaultVisible: true, align: 'right',
    format: (p) => p.cap_pct != null ? `${p.cap_pct.toFixed(1)}%` : '—' },
  { key: 'mav', label: 'MAV', sortKey: 'mav', defaultVisible: true, align: 'right', highlight: true,
    format: (p) => { const v = computeMAV(p); return v != null ? v.toFixed(2) : '—' } },
  { key: 'draft', label: 'Draft', sortKey: 'draft_year', defaultVisible: false, align: 'center',
    format: (p) => p.draft_year != null ? String(p.draft_year) : '—' },
]

function formatSalary(value: number | null): string {
  if (value == null) return '—'
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toLocaleString()}`
}

const PAGE_SIZE = 25

const periodLabels: Record<Period, string> = {
  season: 'Season',
  last1: 'Last Game',
  last3: 'Last 3',
  last5: 'Last 5',
  last10: 'Last 10',
  week: '7 Days',
  month: 'This Month',
}

interface PlayerGridProps {
  season: number
  postseason?: boolean
  onSelectPlayer: (playerId: number) => void
  teamFilter?: { abbreviation: string; full_name: string } | null
}

export function PlayerGrid({ season, postseason = false, onSelectPlayer, teamFilter }: PlayerGridProps) {
  const [players, setPlayers] = useState<GridPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [period, setPeriod] = useState<Period>('season')
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState<PositionFilter>('')
  const [contractFilter, setContractFilter] = useState<ContractFilter>('all')

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('pts')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Pagination
  const [page, setPage] = useState(0)

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    () => new Set(COLUMNS.filter(c => c.defaultVisible).map(c => c.key)),
  )
  const [columnsOpen, setColumnsOpen] = useState(false)
  const columnsRef = useRef<HTMLDivElement>(null)

  // Close column dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (columnsRef.current && !columnsRef.current.contains(e.target as Node)) {
        setColumnsOpen(false)
      }
    }
    if (columnsOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [columnsOpen])

  // Fetch data
  useEffect(() => {
    setLoading(true)
    setError('')
    setPage(0)
    const ps = postseason ? '&postseason=true' : ''
    fetch(`/api/nba/players/grid?season=${season}&period=${period}${ps}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load')
        return res.json()
      })
      .then((data: GridPlayer[]) => {
        setPlayers(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load player data')
        setLoading(false)
      })
  }, [season, period, postseason])

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [search, posFilter, contractFilter, teamFilter, sortKey, sortDir])

  // Filter + sort pipeline
  const filtered = useMemo(() => {
    let result = players

    // Team filter
    if (teamFilter) {
      result = result.filter(p => p.team_abbreviation === teamFilter.abbreviation)
    }

    // Search filter
    if (search.trim().length >= 2) {
      const q = search.trim().toLowerCase()
      result = result.filter(p =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)
        || p.team_abbreviation.toLowerCase().includes(q),
      )
    }

    // Position filter
    if (posFilter) {
      result = result.filter(p => p.position?.includes(posFilter))
    }

    // Contract filter
    if (contractFilter !== 'all') {
      result = result.filter(p => {
        const isRookie = p.draft_year != null && p.draft_year >= ROOKIE_CUTOFF_YEAR
        return contractFilter === 'rookie' ? isRookie : !isRookie
      })
    }

    // Sort
    const sorted = [...result].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') {
        cmp = `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
      } else if (sortKey === 'mav') {
        const va = computeMAV(a)
        const vb = computeMAV(b)
        if (va == null && vb == null) cmp = 0
        else if (va == null) cmp = 1
        else if (vb == null) cmp = -1
        else cmp = va - vb
      } else {
        const va = a[sortKey]
        const vb = b[sortKey]
        if (va == null && vb == null) cmp = 0
        else if (va == null) cmp = 1
        else if (vb == null) cmp = -1
        else if (typeof va === 'string' && typeof vb === 'string') cmp = va.localeCompare(vb)
        else cmp = (va as number) - (vb as number)
      }
      return sortDir === 'desc' ? -cmp : cmp
    })

    return sorted
  }, [players, teamFilter, search, posFilter, contractFilter, sortKey, sortDir])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' || key === 'team_abbreviation' || key === 'position' ? 'asc' : 'desc')
    }
  }

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const activeColumns = COLUMNS.filter(c => visibleColumns.has(c.key))

  return (
    <div>
      {/* Controls bar */}
      <div className="flex flex-col gap-3 mb-4">
        {/* Row 1: Search + Column toggle */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg className="w-3.5 h-3.5 text-[#5a5a64]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players..."
              className="w-full bg-[#0a0a0f] border border-[#1e1e2a] rounded-lg pl-9 pr-3 py-2 text-xs text-[#e8e6e3] placeholder-[#5a5a64] font-mono focus:outline-none focus:border-[#fbbf24]/50 transition-colors"
            />
          </div>

          {/* Column toggle */}
          <div className="relative" ref={columnsRef}>
            <button
              onClick={() => setColumnsOpen(!columnsOpen)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2a] rounded-lg font-mono text-[10px] text-[#8a8a94] hover:text-[#e8e6e3] hover:border-[#3a3a44] transition-colors uppercase tracking-wider"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              Columns
            </button>
            {columnsOpen && (
              <div className="absolute right-0 top-full mt-1 bg-[#111118] border border-[#1e1e2a] rounded-lg p-2 z-20 min-w-[160px] shadow-xl">
                {COLUMNS.map(col => (
                  <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-[#1e1e2a] rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      className="accent-[#fbbf24] w-3 h-3"
                    />
                    <span className="font-mono text-[10px] text-[#8a8a94] uppercase tracking-wider">{col.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Period */}
          <div className="flex items-center gap-0.5 bg-[#0a0a0f] border border-[#1e1e2a] rounded-lg p-0.5">
            {(Object.keys(periodLabels) as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider rounded-md transition-colors ${
                  period === p
                    ? 'bg-[#fbbf24] text-[#0a0a0f] font-bold'
                    : 'text-[#5a5a64] hover:text-[#e8e6e3]'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>

          {/* Position */}
          <div className="flex items-center gap-0.5 bg-[#0a0a0f] border border-[#1e1e2a] rounded-lg p-0.5">
            {(['', 'G', 'F', 'C'] as PositionFilter[]).map(pos => (
              <button
                key={pos}
                onClick={() => setPosFilter(pos)}
                className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider rounded-md transition-colors ${
                  posFilter === pos
                    ? 'bg-[#fbbf24] text-[#0a0a0f] font-bold'
                    : 'text-[#5a5a64] hover:text-[#e8e6e3]'
                }`}
              >
                {pos || 'All'}
              </button>
            ))}
          </div>

          {/* Contract */}
          <div className="flex items-center gap-0.5 bg-[#0a0a0f] border border-[#1e1e2a] rounded-lg p-0.5">
            {([
              { id: 'all', label: 'All' },
              { id: 'rookie', label: 'Rookie' },
              { id: 'vet', label: 'Vet' },
            ] as { id: ContractFilter; label: string }[]).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setContractFilter(id)}
                className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider rounded-md transition-colors ${
                  contractFilter === id
                    ? 'bg-[#fbbf24] text-[#0a0a0f] font-bold'
                    : 'text-[#5a5a64] hover:text-[#e8e6e3]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <span className="font-mono text-[10px] text-[#5a5a64] ml-auto">
            {filtered.length} players
          </span>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="border border-[#1e1e2a] rounded-xl overflow-hidden">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-10 border-b border-[#1e1e2a] animate-pulse bg-[#111118]" />
          ))}
        </div>
      ) : error ? (
        <div className="font-mono text-sm text-red-400 text-center py-12">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="font-mono text-sm text-[#5a5a64] text-center py-12">
          No players match your filters.
        </div>
      ) : (
        <div className="border border-[#1e1e2a] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e2a] bg-[#111118]">
                  <th className="text-left px-3 py-2.5 font-mono text-[10px] text-[#5a5a64] uppercase tracking-wider w-8">
                    #
                  </th>
                  {activeColumns.map(col => {
                    const desc = STAT_DESCRIPTIONS[col.shortLabel || col.label]
                    return (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.sortKey)}
                        className={`px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider cursor-pointer select-none hover:text-[#8a8a94] transition-colors whitespace-nowrap relative group ${
                          col.align === 'left' ? 'text-left' : col.align === 'right' ? 'text-right' : 'text-center'
                        } ${sortKey === col.sortKey ? 'text-[#fbbf24]' : 'text-[#5a5a64]'}`}
                      >
                        <span className={desc ? 'border-b border-dotted border-[#3a3a44]' : ''}>
                          {col.shortLabel || col.label}
                        </span>
                        {sortKey === col.sortKey && (
                          <span className="ml-0.5">{sortDir === 'desc' ? '\u25BC' : '\u25B2'}</span>
                        )}
                        {desc && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2.5 py-1.5 bg-[#1e1e2a] border border-[#2e2e3a] rounded-md text-[10px] font-mono text-[#8a8a94] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 shadow-lg normal-case tracking-normal">
                            {desc}
                          </div>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {paged.map((player, idx) => (
                  <tr
                    key={player.player_id}
                    onClick={() => onSelectPlayer(player.player_id)}
                    className="border-b border-[#1e1e2a] last:border-0 hover:bg-[#111118] cursor-pointer transition-colors group"
                  >
                    <td className="px-3 py-2.5 font-mono text-xs text-[#5a5a64]">
                      {page * PAGE_SIZE + idx + 1}
                    </td>
                    {activeColumns.map(col => (
                      <td
                        key={col.key}
                        className={`px-3 py-2.5 font-mono text-xs whitespace-nowrap ${
                          col.align === 'left' ? 'text-left' : col.align === 'right' ? 'text-right' : 'text-center'
                        } ${
                          col.key === 'name'
                            ? 'font-bold text-[#e8e6e3] group-hover:text-[#fbbf24] transition-colors'
                            : col.highlight
                              ? 'font-bold text-[#fbbf24]'
                              : 'text-[#8a8a94]'
                        }`}
                      >
                        {col.key === 'name' ? (
                          <div className="flex items-center gap-2">
                            <Headshot
                              nbaId={player.nba_id}
                              alt={`${player.first_name} ${player.last_name}`}
                              size={28}
                              rounded="full"
                            />
                            <span>{col.format(player)}</span>
                          </div>
                        ) : (
                          col.format(player)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#1e1e2a] bg-[#111118]">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="font-mono text-[10px] text-[#8a8a94] hover:text-[#fbbf24] transition-colors disabled:text-[#3a3a44] disabled:cursor-not-allowed uppercase tracking-wider"
              >
                Prev
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNum: number
                  if (totalPages <= 7) {
                    pageNum = i
                  } else if (page < 3) {
                    pageNum = i
                  } else if (page > totalPages - 4) {
                    pageNum = totalPages - 7 + i
                  } else {
                    pageNum = page - 3 + i
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-7 h-7 flex items-center justify-center rounded font-mono text-[10px] transition-colors ${
                        page === pageNum
                          ? 'bg-[#fbbf24]/15 text-[#fbbf24] font-bold'
                          : 'text-[#5a5a64] hover:text-[#8a8a94]'
                      }`}
                    >
                      {pageNum + 1}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="font-mono text-[10px] text-[#8a8a94] hover:text-[#fbbf24] transition-colors disabled:text-[#3a3a44] disabled:cursor-not-allowed uppercase tracking-wider"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

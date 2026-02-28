'use client'

import React, { useEffect, useState } from 'react'

interface Standing {
  team: {
    id: number
    conference: string
    division: string
    city: string
    name: string
    full_name: string
    abbreviation: string
  }
  conference_record: string
  conference_rank: number
  division_record: string
  division_rank: number
  wins: number
  losses: number
  home_record: string
  road_record: string
  season: number
}

const views = ['league', 'conference', 'division'] as const
type View = (typeof views)[number]
const viewLabels: Record<View, string> = { league: 'League', conference: 'Conference', division: 'Division' }

const divisionOrder = [
  { conference: 'East', divisions: ['Atlantic', 'Central', 'Southeast'] },
  { conference: 'West', divisions: ['Northwest', 'Pacific', 'Southwest'] },
]

export function StandingsTable({ season }: { season: number }) {
  const [standings, setStandings] = useState<Standing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState<View>('league')

  useEffect(() => {
    setLoading(true)
    setError('')
    fetch(`/api/nba/standings?season=${season}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load')
        return res.json()
      })
      .then(data => {
        setStandings(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load standings')
        setLoading(false)
      })
  }, [season])

  const cycleView = () => {
    const idx = views.indexOf(view)
    setView(views[(idx + 1) % views.length])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="font-mono text-sm text-[#5a5a64] animate-pulse">Loading standings...</span>
      </div>
    )
  }

  if (error) {
    return <div className="font-mono text-sm text-red-400 text-center py-8">{error}</div>
  }

  // Build grouped tables based on the current view
  let groups: { title: string; teams: Standing[] }[] = []

  if (view === 'league') {
    const sorted = [...standings].sort((a, b) => {
      const pctA = a.wins / (a.wins + a.losses || 1)
      const pctB = b.wins / (b.wins + b.losses || 1)
      return pctB - pctA
    })
    groups = [{ title: 'League Standings', teams: sorted }]
  } else if (view === 'conference') {
    groups = [
      {
        title: 'Eastern Conference',
        teams: standings
          .filter(s => s.team.conference === 'East')
          .sort((a, b) => a.conference_rank - b.conference_rank),
      },
      {
        title: 'Western Conference',
        teams: standings
          .filter(s => s.team.conference === 'West')
          .sort((a, b) => a.conference_rank - b.conference_rank),
      },
    ]
  } else {
    for (const conf of divisionOrder) {
      for (const div of conf.divisions) {
        groups.push({
          title: div,
          teams: standings
            .filter(s => s.team.division === div)
            .sort((a, b) => a.division_rank - b.division_rank),
        })
      }
    }
  }

  const gridClass =
    view === 'league'
      ? 'grid-cols-1'
      : view === 'conference'
      ? 'grid-cols-1 lg:grid-cols-2'
      : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {views.map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 font-mono text-xs rounded-md transition-colors ${
                view === v
                  ? 'bg-[#fbbf24]/10 text-[#fbbf24]'
                  : 'text-[#5a5a64] hover:text-[#8a8a94] hover:bg-[#1e1e2a]'
              }`}
            >
              {viewLabels[v]}
            </button>
          ))}
        </div>
        <button
          onClick={cycleView}
          className="font-mono text-[10px] text-[#5a5a64] hover:text-[#8a8a94] transition-colors flex items-center gap-1"
          title="Cycle view"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Tables */}
      <div className={`grid ${gridClass} gap-4`}>
        {groups.map(group => (
          <StandingsGroup
            key={group.title}
            title={group.title}
            teams={group.teams}
            view={view}
          />
        ))}
      </div>

      {/* Legend */}
      {view !== 'division' && (
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 justify-center">
          <LegendItem color="bg-emerald-500" label="Playoff Seed (1-6)" />
          <LegendItem color="bg-[#fbbf24]" label="Play-In (7-10)" />
          <LegendItem color="bg-red-500" label="Out of Contention (11-15)" />
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-[#5a5a64]">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
            Above .500
          </span>
        </div>
      )}
      {view === 'division' && (
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 justify-center">
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-[#5a5a64]">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
            Above .500
          </span>
        </div>
      )}
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[10px] text-[#5a5a64]">
      <span className={`inline-block w-2.5 h-1 rounded-full ${color} flex-shrink-0`} />
      {label}
    </span>
  )
}

function getZoneMeta(rank: number): { border: string; badge: string; badgeText: string; label: string } {
  if (rank <= 6) {
    return { border: 'border-l-emerald-500', badge: 'bg-emerald-500/15 text-emerald-400', badgeText: 'Playoffs', label: 'playoff' }
  }
  if (rank <= 10) {
    return { border: 'border-l-[#fbbf24]', badge: 'bg-[#fbbf24]/15 text-[#fbbf24]', badgeText: 'Play-In', label: 'playin' }
  }
  return { border: 'border-l-red-500/60', badge: 'bg-red-500/15 text-red-400', badgeText: 'Out', label: 'out' }
}

type SortKey = 'rank' | 'team' | 'wins' | 'losses' | 'pct'
type SortDir = 'asc' | 'desc'


function getSortedTeams(teams: Standing[], key: SortKey, dir: SortDir, view: View): Standing[] {
  const sorted = [...teams].sort((a, b) => {
    let cmp = 0
    switch (key) {
      case 'rank':
        cmp = view === 'division'
          ? a.division_rank - b.division_rank
          : view === 'conference'
          ? a.conference_rank - b.conference_rank
          : (b.wins / (b.wins + b.losses || 1)) - (a.wins / (a.wins + a.losses || 1))
        break
      case 'team':
        cmp = a.team.full_name.localeCompare(b.team.full_name)
        break
      case 'wins':
        cmp = a.wins - b.wins
        break
      case 'losses':
        cmp = a.losses - b.losses
        break
      case 'pct': {
        const pctA = a.wins / (a.wins + a.losses || 1)
        const pctB = b.wins / (b.wins + b.losses || 1)
        cmp = pctA - pctB
        break
      }
    }
    return dir === 'desc' ? -cmp : cmp
  })
  return sorted
}

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-0.5 text-[#3a3a44]">&#8597;</span>
  return <span className="ml-0.5 text-[#fbbf24]">{dir === 'asc' ? '\u25B2' : '\u25BC'}</span>
}

function StandingsGroup({
  title,
  teams,
  view,
}: {
  title: string
  teams: Standing[]
  view: View
}) {
  const [expanded, setExpanded] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const showZones = view === 'league' || view === 'conference'

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      // Default direction: descending for W/PCT (highest first), ascending for L/team/rank
      setSortDir(key === 'wins' || key === 'pct' ? 'desc' : 'asc')
    }
  }

  const sortedTeams = getSortedTeams(teams, sortKey, sortDir, view)
  const isSorted = sortKey !== 'rank'

  const thClass = 'py-2.5 cursor-pointer select-none hover:text-[#8a8a94] transition-colors whitespace-nowrap'

  return (
    <div className="border border-[#1e1e2a] rounded-xl overflow-hidden">
      <div className="bg-[#111118] px-4 py-3 border-b border-[#1e1e2a] flex items-center justify-between">
        <h3 className="font-mono font-bold text-[#fbbf24] text-sm">{title}</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="font-mono text-[10px] text-[#5a5a64] hover:text-[#8a8a94] transition-colors flex items-center gap-1"
        >
          {expanded ? 'Less' : 'More'}
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1e1e2a] text-[#5a5a64] font-mono text-xs">
            <th
              className={`text-left px-4 ${thClass}`}
              onClick={() => handleSort('rank')}
            >
              # <SortArrow active={sortKey === 'rank'} dir={sortDir} />
            </th>
            <th
              className={`text-left px-4 ${thClass}`}
              onClick={() => handleSort('team')}
            >
              Team <SortArrow active={sortKey === 'team'} dir={sortDir} />
            </th>
            <th
              className={`text-center px-3 ${thClass}`}
              onClick={() => handleSort('wins')}
            >
              W <SortArrow active={sortKey === 'wins'} dir={sortDir} />
            </th>
            <th
              className={`text-center px-3 ${thClass}`}
              onClick={() => handleSort('losses')}
            >
              L <SortArrow active={sortKey === 'losses'} dir={sortDir} />
            </th>
            <th
              className={`text-center px-3 ${thClass}`}
              onClick={() => handleSort('pct')}
            >
              PCT <SortArrow active={sortKey === 'pct'} dir={sortDir} />
            </th>
            {expanded && (
              <>
                <th className="text-center px-3 py-2.5">Home</th>
                <th className="text-center px-3 py-2.5">Road</th>
                {view !== 'division' && <th className="text-center px-3 py-2.5">Conf</th>}
                {view === 'division' && <th className="text-center px-3 py-2.5">Div</th>}
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {sortedTeams.map((s, idx) => {
            const origRank = view === 'division' ? s.division_rank : view === 'conference' ? s.conference_rank : null
            const displayRank = isSorted ? idx + 1 : (origRank ?? idx + 1)
            const zone = showZones ? getZoneMeta(s.conference_rank) : null
            const aboveFiveHundred = s.wins > s.losses
            // Only show zone dividers when using default rank sort
            const prevZone = showZones && !isSorted && idx > 0
              ? getZoneMeta(sortedTeams[idx - 1].conference_rank).label
              : null
            const currentZoneLabel = zone?.label ?? null
            const showDivider = showZones && !isSorted && prevZone !== null && prevZone !== currentZoneLabel
            const winPct = s.wins + s.losses > 0
              ? (s.wins / (s.wins + s.losses)).toFixed(3).replace(/^0/, '')
              : '.000'

            return (
              <tr
                key={s.team.id}
                className={`border-b border-[#1e1e2a] last:border-0 transition-colors hover:bg-[#111118] ${
                  zone ? `border-l-2 ${zone.border}` : ''
                } ${showDivider ? 'border-t-2 border-t-[#3a3a44]' : ''}`}
              >
                <td className="px-4 py-2.5 font-mono text-[#5a5a64] text-xs">{displayRank}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#e8e6e3] text-sm">
                      {expanded
                        ? s.team.full_name
                        : <><span className="hidden sm:inline">{s.team.full_name}</span><span className="sm:hidden">{s.team.abbreviation}</span></>
                      }
                    </span>
                    {aboveFiveHundred && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" title="Above .500" />
                    )}
                    {zone && (
                      <span className={`hidden lg:inline-block font-mono text-[9px] px-1.5 py-0.5 rounded ${zone.badge}`}>
                        {zone.badgeText}
                      </span>
                    )}
                  </div>
                </td>
                <td className="text-center px-3 py-2.5 font-mono text-[#e8e6e3]">{s.wins}</td>
                <td className="text-center px-3 py-2.5 font-mono text-[#8a8a94]">{s.losses}</td>
                <td className="text-center px-3 py-2.5 font-mono text-[#8a8a94] text-xs">{winPct}</td>
                {expanded && (
                  <>
                    <td className="text-center px-3 py-2.5 font-mono text-[#8a8a94] text-xs">{s.home_record}</td>
                    <td className="text-center px-3 py-2.5 font-mono text-[#8a8a94] text-xs">{s.road_record}</td>
                    <td className="text-center px-3 py-2.5 font-mono text-[#8a8a94] text-xs">
                      {view === 'division' ? s.division_record : s.conference_record}
                    </td>
                  </>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

'use client'

import React, { useEffect, useState } from 'react'
import { PointsTrendChart } from './StatChart'

// 2025-26 NBA salary cap
const NBA_CAP = 141_000_000

type StatsView = 'stats' | 'cost' | 'efficiency'
type GameFilter = 'all' | 'last3' | 'lastWeek' | 'thisMonth' | 'lastMonth'

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
  team?: {
    full_name: string
    abbreviation: string
    conference: string
    division: string
  } | null
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

interface AdvancedAvg {
  games_played: number
  pie: number
  true_shooting_percentage: number
  effective_field_goal_percentage: number
  net_rating: number
  offensive_rating: number
  defensive_rating: number
  usage_percentage: number
  assist_to_turnover: number
  pace: number
}

interface InjuryStatus {
  status: string
  description: string
  return_date: string | null
}

interface ContractYear {
  season: number
  salary: number | null
  player_option: boolean
  team_option: boolean
  qualifying_offer: boolean
  is_two_way: boolean
}

interface PlayerContract {
  team: { abbreviation: string; full_name: string } | null
  years: ContractYear[]
}

interface ContractAggregate {
  total_value: number | null
  years_remaining: number | null
  avg_annual_value: number | null
}

export function PlayerProfile({ playerId, season, onBack }: PlayerProfileProps) {
  const [player, setPlayer] = useState<PlayerData | null>(null)
  const [averages, setAverages] = useState<SeasonAvg[]>([])
  const [games, setGames] = useState<GameStat[]>([])
  const [advanced, setAdvanced] = useState<AdvancedAvg | null>(null)
  const [injury, setInjury] = useState<InjuryStatus | null>(null)
  const [contract, setContract] = useState<PlayerContract | null>(null)
  const [contractAggregate, setContractAggregate] = useState<ContractAggregate | null>(null)
  const [statsView, setStatsView] = useState<StatsView>('stats')
  const [gameFilter, setGameFilter] = useState<GameFilter>('all')
  const [loading, setLoading] = useState(true)
  const [gamesLoading, setGamesLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setGamesLoading(true)
    setAdvanced(null)
    setInjury(null)
    setContract(null)
    setContractAggregate(null)
    setStatsView('stats')
    setGameFilter('all')

    fetch(`/api/nba/players/${playerId}?season=${season}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setPlayer(null)
        } else {
          setPlayer(data.player ?? null)
          setAverages(data.seasonAverages || [])
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))

    fetch(`/api/nba/players/${playerId}/games?season=${season}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setGames(data)
        else setGames([])
        setGamesLoading(false)
      })
      .catch(() => { setGames([]); setGamesLoading(false) })

    fetch(`/api/nba/players/${playerId}/advanced?season=${season}`)
      .then(res => res.json())
      .then(data => {
        setAdvanced(data.averages ?? null)
        setInjury(data.injury ?? null)
      })
      .catch(() => {})

    fetch(`/api/nba/players/${playerId}/contracts`)
      .then(res => res.json())
      .then(data => {
        setContract(data.current ?? null)
        setContractAggregate(data.aggregate ?? null)
      })
      .catch(() => {})
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

  // Filter games based on selected window
  const now = new Date()
  const filteredGames = games.filter(g => {
    const d = new Date(g.game.date)
    if (gameFilter === 'last3') return false // handled by slice below
    if (gameFilter === 'lastWeek') {
      const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 7)
      return d >= cutoff
    }
    if (gameFilter === 'thisMonth') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }
    if (gameFilter === 'lastMonth') {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth()
    }
    return true // 'all'
  }).slice(0, gameFilter === 'last3' ? 3 : gameFilter === 'all' ? 15 : undefined)
  // For last3 we use a separate slice since filter would exclude all
  const displayGames = gameFilter === 'last3' ? games.slice(0, 3) : filteredGames

  // Build points trend from game log (reversed so oldest first)
  const trendData = [...displayGames].reverse().map(g => ({
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
                {player.team?.full_name || 'No Team'}
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
            {injury && (
              <div className="mt-2 flex items-start gap-2 bg-red-950/40 border border-red-500/20 rounded-lg px-3 py-2 max-w-lg">
                <span className="text-red-400 text-xs mt-0.5">⚠</span>
                <div>
                  <span className="font-mono text-xs font-bold text-red-400">{injury.status}</span>
                  {injury.return_date && (
                    <span className="font-mono text-xs text-[#5a5a64] ml-2">
                      Est. return: {new Date(injury.return_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                  {injury.description && (
                    <p className="font-mono text-[11px] text-[#8a8a94] mt-0.5 leading-relaxed">{injury.description}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Season averages */}
      {avg ? (() => {
        const currentSalary = contract?.years.find(y => y.season === season)?.salary ?? null
        const capPct = currentSalary != null ? (currentSalary / NBA_CAP) * 100 : null

        const rateStats: { label: string; value: number; highlight?: boolean }[] = [
          { label: 'PTS', value: avg.pts, highlight: true },
          { label: 'REB', value: avg.reb },
          { label: 'AST', value: avg.ast },
          { label: 'STL', value: avg.stl },
          { label: 'BLK', value: avg.blk },
          { label: 'PRA', value: avg.pts + avg.reb + avg.ast, highlight: true },
          { label: 'STOCKS', value: avg.stl + avg.blk },
          { label: 'TO', value: avg.turnover },
          { label: 'MIN', value: parseFloat(avg.min) || 0 },
        ]

        return (
          <div className="border border-brand-border rounded-xl p-5 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="font-mono font-bold text-brand-gold text-sm">
                  {season}-{(season + 1).toString().slice(-2)} Season Averages
                  <span className="text-brand-muted font-normal ml-2">({avg.games_played} GP)</span>
                </h3>
                {statsView !== 'stats' && currentSalary == null && (
                  <p className="font-mono text-[10px] text-brand-muted mt-0.5">No salary data for {season}-{String(season + 1).slice(-2)}</p>
                )}
              </div>
              {/* Toggle — only show cost/efficiency if we have salary */}
              <div className="flex items-center gap-1 bg-brand-black border border-brand-border rounded-lg p-0.5 self-start sm:self-auto">
                {([
                  { id: 'stats', label: 'Stats' },
                  { id: 'cost', label: '$/Stat', disabled: currentSalary == null },
                  { id: 'efficiency', label: 'Stat/1% Cap', disabled: capPct == null },
                ] as { id: StatsView; label: string; disabled?: boolean }[]).map(({ id, label, disabled }) => (
                  <button
                    key={id}
                    onClick={() => !disabled && setStatsView(id)}
                    disabled={disabled}
                    className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider rounded-md transition-colors ${
                      statsView === id
                        ? 'bg-brand-gold text-brand-black font-bold'
                        : disabled
                        ? 'text-brand-dim cursor-not-allowed'
                        : 'text-brand-muted hover:text-brand-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {statsView === 'stats' && (
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
            )}

            {statsView === 'cost' && currentSalary != null && (
              <div>
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-4 mb-3">
                  {rateStats.map(({ label, value, highlight }) => (
                    <StatBadge
                      key={label}
                      label={`$ / ${label}`}
                      value={value > 0 ? formatSalary(currentSalary / value) : '—'}
                      highlight={highlight}
                    />
                  ))}
                </div>
                <p className="font-mono text-[10px] text-brand-muted">
                  Based on {formatSalary(currentSalary)} salary · lower = more efficient
                </p>
              </div>
            )}

            {statsView === 'efficiency' && capPct != null && (
              <div>
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-4 mb-3">
                  {rateStats.map(({ label, value, highlight }) => (
                    <StatBadge
                      key={label}
                      label={`${label} / 1%`}
                      value={value > 0 ? (value / capPct).toFixed(2) : '—'}
                      highlight={highlight}
                    />
                  ))}
                </div>
                <p className="font-mono text-[10px] text-brand-muted">
                  {capPct.toFixed(1)}% of cap ({formatSalary(currentSalary!)}) · higher = more efficient
                </p>
              </div>
            )}
          </div>
        )
      })() : (
        <div className="border border-[#1e1e2a] rounded-xl p-5 mb-6">
          <p className="font-mono text-sm text-[#5a5a64] text-center">
            No season averages available for {season}-{(season + 1).toString().slice(-2)}
          </p>
        </div>
      )}

      {/* Advanced stats */}
      {advanced && (
        <div className="border border-[#1e1e2a] rounded-xl p-5 mb-6">
          <h3 className="font-mono font-bold text-[#fbbf24] text-sm mb-4">
            Advanced Stats
            <span className="text-[#5a5a64] font-normal ml-2">({advanced.games_played} GP avg)</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
            <AdvBadge
              label="TS%"
              value={(advanced.true_shooting_percentage * 100).toFixed(1)}
              suffix="%"
              tooltip="True Shooting %"
              highlight
            />
            <AdvBadge
              label="eFG%"
              value={(advanced.effective_field_goal_percentage * 100).toFixed(1)}
              suffix="%"
              tooltip="Effective FG %"
              highlight
            />
            <AdvBadge
              label="NET RTG"
              value={advanced.net_rating.toFixed(1)}
              signed
              tooltip="Net Rating (per 100 possessions)"
            />
            <AdvBadge
              label="O-RTG"
              value={advanced.offensive_rating.toFixed(1)}
              tooltip="Offensive Rating (per 100 possessions)"
            />
            <AdvBadge
              label="D-RTG"
              value={advanced.defensive_rating.toFixed(1)}
              tooltip="Defensive Rating (per 100 possessions)"
              lowerBetter
            />
            <AdvBadge
              label="USG%"
              value={(advanced.usage_percentage * 100).toFixed(1)}
              suffix="%"
              tooltip="Usage Rate"
            />
            <AdvBadge
              label="AST/TO"
              value={advanced.assist_to_turnover.toFixed(2)}
              tooltip="Assist-to-Turnover Ratio"
            />
            <AdvBadge
              label="PIE"
              value={(advanced.pie * 100).toFixed(1)}
              suffix="%"
              tooltip="Player Impact Estimate"
              highlight
            />
            <AdvBadge
              label="PACE"
              value={advanced.pace.toFixed(1)}
              tooltip="Team pace (possessions per 48 min)"
            />
          </div>
        </div>
      )}

      {/* Contract */}
      {contract && Array.isArray(contract.years) && contract.years.length > 0 && (
        <div className="border border-[#1e1e2a] rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-mono font-bold text-[#fbbf24] text-sm">Contract</h3>
            {contractAggregate?.total_value != null && (
              <span className="font-mono text-xs text-[#5a5a64]">
                Total: {formatSalary(contractAggregate.total_value)}
                {contractAggregate.avg_annual_value != null && (
                  <span className="ml-2">· AAV: {formatSalary(contractAggregate.avg_annual_value)}</span>
                )}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e2a] text-[#5a5a64] font-mono text-[10px] uppercase tracking-wider">
                  <th className="text-left pb-2 pr-4">Season</th>
                  <th className="text-right pb-2 px-3">Salary</th>
                  <th className="text-center pb-2 px-3 hidden sm:table-cell">Type</th>
                </tr>
              </thead>
              <tbody>
                {contract.years.map((y) => {
                  const isCurrent = y.season === season
                  const optionTag = y.player_option
                    ? 'PO'
                    : y.team_option
                    ? 'TO'
                    : y.qualifying_offer
                    ? 'QO'
                    : y.is_two_way
                    ? '2W'
                    : null
                  return (
                    <tr
                      key={y.season}
                      className={`border-b border-[#1e1e2a] last:border-0 ${isCurrent ? 'bg-[#fbbf24]/5' : ''}`}
                    >
                      <td className="py-2.5 pr-4 font-mono text-xs text-[#8a8a94] whitespace-nowrap">
                        {y.season}-{String(y.season + 1).slice(-2)}
                        {isCurrent && (
                          <span className="ml-1.5 text-[#fbbf24] text-[9px] font-bold uppercase tracking-widest">
                            Current
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs text-right font-bold text-[#e8e6e3] whitespace-nowrap">
                        {y.salary != null ? formatSalary(y.salary) : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-center hidden sm:table-cell">
                        {optionTag ? (
                          <span className="px-1.5 py-0.5 rounded bg-[#1e1e2a] text-[#8a8a94] border border-[#2e2e3a]">
                            {optionTag}
                          </span>
                        ) : (
                          <span className="text-[#3a3a44]">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-mono text-[#5a5a64]">
            <span>PO = Player Option</span>
            <span>TO = Team Option</span>
            <span>QO = Qualifying Offer</span>
            <span>2W = Two-Way</span>
          </div>
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
        <div className="bg-[#111118] px-4 py-3 border-b border-[#1e1e2a] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="font-mono font-bold text-[#fbbf24] text-sm">
            Game Log
            {!gamesLoading && <span className="text-[#5a5a64] font-normal ml-2">({displayGames.length} games)</span>}
          </h3>
          <div className="flex items-center gap-1">
            {([
              { id: 'all', label: 'Recent' },
              { id: 'last3', label: 'L3' },
              { id: 'lastWeek', label: '7 Days' },
              { id: 'thisMonth', label: 'This Mo.' },
              { id: 'lastMonth', label: 'Last Mo.' },
            ] as { id: GameFilter; label: string }[]).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setGameFilter(id)}
                className={`px-2 py-1 font-mono text-[9px] uppercase tracking-wider rounded transition-colors ${
                  gameFilter === id
                    ? 'bg-brand-gold/15 text-brand-gold border border-brand-gold/30'
                    : 'text-brand-muted hover:text-brand-white border border-transparent'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {gamesLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="font-mono text-sm text-[#5a5a64] animate-pulse">Loading games...</span>
          </div>
        ) : displayGames.length === 0 ? (
          <div className="py-8 text-center">
            <span className="font-mono text-sm text-[#5a5a64]">No games in this window</span>
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
                {displayGames.map(g => {
                  const teamAbbr = g.team?.abbreviation || ''
                  const isHome = teamAbbr === g.game.home_team?.abbreviation
                  const opponent = isHome ? g.game.visitor_team?.abbreviation : g.game.home_team?.abbreviation
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

function formatSalary(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value}`
}

function AdvBadge({
  label, value, suffix = '', signed = false, highlight = false, lowerBetter = false, tooltip,
}: {
  label: string; value: string; suffix?: string; signed?: boolean
  highlight?: boolean; lowerBetter?: boolean; tooltip?: string
}) {
  const num = parseFloat(value)
  let color = 'text-[#e8e6e3]'
  if (highlight) color = 'text-[#fbbf24]'
  else if (signed) color = num >= 0 ? 'text-emerald-400' : 'text-red-400'
  else if (lowerBetter) color = num <= 108 ? 'text-emerald-400' : num <= 115 ? 'text-[#e8e6e3]' : 'text-red-400'

  return (
    <div className="text-center group relative">
      <div className="text-[#5a5a64] font-mono text-[10px] uppercase tracking-wider mb-1">{label}</div>
      <div className={`font-mono text-lg font-bold ${color}`}>
        {signed && num > 0 ? '+' : ''}{value}{suffix}
      </div>
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-[#1e1e2a] border border-[#2e2e3a] rounded text-[10px] font-mono text-[#8a8a94] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          {tooltip}
        </div>
      )}
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

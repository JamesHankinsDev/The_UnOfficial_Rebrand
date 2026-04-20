'use client'

import React, { useState } from 'react'
import { StandingsTable } from '@/components/analytics/StandingsTable'
import { Scoreboard } from '@/components/analytics/Scoreboard'
import { PlayerSearch } from '@/components/analytics/PlayerSearch'
import { PlayerProfile } from '@/components/analytics/PlayerProfile'
import { PlayerComparison } from '@/components/analytics/PlayerComparison'
import { PlayerGrid } from '@/components/analytics/PlayerGrid'
import { HotColdStreaks } from '@/components/analytics/HotColdStreaks'
import { PlayerWatchlist } from '@/components/analytics/PlayerWatchlist'
import { TeamSalaryExplorer } from '@/components/analytics/TeamSalaryExplorer'

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'players', label: 'Players' },
  { id: 'compare', label: 'Compare' },
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'teams', label: 'Teams' },
] as const

type TabId = (typeof tabs)[number]['id']

const currentSeason = 2025

interface TeamSelection {
  abbreviation: string
  full_name: string
}

type PeriodFilter = 'regular' | 'postseason'

const POSTSEASON_DISABLED_TABS: Record<TabId, boolean> = {
  overview: false,
  players: false,
  compare: false,
  watchlist: false,
  teams: true,
}

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<TeamSelection | null>(null)
  const [season, setSeason] = useState(currentSeason)
  const [period, setPeriod] = useState<PeriodFilter>('regular')
  const postseason = period === 'postseason'

  const handleSelectTeam = (team: TeamSelection) => {
    setSelectedTeam(team)
    setSelectedPlayerId(null)
    setActiveTab('players')
  }

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId)
    setSelectedPlayerId(null)
    setSelectedTeam(null)
  }

  const navigateToPlayer = (id: number) => {
    setSelectedPlayerId(id)
    setActiveTab('players')
  }

  const periodSupported = !POSTSEASON_DISABLED_TABS[activeTab]

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-mono font-bold text-[#e8e6e3] text-2xl">Analytics</h1>
          <p className="font-mono text-sm text-[#5a5a64] mt-1">Research NBA stats and metrics for your articles</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Regular / Postseason toggle */}
          <div className="flex items-center gap-1 bg-[#111118] border border-[#1e1e2a] rounded-lg p-1">
            {(['regular', 'postseason'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs font-mono tracking-widest uppercase rounded-md transition-colors ${
                  period === p
                    ? 'bg-[#fbbf24]/15 text-[#fbbf24]'
                    : 'text-[#5a5a64] hover:text-[#e8e6e3]'
                }`}
              >
                {p === 'regular' ? 'Regular' : 'Playoffs'}
              </button>
            ))}
          </div>

          {/* Season selector */}
          <div className="flex items-center gap-2">
            <label className="font-mono text-xs text-[#5a5a64]">Season</label>
            <select
              value={season}
              onChange={(e) => {
                setSeason(parseInt(e.target.value, 10))
                setSelectedPlayerId(null)
                setSelectedTeam(null)
              }}
              className="bg-[#111118] border border-[#1e1e2a] text-[#e8e6e3] text-sm font-mono rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#fbbf24] transition-colors"
            >
              {Array.from({ length: 10 }, (_, i) => currentSeason - i).map(y => (
                <option key={y} value={y}>
                  {y}-{(y + 1).toString().slice(-2)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {postseason && !periodSupported && (
        <div className="mb-4 bg-[#fbbf24]/10 border border-[#fbbf24]/30 rounded-lg px-4 py-2 font-mono text-xs text-[#fbbf24]">
          This tab ignores the Playoffs filter &mdash; salary data is season-wide.
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[#1e1e2a] mb-6 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex-shrink-0 px-4 py-2.5 font-mono text-sm font-bold transition-colors relative ${
              activeTab === tab.id
                ? 'text-[#fbbf24]'
                : 'text-[#5a5a64] hover:text-[#8a8a94]'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#fbbf24]" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <section>
            <h2 className="font-mono font-bold text-[#e8e6e3] text-base mb-4">Conference Standings</h2>
            <StandingsTable season={season} onSelectTeam={handleSelectTeam} />
          </section>
          <section>
            <h2 className="font-mono font-bold text-[#e8e6e3] text-base mb-4">Recent Scores</h2>
            <Scoreboard onSelectTeam={handleSelectTeam} />
          </section>
          <section>
            <h2 className="font-mono font-bold text-[#e8e6e3] text-base mb-4">
              Hot &amp; Cold Streaks
              {postseason && (
                <span className="ml-2 font-mono text-[10px] tracking-widest uppercase text-[#fbbf24]">
                  Playoffs
                </span>
              )}
            </h2>
            <HotColdStreaks
              season={season}
              postseason={postseason}
              onSelectPlayer={navigateToPlayer}
            />
          </section>
        </div>
      )}

      {activeTab === 'players' && (
        <div>
          {selectedPlayerId ? (
            <PlayerProfile
              playerId={selectedPlayerId}
              season={season}
              postseason={postseason}
              onBack={() => setSelectedPlayerId(null)}
              backLabel={selectedTeam ? `Back to ${selectedTeam.full_name}` : undefined}
            />
          ) : (
            <div>
              {/* Quick search — jumps directly to a player profile */}
              <div className="max-w-sm mb-4">
                <PlayerSearch onSelect={(p) => setSelectedPlayerId(p.id)} />
              </div>

              {/* Team filter pill */}
              {selectedTeam && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="font-mono text-xs text-[#5a5a64]">Filtered by:</span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#fbbf24]/10 text-[#fbbf24] font-mono text-xs font-bold rounded-lg border border-[#fbbf24]/20">
                    {selectedTeam.full_name}
                    <button
                      onClick={() => setSelectedTeam(null)}
                      className="text-[#fbbf24]/60 hover:text-[#fbbf24] transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                </div>
              )}

              <PlayerGrid
                season={season}
                postseason={postseason}
                onSelectPlayer={(id) => setSelectedPlayerId(id)}
                teamFilter={selectedTeam}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'compare' && (
        <PlayerComparison season={season} postseason={postseason} />
      )}

      {activeTab === 'watchlist' && (
        <PlayerWatchlist
          season={season}
          postseason={postseason}
          onSelectPlayer={navigateToPlayer}
        />
      )}

      {activeTab === 'teams' && (
        <TeamSalaryExplorer season={season} onSelectPlayer={navigateToPlayer} />
      )}
    </div>
  )
}

'use client'

import React, { useState } from 'react'
import { StandingsTable } from '@/components/analytics/StandingsTable'
import { Scoreboard } from '@/components/analytics/Scoreboard'
import { PlayerSearch } from '@/components/analytics/PlayerSearch'
import { PlayerProfile } from '@/components/analytics/PlayerProfile'
import { PlayerComparison } from '@/components/analytics/PlayerComparison'

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'players', label: 'Players' },
  { id: 'compare', label: 'Compare' },
] as const

type TabId = (typeof tabs)[number]['id']

const currentSeason = 2025

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null)
  const [season, setSeason] = useState(currentSeason)

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-mono font-bold text-[#e8e6e3] text-2xl">Analytics</h1>
          <p className="font-mono text-sm text-[#5a5a64] mt-1">Research NBA stats and metrics for your articles</p>
        </div>

        {/* Season selector */}
        <div className="flex items-center gap-2">
          <label className="font-mono text-xs text-[#5a5a64]">Season</label>
          <select
            value={season}
            onChange={(e) => {
              setSeason(parseInt(e.target.value, 10))
              setSelectedPlayerId(null)
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

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[#1e1e2a] mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              setSelectedPlayerId(null)
            }}
            className={`px-4 py-2.5 font-mono text-sm font-bold transition-colors relative ${
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
            <StandingsTable season={season} />
          </section>
          <section>
            <h2 className="font-mono font-bold text-[#e8e6e3] text-base mb-4">Recent Scores</h2>
            <Scoreboard />
          </section>
        </div>
      )}

      {activeTab === 'players' && (
        <div>
          {selectedPlayerId ? (
            <PlayerProfile
              playerId={selectedPlayerId}
              season={season}
              onBack={() => setSelectedPlayerId(null)}
            />
          ) : (
            <div>
              <div className="max-w-md mb-6">
                <PlayerSearch onSelect={(p) => setSelectedPlayerId(p.id)} />
              </div>
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-[#1e1e2a] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="font-mono text-sm text-[#5a5a64]">
                  Search for a player to view their stats, game log, and scoring trends
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'compare' && (
        <PlayerComparison season={season} />
      )}
    </div>
  )
}

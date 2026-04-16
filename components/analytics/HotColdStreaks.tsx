'use client'

import React, { useState, useEffect } from 'react'

interface TrendDeviation {
  stat: string
  season_avg: number
  recent_avg: number
  pct_change: number
  direction: 'up' | 'down'
}

interface TrendPlayer {
  player_id: number
  first_name: string
  last_name: string
  team_abbreviation: string
  position: string
  deviations: TrendDeviation[]
  max_deviation: number
}

interface HotColdStreaksProps {
  season: number
  onSelectPlayer: (playerId: number) => void
}

export function HotColdStreaks({ season, onSelectPlayer }: HotColdStreaksProps) {
  const [data, setData] = useState<{ trending_up: TrendPlayer[]; trending_down: TrendPlayer[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/nba/trends?season=${season}`)
      .then(res => res.ok ? res.json() : null)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [season])

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1].map(i => (
          <div key={i} className="space-y-3">
            {[0, 1, 2].map(j => (
              <div key={j} className="h-20 bg-[#111118] border border-[#1e1e2a] rounded-xl animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (!data || (data.trending_up.length === 0 && data.trending_down.length === 0)) {
    return (
      <div className="text-center py-8 font-mono text-sm text-[#5a5a64]">
        No significant trends detected in the last 5 games.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Trending Up */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-emerald-400 text-sm">&#9650;</span>
          <span className="font-mono text-xs text-emerald-400 uppercase tracking-widest font-bold">Trending Up</span>
        </div>
        {data.trending_up.length === 0 ? (
          <p className="font-mono text-xs text-[#5a5a64]">No players trending up significantly.</p>
        ) : (
          <div className="space-y-2">
            {data.trending_up.map((player, idx) => (
              <TrendCard key={player.player_id} player={player} rank={idx + 1} onSelect={onSelectPlayer} />
            ))}
          </div>
        )}
      </div>

      {/* Trending Down */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-red-400 text-sm">&#9660;</span>
          <span className="font-mono text-xs text-red-400 uppercase tracking-widest font-bold">Trending Down</span>
        </div>
        {data.trending_down.length === 0 ? (
          <p className="font-mono text-xs text-[#5a5a64]">No players trending down significantly.</p>
        ) : (
          <div className="space-y-2">
            {data.trending_down.map((player, idx) => (
              <TrendCard key={player.player_id} player={player} rank={idx + 1} onSelect={onSelectPlayer} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TrendCard({ player, rank, onSelect }: { player: TrendPlayer; rank: number; onSelect: (id: number) => void }) {
  return (
    <div
      onClick={() => onSelect(player.player_id)}
      className="bg-[#111118] border border-[#1e1e2a] rounded-xl p-4 cursor-pointer hover:border-[#3a3a44] transition-colors group"
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="font-mono text-xs text-[#5a5a64] w-5">{rank}</span>
        <span className="font-mono text-sm font-bold text-[#e8e6e3] group-hover:text-[#fbbf24] transition-colors">
          {player.first_name} {player.last_name}
        </span>
        <span className="font-mono text-xs text-[#5a5a64]">{player.team_abbreviation}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 pl-8">
        {player.deviations.map(d => (
          <DeviationBadge key={d.stat} d={d} />
        ))}
      </div>
    </div>
  )
}

function DeviationBadge({ d }: { d: TrendDeviation }) {
  const isUp = d.direction === 'up'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
      isUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
    }`}>
      <span className="uppercase">{d.stat}</span>
      <span className="text-[#5a5a64]">{d.season_avg.toFixed(1)}</span>
      <span>&#8594;</span>
      <span>{d.recent_avg.toFixed(1)}</span>
      <span>({isUp ? '+' : ''}{d.pct_change.toFixed(0)}%)</span>
    </span>
  )
}

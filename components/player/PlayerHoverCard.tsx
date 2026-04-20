'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Headshot } from '@/components/analytics/Headshot'
import { fetchQuickView, type QuickViewPayload } from './quickViewCache'

type Period = 'regular' | 'postseason'

interface PlayerHoverCardProps {
  playerId: number
  fallbackName?: string
}

export function PlayerHoverCard({ playerId, fallbackName }: PlayerHoverCardProps) {
  const [data, setData] = useState<QuickViewPayload | null>(null)
  const [error, setError] = useState(false)
  const [period, setPeriod] = useState<Period>('regular')

  useEffect(() => {
    let cancelled = false
    fetchQuickView(playerId)
      .then((payload) => {
        if (cancelled) return
        setData(payload)
        // Default to postseason if we have postseason data and no regular season
        if (!payload.regular_season && payload.postseason) setPeriod('postseason')
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [playerId])

  const stats = data
    ? period === 'postseason'
      ? data.postseason
      : data.regular_season
    : null

  const psDisabled = !data || !data.postseason
  const rsDisabled = !data || !data.regular_season

  return (
    <div className="w-[280px] bg-[#111118] border border-[#1e1e2a] rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[#1e1e2a]">
        <Headshot
          nbaId={data?.nba_id ?? null}
          alt={data ? `${data.first_name} ${data.last_name}` : fallbackName ?? 'Player'}
          size={56}
          rounded="full"
        />
        <div className="min-w-0 flex-1">
          <div className="font-mono font-bold text-sm text-[#e8e6e3] truncate">
            {data ? `${data.first_name} ${data.last_name}` : fallbackName ?? 'Loading…'}
          </div>
          <div className="font-mono text-[10px] text-[#5a5a64] uppercase tracking-widest mt-0.5 truncate">
            {data?.team?.abbreviation ?? ''}
            {data?.position ? ` · ${data.position}` : ''}
            {data?.age != null ? ` · Age ${data.age}` : ''}
          </div>
        </div>
      </div>

      {/* Period toggle */}
      <div className="flex gap-0.5 p-2 border-b border-[#1e1e2a] bg-[#0a0a0f]">
        <button
          type="button"
          disabled={rsDisabled}
          onClick={() => setPeriod('regular')}
          className={`flex-1 px-2 py-1 text-[10px] font-mono tracking-widest uppercase rounded transition-colors ${
            period === 'regular'
              ? 'bg-[#fbbf24]/15 text-[#fbbf24]'
              : rsDisabled
                ? 'text-[#3a3a44] cursor-not-allowed'
                : 'text-[#5a5a64] hover:text-[#e8e6e3]'
          }`}
        >
          Regular
        </button>
        <button
          type="button"
          disabled={psDisabled}
          onClick={() => setPeriod('postseason')}
          className={`flex-1 px-2 py-1 text-[10px] font-mono tracking-widest uppercase rounded transition-colors ${
            period === 'postseason'
              ? 'bg-[#fbbf24]/15 text-[#fbbf24]'
              : psDisabled
                ? 'text-[#3a3a44] cursor-not-allowed'
                : 'text-[#5a5a64] hover:text-[#e8e6e3]'
          }`}
        >
          Playoffs
        </button>
      </div>

      {/* Stats */}
      <div className="p-4">
        {error ? (
          <div className="font-mono text-xs text-[#5a5a64] text-center py-2">
            Could not load stats.
          </div>
        ) : !data ? (
          <StatGridSkeleton />
        ) : !stats ? (
          <div className="font-mono text-xs text-[#5a5a64] text-center py-2">
            No {period === 'postseason' ? 'postseason' : 'regular season'} data.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <StatCell label="PTS" value={stats.pts.toFixed(1)} highlight />
              <StatCell label="REB" value={stats.reb.toFixed(1)} />
              <StatCell label="AST" value={stats.ast.toFixed(1)} />
              <StatCell label="STL" value={stats.stl.toFixed(1)} />
              <StatCell label="BLK" value={stats.blk.toFixed(1)} />
              <StatCell label="FG%" value={(stats.fg_pct * 100).toFixed(1)} />
            </div>
            <div className="mt-3 font-mono text-[10px] text-[#5a5a64] text-center tracking-widest uppercase">
              {stats.games_played} games
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      {data && (
        <div className="border-t border-[#1e1e2a] px-4 py-2.5 bg-[#0a0a0f]">
          <Link
            href={`/players/${data.player_id}`}
            className="font-mono text-[10px] tracking-widest uppercase text-[#fbbf24] hover:underline"
          >
            Full Profile &rarr;
          </Link>
        </div>
      )}
    </div>
  )
}

function StatCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-[#0a0a0f] border border-[#1e1e2a] rounded-md px-2 py-1.5 text-center">
      <div className="font-mono text-[9px] tracking-widest uppercase text-[#5a5a64]">
        {label}
      </div>
      <div
        className={`font-mono font-bold text-sm ${
          highlight ? 'text-[#fbbf24]' : 'text-[#e8e6e3]'
        }`}
      >
        {value}
      </div>
    </div>
  )
}

function StatGridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-[42px] bg-[#0a0a0f] border border-[#1e1e2a] rounded-md animate-pulse"
        />
      ))}
    </div>
  )
}

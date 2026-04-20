'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useWatchlist } from '@/hooks/useWatchlist'
import { PlayerSearch } from './PlayerSearch'
import { Headshot } from './Headshot'

interface PlayerData {
  id: number
  first_name: string
  last_name: string
  position: string
  team?: { full_name: string; abbreviation: string } | null
}

interface SeasonAvg {
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  games_played: number
}

interface WatchedPlayer {
  player: PlayerData
  avg: SeasonAvg | null
  nbaId: number | null
  age: number | null
}

interface PlayerWatchlistProps {
  season: number
  postseason?: boolean
  onSelectPlayer: (playerId: number) => void
}

export function PlayerWatchlist({ season, postseason = false, onSelectPlayer }: PlayerWatchlistProps) {
  const { watchedIds, addToWatchlist, removeFromWatchlist } = useWatchlist()
  const [players, setPlayers] = useState<Map<number, WatchedPlayer>>(new Map())
  const [loading, setLoading] = useState(false)
  const fetchedRef = useRef<Set<number>>(new Set())

  // Fetch data for watched players we don't have yet
  useEffect(() => {
    const toFetch = watchedIds.filter(id => !fetchedRef.current.has(id))
    if (toFetch.length === 0) return

    const ps = postseason ? '&postseason=true' : ''
    setLoading(true)
    Promise.all(
      toFetch.map(id =>
        fetch(`/api/nba/players/${id}?season=${season}${ps}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (!data || data.error) return null
            return {
              id,
              player: data.player as PlayerData,
              avg: (data.seasonAverages?.[0] as SeasonAvg) ?? null,
              nbaId: (data.nba_id as number | null) ?? null,
              age: ((data.bio?.age as number | null) ?? null),
            }
          })
          .catch(() => null),
      ),
    ).then(results => {
      setPlayers(prev => {
        const next = new Map(prev)
        for (const r of results) {
          if (r) {
            next.set(r.id, { player: r.player, avg: r.avg, nbaId: r.nbaId, age: r.age })
            fetchedRef.current.add(r.id)
          }
        }
        return next
      })
      setLoading(false)
    })
  }, [watchedIds, season, postseason])

  // Clear cache on season/period change
  useEffect(() => {
    fetchedRef.current.clear()
    setPlayers(new Map())
  }, [season, postseason])

  // Remove players no longer watched from the map
  const watchedPlayers = watchedIds
    .map(id => ({ id, data: players.get(id) }))
    .filter(x => x.data != null) as { id: number; data: WatchedPlayer }[]

  return (
    <div>
      {/* Add player */}
      <div className="max-w-sm mb-6">
        <div className="font-mono text-xs text-[#5a5a64] uppercase tracking-wider mb-2">Add to Watchlist</div>
        <PlayerSearch
          onSelect={(p) => addToWatchlist(p.id)}
          placeholder="Search player to watch..."
        />
      </div>

      {/* Cards */}
      {watchedIds.length === 0 ? (
        <div className="text-center py-16">
          <div className="font-mono text-sm text-[#5a5a64] mb-1">No players on your watchlist.</div>
          <div className="font-mono text-xs text-[#3a3a44]">Search and add players to track for your articles.</div>
        </div>
      ) : loading && watchedPlayers.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {watchedIds.map(id => (
            <div key={id} className="h-32 bg-[#111118] border border-[#1e1e2a] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {watchedPlayers.map(({ id, data }) => (
            <div
              key={id}
              className="bg-[#111118] border border-[#1e1e2a] rounded-xl p-4 relative group hover:border-[#3a3a44] transition-colors"
            >
              {/* Remove button */}
              <button
                onClick={(e) => { e.stopPropagation(); removeFromWatchlist(id) }}
                className="absolute top-3 right-3 text-[#5a5a64] hover:text-red-400 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Player info — clickable */}
              <div className="cursor-pointer" onClick={() => onSelectPlayer(id)}>
                <div className="flex items-center gap-3 mb-3">
                  <Headshot
                    nbaId={data.nbaId}
                    alt={`${data.player.first_name} ${data.player.last_name}`}
                    size={40}
                    rounded="full"
                  />
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-bold text-[#e8e6e3] group-hover:text-[#fbbf24] transition-colors truncate">
                      {data.player.first_name} {data.player.last_name}
                    </div>
                    <div className="font-mono text-xs text-[#5a5a64] truncate">
                      {data.player.team?.abbreviation ?? '—'}
                      {data.player.position ? ` · ${data.player.position}` : ''}
                      {data.age != null ? ` · Age ${data.age}` : ''}
                    </div>
                  </div>
                </div>

                {data.avg ? (
                  <div className="grid grid-cols-4 gap-2">
                    <StatMini label="PTS" value={data.avg.pts.toFixed(1)} highlight />
                    <StatMini label="REB" value={data.avg.reb.toFixed(1)} />
                    <StatMini label="AST" value={data.avg.ast.toFixed(1)} />
                    <StatMini label="PRA" value={(data.avg.pts + data.avg.reb + data.avg.ast).toFixed(1)} highlight />
                  </div>
                ) : (
                  <div className="font-mono text-xs text-[#3a3a44]">No stats available</div>
                )}
              </div>
            </div>
          ))}

          {/* Loading placeholders for players still fetching */}
          {watchedIds
            .filter(id => !players.has(id))
            .map(id => (
              <div key={id} className="h-32 bg-[#111118] border border-[#1e1e2a] rounded-xl animate-pulse" />
            ))}
        </div>
      )}
    </div>
  )
}

function StatMini({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <div className="font-mono text-[9px] text-[#5a5a64] uppercase tracking-wider">{label}</div>
      <div className={`font-mono text-sm font-bold ${highlight ? 'text-[#fbbf24]' : 'text-[#e8e6e3]'}`}>
        {value}
      </div>
    </div>
  )
}

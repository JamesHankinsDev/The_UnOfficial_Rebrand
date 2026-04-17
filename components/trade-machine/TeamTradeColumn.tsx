'use client'

import React, { useState, useMemo } from 'react'
import { CapStatusBadge } from './CapStatusBadge'
import { TradePlayerCard } from './TradePlayerCard'
import {
  formatSalary,
  type TradePlayer,
  type TeamTradeResult,
} from '@/lib/trade-rules'
import type { TradeTeamData, TradeDestination } from '@/hooks/useTradeMachine'

interface TeamTradeColumnProps {
  slotIndex: number
  team: TradeTeamData | null
  outgoing: TradeDestination[]
  incoming: TradePlayer[]
  loading: boolean
  teamCount: 2 | 3
  allTeams: { id: number; abbreviation: string; full_name: string }[]
  otherTeamSlots: { index: number; abbreviation: string }[]
  onSelectTeam: (teamId: number) => void
  onTogglePlayer: (player: TradePlayer, toTeamIndex: number) => void
  onRemovePlayer: (playerId: number) => void
  onRemoveSlot?: () => void
  teamResult: TeamTradeResult | null
  usedTeamIds: number[]
}

export const TeamTradeColumn = React.memo(function TeamTradeColumn({
  slotIndex,
  team,
  outgoing,
  incoming,
  loading,
  teamCount,
  allTeams,
  otherTeamSlots,
  onSelectTeam,
  onTogglePlayer,
  onRemovePlayer,
  onRemoveSlot,
  teamResult,
  usedTeamIds,
}: TeamTradeColumnProps) {
  const [filter, setFilter] = useState('')
  const [destPickerPlayer, setDestPickerPlayer] = useState<TradePlayer | null>(null)

  const outgoingIds = useMemo(
    () => new Set(outgoing.map(d => d.player.player_id)),
    [outgoing],
  )

  const filteredRoster = useMemo(() => {
    if (!team) return []
    const q = filter.toLowerCase()
    return team.roster.filter(p => {
      if (!q) return true
      const name = `${p.first_name} ${p.last_name}`.toLowerCase()
      return name.includes(q)
    })
  }, [team, filter])

  const outgoingSalary = outgoing.reduce((s, d) => s + d.player.salary, 0)
  const incomingSalary = incoming.reduce((s, p) => s + p.salary, 0)

  // Available teams for the dropdown (exclude already-selected teams)
  const availableTeams = allTeams.filter(
    t => !usedTeamIds.includes(t.id) || t.id === team?.team.id,
  )

  const handlePlayerClick = (player: TradePlayer) => {
    // If already in trade, remove
    if (outgoingIds.has(player.player_id)) {
      onRemovePlayer(player.player_id)
      setDestPickerPlayer(null)
      return
    }

    if (teamCount === 2) {
      const otherIndex = slotIndex === 0 ? 1 : 0
      onTogglePlayer(player, otherIndex)
    } else if (otherTeamSlots.length === 1) {
      onTogglePlayer(player, otherTeamSlots[0].index)
    } else {
      // 3-team mode: show destination picker
      setDestPickerPlayer(player)
    }
  }

  const handleDestinationSelect = (toTeamIndex: number) => {
    if (destPickerPlayer) {
      onTogglePlayer(destPickerPlayer, toTeamIndex)
      setDestPickerPlayer(null)
    }
  }

  return (
    <div className="border border-[#1e1e2a] rounded-xl bg-[#111118] flex flex-col min-w-0">
      {/* Header */}
      <div className="p-4 border-b border-[#1e1e2a]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="font-mono text-[10px] text-[#5a5a64] uppercase tracking-wider">
            Team {slotIndex + 1}
          </span>
          {onRemoveSlot && (
            <button
              onClick={onRemoveSlot}
              className="text-[#5a5a64] hover:text-red-400 transition-colors font-mono text-xs"
              title="Remove team"
            >
              Remove
            </button>
          )}
        </div>

        <select
          value={team?.team.id ?? ''}
          onChange={e => {
            const id = parseInt(e.target.value, 10)
            if (!isNaN(id)) onSelectTeam(id)
          }}
          disabled={loading}
          className="w-full bg-[#0a0a0f] border border-[#1e1e2a] text-[#e8e6e3] text-sm font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-[#fbbf24] transition-colors"
        >
          <option value="">Select a team...</option>
          {availableTeams.map(t => (
            <option key={t.id} value={t.id}>
              {t.full_name}
            </option>
          ))}
        </select>

        {team && (
          <div className="flex items-center justify-between mt-3 gap-2">
            <CapStatusBadge tier={team.cap_tier} />
            <span className="font-mono text-xs text-[#8a8a94]">
              {team.standings.wins}-{team.standings.losses}
            </span>
            <span className="font-mono text-xs text-[#fbbf24] font-bold">
              {formatSalary(team.total_salary)}
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-[#fbbf24]/30 border-t-[#fbbf24] rounded-full animate-spin" />
        </div>
      ) : !team ? (
        <div className="py-12 text-center font-mono text-sm text-[#5a5a64]">
          Select a team to view roster
        </div>
      ) : (
        <>
          {/* Outgoing section */}
          {outgoing.length > 0 && (
            <div className="p-3 border-b border-[#1e1e2a]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-red-400 uppercase tracking-wider font-bold">
                  Sending
                </span>
                <span className="font-mono text-xs text-red-400 font-bold">
                  {formatSalary(outgoingSalary)}
                </span>
              </div>
              <div className="space-y-1.5">
                {outgoing.map(d => (
                  <TradePlayerCard
                    key={d.player.player_id}
                    player={d.player}
                    variant="outgoing"
                    onRemove={() => onRemovePlayer(d.player.player_id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Incoming section */}
          {incoming.length > 0 && (
            <div className="p-3 border-b border-[#1e1e2a]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-emerald-400 uppercase tracking-wider font-bold">
                  Receiving
                </span>
                <span className="font-mono text-xs text-emerald-400 font-bold">
                  {formatSalary(incomingSalary)}
                </span>
              </div>
              <div className="space-y-1.5">
                {incoming.map(p => (
                  <TradePlayerCard key={p.player_id} player={p} variant="incoming" />
                ))}
              </div>
            </div>
          )}

          {/* Salary matching result */}
          {teamResult && (
            <div className="px-3 py-2 border-b border-[#1e1e2a]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-[#5a5a64] uppercase tracking-wider">
                  Max Incoming
                </span>
                <span className="font-mono text-xs text-[#8a8a94]">
                  {formatSalary(teamResult.max_incoming_salary)}
                </span>
              </div>
              {!teamResult.salary_match_ok && (
                <div className="mt-1 font-mono text-[10px] text-red-400">
                  Over limit by {formatSalary(teamResult.incoming_salary - teamResult.max_incoming_salary)}
                </div>
              )}
            </div>
          )}

          {/* Roster filter */}
          <div className="p-3 border-b border-[#1e1e2a]">
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter roster..."
              className="w-full bg-[#0a0a0f] border border-[#1e1e2a] text-[#e8e6e3] text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-[#fbbf24] transition-colors placeholder:text-[#3a3a44]"
            />
          </div>

          {/* 3-team destination picker */}
          {destPickerPlayer && otherTeamSlots.length > 1 && (
            <div className="p-3 border-b border-[#1e1e2a] bg-[#fbbf24]/5">
              <div className="font-mono text-[10px] text-[#fbbf24] uppercase tracking-wider mb-2">
                Send {destPickerPlayer.first_name} {destPickerPlayer.last_name} to:
              </div>
              <div className="flex gap-2">
                {otherTeamSlots.map(slot => (
                  <button
                    key={slot.index}
                    onClick={() => handleDestinationSelect(slot.index)}
                    className="flex-1 px-3 py-1.5 font-mono text-xs font-bold text-[#e8e6e3] bg-[#0a0a0f] border border-[#1e1e2a] rounded-lg hover:border-[#fbbf24] hover:text-[#fbbf24] transition-colors"
                  >
                    {slot.abbreviation}
                  </button>
                ))}
                <button
                  onClick={() => setDestPickerPlayer(null)}
                  className="px-2 py-1.5 font-mono text-xs text-[#5a5a64] hover:text-[#e8e6e3] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Roster */}
          <div className="overflow-y-auto max-h-[340px] flex-1">
            {filteredRoster.map(player => {
              const isInTrade = outgoingIds.has(player.player_id)
              return (
                <button
                  key={player.player_id}
                  onClick={() => handlePlayerClick(player)}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 border-b border-[#1e1e2a] last:border-0 transition-colors ${
                    isInTrade
                      ? 'bg-red-500/5 hover:bg-red-500/10'
                      : 'hover:bg-[#1e1e2a]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] text-[#5a5a64] w-5 flex-shrink-0">
                      {player.position || '—'}
                    </span>
                    <span
                      className={`font-mono text-xs truncate ${
                        isInTrade ? 'text-red-400 line-through' : 'text-[#e8e6e3]'
                      }`}
                    >
                      {player.first_name} {player.last_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {player.minutes_per_game != null && (
                      <span className="font-mono text-[10px] text-[#5a5a64]">
                        {player.minutes_per_game.toFixed(1)}m
                      </span>
                    )}
                    <span className="font-mono text-xs text-[#fbbf24] font-bold min-w-[60px] text-right">
                      {formatSalary(player.salary)}
                    </span>
                    {isInTrade ? (
                      <span className="text-red-400 text-xs">&#x2212;</span>
                    ) : (
                      <span className="text-emerald-400 text-xs">+</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
})

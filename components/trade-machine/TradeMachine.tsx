'use client'

import React from 'react'
import { useTradeMachine } from '@/hooks/useTradeMachine'
import { useNBATeams } from '@/hooks/useNBATeams'
import { TeamTradeColumn } from './TeamTradeColumn'
import { TradeSummaryPanel } from './TradeSummaryPanel'
import { WinImpactPanel } from './WinImpactPanel'
import { Button } from '@/components/ui/Button'

export function TradeMachine() {
  const {
    teamCount,
    teams,
    outgoing,
    loading,
    error,
    validation,
    winImpact,
    hasTrade,
    selectTeam,
    togglePlayerInTrade,
    removePlayerFromTrade,
    addTeamSlot,
    removeTeamSlot,
    resetTrade,
    getIncomingPlayers,
  } = useTradeMachine()

  const { teams: allTeams, loading: teamsLoading } = useNBATeams()

  // IDs of teams already selected
  const usedTeamIds = teams
    .filter((t): t is NonNullable<typeof t> => t != null)
    .map(t => t.team.id)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-mono font-bold text-[#e8e6e3] text-2xl sm:text-3xl">
            Trade Machine
          </h1>
          <p className="font-mono text-sm text-[#5a5a64] mt-1">
            Build NBA trades with real salaries, CBA compliance, and win projections
          </p>
        </div>

        <div className="flex items-center gap-3">
          {teamCount < 3 && (
            <Button variant="secondary" size="sm" onClick={addTeamSlot}>
              + 3rd Team
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={resetTrade}>
            Reset
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/5 font-mono text-sm text-red-400">
          {error}
        </div>
      )}

      {teamsLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-[#fbbf24]/30 border-t-[#fbbf24] rounded-full animate-spin" />
            <span className="font-mono text-sm text-[#5a5a64]">Loading teams...</span>
          </div>
        </div>
      ) : (
        <>
          {/* Team columns */}
          <div
            className="grid gap-4 mb-6"
            style={{
              gridTemplateColumns: `repeat(${teamCount}, 1fr)`,
            }}
          >
            {Array.from({ length: teamCount }, (_, i) => {
              const otherSlots = Array.from({ length: teamCount }, (_, j) => j)
                .filter(j => j !== i && teams[j] != null)
                .map(j => ({
                  index: j,
                  abbreviation: teams[j]!.team.abbreviation,
                }))

              const teamResult = validation?.per_team.find(
                t => t.team_id === teams[i]?.team.id,
              ) ?? null

              return (
                <TeamTradeColumn
                  key={i}
                  slotIndex={i}
                  team={teams[i]}
                  outgoing={outgoing[i]}
                  incoming={getIncomingPlayers(i)}
                  loading={loading[i]}
                  teamCount={teamCount}
                  allTeams={allTeams}
                  otherTeamSlots={otherSlots}
                  onSelectTeam={teamId => selectTeam(i, teamId)}
                  onTogglePlayer={(player, toIdx) => togglePlayerInTrade(i, player, toIdx)}
                  onRemovePlayer={playerId => removePlayerFromTrade(i, playerId)}
                  onRemoveSlot={teamCount > 2 && i === teamCount - 1 ? () => removeTeamSlot(i) : undefined}
                  teamResult={teamResult}
                  usedTeamIds={usedTeamIds}
                />
              )
            })}
          </div>

          {/* Trade results */}
          {hasTrade && validation && (
            <div className="space-y-4">
              <TradeSummaryPanel validation={validation} />
              {winImpact && <WinImpactPanel impact={winImpact} />}
            </div>
          )}

          {/* Empty state */}
          {!hasTrade && teams.some(t => t != null) && (
            <div className="text-center py-8 border border-[#1e1e2a] rounded-xl bg-[#111118]">
              <p className="font-mono text-sm text-[#5a5a64]">
                Select players from each team to build a trade
              </p>
              <p className="font-mono text-xs text-[#3a3a44] mt-1">
                Click a player to add them to the trade
              </p>
            </div>
          )}
        </>
      )}

      {/* Footer info */}
      <div className="mt-8 text-center space-y-1">
        <p className="font-mono text-[10px] text-[#3a3a44]">
          Salary cap: $154.6M | Luxury tax: $188.9M | 1st apron: $196.5M | 2nd apron: $204.1M
        </p>
        <p className="font-mono text-[10px] text-[#3a3a44]">
          2025-26 season. Salary data via Ball Don&apos;t Lie. CBA rules are simplified estimates.
        </p>
      </div>
    </div>
  )
}

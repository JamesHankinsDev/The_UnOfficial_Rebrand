'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  validateTrade,
  type TradePlayer,
  type TradeTeam,
  type TradeSide,
  type TradeValidationResult,
  type CapTier,
} from '@/lib/trade-rules'
import { calculateTradeWinImpact, type TeamWinDelta } from '@/lib/trade-impact'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TradeTeamData {
  team: {
    id: number
    abbreviation: string
    full_name: string
    conference: string
    division: string
  }
  standings: {
    wins: number
    losses: number
    conference_rank: number
  }
  total_salary: number
  cap_tier: CapTier
  roster: TradePlayer[]
}

export interface TradeDestination {
  player: TradePlayer
  fromTeamIndex: number
  toTeamIndex: number
}

export interface UseTradeMachineReturn {
  teamCount: 2 | 3
  teams: (TradeTeamData | null)[]
  outgoing: TradeDestination[][]
  loading: boolean[]
  error: string | null
  sides: TradeSide[]
  validation: TradeValidationResult | null
  winImpact: TeamWinDelta[] | null
  hasTrade: boolean
  selectTeam: (slotIndex: number, teamId: number) => Promise<void>
  togglePlayerInTrade: (
    fromTeamIndex: number,
    player: TradePlayer,
    toTeamIndex: number,
  ) => void
  removePlayerFromTrade: (fromTeamIndex: number, playerId: number) => void
  addTeamSlot: () => void
  removeTeamSlot: (index: number) => void
  resetTrade: () => void
  getIncomingPlayers: (teamIndex: number) => TradePlayer[]
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTradeMachine(): UseTradeMachineReturn {
  const [teamCount, setTeamCount] = useState<2 | 3>(2)
  const [teams, setTeams] = useState<(TradeTeamData | null)[]>([null, null])
  const [outgoing, setOutgoing] = useState<TradeDestination[][]>([[], []])
  const [loading, setLoading] = useState<boolean[]>([false, false])
  const [error, setError] = useState<string | null>(null)

  // Fetch a team's roster and set it in the given slot
  const selectTeam = useCallback(async (slotIndex: number, teamId: number) => {
    setLoading(prev => {
      const next = [...prev]
      next[slotIndex] = true
      return next
    })
    setError(null)

    // Clear outgoing for this slot
    setOutgoing(prev => {
      const next = [...prev]
      next[slotIndex] = []
      // Also remove any destinations targeting this slot from other teams
      for (let i = 0; i < next.length; i++) {
        if (i !== slotIndex) {
          next[i] = next[i].filter(d => d.toTeamIndex !== slotIndex)
        }
      }
      return next
    })

    try {
      const res = await fetch(`/api/nba/trade/team-roster?team_id=${teamId}`)
      if (!res.ok) throw new Error('Failed to fetch roster')
      const data: TradeTeamData = await res.json()

      setTeams(prev => {
        const next = [...prev]
        next[slotIndex] = data
        return next
      })
    } catch {
      setError('Failed to load team roster. Please try again.')
      setTeams(prev => {
        const next = [...prev]
        next[slotIndex] = null
        return next
      })
    } finally {
      setLoading(prev => {
        const next = [...prev]
        next[slotIndex] = false
        return next
      })
    }
  }, [])

  // Toggle a player in/out of the trade
  const togglePlayerInTrade = useCallback(
    (fromTeamIndex: number, player: TradePlayer, toTeamIndex: number) => {
      setOutgoing(prev => {
        const next = [...prev]
        const existing = next[fromTeamIndex].find(
          d => d.player.player_id === player.player_id,
        )
        if (existing) {
          // Remove
          next[fromTeamIndex] = next[fromTeamIndex].filter(
            d => d.player.player_id !== player.player_id,
          )
        } else {
          // Add
          next[fromTeamIndex] = [
            ...next[fromTeamIndex],
            { player, fromTeamIndex, toTeamIndex },
          ]
        }
        return next
      })
    },
    [],
  )

  const removePlayerFromTrade = useCallback(
    (fromTeamIndex: number, playerId: number) => {
      setOutgoing(prev => {
        const next = [...prev]
        next[fromTeamIndex] = next[fromTeamIndex].filter(
          d => d.player.player_id !== playerId,
        )
        return next
      })
    },
    [],
  )

  // Get players incoming to a specific team (from other teams' outgoing)
  const getIncomingPlayers = useCallback(
    (teamIndex: number): TradePlayer[] => {
      const incoming: TradePlayer[] = []
      for (let i = 0; i < outgoing.length; i++) {
        if (i === teamIndex) continue
        for (const dest of outgoing[i]) {
          if (dest.toTeamIndex === teamIndex) {
            incoming.push(dest.player)
          }
        }
      }
      return incoming
    },
    [outgoing],
  )

  // Build TradeSide objects for validation
  const sides: TradeSide[] = useMemo(() => {
    const result: TradeSide[] = []

    for (let i = 0; i < teamCount; i++) {
      const teamData = teams[i]
      if (!teamData) continue

      const outgoingPlayers = outgoing[i].map(d => d.player)
      const incomingPlayers: TradePlayer[] = []

      // Collect incoming from other teams
      for (let j = 0; j < teamCount; j++) {
        if (j === i) continue
        for (const dest of outgoing[j]) {
          if (dest.toTeamIndex === i) {
            incomingPlayers.push(dest.player)
          }
        }
      }

      if (outgoingPlayers.length === 0 && incomingPlayers.length === 0) continue

      const tradeTeam: TradeTeam = {
        team_id: teamData.team.id,
        abbreviation: teamData.team.abbreviation,
        full_name: teamData.team.full_name,
        total_salary: teamData.total_salary,
        wins: teamData.standings.wins,
        losses: teamData.standings.losses,
        conference_rank: teamData.standings.conference_rank,
        roster: teamData.roster,
      }

      result.push({
        team: tradeTeam,
        outgoing: outgoingPlayers,
        incoming: incomingPlayers,
      })
    }

    return result
  }, [teams, outgoing, teamCount])

  // Determine if there's an active trade
  const hasTrade = sides.length >= 2 && sides.every(s => s.outgoing.length > 0)

  // Validation (only when we have a complete trade)
  const validation = useMemo<TradeValidationResult | null>(() => {
    if (!hasTrade) return null
    return validateTrade(sides)
  }, [sides, hasTrade])

  // Win impact
  const winImpact = useMemo<TeamWinDelta[] | null>(() => {
    if (!hasTrade) return null
    return calculateTradeWinImpact(sides)
  }, [sides, hasTrade])

  const addTeamSlot = useCallback(() => {
    if (teamCount >= 3) return
    setTeamCount(3)
    setTeams(prev => [...prev, null])
    setOutgoing(prev => [...prev, []])
    setLoading(prev => [...prev, false])
  }, [teamCount])

  const removeTeamSlot = useCallback(
    (index: number) => {
      if (teamCount <= 2) return
      setTeamCount(2)
      setTeams(prev => prev.filter((_, i) => i !== index))
      setOutgoing(prev => {
        const filtered = prev.filter((_, i) => i !== index)
        // Remove any destinations targeting the removed slot
        // and adjust indices
        return filtered.map(destinations =>
          destinations
            .filter(d => d.toTeamIndex !== index)
            .map(d => ({
              ...d,
              fromTeamIndex: d.fromTeamIndex > index ? d.fromTeamIndex - 1 : d.fromTeamIndex,
              toTeamIndex: d.toTeamIndex > index ? d.toTeamIndex - 1 : d.toTeamIndex,
            })),
        )
      })
      setLoading(prev => prev.filter((_, i) => i !== index))
    },
    [teamCount],
  )

  const resetTrade = useCallback(() => {
    setTeamCount(2)
    setTeams([null, null])
    setOutgoing([[], []])
    setLoading([false, false])
    setError(null)
  }, [])

  return {
    teamCount,
    teams,
    outgoing,
    loading,
    error,
    sides,
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
  }
}

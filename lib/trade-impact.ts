import type { TradeSide } from '@/lib/trade-rules'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Approximate point differential per win over an 82-game season (Pythagorean). */
const POINTS_PER_WIN = 2.7

/** Full NBA season length. */
const SEASON_GAMES = 82

// ---------------------------------------------------------------------------
// Per-player win estimation
// ---------------------------------------------------------------------------

/**
 * Estimate a player's win contribution for a full 82-game season.
 *
 * Formula: (net_rating / 100) * (mpg / 48) * 82 / 2.7
 *
 * net_rating = point differential per 100 possessions when on court.
 * We scale by the player's share of minutes (mpg / 48) to get
 * per-game impact, then project over 82 games and convert from
 * point differential to wins using the Pythagorean constant.
 *
 * Returns null if advanced stats are unavailable.
 */
export function estimatePlayerWins(player: {
  net_rating: number | null
  minutes_per_game: number | null
  games_played: number | null
}): number | null {
  if (
    player.net_rating == null ||
    player.minutes_per_game == null ||
    player.minutes_per_game <= 0
  ) {
    return null
  }

  const minuteShare = player.minutes_per_game / 48
  return (player.net_rating / 100) * minuteShare * SEASON_GAMES / POINTS_PER_WIN
}

// ---------------------------------------------------------------------------
// Team win delta
// ---------------------------------------------------------------------------

export interface TeamWinDelta {
  team_id: number
  abbreviation: string
  currentWins: number
  currentLosses: number
  projectedWins: number
  projectedLosses: number
  winDelta: number
  gamesRemaining: number
  hasEstimate: boolean
  missingPlayers: string[]
}

/**
 * Calculate the projected win change for a single team in a trade.
 *
 * win_delta = sum(incoming players' estimated wins) - sum(outgoing players' estimated wins)
 *
 * The delta is prorated over remaining games in the season.
 */
export function calculateTeamWinDelta(side: TradeSide): TeamWinDelta {
  const gamesPlayed = side.team.wins + side.team.losses
  const gamesRemaining = Math.max(0, SEASON_GAMES - gamesPlayed)

  const missingPlayers: string[] = []
  let outgoingWins = 0
  let incomingWins = 0
  let hasAnyEstimate = false

  for (const p of side.outgoing) {
    const w = estimatePlayerWins(p)
    if (w != null) {
      outgoingWins += w
      hasAnyEstimate = true
    } else {
      missingPlayers.push(`${p.first_name} ${p.last_name}`)
    }
  }

  for (const p of side.incoming) {
    const w = estimatePlayerWins(p)
    if (w != null) {
      incomingWins += w
      hasAnyEstimate = true
    } else {
      missingPlayers.push(`${p.first_name} ${p.last_name}`)
    }
  }

  // Full-season delta, prorated to remaining games
  const fullSeasonDelta = incomingWins - outgoingWins
  const proratedDelta = gamesRemaining > 0
    ? fullSeasonDelta * (gamesRemaining / SEASON_GAMES)
    : fullSeasonDelta

  const projectedWins = Math.round((side.team.wins + proratedDelta) * 10) / 10
  const projectedLosses = Math.round((SEASON_GAMES - projectedWins) * 10) / 10

  return {
    team_id: side.team.team_id,
    abbreviation: side.team.abbreviation,
    currentWins: side.team.wins,
    currentLosses: side.team.losses,
    projectedWins,
    projectedLosses,
    winDelta: Math.round(proratedDelta * 10) / 10,
    gamesRemaining,
    hasEstimate: hasAnyEstimate,
    missingPlayers,
  }
}

// ---------------------------------------------------------------------------
// Multi-team impact
// ---------------------------------------------------------------------------

export function calculateTradeWinImpact(sides: TradeSide[]): TeamWinDelta[] {
  return sides.map(side => calculateTeamWinDelta(side))
}

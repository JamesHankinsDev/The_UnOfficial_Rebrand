import {
  SALARY_CAP_USD,
  LUXURY_TAX_USD,
  FIRST_APRON_USD,
  SECOND_APRON_USD,
} from '@/lib/constants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CapTier =
  | 'under_cap'
  | 'over_cap'
  | 'luxury_tax'
  | 'first_apron'
  | 'second_apron'

export interface TradePlayer {
  player_id: number
  first_name: string
  last_name: string
  position: string
  salary: number
  is_two_way: boolean
  team_id: number
  team_abbreviation: string
  net_rating: number | null
  minutes_per_game: number | null
  games_played: number | null
}

export interface TradeTeam {
  team_id: number
  abbreviation: string
  full_name: string
  total_salary: number
  wins: number
  losses: number
  conference_rank: number
  roster: TradePlayer[]
}

export interface TradeSide {
  team: TradeTeam
  outgoing: TradePlayer[]
  incoming: TradePlayer[]
}

export interface TeamTradeResult {
  team_id: number
  abbreviation: string
  cap_tier_before: CapTier
  cap_tier_after: CapTier
  salary_before: number
  salary_after: number
  outgoing_salary: number
  incoming_salary: number
  max_incoming_salary: number
  salary_match_ok: boolean
  errors: string[]
  warnings: string[]
}

export interface TradeValidationResult {
  is_legal: boolean
  errors: string[]
  warnings: string[]
  per_team: TeamTradeResult[]
}

// ---------------------------------------------------------------------------
// Cap tier helpers
// ---------------------------------------------------------------------------

export function getCapTier(totalSalary: number): CapTier {
  if (totalSalary >= SECOND_APRON_USD) return 'second_apron'
  if (totalSalary >= FIRST_APRON_USD) return 'first_apron'
  if (totalSalary >= LUXURY_TAX_USD) return 'luxury_tax'
  if (totalSalary >= SALARY_CAP_USD) return 'over_cap'
  return 'under_cap'
}

export function capTierLabel(tier: CapTier): string {
  const labels: Record<CapTier, string> = {
    under_cap: 'Under Cap',
    over_cap: 'Over Cap',
    luxury_tax: 'Luxury Tax',
    first_apron: '1st Apron',
    second_apron: '2nd Apron',
  }
  return labels[tier]
}

export function availableCapSpace(totalSalary: number): number {
  return Math.max(0, SALARY_CAP_USD - totalSalary)
}

// ---------------------------------------------------------------------------
// Salary matching
// ---------------------------------------------------------------------------

/**
 * Maximum incoming salary a team can receive given their outgoing salary
 * and cap position. This is the core CBA matching logic.
 */
export function maxIncomingSalary(
  outgoingSalary: number,
  teamTotalSalary: number,
): number {
  const tier = getCapTier(teamTotalSalary)

  // Under-cap teams can absorb into their cap space without matching,
  // plus any salary-matching allowance on the remainder.
  if (tier === 'under_cap') {
    const space = availableCapSpace(teamTotalSalary)
    // They can absorb up to their full cap space + outgoing matching
    return space + outgoingSalary
  }

  // First or second apron: tightest restrictions
  if (tier === 'first_apron' || tier === 'second_apron') {
    return Math.floor(outgoingSalary * 1.10 + 100_000)
  }

  // Over cap or luxury tax: three-tier matching
  if (outgoingSalary <= 7_500_000) {
    return Math.floor(outgoingSalary * 2.0 + 250_000)
  }
  if (outgoingSalary <= 29_000_000) {
    return Math.floor(outgoingSalary * 1.75 + 100_000)
  }
  return Math.floor(outgoingSalary * 1.25 + 100_000)
}

/**
 * Apron teams cannot aggregate salaries from multiple smaller contracts
 * to match one large incoming contract.
 */
function checkAggregationRule(
  outgoing: TradePlayer[],
  incoming: TradePlayer[],
  capTier: CapTier,
): { ok: boolean; error: string | null } {
  if (capTier !== 'first_apron' && capTier !== 'second_apron') {
    return { ok: true, error: null }
  }

  // If sending multiple players and receiving fewer, check if the largest
  // incoming salary exceeds the largest single outgoing salary's matching limit.
  if (outgoing.length > 1 && incoming.length >= 1) {
    const largestIncoming = Math.max(...incoming.map(p => p.salary))
    const largestOutgoing = Math.max(...outgoing.map(p => p.salary))
    const singleMatchLimit = Math.floor(largestOutgoing * 1.10 + 100_000)

    if (largestIncoming > singleMatchLimit) {
      return {
        ok: false,
        error: `Apron teams cannot aggregate salaries. Largest outgoing contract ($${(largestOutgoing / 1_000_000).toFixed(1)}M) can only match up to $${(singleMatchLimit / 1_000_000).toFixed(1)}M, but incoming player is at $${(largestIncoming / 1_000_000).toFixed(1)}M.`,
      }
    }
  }

  return { ok: true, error: null }
}

// ---------------------------------------------------------------------------
// Per-team validation
// ---------------------------------------------------------------------------

export function checkSalaryMatching(side: TradeSide): TeamTradeResult {
  const errors: string[] = []
  const warnings: string[] = []

  const outgoingSalary = side.outgoing.reduce((s, p) => s + p.salary, 0)
  const incomingSalary = side.incoming.reduce((s, p) => s + p.salary, 0)
  const salaryBefore = side.team.total_salary
  const salaryAfter = salaryBefore - outgoingSalary + incomingSalary

  const tierBefore = getCapTier(salaryBefore)
  const tierAfter = getCapTier(salaryAfter)

  const maxIncoming = maxIncomingSalary(outgoingSalary, salaryBefore)
  const salaryMatchOk = incomingSalary <= maxIncoming

  if (!salaryMatchOk) {
    errors.push(
      `${side.team.abbreviation} cannot receive $${(incomingSalary / 1_000_000).toFixed(1)}M — max allowed is $${(maxIncoming / 1_000_000).toFixed(1)}M based on $${(outgoingSalary / 1_000_000).toFixed(1)}M outgoing.`,
    )
  }

  // Aggregation rule for apron teams
  const aggCheck = checkAggregationRule(side.outgoing, side.incoming, tierBefore)
  if (!aggCheck.ok && aggCheck.error) {
    errors.push(aggCheck.error)
  }

  // Two-way contract warning
  const twoWayPlayers = [...side.outgoing, ...side.incoming].filter(p => p.is_two_way)
  if (twoWayPlayers.length > 0) {
    warnings.push(
      `Two-way contract(s) involved: ${twoWayPlayers.map(p => `${p.first_name} ${p.last_name}`).join(', ')}. Two-way players have special trade restrictions.`,
    )
  }

  // Apron tier warnings
  if (tierBefore !== tierAfter) {
    if (
      (tierAfter === 'first_apron' || tierAfter === 'second_apron') &&
      tierBefore !== 'first_apron' &&
      tierBefore !== 'second_apron'
    ) {
      warnings.push(
        `${side.team.abbreviation} would cross into the ${capTierLabel(tierAfter)} ($${(salaryAfter / 1_000_000).toFixed(1)}M), triggering additional restrictions.`,
      )
    }
  }

  // Second apron restriction
  if (tierBefore === 'second_apron') {
    warnings.push(
      `${side.team.abbreviation} is above the 2nd apron — cannot use trade exceptions or acquire via sign-and-trade.`,
    )
  }

  // Bird rights warning
  if (side.incoming.length > 0) {
    warnings.push(
      `Bird rights for incoming player(s) will transfer to ${side.team.abbreviation}.`,
    )
  }

  // Roster size warning
  const rosterAfter = side.team.roster.length - side.outgoing.length + side.incoming.length
  if (rosterAfter < 14) {
    warnings.push(
      `${side.team.abbreviation} would have ${rosterAfter} players after the trade (minimum 14 recommended).`,
    )
  }
  if (rosterAfter > 15) {
    warnings.push(
      `${side.team.abbreviation} would have ${rosterAfter} players after the trade (maximum 15 standard roster spots).`,
    )
  }

  return {
    team_id: side.team.team_id,
    abbreviation: side.team.abbreviation,
    cap_tier_before: tierBefore,
    cap_tier_after: tierAfter,
    salary_before: salaryBefore,
    salary_after: salaryAfter,
    outgoing_salary: outgoingSalary,
    incoming_salary: incomingSalary,
    max_incoming_salary: maxIncoming,
    salary_match_ok: salaryMatchOk,
    errors,
    warnings,
  }
}

// ---------------------------------------------------------------------------
// Full trade validation
// ---------------------------------------------------------------------------

export function validateTrade(sides: TradeSide[]): TradeValidationResult {
  const globalErrors: string[] = []
  const globalWarnings: string[] = []

  // Must have at least 2 teams
  if (sides.length < 2) {
    return {
      is_legal: false,
      errors: ['A trade requires at least 2 teams.'],
      warnings: [],
      per_team: [],
    }
  }

  // Each team must be sending at least one player
  for (const side of sides) {
    if (side.outgoing.length === 0) {
      globalErrors.push(`${side.team.abbreviation} must send at least one player.`)
    }
  }

  // No team should appear twice
  const teamIds = sides.map(s => s.team.team_id)
  if (new Set(teamIds).size !== teamIds.length) {
    globalErrors.push('A team cannot trade with itself.')
  }

  // Validate each team's salary matching
  const perTeam = sides.map(side => checkSalaryMatching(side))

  // Aggregate errors
  const allErrors = [
    ...globalErrors,
    ...perTeam.flatMap(t => t.errors),
  ]
  const allWarnings = [
    ...globalWarnings,
    ...perTeam.flatMap(t => t.warnings),
  ]

  return {
    is_legal: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    per_team: perTeam,
  }
}

// ---------------------------------------------------------------------------
// Salary formatting utility
// ---------------------------------------------------------------------------

export function formatSalary(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toLocaleString()}`
}

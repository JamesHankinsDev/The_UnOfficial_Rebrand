import React from 'react'

/**
 * Centralized descriptions for all basketball stats and KPIs.
 * Used by StatHeader for tooltips across the analytics dashboard.
 */
export const STAT_DESCRIPTIONS: Record<string, string> = {
  // Box score stats
  PTS: 'Points scored per game',
  REB: 'Total rebounds per game',
  AST: 'Assists per game',
  STL: 'Steals per game',
  BLK: 'Blocks per game',
  TO: 'Turnovers per game',
  MIN: 'Minutes played per game',
  MPG: 'Minutes played per game',
  GP: 'Games played this season',
  FG: 'Field goals made / attempted',
  'FG%': 'Field goal percentage (makes / attempts)',
  '3PT': 'Three-pointers made / attempted',
  '3P%': 'Three-point field goal percentage',
  'FT%': 'Free throw percentage',
  PF: 'Personal fouls per game',

  // Per-game abbreviations
  PPG: 'Points per game',
  RPG: 'Rebounds per game',
  APG: 'Assists per game',
  SPG: 'Steals per game',
  BPG: 'Blocks per game',
  TOPG: 'Turnovers per game',

  // Composite stats
  PRA: 'Points + Rebounds + Assists per game',
  STOCKS: 'Steals + Blocks per game',
  STK: 'Steals + Blocks per game',

  // Advanced stats
  'TS%': 'True Shooting % — shooting efficiency including FTs and 3s',
  'eFG%': 'Effective FG % — adjusts FG% for the value of 3-pointers',
  'NET RTG': 'Point differential per 100 possessions when on court',
  'Net Rtg': 'Point differential per 100 possessions when on court',
  'O-RTG': 'Points scored per 100 possessions (offensive efficiency)',
  'D-RTG': 'Points allowed per 100 possessions (lower is better)',
  'USG%': 'Usage Rate — % of team possessions used by this player',
  'AST/TO': 'Assist-to-Turnover ratio (higher is better)',
  PIE: 'Player Impact Estimate — overall contribution metric (0-1)',
  PACE: 'Team pace — estimated possessions per 48 minutes',

  // Salary & cap stats
  Salary: 'Current season base salary',
  'Cap%': 'Salary as a percentage of the salary cap ($154.6M)',
  MAV: 'Minutes-Adjusted Value — (PRA / Cap%) x (MPG / 36). Higher = more production per dollar per minute',

  // Team stats
  W: 'Wins',
  L: 'Losses',
  PCT: 'Win percentage (wins / total games)',
  Home: 'Home record (wins-losses)',
  Road: 'Road/away record (wins-losses)',
  Conf: 'Conference record (wins-losses)',
  Div: 'Division record (wins-losses)',

  // Trade stats
  Outgoing: 'Total salary of players being traded away',
  Incoming: 'Total salary of players being received',
  'Max Allowed': 'Maximum incoming salary allowed by CBA rules',
  'New Salary': 'Team total salary after the trade',
  'Cap Status': 'Team salary tier: Under Cap, Over Cap, Luxury Tax, 1st/2nd Apron',

  // Position
  Pos: 'Position (G = Guard, F = Forward, C = Center)',

  // Draft
  Draft: 'Year the player was drafted',

  // Identifiers
  Team: 'Team abbreviation',
  Player: 'Player name',
}

interface StatHeaderProps {
  /** The stat label to display */
  label: string
  /** Optional override for the tooltip text (defaults to STAT_DESCRIPTIONS lookup) */
  tooltip?: string
  /** Text alignment class */
  align?: 'left' | 'center' | 'right'
  /** Additional CSS classes */
  className?: string
}

/**
 * Table header cell with hover tooltip explaining the stat.
 * Replaces plain <th> elements in analytics tables.
 */
export function StatHeader({ label, tooltip, align = 'center', className = '' }: StatHeaderProps) {
  const description = tooltip ?? STAT_DESCRIPTIONS[label]
  const alignClass = align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center'

  return (
    <th className={`${alignClass} px-3 py-2.5 relative group ${className}`}>
      <span className={description ? 'cursor-help border-b border-dotted border-[#3a3a44]' : ''}>
        {label}
      </span>
      {description && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2.5 py-1.5 bg-[#1e1e2a] border border-[#2e2e3a] rounded-md text-[10px] font-mono text-[#8a8a94] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 shadow-lg max-w-[250px] text-center">
          {description}
        </div>
      )}
    </th>
  )
}

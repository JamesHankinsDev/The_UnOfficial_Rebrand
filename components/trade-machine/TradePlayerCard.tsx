'use client'

import { formatSalary, type TradePlayer } from '@/lib/trade-rules'

interface TradePlayerCardProps {
  player: TradePlayer
  variant: 'outgoing' | 'incoming'
  onRemove?: () => void
}

export function TradePlayerCard({ player, variant, onRemove }: TradePlayerCardProps) {
  const borderColor = variant === 'outgoing' ? 'border-red-500/40' : 'border-emerald-500/40'
  const accentColor = variant === 'outgoing' ? 'text-red-400' : 'text-emerald-400'

  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border ${borderColor} bg-[#0a0a0f]`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`font-mono text-[10px] font-bold ${accentColor} flex-shrink-0`}>
          {player.position || '—'}
        </span>
        <span className="font-mono text-xs font-bold text-[#e8e6e3] truncate">
          {player.first_name} {player.last_name}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="font-mono text-xs text-[#fbbf24] font-bold">
          {formatSalary(player.salary)}
        </span>
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-[#5a5a64] hover:text-red-400 transition-colors"
            title="Remove from trade"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

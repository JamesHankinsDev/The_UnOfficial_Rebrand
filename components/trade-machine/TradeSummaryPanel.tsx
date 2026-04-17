'use client'

import { CapStatusBadge } from './CapStatusBadge'
import { formatSalary, type TradeValidationResult } from '@/lib/trade-rules'
import { StatHeader } from '@/components/ui/StatHeader'

interface TradeSummaryPanelProps {
  validation: TradeValidationResult
}

export function TradeSummaryPanel({ validation }: TradeSummaryPanelProps) {
  return (
    <div className="border border-[#1e1e2a] rounded-xl bg-[#111118] overflow-hidden">
      {/* Status banner */}
      <div
        className={`px-4 py-3 font-mono font-bold text-sm text-center ${
          validation.is_legal
            ? 'bg-emerald-500/10 text-emerald-400 border-b border-emerald-500/20'
            : 'bg-red-500/10 text-red-400 border-b border-red-500/20'
        }`}
      >
        {validation.is_legal ? 'TRADE IS LEGAL' : 'TRADE IS NOT LEGAL'}
      </div>

      {/* Per-team breakdown */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1e1e2a] font-mono text-[10px] text-[#5a5a64] uppercase tracking-wider">
              <th className="text-left px-4 py-2.5">Team</th>
              <StatHeader label="Cap Status" />
              <StatHeader label="Outgoing" align="right" />
              <StatHeader label="Incoming" align="right" />
              <StatHeader label="Max Allowed" align="right" />
              <StatHeader label="New Salary" align="right" />
              <th className="text-center px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {validation.per_team.map(t => (
              <tr key={t.team_id} className="border-b border-[#1e1e2a] last:border-0">
                <td className="px-4 py-2.5 font-mono font-bold text-[#e8e6e3]">
                  {t.abbreviation}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <CapStatusBadge tier={t.cap_tier_before} />
                    {t.cap_tier_before !== t.cap_tier_after && (
                      <>
                        <span className="text-[#5a5a64] mx-0.5">&rarr;</span>
                        <CapStatusBadge tier={t.cap_tier_after} />
                      </>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-red-400 font-bold">
                  {formatSalary(t.outgoing_salary)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-emerald-400 font-bold">
                  {formatSalary(t.incoming_salary)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-[#8a8a94]">
                  {formatSalary(t.max_incoming_salary)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-[#e8e6e3] font-bold">
                  {formatSalary(t.salary_after)}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {t.salary_match_ok ? (
                    <span className="text-emerald-400 font-bold">&#10003;</span>
                  ) : (
                    <span className="text-red-400 font-bold">&#10007;</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Errors */}
      {validation.errors.length > 0 && (
        <div className="px-4 py-3 border-t border-[#1e1e2a]">
          <div className="font-mono text-[10px] text-red-400 uppercase tracking-wider font-bold mb-2">
            Issues
          </div>
          <ul className="space-y-1">
            {validation.errors.map((err, i) => (
              <li key={i} className="font-mono text-xs text-red-400 flex gap-2">
                <span className="flex-shrink-0">&bull;</span>
                <span>{err}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {validation.warnings.length > 0 && (
        <div className="px-4 py-3 border-t border-[#1e1e2a]">
          <div className="font-mono text-[10px] text-[#fbbf24] uppercase tracking-wider font-bold mb-2">
            Notes
          </div>
          <ul className="space-y-1">
            {validation.warnings.map((warn, i) => (
              <li key={i} className="font-mono text-xs text-[#8a8a94] flex gap-2">
                <span className="flex-shrink-0 text-[#fbbf24]">&bull;</span>
                <span>{warn}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'
import type { TeamWinDelta } from '@/lib/trade-impact'

interface WinImpactPanelProps {
  impact: TeamWinDelta[]
}

export function WinImpactPanel({ impact }: WinImpactPanelProps) {
  const anyEstimate = impact.some(t => t.hasEstimate)

  const chartData = impact.map(t => ({
    team: t.abbreviation,
    currentWins: t.currentWins,
    projectedWins: t.projectedWins,
    delta: t.winDelta,
    hasEstimate: t.hasEstimate,
  }))

  const allMissing = impact.flatMap(t => t.missingPlayers)

  return (
    <div className="border border-[#1e1e2a] rounded-xl bg-[#111118] p-5">
      <h3 className="font-mono font-bold text-sm text-[#e8e6e3] mb-4">
        Projected Win Impact
      </h3>

      {anyEstimate ? (
        <>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${impact.length}, 1fr)` }}>
            {impact.map(t => (
              <div
                key={t.team_id}
                className="border border-[#1e1e2a] rounded-lg p-4 text-center"
              >
                <div className="font-mono text-xs text-[#5a5a64] uppercase tracking-wider mb-1">
                  {t.abbreviation}
                </div>
                <div className="font-mono text-lg text-[#e8e6e3] font-bold">
                  {t.currentWins}-{t.currentLosses}
                </div>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <span className="text-[#5a5a64]">&rarr;</span>
                  <span className="font-mono text-lg font-bold text-[#e8e6e3]">
                    {t.projectedWins}-{t.projectedLosses}
                  </span>
                </div>
                <div
                  className={`font-mono text-sm font-bold mt-2 ${
                    t.winDelta > 0
                      ? 'text-emerald-400'
                      : t.winDelta < 0
                        ? 'text-red-400'
                        : 'text-[#8a8a94]'
                  }`}
                >
                  {t.winDelta > 0 ? '+' : ''}
                  {t.winDelta.toFixed(1)} wins
                </div>
                {!t.hasEstimate && (
                  <div className="font-mono text-[10px] text-[#5a5a64] mt-1">
                    No advanced data
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div className="mt-5">
            <ResponsiveContainer width="100%" height={120}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{
                    fill: '#5a5a64',
                    fontSize: 10,
                    fontFamily: 'Space Mono, monospace',
                  }}
                  stroke="#1e1e2a"
                  domain={['dataMin - 3', 'dataMax + 3']}
                />
                <YAxis
                  type="category"
                  dataKey="team"
                  tick={{
                    fill: '#8a8a94',
                    fontSize: 11,
                    fontFamily: 'Space Mono, monospace',
                  }}
                  stroke="#1e1e2a"
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111118',
                    border: '1px solid #1e1e2a',
                    borderRadius: 8,
                    fontFamily: 'Space Mono, monospace',
                    fontSize: 12,
                    color: '#e8e6e3',
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => [
                    `${value} wins`,
                    name === 'currentWins' ? 'Current' : 'Projected',
                  ]}
                />
                <ReferenceLine x={0} stroke="#1e1e2a" />
                <Bar dataKey="delta" radius={[0, 4, 4, 0]} barSize={20}>
                  {chartData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={entry.delta >= 0 ? '#10b981' : '#ef4444'}
                      fillOpacity={0.6}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="text-center py-6 font-mono text-sm text-[#5a5a64]">
          Advanced stats unavailable for traded players. Win impact cannot be estimated.
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-3 space-y-1">
        <p className="font-mono text-[10px] text-[#3a3a44] text-center">
          Estimates based on player net rating and minutes data. Uses Pythagorean win
          expectation (~2.7 pts/win). Actual results will vary.
        </p>
        {allMissing.length > 0 && (
          <p className="font-mono text-[10px] text-[#5a5a64] text-center">
            Missing advanced stats for: {allMissing.join(', ')}
          </p>
        )}
      </div>
    </div>
  )
}

'use client'

import React from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell,
} from 'recharts'

export const STAT_COLORS: Record<string, string> = {
  pts: '#fbbf24',
  reb: '#10b981',
  ast: '#3b82f6',
  stl: '#a855f7',
  blk: '#f97316',
  pra: '#ec4899',
  stocks: '#14b8a6',
}

interface LineChartProps {
  data: { label: string; value: number }[]
  color?: string
  height?: number
}

export function PointsTrendChart({ data, color = '#fbbf24', height = 200 }: LineChartProps) {
  if (data.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2a" />
        <XAxis
          dataKey="label"
          tick={{ fill: '#5a5a64', fontSize: 10, fontFamily: 'Space Mono, monospace' }}
          stroke="#1e1e2a"
        />
        <YAxis
          tick={{ fill: '#5a5a64', fontSize: 10, fontFamily: 'Space Mono, monospace' }}
          stroke="#1e1e2a"
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
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={{ fill: color, r: 3 }}
          activeDot={{ fill: color, r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

interface ComparisonBarProps {
  data: { stat: string; player1: number; player2: number }[]
  player1Name: string
  player2Name: string
  height?: number
}

// --- Multi-stat trend chart ---

interface StatSeries {
  key: string
  label: string
  color: string
  data: number[]
}

interface MultiStatTrendChartProps {
  labels: string[]
  series: StatSeries[]
  activeSeries: string[]
  height?: number
}

function MultiStatTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#111118] border border-[#1e1e2a] rounded-lg p-3 font-mono text-xs">
      <div className="text-[#5a5a64] mb-1.5">{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-[#8a8a94]">{entry.name}:</span>
          <span className="text-[#e8e6e3] font-bold">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function MultiStatTrendChart({ labels, series, activeSeries, height = 220 }: MultiStatTrendChartProps) {
  if (labels.length === 0) return null

  const chartData = labels.map((label, i) => {
    const point: Record<string, string | number> = { label }
    for (const s of series) {
      if (activeSeries.includes(s.key)) {
        point[s.key] = s.data[i]
      }
    }
    return point
  })

  const visibleSeries = series.filter((s) => activeSeries.includes(s.key))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2a" />
        <XAxis
          dataKey="label"
          tick={{ fill: '#5a5a64', fontSize: 10, fontFamily: 'Space Mono, monospace' }}
          stroke="#1e1e2a"
        />
        <YAxis
          tick={{ fill: '#5a5a64', fontSize: 10, fontFamily: 'Space Mono, monospace' }}
          stroke="#1e1e2a"
        />
        <Tooltip content={<MultiStatTooltip />} />
        {visibleSeries.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={{ fill: s.color, r: 3 }}
            activeDot={{ fill: s.color, r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// --- Comparison bar chart ---

export function ComparisonBarChart({ data, player1Name, player2Name, height = 300 }: ComparisonBarProps) {
  if (data.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2a" />
        <XAxis
          dataKey="stat"
          tick={{ fill: '#8a8a94', fontSize: 11, fontFamily: 'Space Mono, monospace' }}
          stroke="#1e1e2a"
        />
        <YAxis
          tick={{ fill: '#5a5a64', fontSize: 10, fontFamily: 'Space Mono, monospace' }}
          stroke="#1e1e2a"
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
        />
        <Legend
          wrapperStyle={{
            fontFamily: 'Space Mono, monospace',
            fontSize: 11,
            color: '#8a8a94',
          }}
        />
        <Bar dataKey="player1" name={player1Name} fill="#fbbf24" radius={[4, 4, 0, 0]}>
          {data.map((_, idx) => (
            <Cell key={idx} fill="#fbbf24" />
          ))}
        </Bar>
        <Bar dataKey="player2" name={player2Name} fill="#8b5cf6" radius={[4, 4, 0, 0]}>
          {data.map((_, idx) => (
            <Cell key={idx} fill="#8b5cf6" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

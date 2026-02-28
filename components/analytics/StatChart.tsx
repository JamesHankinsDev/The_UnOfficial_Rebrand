'use client'

import React from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell,
} from 'recharts'

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

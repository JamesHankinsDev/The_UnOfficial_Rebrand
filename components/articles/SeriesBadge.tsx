import React from 'react'
import { Badge } from '@/components/ui/Badge'

const seriesConfig: Record<string, { label: string; variant: 'gold' | 'orange' | 'green' | 'gray' }> = {
  'value-meal': { label: 'Value Meal', variant: 'gold' },
  'trajectory-twins': { label: 'Trajectory Twins', variant: 'green' },
  'picks-pops-rolls': { label: 'Picks Pops & Rolls', variant: 'orange' },
}

interface SeriesBadgeProps {
  series?: string | null
}

export function SeriesBadge({ series }: SeriesBadgeProps) {
  if (!series) return null
  const config = seriesConfig[series]
  if (!config) return null
  return <Badge variant={config.variant}>{config.label}</Badge>
}

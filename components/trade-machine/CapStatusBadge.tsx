'use client'

import { Badge } from '@/components/ui/Badge'
import { capTierLabel, type CapTier } from '@/lib/trade-rules'

const TIER_VARIANT: Record<CapTier, 'green' | 'gold' | 'orange' | 'red'> = {
  under_cap: 'green',
  over_cap: 'gold',
  luxury_tax: 'orange',
  first_apron: 'red',
  second_apron: 'red',
}

export function CapStatusBadge({ tier, className }: { tier: CapTier; className?: string }) {
  return (
    <Badge variant={TIER_VARIANT[tier]} className={className}>
      {capTierLabel(tier)}
    </Badge>
  )
}

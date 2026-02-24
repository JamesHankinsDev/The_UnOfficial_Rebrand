import React from 'react'

type BadgeVariant = 'gold' | 'orange' | 'green' | 'gray' | 'blue' | 'red'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  gold: 'bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/30',
  orange: 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/30',
  green: 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30',
  gray: 'bg-[#1e1e2a] text-[#8a8a94] border-[#3a3a44]',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  red: 'bg-red-500/10 text-red-400 border-red-500/30',
}

export function Badge({ children, variant = 'gray', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-mono font-bold tracking-widest uppercase rounded border ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  )
}

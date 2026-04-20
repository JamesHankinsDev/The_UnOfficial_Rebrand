'use client'

import React, { useState } from 'react'

interface HeadshotProps {
  nbaId: number | null | undefined
  alt: string
  size: number
  className?: string
  rounded?: 'full' | 'md' | 'lg'
}

export function Headshot({ nbaId, alt, size, className = '', rounded = 'full' }: HeadshotProps) {
  const [failed, setFailed] = useState(false)
  const radiusClass =
    rounded === 'full' ? 'rounded-full' : rounded === 'lg' ? 'rounded-lg' : 'rounded-md'

  if (!nbaId || failed) {
    return (
      <div
        className={`flex-shrink-0 bg-[#1e1e2a] ${radiusClass} flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
        aria-label={alt}
      >
        <span className="font-mono text-[10px] text-[#5a5a64] uppercase tracking-widest">
          {alt
            .split(' ')
            .map((w) => w[0])
            .slice(0, 2)
            .join('')}
        </span>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/nba/headshot/${nbaId}`}
      alt={alt}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`flex-shrink-0 object-cover bg-[#1e1e2a] ${radiusClass} ${className}`}
      style={{ width: size, height: size }}
    />
  )
}

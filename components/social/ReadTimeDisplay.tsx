import React from 'react'

interface ReadTimeDisplayProps {
  minutes: number
  className?: string
}

export function ReadTimeDisplay({ minutes, className = '' }: ReadTimeDisplayProps) {
  return (
    <span className={`font-mono text-xs tracking-widest text-[#8a8a94] uppercase ${className}`}>
      {minutes} Min Read
    </span>
  )
}

'use client'

import React, { useState } from 'react'
import toast from 'react-hot-toast'

interface ShareButtonProps {
  url: string
  className?: string
  size?: 'sm' | 'md'
}

export function ShareButton({ url, className = '', size = 'sm' }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Link copied.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy link.')
    }
  }

  const sizeClass = size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5'

  return (
    <button
      onClick={handleShare}
      className={`font-mono tracking-wide border border-[#1e1e2a] text-[#8a8a94] hover:text-[#e8e6e3] hover:border-[#3a3a44] rounded transition-all duration-150 ${sizeClass} ${className}`}
    >
      {copied ? '✓ Copied' : '⟐ Share'}
    </button>
  )
}

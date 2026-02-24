'use client'

import React from 'react'
import { tweetUrl } from '@/lib/utils'

interface TweetButtonProps {
  title: string
  url: string
  tweetPreview?: string
  size?: 'sm' | 'md'
  className?: string
}

export function TweetButton({
  title,
  url,
  tweetPreview,
  size = 'sm',
  className = '',
}: TweetButtonProps) {
  const text = tweetPreview || `${title} via @TheUnOfficial`
  const href = tweetUrl(text, url)
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5'

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 font-mono tracking-wide border border-[#1e1e2a] text-[#8a8a94] hover:text-[#1da1f2] hover:border-[#1da1f2]/30 rounded transition-all duration-150 ${sizeClass} ${className}`}
    >
      𝕏 Tweet
    </a>
  )
}

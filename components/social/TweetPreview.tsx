'use client'

import React from 'react'

interface TweetPreviewProps {
  text?: string
  title: string
  url?: string
}

export function TweetPreview({ text, title, url }: TweetPreviewProps) {
  const preview = text || `${title} via @TheUnOfficial${url ? ` ${url}` : ''}`
  const remaining = 240 - preview.length

  return (
    <div className="bg-[#0a0a0f] border border-[#1e1e2a] rounded-lg p-3">
      <div className="font-mono text-xs text-[#5a5a64] uppercase tracking-widest mb-2">
        Tweet Preview
      </div>
      <div className="text-sm text-[#e8e6e3] leading-relaxed break-words">{preview}</div>
      <div
        className={`mt-2 text-xs font-mono text-right ${
          remaining < 20 ? 'text-red-400' : 'text-[#5a5a64]'
        }`}
      >
        {remaining} chars remaining
      </div>
    </div>
  )
}

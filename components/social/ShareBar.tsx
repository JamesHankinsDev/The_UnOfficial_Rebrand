'use client'

import React from 'react'
import { ShareButton } from './ShareButton'
import { TweetButton } from './TweetButton'

interface ShareBarProps {
  url: string
  title: string
  tweetPreview?: string
  sticky?: boolean
}

export function ShareBar({ url, title, tweetPreview, sticky = false }: ShareBarProps) {
  return (
    <div className={`flex items-center gap-2 ${sticky ? 'sticky top-20 z-30' : ''}`}>
      <ShareButton url={url} size="md" />
      <TweetButton url={url} title={title} tweetPreview={tweetPreview} size="md" />
    </div>
  )
}

'use client'

import React from 'react'
import { PlayerHoverRoot } from '@/components/player/PlayerHoverRoot'

interface ArticleBodyProps {
  html: string
  prose: boolean
}

export function ArticleBody({ html, prose }: ArticleBodyProps) {
  return (
    <>
      <div
        className={`max-w-none mb-16 ${prose ? 'prose prose-invert' : ''}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <PlayerHoverRoot />
    </>
  )
}

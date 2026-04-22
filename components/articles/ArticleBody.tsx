'use client'

import React from 'react'

interface ArticleBodyProps {
  html: string
  prose: boolean
}

export function ArticleBody({ html, prose }: ArticleBodyProps) {
  // Player hover cards (data-player-id triggers) are wired via the
  // app-wide <PlayerHoverRoot /> mounted in <BoxScoreProvider>; no
  // local mount needed here.
  return (
    <div
      className={`max-w-none mb-16 ${prose ? 'prose prose-invert' : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

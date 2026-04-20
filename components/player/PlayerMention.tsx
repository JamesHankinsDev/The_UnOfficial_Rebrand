'use client'

import React from 'react'

interface PlayerMentionProps {
  playerId: number
  name?: string
  children?: React.ReactNode
  className?: string
}

/**
 * Wraps a player's name so hovering over it triggers the shared PlayerHoverRoot card.
 * Install a <PlayerHoverRoot /> once per page for this to activate.
 */
export function PlayerMention({
  playerId,
  name,
  children,
  className = '',
}: PlayerMentionProps) {
  const content = children ?? name
  return (
    <span
      data-player-id={playerId}
      data-player-name={name ?? (typeof content === 'string' ? content : undefined)}
      className={`underline decoration-dotted decoration-[#fbbf24]/40 underline-offset-4 cursor-help ${className}`}
    >
      {content}
    </span>
  )
}

'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PlayerHoverCard } from './PlayerHoverCard'

const SHOW_DELAY_MS = 150
const HIDE_DELAY_MS = 200
const CARD_W = 280
const CARD_H_ESTIMATE = 260

interface ActiveCard {
  playerId: number
  fallbackName: string
  rect: { top: number; left: number; right: number; bottom: number; width: number }
}

function findTrigger(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  return target.closest<HTMLElement>('[data-player-id]')
}

export function PlayerHoverRoot() {
  const [active, setActive] = useState<ActiveCard | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cardHovered = useRef(false)

  useEffect(() => {
    const clearShow = () => {
      if (hoverTimer.current) {
        clearTimeout(hoverTimer.current)
        hoverTimer.current = null
      }
    }
    const clearHide = () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current)
        hideTimer.current = null
      }
    }

    const extract = (el: HTMLElement): ActiveCard | null => {
      const idRaw = el.dataset.playerId
      const id = idRaw ? parseInt(idRaw, 10) : NaN
      if (!Number.isFinite(id)) return null
      const rect = el.getBoundingClientRect()
      return {
        playerId: id,
        fallbackName: el.dataset.playerName || el.textContent?.trim() || 'Player',
        rect: {
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          right: rect.right + window.scrollX,
          bottom: rect.bottom + window.scrollY,
          width: rect.width,
        },
      }
    }

    const onOver = (e: MouseEvent) => {
      const trigger = findTrigger(e.target)
      if (!trigger) return
      clearHide()
      const next = extract(trigger)
      if (!next) return
      // If we're already showing this player, refresh rect and bail
      if (active && active.playerId === next.playerId) {
        return
      }
      clearShow()
      hoverTimer.current = setTimeout(() => {
        setActive(next)
      }, SHOW_DELAY_MS)
    }

    const onOut = (e: MouseEvent) => {
      const trigger = findTrigger(e.target)
      if (!trigger) return
      // If pointer is moving to the card, don't hide yet
      const to = e.relatedTarget as Node | null
      if (to && document.getElementById('player-hover-card')?.contains(to)) return
      clearShow()
      clearHide()
      hideTimer.current = setTimeout(() => {
        if (!cardHovered.current) setActive(null)
      }, HIDE_DELAY_MS)
    }

    const onClick = (e: MouseEvent) => {
      const trigger = findTrigger(e.target)
      if (!trigger) return
      // Don't hijack explicit anchor navigation
      if (trigger.tagName === 'A' && (trigger as HTMLAnchorElement).href) return
      const next = extract(trigger)
      if (!next) return
      e.preventDefault()
      setActive((cur) => (cur?.playerId === next.playerId ? null : next))
    }

    const onScroll = () => {
      clearShow()
      setActive(null)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActive(null)
    }

    document.addEventListener('mouseover', onOver)
    document.addEventListener('mouseout', onOut)
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, true)

    return () => {
      clearShow()
      clearHide()
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mouseout', onOut)
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [active])

  if (!active || typeof document === 'undefined') return null

  const { top, left, bottom, width } = active.rect
  const viewportW = window.innerWidth
  const scrollY = window.scrollY
  const scrollX = window.scrollX

  // Prefer placing below the trigger; flip if there's not enough space.
  const spaceBelow = window.innerHeight - (bottom - scrollY)
  const placeAbove = spaceBelow < CARD_H_ESTIMATE && top - scrollY > CARD_H_ESTIMATE
  const cardTop = placeAbove ? top - CARD_H_ESTIMATE - 8 : bottom + 8

  // Horizontally center on the trigger; clamp to viewport.
  const desiredLeft = left + width / 2 - CARD_W / 2
  const clampedLeft = Math.max(
    scrollX + 12,
    Math.min(desiredLeft, scrollX + viewportW - CARD_W - 12),
  )

  return createPortal(
    <div
      id="player-hover-card"
      role="tooltip"
      className="absolute z-[60]"
      style={{ top: cardTop, left: clampedLeft }}
      onMouseEnter={() => {
        cardHovered.current = true
        if (hideTimer.current) {
          clearTimeout(hideTimer.current)
          hideTimer.current = null
        }
      }}
      onMouseLeave={() => {
        cardHovered.current = false
        hideTimer.current = setTimeout(() => setActive(null), HIDE_DELAY_MS)
      }}
    >
      <PlayerHoverCard playerId={active.playerId} fallbackName={active.fallbackName} />
    </div>,
    document.body,
  )
}

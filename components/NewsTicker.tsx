'use client'

import { useEffect, useState } from 'react'

interface TickerData {
  standings: { conference: string; team: string; wins: number; losses: number }[]
  leaders: { stat: string; label: string; players: { name: string; team: string; value: number }[] }[]
  todayGames: { home: string; visitor: string; status: string; homeScore: number; visitorScore: number }[]
  yesterdayGames: { home: string; homeScore: number; visitor: string; visitorScore: number; status: string }[]
}

function buildTickerContent(data: TickerData): string[] {
  const segments: string[] = []

  // Standings — top 5 per conference
  for (const conf of ['East', 'West']) {
    const teams = data.standings.filter(s => s.conference === conf)
    if (teams.length === 0) continue
    const list = teams.map((t, i) => `${i + 1}. ${t.team} ${t.wins}-${t.losses}`).join('  ·  ')
    segments.push(`${conf.toUpperCase()}|||${list}`)
  }

  // Leaders — top 5 per stat category
  for (const cat of data.leaders) {
    if (cat.players.length === 0) continue
    const list = cat.players.map(p => `${p.name} ${p.value}`).join('  ·  ')
    segments.push(`${cat.label}|||${list}`)
  }

  // Today's games
  if (data.todayGames.length > 0) {
    const isFinal = (s: string) => s === 'Final'
    const list = data.todayGames.map(g => {
      if (isFinal(g.status)) {
        return `${g.visitor} ${g.visitorScore} - ${g.home} ${g.homeScore}`
      }
      return `${g.visitor} @ ${g.home}`
    }).join('  ·  ')
    segments.push(`TODAY|||${list}`)
  }

  // Yesterday's results
  if (data.yesterdayGames.length > 0) {
    const list = data.yesterdayGames.map(g =>
      `${g.visitor} ${g.visitorScore} - ${g.home} ${g.homeScore}`
    ).join('  ·  ')
    segments.push(`YESTERDAY|||${list}`)
  }

  return segments
}

export function NewsTicker() {
  const [segments, setSegments] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/nba/ticker')
      .then(res => {
        if (!res.ok) throw new Error('Failed')
        return res.json()
      })
      .then((data: TickerData) => {
        setSegments(buildTickerContent(data))
      })
      .catch(() => {
        // Silently fail — ticker just won't render
      })
  }, [])

  if (segments.length === 0) return null

  return (
    <div className="relative bg-[#0a0a0f] border-b border-[#1e1e2a] overflow-hidden h-8 flex items-center">
      <div className="ticker-track flex whitespace-nowrap">
        {/* Render content twice for seamless loop */}
        {[0, 1].map(copy => (
          <div key={copy} className="flex items-center shrink-0" aria-hidden={copy === 1}>
            {segments.map((seg, i) => {
              const [label, content] = seg.split('|||')
              return (
                <span key={`${copy}-${i}`} className="flex items-center">
                  <span className="text-[#fbbf24] font-mono text-[10px] font-bold mx-4">
                    &#9670;
                  </span>
                  <span className="font-mono text-[11px] font-bold text-[#fbbf24] mr-2 tracking-wide">
                    {label}
                  </span>
                  <span className="font-mono text-[11px] text-[#8a8a94]">
                    {content}
                  </span>
                </span>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { DraftOrderGame } from './DraftOrderGame'
import { StatRankingGame } from './StatRankingGame'

type TriviaMode = null | 'draft' | 'pra' | 'stocks'

const MODES = [
  {
    key: 'draft' as const,
    title: 'Draft IQ',
    tagline: 'Draft Position',
    description: 'Rank 5 players by their overall draft pick — earliest first.',
  },
  {
    key: 'pra' as const,
    title: 'PRA IQ',
    tagline: 'Points + Rebounds + Assists',
    description: 'Rank 5 players by their combined PRA stat line — highest first.',
  },
  {
    key: 'stocks' as const,
    title: 'STOCKS IQ',
    tagline: 'Steals + Blocks',
    description: 'Rank 5 players by their combined STOCKS — highest first.',
  },
] as const

export function TriviaHub() {
  const [mode, setMode] = useState<TriviaMode>(null)

  const goBack = () => setMode(null)

  if (mode === 'draft') {
    return <DraftOrderGame onBack={goBack} />
  }

  if (mode === 'pra') {
    return (
      <StatRankingGame
        mode="pra"
        title="PRA IQ"
        subtitle="Points + Rebounds + Assists"
        description="Five players. Five stat lines. Can you rank them by PRA? Rank from highest to lowest."
        statLabel="PRA"
        onBack={goBack}
      />
    )
  }

  if (mode === 'stocks') {
    return (
      <StatRankingGame
        mode="stocks"
        title="STOCKS IQ"
        subtitle="Steals + Blocks"
        description="Five players. Five defensive stat lines. Can you rank them by STOCKS? Rank from highest to lowest."
        statLabel="STOCKS"
        onBack={goBack}
      />
    )
  }

  // --- Mode Selection ---
  return (
    <div className="py-12 px-4">
      <div className="text-center mb-10">
        <h1 className="font-mono font-bold text-3xl sm:text-4xl text-[#fbbf24] mb-2">
          NBA Trivia
        </h1>
        <p className="text-[#8a8a94] text-sm sm:text-base">
          Choose your challenge
        </p>
      </div>

      <div className="max-w-lg mx-auto space-y-4">
        {MODES.map(({ key, title, tagline, description }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className="w-full text-left p-5 rounded-xl border border-[#1e1e2a] bg-[#111118] hover:border-[#fbbf24]/50 hover:bg-[#fbbf24]/5 transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono font-bold text-lg text-[#e8e6e3] group-hover:text-[#fbbf24] transition-colors">
                {title}
              </span>
              <span className="text-[#3a3a44] group-hover:text-[#fbbf24] transition-colors">
                &rarr;
              </span>
            </div>
            <div className="font-mono text-[10px] text-[#5a5a64] uppercase tracking-wider mb-2">
              {tagline}
            </div>
            <p className="text-[#8a8a94] text-xs leading-relaxed">
              {description}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { PlayerProfile } from './PlayerProfile'
import { CURRENT_SEASON } from '@/lib/constants'

type Period = 'regular' | 'postseason'

export function PublicPlayerProfileShell({ playerId }: { playerId: number }) {
  const [period, setPeriod] = useState<Period>('regular')
  const postseason = period === 'postseason'

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <Link
          href="/posts"
          className="font-mono text-xs text-[#8a8a94] hover:text-[#fbbf24] transition-colors flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to articles
        </Link>

        <div className="flex items-center gap-1 bg-[#111118] border border-[#1e1e2a] rounded-lg p-1">
          {(['regular', 'postseason'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs font-mono tracking-widest uppercase rounded-md transition-colors ${
                period === p
                  ? 'bg-[#fbbf24]/15 text-[#fbbf24]'
                  : 'text-[#5a5a64] hover:text-[#e8e6e3]'
              }`}
            >
              {p === 'regular' ? 'Regular' : 'Playoffs'}
            </button>
          ))}
        </div>
      </div>

      <PlayerProfile
        playerId={playerId}
        season={CURRENT_SEASON}
        postseason={postseason}
        showWatchButton={false}
      />
    </div>
  )
}

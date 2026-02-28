'use client'

import React, { useState, useCallback } from 'react'
import toast from 'react-hot-toast'

interface Player {
  id: number
  name: string
  team: string
  position: string
}

interface DraftAnswer {
  draftNumber: number
  draftYear: number
  draftRound: number
}

type GameState = 'idle' | 'loading' | 'playing' | 'results'

export function DraftOrderGame() {
  const [state, setState] = useState<GameState>('idle')
  const [players, setPlayers] = useState<Player[]>([])
  const [answers, setAnswers] = useState<Record<number, DraftAnswer>>({})
  const [rankings, setRankings] = useState<number[]>([]) // ordered list of player IDs
  const [score, setScore] = useState(0)

  const fetchPlayers = useCallback(async () => {
    setState('loading')
    try {
      const res = await fetch('/api/trivia/draft-order')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setPlayers(data.players)
      setAnswers(data.answers)
      setRankings([])
      setScore(0)
      setState('playing')
    } catch {
      toast.error('Failed to load trivia. Try again!')
      setState('idle')
    }
  }, [])

  const toggleRank = (playerId: number) => {
    setRankings(prev => {
      if (prev.includes(playerId)) {
        return prev.filter(id => id !== playerId)
      }
      if (prev.length >= 5) return prev
      return [...prev, playerId]
    })
  }

  const handleSubmit = () => {
    // Compare user ranking order vs correct order by draft number
    const correctOrder = [...players].sort(
      (a, b) => answers[a.id].draftNumber - answers[b.id].draftNumber
    )
    const correctIds = correctOrder.map(p => p.id)

    let correct = 0
    for (let i = 0; i < rankings.length; i++) {
      if (rankings[i] === correctIds[i]) correct++
    }
    setScore(correct)
    setState('results')
  }

  const correctOrder = state === 'results'
    ? [...players].sort((a, b) => answers[a.id].draftNumber - answers[b.id].draftNumber)
    : []

  // --- Idle / Start Screen ---
  if (state === 'idle' || state === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 px-4">
        <div className="mb-2 text-4xl sm:text-5xl font-mono font-bold text-[#fbbf24]">
          Draft IQ
        </div>
        <p className="text-[#8a8a94] text-sm sm:text-base max-w-md mb-8 leading-relaxed">
          Five players. Five draft picks. Can you put them in the right order?
          Rank them from earliest pick to latest.
        </p>
        <button
          onClick={fetchPlayers}
          disabled={state === 'loading'}
          className="px-8 py-3 font-mono font-bold text-sm rounded-lg bg-[#fbbf24] text-[#0a0a0f] hover:bg-[#f59e0b] transition-colors disabled:opacity-60 disabled:cursor-wait"
        >
          {state === 'loading' ? 'Loading...' : 'Start Game'}
        </button>
      </div>
    )
  }

  // --- Playing State ---
  if (state === 'playing') {
    return (
      <div className="py-8 px-4">
        <div className="text-center mb-6">
          <h2 className="font-mono font-bold text-[#e8e6e3] text-lg sm:text-xl mb-1">
            Rank by Draft Position
          </h2>
          <p className="text-[#8a8a94] text-xs sm:text-sm">
            Tap each player in order — earliest pick first
          </p>
        </div>

        <div className="max-w-lg mx-auto space-y-3 mb-8">
          {players.map(player => {
            const rankIndex = rankings.indexOf(player.id)
            const isRanked = rankIndex !== -1

            return (
              <button
                key={player.id}
                onClick={() => toggleRank(player.id)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${
                  isRanked
                    ? 'border-[#fbbf24] bg-[#fbbf24]/10'
                    : 'border-[#1e1e2a] bg-[#111118] hover:border-[#3a3a44]'
                }`}
              >
                {/* Rank badge */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-sm font-bold flex-shrink-0 transition-colors ${
                    isRanked
                      ? 'bg-[#fbbf24] text-[#0a0a0f]'
                      : 'bg-[#1e1e2a] text-[#5a5a64]'
                  }`}
                >
                  {isRanked ? rankIndex + 1 : '?'}
                </div>

                {/* Player info */}
                <div className="text-left flex-1 min-w-0">
                  <div className="font-mono font-bold text-[#e8e6e3] text-sm sm:text-base truncate">
                    {player.name}
                  </div>
                  <div className="text-xs text-[#8a8a94] truncate">
                    {player.team} &middot; {player.position}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Submit / status */}
        <div className="text-center">
          {rankings.length < 5 ? (
            <p className="text-[#5a5a64] font-mono text-xs">
              {rankings.length}/5 ranked
            </p>
          ) : (
            <button
              onClick={handleSubmit}
              className="px-8 py-3 font-mono font-bold text-sm rounded-lg bg-[#fbbf24] text-[#0a0a0f] hover:bg-[#f59e0b] transition-colors"
            >
              Lock It In
            </button>
          )}
        </div>
      </div>
    )
  }

  // --- Results State ---
  return (
    <div className="py-8 px-4">
      <div className="text-center mb-6">
        <div className="font-mono font-bold text-3xl sm:text-4xl text-[#fbbf24] mb-1">
          {score}/5
        </div>
        <p className="text-[#8a8a94] text-sm">
          {score === 5
            ? 'Perfect! You know your draft history.'
            : score >= 3
            ? 'Solid draft knowledge!'
            : score >= 1
            ? 'Keep studying those drafts!'
            : 'Tough round. Try again!'}
        </p>
      </div>

      {/* Correct order */}
      <div className="max-w-lg mx-auto mb-4">
        <p className="text-[#5a5a64] font-mono text-xs mb-3 text-center uppercase tracking-wider">
          Correct Order
        </p>
        <div className="space-y-3">
          {correctOrder.map((player, idx) => {
            const userRankIndex = rankings.indexOf(player.id)
            const isCorrect = rankings[idx] === player.id
            const answer = answers[player.id]

            return (
              <div
                key={player.id}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                  isCorrect
                    ? 'border-emerald-500/60 bg-emerald-500/10'
                    : 'border-red-500/60 bg-red-500/10'
                }`}
              >
                {/* Correct position badge */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-sm font-bold flex-shrink-0 ${
                    isCorrect
                      ? 'bg-emerald-500 text-[#0a0a0f]'
                      : 'bg-red-500 text-[#0a0a0f]'
                  }`}
                >
                  {idx + 1}
                </div>

                {/* Player info + draft details */}
                <div className="flex-1 min-w-0">
                  <div className="font-mono font-bold text-[#e8e6e3] text-sm sm:text-base truncate">
                    {player.name}
                  </div>
                  <div className="text-xs text-[#8a8a94]">
                    Pick #{answer.draftNumber} overall &middot; {answer.draftYear} Draft
                    {answer.draftRound > 1 ? ` (Rd ${answer.draftRound})` : ''}
                  </div>
                </div>

                {/* User's rank */}
                <div className="text-right flex-shrink-0">
                  <span className={`font-mono text-xs ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                    You: {userRankIndex + 1}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="text-center mt-8">
        <button
          onClick={fetchPlayers}
          className="px-8 py-3 font-mono font-bold text-sm rounded-lg bg-[#fbbf24] text-[#0a0a0f] hover:bg-[#f59e0b] transition-colors"
        >
          Play Again
        </button>
      </div>
    </div>
  )
}

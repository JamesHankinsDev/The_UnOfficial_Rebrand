'use client'

import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { SortablePlayerList, type SortablePlayer } from './SortablePlayerList'

interface StatAnswer {
  value: number
}

type GameState = 'idle' | 'loading' | 'playing' | 'results'

interface StatRankingGameProps {
  mode: 'pra' | 'stocks'
  title: string
  subtitle: string
  description: string
  statLabel: string
  onBack?: () => void
}

export function StatRankingGame({
  mode,
  title,
  subtitle,
  description,
  statLabel,
  onBack,
}: StatRankingGameProps) {
  const [state, setState] = useState<GameState>('idle')
  const [orderedPlayers, setOrderedPlayers] = useState<SortablePlayer[]>([])
  const [answers, setAnswers] = useState<Record<number, StatAnswer>>({})
  const [submittedOrder, setSubmittedOrder] = useState<SortablePlayer[]>([])
  const [score, setScore] = useState(0)

  const fetchPlayers = useCallback(async () => {
    setState('loading')
    try {
      const res = await fetch(`/api/trivia/stat-ranking?mode=${mode}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setOrderedPlayers(data.players)
      setAnswers(data.answers)
      setSubmittedOrder([])
      setScore(0)
      setState('playing')
    } catch {
      toast.error('Failed to load trivia. Try again!')
      setState('idle')
    }
  }, [mode])

  const handleSubmit = () => {
    // Correct order: highest stat value first
    const correctOrder = [...orderedPlayers].sort(
      (a, b) => answers[b.id].value - answers[a.id].value
    )
    const correctIds = correctOrder.map(p => p.id)

    let correct = 0
    for (let i = 0; i < orderedPlayers.length; i++) {
      if (orderedPlayers[i].id === correctIds[i]) correct++
    }
    setSubmittedOrder([...orderedPlayers])
    setScore(correct)
    setState('results')
  }

  const correctOrder = state === 'results'
    ? [...submittedOrder].sort((a, b) => answers[b.id].value - answers[a.id].value)
    : []

  // --- Idle / Start Screen ---
  if (state === 'idle' || state === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 px-4">
        {onBack && (
          <button
            onClick={onBack}
            className="self-start mb-6 text-[#8a8a94] hover:text-[#e8e6e3] font-mono text-xs transition-colors"
          >
            &larr; Back
          </button>
        )}
        <div className="mb-1 text-4xl sm:text-5xl font-mono font-bold text-[#fbbf24]">
          {title}
        </div>
        <div className="mb-4 text-[#5a5a64] font-mono text-xs tracking-wider uppercase">
          {subtitle}
        </div>
        <p className="text-[#8a8a94] text-sm sm:text-base max-w-md mb-8 leading-relaxed">
          {description}
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
        {onBack && (
          <button
            onClick={onBack}
            className="mb-4 text-[#8a8a94] hover:text-[#e8e6e3] font-mono text-xs transition-colors"
          >
            &larr; Back
          </button>
        )}
        <div className="text-center mb-6">
          <h2 className="font-mono font-bold text-[#e8e6e3] text-lg sm:text-xl mb-1">
            Rank by {statLabel}
          </h2>
          <p className="text-[#8a8a94] text-xs sm:text-sm">
            Drag players to reorder — highest {statLabel} first
          </p>
        </div>

        <div className="mb-8">
          <SortablePlayerList
            players={orderedPlayers}
            onReorder={setOrderedPlayers}
          />
        </div>

        <div className="text-center">
          <button
            onClick={handleSubmit}
            className="px-8 py-3 font-mono font-bold text-sm rounded-lg bg-[#fbbf24] text-[#0a0a0f] hover:bg-[#f59e0b] transition-colors"
          >
            Lock It In
          </button>
        </div>
      </div>
    )
  }

  // --- Results State ---
  return (
    <div className="py-8 px-4">
      {onBack && (
        <button
          onClick={onBack}
          className="mb-4 text-[#8a8a94] hover:text-[#e8e6e3] font-mono text-xs transition-colors"
        >
          &larr; Back
        </button>
      )}
      <div className="text-center mb-6">
        <div className="font-mono font-bold text-3xl sm:text-4xl text-[#fbbf24] mb-1">
          {score}/5
        </div>
        <p className="text-[#8a8a94] text-sm">
          {score === 5
            ? `Perfect! You know your ${statLabel} leaders.`
            : score >= 3
            ? `Solid ${statLabel} knowledge!`
            : score >= 1
            ? `Keep studying those stat lines!`
            : 'Tough round. Try again!'}
        </p>
      </div>

      <div className="max-w-lg mx-auto mb-4">
        <p className="text-[#5a5a64] font-mono text-xs mb-3 text-center uppercase tracking-wider">
          Correct Order
        </p>
        <div className="space-y-3">
          {correctOrder.map((player, idx) => {
            const userRankIndex = submittedOrder.findIndex(p => p.id === player.id)
            const isCorrect = submittedOrder[idx]?.id === player.id
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
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-sm font-bold flex-shrink-0 ${
                    isCorrect
                      ? 'bg-emerald-500 text-[#0a0a0f]'
                      : 'bg-red-500 text-[#0a0a0f]'
                  }`}
                >
                  {idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-mono font-bold text-[#e8e6e3] text-sm sm:text-base truncate">
                    {player.name}
                  </div>
                  <div className="text-xs text-[#8a8a94]">
                    {answer.value} {statLabel} &middot; {player.team}
                  </div>
                </div>

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

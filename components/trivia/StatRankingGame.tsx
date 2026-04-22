'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'
import { earnBucks, formatResetsIn } from '@/lib/earn-client'
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

const STAR_LABELS = ['', '★', '★★', '★★★'] as const
const STAR_DESCRIPTIONS = [
  '',
  'Top 10% of players — the household names.',
  'Top 30% of players — solid starters and stars.',
  'Any eligible player — who really knows their stuff?',
]
const STAR_POOL_LABEL = ['', 'Top 10%', 'Top 30%', 'All Players']

export function StatRankingGame({
  mode,
  title,
  subtitle,
  description,
  statLabel,
  onBack,
}: StatRankingGameProps) {
  const { user } = useAuth()
  const [state, setState] = useState<GameState>('idle')
  const [stars, setStars] = useState<1 | 2 | 3>(1)
  const [orderedPlayers, setOrderedPlayers] = useState<SortablePlayer[]>([])
  const [answers, setAnswers] = useState<Record<number, StatAnswer>>({})
  const [submittedOrder, setSubmittedOrder] = useState<SortablePlayer[]>([])
  const [score, setScore] = useState(0)
  const [bucksEarned, setBucksEarned] = useState(0)
  const [bucksPerCorrect, setBucksPerCorrect] = useState(1)

  const fetchPlayers = useCallback(async (selectedStars: 1 | 2 | 3) => {
    setState('loading')
    try {
      const res = await fetch(`/api/trivia/stat-ranking?mode=${mode}&stars=${selectedStars}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setOrderedPlayers(data.players)
      setAnswers(data.answers)
      setBucksPerCorrect(data.bucksPerCorrect ?? selectedStars)
      setSubmittedOrder([])
      setScore(0)
      setBucksEarned(0)
      setState('playing')
    } catch {
      toast.error('Failed to load trivia. Try again!')
      setState('idle')
    }
  }, [mode])

  const handleSubmit = () => {
    const correctOrder = [...orderedPlayers].sort(
      (a, b) => answers[b.id].value - answers[a.id].value
    )
    const correctIds = correctOrder.map(p => p.id)

    let correct = 0
    for (let i = 0; i < orderedPlayers.length; i++) {
      if (orderedPlayers[i].id === correctIds[i]) correct++
    }
    const earned = correct * bucksPerCorrect
    setSubmittedOrder([...orderedPlayers])
    setScore(correct)
    setBucksEarned(earned)
    setState('results')

    if (earned > 0 && user) {
      earnBucks(user, { source: 'trivia.stat-ranking', amount: earned })
        .then((res) => {
          if (res.wasOverCap) {
            toast(`Daily earning cap hit. Keep playing — coins reset in ${formatResetsIn(res.resetsInMs)}.`, { icon: '⏳' })
          } else if (res.willCapAfter) {
            toast.success(
              `+${res.credited} coins. You've hit your daily cap — resets in ${formatResetsIn(res.resetsInMs)}.`,
            )
          }
          setBucksEarned(res.credited)
        })
        .catch(() => {})
    }
  }

  const correctOrder = state === 'results'
    ? [...submittedOrder].sort((a, b) => answers[b.id].value - answers[a.id].value)
    : []

  const handleShare = () => {
    const squares = correctOrder
      .map((p, i) => (submittedOrder[i]?.id === p.id ? '\u{1F7E9}' : '\u{1F7E5}'))
      .join('')
    const taunt = score === 5
      ? 'Perfect score. Your turn.'
      : score >= 3
      ? 'Not bad... but can you beat it?'
      : 'I need backup. Pull up and try this.'
    const text = `${title} ${STAR_LABELS[stars]} ${score}/5\n${squares}\n\n${taunt}\nthe-un-official.com/trivia`
    navigator.clipboard.writeText(text).then(() => toast.success('Copied to clipboard!'))
  }

  // --- Idle / Star Selection ---
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

        {/* Star difficulty selector */}
        <div className="w-full max-w-sm mb-8">
          <p className="font-mono text-[10px] text-[#5a5a64] uppercase tracking-wider mb-3">
            Choose Difficulty
          </p>
          <div className="space-y-2">
            {([1, 2, 3] as const).map(s => (
              <button
                key={s}
                onClick={() => setStars(s)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                  stars === s
                    ? 'border-[#fbbf24] bg-[#fbbf24]/10'
                    : 'border-[#1e1e2a] bg-[#111118] hover:border-[#fbbf24]/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-mono font-bold text-sm tracking-wide ${stars === s ? 'text-[#fbbf24]' : 'text-[#8a8a94]'}`}>
                    {STAR_LABELS[s]}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[#5a5a64]">
                      {STAR_POOL_LABEL[s]}
                    </span>
                    <span className={`font-mono text-[10px] font-bold ${stars === s ? 'text-[#fbbf24]' : 'text-[#5a5a64]'}`}>
                      {s} Buck{s !== 1 ? 's' : ''} / correct
                    </span>
                  </div>
                </div>
                <p className="text-[#5a5a64] text-[11px] mt-0.5">
                  {STAR_DESCRIPTIONS[s]}
                </p>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => fetchPlayers(stars)}
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
          <div className="flex items-center justify-center gap-2 mb-1">
            <h2 className="font-mono font-bold text-[#e8e6e3] text-lg sm:text-xl">
              Rank by {statLabel}
            </h2>
            <span className="font-mono text-sm text-[#fbbf24]">{STAR_LABELS[stars]}</span>
          </div>
          <p className="text-[#8a8a94] text-xs sm:text-sm">
            Drag players to reorder — highest {statLabel} first
          </p>
          <p className="text-[#5a5a64] font-mono text-[10px] mt-1">
            {bucksPerCorrect} Buck{bucksPerCorrect !== 1 ? 's' : ''} per correct position
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
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="font-mono font-bold text-3xl sm:text-4xl text-[#fbbf24]">
            {score}/5
          </div>
          <span className="font-mono text-xl text-[#fbbf24]">{STAR_LABELS[stars]}</span>
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
        {bucksEarned > 0 && user && (
          <p className="mt-2 font-mono text-sm text-[#fbbf24]">
            +{bucksEarned} UnOfficial Buck{bucksEarned !== 1 ? 's' : ''} earned!
            <Link href="/cards" className="ml-2 underline text-xs hover:text-[#f59e0b]">
              Spend them →
            </Link>
          </p>
        )}
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
                    isCorrect ? 'bg-emerald-500 text-[#0a0a0f]' : 'bg-red-500 text-[#0a0a0f]'
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
                    You: #{userRankIndex + 1}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 mt-8">
        <button
          onClick={() => fetchPlayers(stars)}
          className="px-8 py-3 font-mono font-bold text-sm rounded-lg bg-[#fbbf24] text-[#0a0a0f] hover:bg-[#f59e0b] transition-colors"
        >
          Play Again
        </button>
        <button
          onClick={handleShare}
          className="px-8 py-3 font-mono font-bold text-sm rounded-lg border border-[#fbbf24] text-[#fbbf24] hover:bg-[#fbbf24]/10 transition-colors"
        >
          Share
        </button>
      </div>

      <div className="text-center mt-6">
        <a
          href="https://buymeacoffee.com/theunofficialjb"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs font-mono text-[#5a5a64] hover:text-[#fbbf24] transition-colors"
        >
          Enjoying the game? ☕ Tip the UnOfficial
        </a>
      </div>
    </div>
  )
}

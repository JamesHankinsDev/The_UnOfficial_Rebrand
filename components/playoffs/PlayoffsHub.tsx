'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { getPublishedArticles, ArticleDoc } from '@/lib/firestore'
import { ArticleCard } from '@/components/articles/ArticleCard'
import type { PlayoffsPayload, PlayoffSeriesDTO } from '@/app/api/nba/playoffs/route'

const ROUND_LABELS: Record<number, string> = {
  1: 'First Round',
  2: 'Conference Semifinals',
  3: 'Conference Finals',
  4: 'NBA Finals',
}

export function PlayoffsHub() {
  const [bracket, setBracket] = useState<PlayoffsPayload | null>(null)
  const [articles, setArticles] = useState<ArticleDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const [bracketRes, posts] = await Promise.all([
          fetch('/api/nba/playoffs').then((r) => {
            if (!r.ok) throw new Error('bracket fetch failed')
            return r.json() as Promise<PlayoffsPayload>
          }),
          getPublishedArticles().catch(() => [] as ArticleDoc[]),
        ])
        if (cancelled) return
        setBracket(bracketRes)
        setArticles(
          posts.filter((p) => p.tags.some((t) => t.toLowerCase() === 'playoffs')),
        )
      } catch {
        if (!cancelled) setError('Could not load the playoff bracket. Try again later.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  const series = bracket?.series ?? []
  const east = series.filter((s) => s.conference === 'East')
  const west = series.filter((s) => s.conference === 'West')
  const finals = series.filter((s) => s.conference === 'Finals')

  return (
    <div>
      <div className="mb-10">
        <div className="font-mono text-xs tracking-widest uppercase text-[#fbbf24] mb-2">
          2026 NBA Playoffs
        </div>
        <h1 className="font-mono font-bold text-4xl text-[#e8e6e3] mb-2">
          The Bracket
        </h1>
        <p className="text-[#8a8a94]">
          Live series scores, plus The UnOfficial&apos;s playoff coverage.
        </p>
      </div>

      {loading ? (
        <BracketSkeleton />
      ) : error ? (
        <div className="text-center py-20 text-[#8a8a94] font-mono text-sm">{error}</div>
      ) : series.length === 0 ? (
        <div className="bg-[#111118] border border-[#1e1e2a] rounded-xl p-10 text-center">
          <p className="text-[#e8e6e3] font-mono">Tip-off is any minute.</p>
          <p className="text-[#5a5a64] font-mono text-sm mt-2">
            The bracket populates once playoff games are final.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ConferenceColumn label="Eastern Conference" series={east} />
            <ConferenceColumn label="Western Conference" series={west} />
          </div>
          {finals.length > 0 && (
            <div>
              <SectionHeader label="NBA Finals" />
              <div className="max-w-md mx-auto">
                {finals.map((s) => (
                  <SeriesCard key={s.id} s={s} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-16">
        <div className="flex items-center gap-3 mb-4">
          <div className="font-mono text-xs tracking-widest uppercase text-[#5a5a64]">
            Playoff Coverage
          </div>
          <div className="flex-1 h-px bg-[#1e1e2a]" />
        </div>
        {articles.length === 0 ? (
          <div className="text-[#5a5a64] font-mono text-sm py-4">
            No playoff articles yet. Tag a post with{' '}
            <code className="text-[#fbbf24]">playoffs</code> to surface it here.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ConferenceColumn({
  label,
  series,
}: {
  label: string
  series: PlayoffSeriesDTO[]
}) {
  const byRound = new Map<number, PlayoffSeriesDTO[]>()
  for (const s of series) {
    const arr = byRound.get(s.round) ?? []
    arr.push(s)
    byRound.set(s.round, arr)
  }
  const rounds = Array.from(byRound.keys()).sort((a, b) => a - b)

  return (
    <div>
      <SectionHeader label={label} />
      {rounds.length === 0 ? (
        <div className="text-[#5a5a64] font-mono text-sm">No series yet.</div>
      ) : (
        <div className="space-y-6">
          {rounds.map((r) => (
            <div key={r}>
              <div className="font-mono text-[10px] tracking-widest uppercase text-[#5a5a64] mb-2">
                {ROUND_LABELS[r] ?? `Round ${r}`}
              </div>
              <div className="grid grid-cols-1 gap-3">
                {byRound.get(r)!.map((s) => (
                  <SeriesCard key={s.id} s={s} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SeriesCard({ s }: { s: PlayoffSeriesDTO }) {
  const aWon = s.winner === 'A'
  const bWon = s.winner === 'B'
  const finalized = s.status === 'completed'
  return (
    <Link
      href={`/playoffs/${s.id}`}
      className="block bg-[#111118] border border-[#1e1e2a] rounded-lg p-4 hover:border-[#fbbf24]/40 hover:bg-[#15151d] transition-colors"
    >
      <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-[#5a5a64] mb-3">
        <span>
          {s.conference === 'Finals'
            ? 'NBA Finals'
            : `${ROUND_LABELS[s.round] ?? `Round ${s.round}`}`}
        </span>
        <span className={finalized ? 'text-[#5a5a64]' : 'text-[#fbbf24]'}>
          {finalized ? 'Final' : s.totalGames > 0 ? 'In Progress' : 'Upcoming'}
        </span>
      </div>
      <TeamRow
        name={s.teamA.full_name}
        wins={s.winsA}
        winnerHighlight={aWon}
        leading={!finalized && s.winsA > s.winsB}
        dimmed={finalized && !aWon}
      />
      <div className="my-2 h-px bg-[#1e1e2a]" />
      <TeamRow
        name={s.teamB.full_name}
        wins={s.winsB}
        winnerHighlight={bWon}
        leading={!finalized && s.winsB > s.winsA}
        dimmed={finalized && !bWon}
      />
    </Link>
  )
}

function TeamRow({
  name,
  wins,
  winnerHighlight,
  leading,
  dimmed,
}: {
  name: string
  wins: number
  winnerHighlight: boolean
  leading: boolean
  dimmed: boolean
}) {
  const textColor = winnerHighlight
    ? 'text-[#fbbf24]'
    : leading
      ? 'text-[#e8e6e3]'
      : 'text-[#e8e6e3]'
  const winsColor = winnerHighlight || leading ? 'text-[#fbbf24]' : 'text-[#8a8a94]'
  return (
    <div className={`flex items-center justify-between ${dimmed ? 'opacity-40' : ''}`}>
      <span className={`font-mono text-sm ${textColor}`}>{name}</span>
      <span className={`font-mono text-lg ${winsColor}`}>{wins}</span>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="font-mono font-bold text-lg text-[#e8e6e3]">{label}</div>
      <div className="flex-1 h-px bg-[#1e1e2a]" />
    </div>
  )
}

function BracketSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-3">
          {Array.from({ length: 4 }).map((_, j) => (
            <div
              key={j}
              className="bg-[#111118] border border-[#1e1e2a] rounded-lg h-24 animate-pulse"
            />
          ))}
        </div>
      ))}
    </div>
  )
}

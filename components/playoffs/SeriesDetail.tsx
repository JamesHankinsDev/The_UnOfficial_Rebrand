'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import type {
  SeriesDetailPayload,
  SeriesGameRow,
  SeriesLeaderRow,
} from '@/app/api/nba/playoffs/[seriesId]/route'
import { useBoxScore } from '@/components/box-score/BoxScoreContext'

const ROUND_LABELS: Record<number, string> = {
  1: 'First Round',
  2: 'Conference Semifinals',
  3: 'Conference Finals',
  4: 'NBA Finals',
}

export function SeriesDetail({ seriesId }: { seriesId: string }) {
  const [data, setData] = useState<SeriesDetailPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/nba/playoffs/${seriesId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`status ${r.status}`)
        return (await r.json()) as SeriesDetailPayload
      })
      .then((payload) => {
        if (cancelled) return
        setData(payload)
        setError(null)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load this series. It may not exist yet.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [seriesId])

  if (loading) return <DetailSkeleton />

  if (error || !data) {
    return (
      <div>
        <BackLink />
        <div className="text-center py-20 text-[#8a8a94] font-mono text-sm">
          {error ?? 'Series not found.'}
        </div>
      </div>
    )
  }

  const aWon = data.winner === 'A'
  const bWon = data.winner === 'B'
  const finalized = data.status === 'completed'
  const roundLabel = ROUND_LABELS[data.round] ?? `Round ${data.round}`

  return (
    <div>
      <BackLink />

      <div className="mb-8">
        <div className="font-mono text-xs tracking-widest uppercase text-[#fbbf24] mb-2">
          {roundLabel}
        </div>
        <div className="flex items-baseline gap-4 flex-wrap">
          <h1 className="font-mono font-bold text-3xl md:text-4xl text-[#e8e6e3]">
            {data.teamA.full_name}{' '}
            <span className="text-[#5a5a64]">vs</span> {data.teamB.full_name}
          </h1>
          <span
            className={`font-mono text-sm ${
              finalized ? 'text-[#5a5a64]' : 'text-[#fbbf24]'
            }`}
          >
            {finalized ? 'Series Final' : 'Series In Progress'}
          </span>
        </div>
        <div className="mt-4 flex items-center gap-6 font-mono">
          <span
            className={`text-2xl ${
              aWon ? 'text-[#fbbf24]' : data.winsA > data.winsB ? 'text-[#fbbf24]' : 'text-[#8a8a94]'
            }`}
          >
            {data.teamA.abbreviation}{' '}
            <span className="font-bold">{data.winsA}</span>
          </span>
          <span className="text-[#5a5a64]">—</span>
          <span
            className={`text-2xl ${
              bWon ? 'text-[#fbbf24]' : data.winsB > data.winsA ? 'text-[#fbbf24]' : 'text-[#8a8a94]'
            }`}
          >
            <span className="font-bold">{data.winsB}</span>{' '}
            {data.teamB.abbreviation}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          <SectionHeader label="Game History" />
          {data.games.length === 0 ? (
            <div className="text-[#5a5a64] font-mono text-sm">No games yet.</div>
          ) : (
            <div className="space-y-2">
              {data.games.map((g, i) => (
                <GameRow key={g.id} game={g} index={i} />
              ))}
            </div>
          )}
        </div>
        <div className="lg:col-span-2">
          <SectionHeader label="Series Leaders" />
          <div className="space-y-6">
            <LeaderGroup label="Points" rows={data.leaders.pts} />
            <LeaderGroup label="Rebounds" rows={data.leaders.reb} />
            <LeaderGroup label="Assists" rows={data.leaders.ast} />
          </div>
        </div>
      </div>
    </div>
  )
}

function GameRow({ game, index }: { game: SeriesGameRow; index: number }) {
  const { openBoxScore } = useBoxScore()
  const homeWon = game.winner === 'home'
  const visitorWon = game.winner === 'visitor'
  const dateLabel = formatGameDate(game.date)
  const clickable = game.isFinal
  return (
    <div
      onClick={clickable ? () => openBoxScore(game.id) : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                openBoxScore(game.id)
              }
            }
          : undefined
      }
      className={`bg-[#111118] border border-[#1e1e2a] rounded-lg p-4 transition-colors ${
        clickable ? 'cursor-pointer hover:border-[#fbbf24]/40' : ''
      }`}
    >
      <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-[#5a5a64] mb-2">
        <span>Game {index + 1}</span>
        <span>{dateLabel}</span>
      </div>
      <ScoreLine
        team={game.visitor_team.full_name}
        abbr={game.visitor_team.abbreviation}
        score={game.visitor_team_score}
        won={visitorWon}
        isFinal={game.isFinal}
      />
      <div className="my-1 h-px bg-[#1e1e2a]" />
      <ScoreLine
        team={`${game.home_team.full_name} (home)`}
        abbr={game.home_team.abbreviation}
        score={game.home_team_score}
        won={homeWon}
        isFinal={game.isFinal}
      />
      <div className="mt-2 text-[10px] font-mono text-[#5a5a64]">
        {game.isFinal ? 'Final' : game.status || 'Scheduled'}
      </div>
    </div>
  )
}

function ScoreLine({
  team,
  abbr,
  score,
  won,
  isFinal,
}: {
  team: string
  abbr: string
  score: number
  won: boolean
  isFinal: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={`font-mono text-sm ${
          won ? 'text-[#fbbf24]' : 'text-[#e8e6e3]'
        }`}
      >
        <span className="text-[#5a5a64] mr-2">{abbr}</span>
        {team}
      </span>
      <span
        className={`font-mono text-lg ${
          !isFinal
            ? 'text-[#5a5a64]'
            : won
              ? 'text-[#fbbf24]'
              : 'text-[#8a8a94]'
        }`}
      >
        {isFinal ? score : '—'}
      </span>
    </div>
  )
}

function LeaderGroup({
  label,
  rows,
}: {
  label: string
  rows: SeriesLeaderRow[]
}) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-widest uppercase text-[#5a5a64] mb-2">
        {label}
      </div>
      {rows.length === 0 ? (
        <div className="text-[#5a5a64] font-mono text-xs">No stats yet.</div>
      ) : (
        <div className="bg-[#111118] border border-[#1e1e2a] rounded-lg divide-y divide-[#1e1e2a]">
          {rows.map((r, i) => (
            <div
              key={r.playerId}
              className="flex items-center justify-between px-3 py-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-xs text-[#5a5a64] w-4">
                  {i + 1}
                </span>
                <span
                  className="font-mono text-sm text-[#e8e6e3] truncate player-mention"
                  data-player-id={r.playerId}
                  data-player-name={r.name}
                >
                  {r.name}
                </span>
                <span className="font-mono text-[10px] text-[#5a5a64]">
                  {r.teamAbbr}
                </span>
              </div>
              <div className="flex items-baseline gap-2 font-mono">
                <span className="text-sm text-[#fbbf24]">
                  {r.perGame.toFixed(1)}
                </span>
                <span className="text-[10px] text-[#5a5a64]">
                  /G · {r.games}g
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
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

function BackLink() {
  return (
    <Link
      href="/playoffs"
      className="inline-flex items-center gap-2 font-mono text-xs tracking-widest uppercase text-[#8a8a94] hover:text-[#fbbf24] transition-colors mb-6"
    >
      <span aria-hidden>&larr;</span>
      Back to Bracket
    </Link>
  )
}

function DetailSkeleton() {
  return (
    <div>
      <div className="h-4 w-40 bg-[#111118] rounded animate-pulse mb-6" />
      <div className="h-10 w-2/3 bg-[#111118] rounded animate-pulse mb-3" />
      <div className="h-6 w-1/3 bg-[#111118] rounded animate-pulse mb-8" />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-[#111118] border border-[#1e1e2a] rounded-lg h-24 animate-pulse"
            />
          ))}
        </div>
        <div className="lg:col-span-2 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-[#111118] border border-[#1e1e2a] rounded-lg h-32 animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function formatGameDate(date: string): string {
  if (!date) return ''
  // date may be "2026-04-20T..." or "2026-04-20"
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

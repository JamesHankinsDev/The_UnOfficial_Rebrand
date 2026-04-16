'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  getLatestBriefForType,
  type BriefArticleType,
  type BriefDoc,
  type ValuePlay,
} from '@/lib/firestore'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

interface ETNow {
  weekday: string
  hour: number
}

function getEasternNow(): ETNow {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    hour: 'numeric',
    hour12: false,
  })
  const parts = fmt.formatToParts(new Date())
  const weekday =
    parts.find((p) => p.type === 'weekday')?.value?.toLowerCase() ?? ''
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
  return { weekday, hour }
}

// Phase 1 always shows the latest Value Meal brief so writers can reference
// it throughout the week, not only on Monday.
function articleTypeForDay(): BriefArticleType {
  return 'value_meal'
}

function formatPct(n: number | null): string {
  if (n == null) return '—'
  return `${(n * 100).toFixed(1)}%`
}

function formatSalary(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  return `$${(n / 1_000).toFixed(0)}K`
}

export default function BriefPage() {
  const [brief, setBrief] = useState<BriefDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedPlay, setExpandedPlay] = useState<ValuePlay | null>(null)
  const [expansionText, setExpansionText] = useState('')
  const [expansionLoading, setExpansionLoading] = useState(false)
  const [expansionError, setExpansionError] = useState('')

  const et = useMemo(getEasternNow, [])
  const targetType = useMemo(articleTypeForDay, [])
  const isBeforeSixAm = et.weekday === 'monday' && et.hour < 6

  useEffect(() => {
    getLatestBriefForType(targetType)
      .then((b) => {
        setBrief(b)
      })
      .catch(() => setError('Could not load the brief. Try refreshing.'))
      .finally(() => setLoading(false))
  }, [targetType])

  const briefIsFresh = useMemo(() => {
    if (!brief) return false
    const generated = brief.generatedAt.toMillis()
    const now = Date.now()
    return now - generated < 7 * 24 * 60 * 60 * 1000
  }, [brief])

  async function openExpand(play: ValuePlay) {
    setExpandedPlay(play)
    setExpansionText('')
    setExpansionError('')
    setExpansionLoading(true)

    try {
      const res = await fetch('/api/generate-brief/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          play,
          surroundingContext: brief?.content.narrativeHook ?? '',
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Request failed (${res.status})`)
      }
      const body = await res.json()
      setExpansionText(body.text ?? '')
    } catch (err) {
      setExpansionError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setExpansionLoading(false)
    }
  }

  function closeExpand() {
    setExpandedPlay(null)
    setExpansionText('')
    setExpansionError('')
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Badge variant="gold">Value Meal</Badge>
          <span className="text-xs font-mono text-[#5a5a64] uppercase tracking-widest">
            Monday Brief
          </span>
        </div>
        <h1 className="font-mono font-bold text-2xl text-[#e8e6e3] mb-1">
          Morning Brief
        </h1>
        <p className="text-sm text-[#5a5a64] font-mono">
          Auto-generated every Monday at 6am ET from last week&apos;s game logs.
        </p>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <EmptyState title="Something went wrong" body={error} />
      ) : isBeforeSixAm && !briefIsFresh ? (
        <GeneratingState />
      ) : !brief || !briefIsFresh ? (
        <EmptyState
          title="Brief generating…"
          body="The Monday brief will appear here shortly after 6am ET. If you're seeing this during the day, the cron job may have failed — check your Vercel logs."
        />
      ) : (
        <BriefView brief={brief} onExpand={openExpand} />
      )}

      <Modal
        open={expandedPlay != null}
        onClose={closeExpand}
        title={expandedPlay ? `${expandedPlay.playerName} — Deep Read` : ''}
      >
        {expansionLoading ? (
          <div className="py-8 text-center font-mono text-sm text-[#5a5a64] animate-pulse">
            Claude is writing…
          </div>
        ) : expansionError ? (
          <div className="py-4 font-mono text-sm text-red-400">
            {expansionError}
          </div>
        ) : (
          <div className="whitespace-pre-wrap text-sm text-[#e8e6e3] leading-relaxed max-h-[60vh] overflow-y-auto">
            {expansionText}
          </div>
        )}
      </Modal>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-24 bg-[#111118] border border-[#1e1e2a] rounded-xl animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-32 bg-[#111118] border border-[#1e1e2a] rounded-xl animate-pulse"
          />
        ))}
      </div>
    </div>
  )
}

function GeneratingState() {
  return (
    <div className="border border-[#fbbf24]/30 bg-[#fbbf24]/5 rounded-xl p-10 text-center">
      <div className="font-mono text-[#fbbf24] text-sm uppercase tracking-widest mb-2">
        Brief generating…
      </div>
      <p className="text-sm text-[#8a8a94] font-mono max-w-md mx-auto">
        The Monday Value Meal drops at 6am ET. Grab a coffee and check back.
      </p>
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-[#1e1e2a] bg-[#111118] rounded-xl p-10 text-center">
      <div className="font-mono text-[#e8e6e3] text-sm mb-2">{title}</div>
      <p className="text-sm text-[#5a5a64] font-mono max-w-md mx-auto">{body}</p>
    </div>
  )
}

function BriefView({
  brief,
  onExpand,
}: {
  brief: BriefDoc
  onExpand: (play: ValuePlay) => void
}) {
  const generatedDate = brief.generatedAt.toDate()
  const generatedLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(generatedDate)

  return (
    <div className="space-y-8">
      {/* Narrative hook */}
      <section className="border border-[#fbbf24]/30 bg-gradient-to-br from-[#fbbf24]/5 to-transparent rounded-xl p-6">
        <div className="text-xs font-mono text-[#fbbf24] uppercase tracking-widest mb-3">
          Narrative hook
        </div>
        <p className="text-lg text-[#e8e6e3] leading-relaxed font-body">
          {brief.content.narrativeHook}
        </p>
        <div className="text-xs font-mono text-[#5a5a64] mt-4">
          Generated {generatedLabel} ET
        </div>
      </section>

      {/* Value plays */}
      <section>
        <h2 className="font-mono font-bold text-sm text-[#e8e6e3] uppercase tracking-widest mb-3">
          Top Value Plays
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {brief.content.topValuePlays.map((play, i) => (
            <ValuePlayCard
              key={`${play.playerId}-${i}`}
              play={play}
              onExpand={() => onExpand(play)}
            />
          ))}
        </div>
      </section>

      {/* Data anomalies */}
      {brief.content.dataAnomalies.length > 0 && (
        <section>
          <h2 className="font-mono font-bold text-sm text-[#e8e6e3] uppercase tracking-widest mb-3">
            Data Anomalies
          </h2>
          <ul className="border border-[#1e1e2a] bg-[#111118] rounded-xl divide-y divide-[#1e1e2a]">
            {brief.content.dataAnomalies.map((item, i) => (
              <li
                key={i}
                className="px-4 py-3 text-sm text-[#e8e6e3] font-mono flex gap-3"
              >
                <span className="text-[#fbbf24]">▸</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Injury context */}
      <section>
        <h2 className="font-mono font-bold text-sm text-[#e8e6e3] uppercase tracking-widest mb-3">
          Injury Context
        </h2>
        <div className="border border-[#1e1e2a] bg-[#111118] rounded-xl p-5">
          <p className="text-sm text-[#e8e6e3] leading-relaxed font-body">
            {brief.content.injuryContext}
          </p>
        </div>
      </section>
    </div>
  )
}

function ValuePlayCard({
  play,
  onExpand,
}: {
  play: ValuePlay
  onExpand: () => void
}) {
  return (
    <div className="border border-[#1e1e2a] bg-[#111118] rounded-xl p-5 flex flex-col gap-3 hover:border-[#fbbf24]/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono font-bold text-[#e8e6e3]">
            {play.playerName}
          </div>
          <div className="font-mono text-xs text-[#5a5a64] uppercase tracking-widest">
            {play.team}
          </div>
        </div>
        <Badge variant="gold">{play.pra.toFixed(1)} PRA</Badge>
      </div>

      <div className="flex items-center gap-4 text-xs font-mono">
        <div>
          <div className="text-[#5a5a64] uppercase tracking-widest">Cap %</div>
          <div className="text-[#e8e6e3]">{formatPct(play.capPct)}</div>
        </div>
        <div>
          <div className="text-[#5a5a64] uppercase tracking-widest">Salary</div>
          <div className="text-[#e8e6e3]">{formatSalary(play.salary)}</div>
        </div>
      </div>

      {play.contextNote && (
        <p className="text-xs text-[#8a8a94] font-body leading-relaxed">
          {play.contextNote}
        </p>
      )}

      <Button
        variant="secondary"
        size="sm"
        className="mt-auto"
        onClick={onExpand}
      >
        Expand this angle →
      </Button>
    </div>
  )
}

'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import {
  getArticlesByAuthor,
  getLatestBrief,
  ArticleDoc,
  BriefDoc,
  BriefArticleType,
} from '@/lib/firestore'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SeriesBadge } from '@/components/articles/SeriesBadge'
import { formatShortDate } from '@/lib/utils'

const BRIEF_META: Record<
  BriefArticleType,
  { label: string; color: string }
> = {
  value_meal: { label: 'Value Meal', color: '#fbbf24' },
  mix_tape: { label: 'Mix Tape', color: '#3b82f6' },
  residue: { label: 'Residue', color: '#10b981' },
  picks_pops_rolls: { label: 'Picks Pops & Rolls', color: '#f97316' },
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Up late'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function todayStr(): string {
  const d = new Date()
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export default function DashboardHomePage() {
  const { user, userDoc } = useAuth()
  const [articles, setArticles] = useState<ArticleDoc[] | null>(null)
  const [brief, setBrief] = useState<BriefDoc | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([
      getArticlesByAuthor(user.uid).catch(() => [] as ArticleDoc[]),
      getLatestBrief().catch(() => null),
    ]).then(([mine, latestBrief]) => {
      if (cancelled) return
      setArticles(mine)
      setBrief(latestBrief)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  const stats = useMemo(() => {
    const list = articles ?? []
    return {
      drafts: list.filter((a) => a.status === 'draft').length,
      scheduled: list.filter((a) => a.status === 'scheduled').length,
      published: list.filter((a) => a.status === 'published').length,
      totalViews: list.reduce((s, a) => s + (a.viewCount ?? 0), 0),
    }
  }, [articles])

  const drafts = useMemo(
    () =>
      (articles ?? [])
        .filter((a) => a.status === 'draft')
        .sort((a, b) => {
          const at = a.updatedAt?.toMillis?.() ?? 0
          const bt = b.updatedAt?.toMillis?.() ?? 0
          return bt - at
        })
        .slice(0, 5),
    [articles],
  )

  const recentPublished = useMemo(
    () =>
      (articles ?? [])
        .filter((a) => a.status === 'published')
        .sort((a, b) => {
          const at = a.publishedAt?.toMillis?.() ?? 0
          const bt = b.publishedAt?.toMillis?.() ?? 0
          return bt - at
        })
        .slice(0, 5),
    [articles],
  )

  const upcoming = useMemo(
    () =>
      (articles ?? [])
        .filter((a) => a.status === 'scheduled')
        .sort((a, b) => {
          const at = a.scheduledAt?.toMillis?.() ?? 0
          const bt = b.scheduledAt?.toMillis?.() ?? 0
          return at - bt
        })
        .slice(0, 5),
    [articles],
  )

  const firstName = userDoc?.displayName?.split(' ')[0] ?? ''

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="font-mono text-xs tracking-widest uppercase text-[#5a5a64] mb-2">
          {todayStr()}
        </div>
        <h1 className="font-mono font-bold text-3xl text-[#e8e6e3]">
          {greeting()}
          {firstName ? `, ${firstName}` : ''}.
        </h1>
        <p className="text-[#8a8a94] mt-1">What are we cooking today?</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatTile
          label="Drafts"
          value={stats.drafts}
          loading={loading}
          href="/dashboard/articles?status=draft"
        />
        <StatTile
          label="Scheduled"
          value={stats.scheduled}
          loading={loading}
          href="/dashboard/articles?status=scheduled"
        />
        <StatTile
          label="Published"
          value={stats.published}
          loading={loading}
          href="/dashboard/articles?status=published"
        />
        <StatTile
          label="Total Views"
          value={stats.totalViews}
          loading={loading}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-10">
        <Link href="/dashboard/articles/new">
          <Button variant="primary">+ New Article</Button>
        </Link>
        <Link href="/dashboard/brief">
          <Button variant="secondary">Morning Brief &rarr;</Button>
        </Link>
        <Link href="/dashboard/analytics">
          <Button variant="secondary">League Stats &rarr;</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Section title="Continue Writing" items={drafts} empty="No drafts. Start something new.">
            <ul className="space-y-2">
              {drafts.map((a) => (
                <DraftRow key={a.id} a={a} />
              ))}
            </ul>
          </Section>

          <Section
            title="Recently Published"
            items={recentPublished}
            empty="Nothing published yet."
          >
            <ul className="space-y-2">
              {recentPublished.map((a) => (
                <PublishedRow key={a.id} a={a} />
              ))}
            </ul>
          </Section>
        </div>

        <div className="space-y-8">
          <BriefTeaser brief={brief} />
          <UpcomingList items={upcoming} />
        </div>
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  loading,
  href,
}: {
  label: string
  value: number
  loading: boolean
  href?: string
}) {
  const inner = (
    <div
      className={`bg-[#111118] border border-[#1e1e2a] rounded-lg p-4 ${
        href ? 'hover:border-[#fbbf24]/30 transition-colors' : ''
      }`}
    >
      <div className="font-mono text-[10px] tracking-widest uppercase text-[#5a5a64] mb-1">
        {label}
      </div>
      <div className="font-mono text-3xl font-bold text-[#e8e6e3]">
        {loading ? (
          <span className="text-[#3a3a44]">—</span>
        ) : (
          value.toLocaleString()
        )}
      </div>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

function Section({
  title,
  items,
  empty,
  children,
}: {
  title: string
  items: ArticleDoc[]
  empty: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <h2 className="font-mono font-bold text-sm tracking-widest uppercase text-[#e8e6e3]">
          {title}
        </h2>
        <div className="flex-1 h-px bg-[#1e1e2a]" />
      </div>
      {items.length === 0 ? (
        <div className="text-[#5a5a64] font-mono text-sm py-4">{empty}</div>
      ) : (
        children
      )}
    </section>
  )
}

function DraftRow({ a }: { a: ArticleDoc }) {
  return (
    <li>
      <Link
        href={`/dashboard/articles/${a.id}/edit`}
        className="group flex items-center gap-3 bg-[#111118] border border-[#1e1e2a] rounded-lg px-4 py-3 hover:border-[#fbbf24]/40 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <SeriesBadge series={a.series} />
            <span className="font-mono text-[10px] tracking-widest uppercase text-[#5a5a64]">
              {a.readTimeMinutes} min
            </span>
          </div>
          <div className="font-mono text-sm text-[#e8e6e3] truncate group-hover:text-[#fbbf24] transition-colors">
            {a.title || 'Untitled'}
          </div>
        </div>
        <span className="font-mono text-[10px] tracking-widest uppercase text-[#5a5a64] flex-shrink-0">
          {formatShortDate(a.updatedAt)}
        </span>
      </Link>
    </li>
  )
}

function PublishedRow({ a }: { a: ArticleDoc }) {
  return (
    <li>
      <Link
        href={`/posts/${a.slug}`}
        target="_blank"
        className="group flex items-center gap-3 bg-[#111118] border border-[#1e1e2a] rounded-lg px-4 py-3 hover:border-[#fbbf24]/40 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <SeriesBadge series={a.series} />
            {a.featured && <Badge variant="gold">Featured</Badge>}
          </div>
          <div className="font-mono text-sm text-[#e8e6e3] truncate group-hover:text-[#fbbf24] transition-colors">
            {a.title}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-mono text-sm text-[#e8e6e3]">
            {(a.viewCount ?? 0).toLocaleString()}
          </div>
          <div className="font-mono text-[10px] tracking-widest uppercase text-[#5a5a64]">
            views
          </div>
        </div>
      </Link>
    </li>
  )
}

function UpcomingList({ items }: { items: ArticleDoc[] }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <h2 className="font-mono font-bold text-sm tracking-widest uppercase text-[#e8e6e3]">
          Upcoming
        </h2>
        <div className="flex-1 h-px bg-[#1e1e2a]" />
      </div>
      {items.length === 0 ? (
        <div className="text-[#5a5a64] font-mono text-sm py-4">
          Nothing scheduled.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <li
              key={a.id}
              className="bg-[#111118] border border-[#1e1e2a] rounded-lg px-4 py-3"
            >
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <SeriesBadge series={a.series} />
                <span className="font-mono text-[10px] tracking-widest uppercase text-[#5a5a64]">
                  {a.scheduledAt ? formatShortDate(a.scheduledAt) : 'Soon'}
                </span>
              </div>
              <Link
                href={`/dashboard/articles/${a.id}/edit`}
                className="font-mono text-sm text-[#e8e6e3] hover:text-[#fbbf24] transition-colors line-clamp-2 block"
              >
                {a.title || 'Untitled'}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function BriefTeaser({ brief }: { brief: BriefDoc | null }) {
  if (!brief) {
    return (
      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="font-mono font-bold text-sm tracking-widest uppercase text-[#e8e6e3]">
            Today&apos;s Brief
          </h2>
          <div className="flex-1 h-px bg-[#1e1e2a]" />
        </div>
        <div className="text-[#5a5a64] font-mono text-sm py-4">
          No briefs yet.
        </div>
      </section>
    )
  }

  const meta = BRIEF_META[brief.articleType]
  const topPlay = brief.content.topValuePlays?.[0]
  const residue = brief.content.residueItems?.[0]
  const blurb = brief.content.tweetableBlurbs?.[0]

  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <h2 className="font-mono font-bold text-sm tracking-widest uppercase text-[#e8e6e3]">
          Latest Brief
        </h2>
        <div className="flex-1 h-px bg-[#1e1e2a]" />
      </div>
      <Link
        href="/dashboard/brief"
        className="group block bg-[#111118] border border-[#1e1e2a] rounded-lg p-5 hover:border-[#fbbf24]/40 transition-colors"
      >
        <div className="flex items-center gap-2 mb-3">
          <span
            className="font-mono text-[10px] tracking-widest uppercase font-bold"
            style={{ color: meta?.color ?? '#8a8a94' }}
          >
            {meta?.label ?? brief.articleType}
          </span>
          <span className="font-mono text-[10px] tracking-widest uppercase text-[#5a5a64]">
            {formatShortDate(brief.generatedAt)}
          </span>
        </div>

        {brief.content.narrativeHook && (
          <p className="text-sm text-[#e8e6e3] leading-relaxed mb-3 line-clamp-3">
            {brief.content.narrativeHook}
          </p>
        )}

        {topPlay && (
          <div className="border-t border-[#1e1e2a] pt-3 mb-2">
            <div className="font-mono text-[10px] tracking-widest uppercase text-[#5a5a64] mb-1">
              Top Play
            </div>
            <div className="font-mono text-sm text-[#e8e6e3]">
              {topPlay.playerName}{' '}
              <span className="text-[#5a5a64]">({topPlay.team})</span>{' '}
              <span className="text-[#fbbf24]">{topPlay.pra} PRA</span>
            </div>
            {topPlay.contextNote && (
              <div className="text-xs text-[#8a8a94] mt-1 line-clamp-2">
                {topPlay.contextNote}
              </div>
            )}
          </div>
        )}

        {residue && (
          <div className="border-t border-[#1e1e2a] pt-3 mb-2">
            <div className="font-mono text-[10px] tracking-widest uppercase text-[#5a5a64] mb-1">
              Residue
            </div>
            <div className="font-mono text-sm text-[#e8e6e3] line-clamp-2">
              {residue.title}
            </div>
          </div>
        )}

        {blurb && !topPlay && !residue && (
          <p className="text-xs text-[#8a8a94] italic line-clamp-3">
            &ldquo;{blurb}&rdquo;
          </p>
        )}

        <div className="mt-4 font-mono text-xs text-[#fbbf24] group-hover:underline">
          Read the full brief &rarr;
        </div>
      </Link>
    </section>
  )
}

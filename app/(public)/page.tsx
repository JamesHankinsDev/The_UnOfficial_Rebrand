import React from 'react'
import Link from 'next/link'
import { getFeaturedArticles, getPublishedArticles, getUpcomingScheduled } from '@/lib/firestore'
import { FeaturedHero } from '@/components/articles/FeaturedHero'
import { RecentList } from '@/components/articles/RecentList'
import { SeriesBadge } from '@/components/articles/SeriesBadge'
import { EmailSubscribe } from '@/components/social/EmailSubscribe'
import { formatShortDate } from '@/lib/utils'

export const revalidate = 60

export default async function HomePage() {
  const [featured, recent, upcoming] = await Promise.all([
    getFeaturedArticles().catch(() => []),
    getPublishedArticles({ lim: 10 }).catch(() => []),
    getUpcomingScheduled().catch(() => []),
  ])

  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || ''

  // Drop featured articles from recent feed so the two sections don't duplicate.
  const featuredIds = new Set(featured.map((a) => a.id))
  const recentOnly = recent.filter((a) => !featuredIds.has(a.id)).slice(0, 8)

  return (
    <div className="bg-[#0a0a0f]">
      <FeaturedHero articles={featured} baseUrl={siteUrl} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <section className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="font-mono text-xs tracking-widest text-[#5a5a64] uppercase">
                Recent
              </div>
              <div className="w-16 h-px bg-[#1e1e2a]" />
            </div>
            <Link
              href="/posts"
              className="font-mono text-xs tracking-widest uppercase text-[#5a5a64] hover:text-[#fbbf24] transition-colors"
            >
              All Articles &rarr;
            </Link>
          </div>
          <RecentList articles={recentOnly} />
        </section>

        {upcoming.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="font-mono text-xs tracking-widest text-[#fbbf24] uppercase">
                Coming Soon
              </div>
              <div className="flex-1 h-px bg-[#1e1e2a]" />
            </div>
            <ul className="divide-y divide-[#1e1e2a] border-y border-[#1e1e2a]">
              {upcoming.map((a) => (
                <li
                  key={a.id}
                  className="py-3 flex items-center gap-3 flex-wrap"
                >
                  <SeriesBadge series={a.series} />
                  <span className="font-mono font-bold text-[#e8e6e3] flex-1 min-w-0 truncate">
                    {a.title}
                  </span>
                  <span className="font-mono text-xs tracking-widest uppercase text-[#5a5a64]">
                    {a.scheduledAt ? formatShortDate(a.scheduledAt) : 'Soon'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mb-12">
          <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto">
            <div className="font-mono text-xs tracking-widest text-[#5a5a64] uppercase mb-3">
              Stay in the loop
            </div>
            <h2 className="font-mono font-bold text-2xl text-[#e8e6e3] mb-2">
              Drop your email.
            </h2>
            <p className="text-[#8a8a94] mb-6">
              New pieces, hot takes, and draft board drama &mdash; straight to your inbox.
            </p>
            <div className="max-w-md mx-auto">
              <EmailSubscribe source="homepage" />
            </div>
          </div>
        </section>

        <section className="mb-8">
          <div className="bg-gradient-to-r from-[#fbbf24]/10 via-[#f97316]/5 to-transparent border border-[#fbbf24]/20 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="font-mono font-bold text-[#fbbf24] mb-1">
                Rep the Brand
              </div>
              <p className="text-sm text-[#8a8a94]">
                Gear for people who actually watched the tape.
              </p>
            </div>
            <Link
              href="/merch"
              className="flex-shrink-0 px-5 py-2.5 bg-[#fbbf24] text-[#0a0a0f] font-mono font-bold text-sm rounded-lg hover:bg-[#f59e0b] transition-colors"
            >
              Shop Merch &rarr;
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

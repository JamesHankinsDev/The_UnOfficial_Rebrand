import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getFeaturedArticles, getPublishedArticles, getUpcomingScheduled } from '@/lib/firestore'
import { FeaturedBanner } from '@/components/articles/FeaturedBanner'
import { ArticleCard } from '@/components/articles/ArticleCard'
import { EmailSubscribe } from '@/components/social/EmailSubscribe'

export const revalidate = 60

export default async function HomePage() {
  const [featured, recent, upcoming] = await Promise.all([
    getFeaturedArticles().catch(() => []),
    getPublishedArticles({ lim: 9 }).catch(() => []),
    getUpcomingScheduled().catch(() => []),
  ])

  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || ''

  return (
    <div className="bg-[#0a0a0f]">
      {/* Hero */}
      <section className="relative border-b border-[#1e1e2a] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#fbbf24]/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 relative">
          <div className="max-w-3xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative w-12 h-12">
                <Image src="/logo.png" alt="The UnOfficial" fill className="object-contain" />
              </div>
              <div className="font-mono text-xs tracking-widest text-[#5a5a64] uppercase">
                Est. 2024
              </div>
            </div>
            <h1 className="font-mono font-bold text-5xl sm:text-6xl text-[#e8e6e3] leading-tight mb-4">
              The{' '}
              <span className="text-[#fbbf24]">Un</span>Official
            </h1>
            <p className="text-xl text-[#8a8a94] mb-8 leading-relaxed">
              Serious Fans, UnSerious Takes.
              <br />
              NBA analytics without the spin.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/posts"
                className="inline-flex items-center justify-center px-6 py-3 bg-[#fbbf24] text-[#0a0a0f] font-mono font-bold rounded-lg hover:bg-[#f59e0b] transition-colors"
              >
                Read the Latest
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center justify-center px-6 py-3 border border-[#1e1e2a] text-[#8a8a94] font-mono rounded-lg hover:border-[#3a3a44] hover:text-[#e8e6e3] transition-colors"
              >
                About the Site
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Featured articles */}
        {featured.length > 0 && (
          <FeaturedBanner articles={featured} baseUrl={siteUrl} />
        )}

        {/* Upcoming scheduled */}
        {upcoming.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="font-mono text-xs tracking-widest text-[#5a5a64] uppercase">Coming Soon</div>
              <div className="flex-1 h-px bg-[#1e1e2a]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcoming.map(article => (
                <ArticleCard key={article.id} article={article} baseUrl={siteUrl} />
              ))}
            </div>
          </section>
        )}

        {/* Recent articles */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="font-mono text-xs tracking-widest text-[#5a5a64] uppercase">Recent</div>
              <div className="w-24 h-px bg-[#1e1e2a]" />
            </div>
            <Link
              href="/posts"
              className="text-xs font-mono text-[#5a5a64] hover:text-[#fbbf24] transition-colors"
            >
              All Articles →
            </Link>
          </div>

          {recent.length === 0 ? (
            <div className="text-center py-16 text-[#5a5a64] font-mono text-sm">
              Nothing published yet. Don&apos;t sleep on the content calendar.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recent.map(article => (
                <ArticleCard key={article.id} article={article} baseUrl={siteUrl} />
              ))}
            </div>
          )}
        </section>

        {/* Subscribe section */}
        <section className="mb-12">
          <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto">
            <div className="font-mono text-xs tracking-widest text-[#5a5a64] uppercase mb-3">
              Stay in the loop
            </div>
            <h2 className="font-mono font-bold text-2xl text-[#e8e6e3] mb-2">
              Drop your email.
            </h2>
            <p className="text-[#8a8a94] mb-6">
              New pieces, hot takes, and draft board drama — straight to your inbox.
            </p>
            <div className="max-w-md mx-auto">
              <EmailSubscribe source="homepage" />
            </div>
          </div>
        </section>

        {/* Merch strip */}
        <section className="mb-8">
          <div className="bg-gradient-to-r from-[#fbbf24]/10 via-[#f97316]/5 to-transparent border border-[#fbbf24]/20 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="font-mono font-bold text-[#fbbf24] mb-1">Rep the Brand</div>
              <p className="text-sm text-[#8a8a94]">Gear for people who actually watched the tape.</p>
            </div>
            <Link
              href="/merch"
              className="flex-shrink-0 px-5 py-2.5 bg-[#fbbf24] text-[#0a0a0f] font-mono font-bold text-sm rounded-lg hover:bg-[#f59e0b] transition-colors"
            >
              Shop Merch →
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

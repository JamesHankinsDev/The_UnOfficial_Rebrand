import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArticleDoc } from '@/lib/firestore'
import { SeriesBadge } from './SeriesBadge'
import { ReadTimeDisplay } from '@/components/social/ReadTimeDisplay'
import { ShareButton } from '@/components/social/ShareButton'
import { TweetButton } from '@/components/social/TweetButton'
import { formatShortDate } from '@/lib/utils'

interface FeaturedHeroProps {
  articles: ArticleDoc[]
  baseUrl?: string
}

export function FeaturedHero({ articles, baseUrl = '' }: FeaturedHeroProps) {
  const primary = articles[0]
  const rail = articles.slice(1, 4)

  return (
    <section className="relative border-b border-[#1e1e2a] overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#fbbf24]/5 via-transparent to-transparent pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 relative">
        <div className="flex items-center gap-3 mb-8">
          <div className="font-mono text-[10px] tracking-widest text-[#fbbf24] uppercase">
            Editor&apos;s Picks
          </div>
          <div className="flex-1 h-px bg-[#1e1e2a]" />
          <span className="font-mono text-[10px] tracking-widest text-[#5a5a64] uppercase hidden sm:inline">
            Serious Fans &middot; UnSerious Takes
          </span>
        </div>

        {primary ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-10">
            <article className="lg:col-span-3 group">
              <Link href={`/posts/${primary.slug}`} className="block">
                {primary.coverImageUrl && (
                  <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-[#111118] mb-5">
                    <Image
                      src={primary.coverImageUrl}
                      alt={primary.title}
                      fill
                      priority
                      sizes="(max-width: 1024px) 100vw, 60vw"
                      className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f]/60 via-transparent to-transparent" />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <SeriesBadge series={primary.series} />
                  <ReadTimeDisplay minutes={primary.readTimeMinutes} />
                </div>
                <h1 className="font-mono font-bold text-3xl sm:text-4xl lg:text-5xl text-[#e8e6e3] leading-[1.1] mb-4 group-hover:text-[#fbbf24] transition-colors">
                  {primary.title}
                </h1>
              </Link>
              <p className="text-lg text-[#8a8a94] leading-relaxed mb-5 max-w-2xl line-clamp-3">
                {primary.excerpt}
              </p>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <span className="font-mono text-xs text-[#5a5a64]">
                  By {primary.authorName}
                  {primary.publishedAt ? ` \u00b7 ${formatShortDate(primary.publishedAt)}` : ''}
                </span>
                <div className="flex gap-2">
                  <ShareButton url={`${baseUrl}/posts/${primary.slug}`} />
                  <TweetButton
                    url={`${baseUrl}/posts/${primary.slug}`}
                    title={primary.title}
                    tweetPreview={primary.tweetPreview}
                  />
                </div>
              </div>
            </article>

            <aside className="lg:col-span-2 lg:border-l lg:border-[#1e1e2a] lg:pl-8 flex flex-col">
              <div className="font-mono text-[10px] tracking-widest text-[#5a5a64] uppercase mb-4 hidden lg:block">
                Also Featured
              </div>
              {rail.length === 0 ? (
                <div className="py-6 text-[#5a5a64] font-mono text-sm">
                  More featured coverage on the way.
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-[#1e1e2a] border-t border-[#1e1e2a] lg:border-t-0">
                  {rail.map((a) => (
                    <article key={a.id} className="group py-5 first:pt-0 lg:first:pt-0">
                      <Link href={`/posts/${a.slug}`} className="block">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <SeriesBadge series={a.series} />
                          <ReadTimeDisplay minutes={a.readTimeMinutes} />
                        </div>
                        <h3 className="font-mono font-bold text-lg text-[#e8e6e3] leading-snug mb-2 group-hover:text-[#fbbf24] transition-colors line-clamp-2">
                          {a.title}
                        </h3>
                        <p className="text-sm text-[#8a8a94] line-clamp-2 mb-2">
                          {a.excerpt}
                        </p>
                        <span className="font-mono text-xs text-[#5a5a64]">
                          {a.authorName}
                          {a.publishedAt ? ` \u00b7 ${formatShortDate(a.publishedAt)}` : ''}
                        </span>
                      </Link>
                    </article>
                  ))}
                </div>
              )}
            </aside>
          </div>
        ) : (
          <div className="py-16 text-center max-w-2xl mx-auto">
            <h1 className="font-mono font-bold text-5xl text-[#e8e6e3] mb-4">
              The <span className="text-[#fbbf24]">Un</span>Official
            </h1>
            <p className="text-xl text-[#8a8a94] mb-8">
              NBA analytics without the spin.
            </p>
            <Link
              href="/posts"
              className="inline-flex items-center justify-center px-6 py-3 bg-[#fbbf24] text-[#0a0a0f] font-mono font-bold rounded-lg hover:bg-[#f59e0b] transition-colors"
            >
              Read the Latest
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

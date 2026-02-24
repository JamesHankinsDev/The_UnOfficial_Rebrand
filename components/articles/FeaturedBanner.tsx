import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArticleDoc } from '@/lib/firestore'
import { SeriesBadge } from './SeriesBadge'
import { ReadTimeDisplay } from '@/components/social/ReadTimeDisplay'
import { ShareButton } from '@/components/social/ShareButton'
import { TweetButton } from '@/components/social/TweetButton'
import { formatShortDate } from '@/lib/utils'

interface FeaturedBannerProps {
  articles: ArticleDoc[]
  baseUrl?: string
}

export function FeaturedBanner({ articles, baseUrl = '' }: FeaturedBannerProps) {
  if (!articles.length) return null
  const [primary, ...rest] = articles

  return (
    <section className="mb-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="font-mono text-xs tracking-widest text-[#5a5a64] uppercase">Featured</div>
        <div className="flex-1 h-px bg-[#1e1e2a]" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Primary feature */}
        <article className="lg:col-span-3 group bg-[#111118] border border-[#1e1e2a] rounded-xl overflow-hidden hover:border-[#fbbf24]/30 transition-colors">
          {primary.coverImageUrl && (
            <div className="relative aspect-video overflow-hidden">
              <Image
                src={primary.coverImageUrl}
                alt={primary.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#111118] via-transparent to-transparent" />
            </div>
          )}
          <div className="p-6">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <SeriesBadge series={primary.series} />
              <ReadTimeDisplay minutes={primary.readTimeMinutes} />
            </div>
            <Link href={`/posts/${primary.slug}`}>
              <h2 className="font-mono font-bold text-2xl text-[#e8e6e3] leading-tight mb-2 group-hover:text-[#fbbf24] transition-colors">
                {primary.title}
              </h2>
            </Link>
            <p className="text-[#8a8a94] leading-relaxed mb-4 line-clamp-2">{primary.excerpt}</p>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-mono text-[#5a5a64]">
                {primary.authorName}
                {primary.publishedAt ? ` · ${formatShortDate(primary.publishedAt)}` : ''}
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
          </div>
        </article>

        {/* Secondary features */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {rest.map(article => (
            <article
              key={article.id}
              className="group flex-1 bg-[#111118] border border-[#1e1e2a] rounded-xl p-4 hover:border-[#3a3a44] transition-colors"
            >
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <SeriesBadge series={article.series} />
                <ReadTimeDisplay minutes={article.readTimeMinutes} />
              </div>
              <Link href={`/posts/${article.slug}`}>
                <h3 className="font-mono font-bold text-[#e8e6e3] leading-snug mb-2 group-hover:text-[#fbbf24] transition-colors line-clamp-2">
                  {article.title}
                </h3>
              </Link>
              <p className="text-sm text-[#8a8a94] line-clamp-2 mb-3">{article.excerpt}</p>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-mono text-[#5a5a64]">{article.authorName}</span>
                <div className="flex gap-1.5">
                  <ShareButton url={`${baseUrl}/posts/${article.slug}`} />
                  <TweetButton
                    url={`${baseUrl}/posts/${article.slug}`}
                    title={article.title}
                    tweetPreview={article.tweetPreview}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

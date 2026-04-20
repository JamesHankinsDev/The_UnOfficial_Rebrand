import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArticleDoc } from '@/lib/firestore'
import { SeriesBadge } from './SeriesBadge'
import { formatShortDate } from '@/lib/utils'

interface RecentListProps {
  articles: ArticleDoc[]
}

export function RecentList({ articles }: RecentListProps) {
  if (articles.length === 0) {
    return (
      <div className="text-[#5a5a64] font-mono text-sm py-8 text-center">
        Nothing published yet. Don&apos;t sleep on the content calendar.
      </div>
    )
  }

  return (
    <ul className="divide-y divide-[#1e1e2a] border-y border-[#1e1e2a]">
      {articles.map((a) => (
        <li key={a.id}>
          <Link
            href={`/posts/${a.slug}`}
            className="group flex items-start gap-4 py-4 px-2 -mx-2 rounded hover:bg-[#111118] transition-colors"
          >
            <div className="relative flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-[#111118]">
              {a.coverImageUrl ? (
                <Image
                  src={a.coverImageUrl}
                  alt={a.title}
                  fill
                  sizes="96px"
                  className="object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#1e1e2a] to-[#111118]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <SeriesBadge series={a.series} />
                <span className="font-mono text-[10px] tracking-widest text-[#5a5a64] uppercase">
                  {a.readTimeMinutes} min read
                </span>
              </div>
              <h3 className="font-mono font-bold text-base sm:text-lg text-[#e8e6e3] leading-snug group-hover:text-[#fbbf24] transition-colors line-clamp-2">
                {a.title}
              </h3>
              <p className="text-sm text-[#8a8a94] line-clamp-1 mt-1 hidden sm:block">
                {a.excerpt}
              </p>
            </div>
            <div className="flex-shrink-0 text-right hidden sm:flex flex-col items-end gap-1">
              <span className="font-mono text-xs text-[#5a5a64]">
                {a.authorName}
              </span>
              {a.publishedAt && (
                <span className="font-mono text-xs text-[#5a5a64]">
                  {formatShortDate(a.publishedAt)}
                </span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

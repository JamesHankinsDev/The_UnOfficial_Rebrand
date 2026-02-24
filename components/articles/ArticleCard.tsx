import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArticleDoc } from '@/lib/firestore'
import { SeriesBadge } from './SeriesBadge'
import { ReadTimeDisplay } from '@/components/social/ReadTimeDisplay'
import { ShareButton } from '@/components/social/ShareButton'
import { TweetButton } from '@/components/social/TweetButton'
import { Badge } from '@/components/ui/Badge'
import { formatShortDate } from '@/lib/utils'

interface ArticleCardProps {
  article: ArticleDoc
  baseUrl?: string
}

export function ArticleCard({ article, baseUrl = '' }: ArticleCardProps) {
  const url = `${baseUrl}/posts/${article.slug}`
  const isUpcoming = article.status === 'scheduled'

  if (isUpcoming) {
    const scheduledDate = article.scheduledAt
      ? formatShortDate(article.scheduledAt)
      : 'Soon'
    return (
      <div className="bg-[#111118] border border-[#1e1e2a] rounded-xl p-5 opacity-70">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <SeriesBadge series={article.series} />
          <Badge variant="gray">COMING {scheduledDate.toUpperCase()}</Badge>
        </div>
        <h3 className="font-mono font-bold text-[#8a8a94] text-lg leading-snug">
          {article.title}
        </h3>
      </div>
    )
  }

  return (
    <article className="group bg-[#111118] border border-[#1e1e2a] rounded-xl overflow-hidden hover:border-[#3a3a44] transition-colors">
      {article.coverImageUrl && (
        <Link href={`/posts/${article.slug}`} className="block relative aspect-video overflow-hidden">
          <Image
            src={article.coverImageUrl}
            alt={article.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </Link>
      )}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <SeriesBadge series={article.series} />
          <ReadTimeDisplay minutes={article.readTimeMinutes} />
        </div>
        <Link href={`/posts/${article.slug}`}>
          <h3 className="font-mono font-bold text-[#e8e6e3] text-lg leading-snug mb-2 group-hover:text-[#fbbf24] transition-colors line-clamp-2">
            {article.title}
          </h3>
        </Link>
        <p className="text-sm text-[#8a8a94] leading-relaxed mb-4 line-clamp-3">
          {article.excerpt}
        </p>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs font-mono text-[#5a5a64]">
            {article.authorName}
            {article.publishedAt ? ` · ${formatShortDate(article.publishedAt)}` : ''}
          </div>
          <div className="flex items-center gap-1.5">
            <ShareButton url={url} />
            <TweetButton url={url} title={article.title} tweetPreview={article.tweetPreview} />
          </div>
        </div>
      </div>
    </article>
  )
}

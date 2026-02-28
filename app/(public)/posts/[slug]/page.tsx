import React from 'react'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import type { Metadata } from 'next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { getArticleBySlug, getPublishedArticles } from '@/lib/firestore'
import { SeriesBadge } from '@/components/articles/SeriesBadge'
import { ReadTimeDisplay } from '@/components/social/ReadTimeDisplay'
import { ShareBar } from '@/components/social/ShareBar'
import { AudioPlayer } from '@/components/social/AudioPlayer'
import { EmailSubscribe } from '@/components/social/EmailSubscribe'
import { ArticleCard } from '@/components/articles/ArticleCard'
import { formatDate } from '@/lib/utils'

export const revalidate = 60

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) return { title: 'Not Found | The UnOfficial' }

  return {
    title: `${article.title} | The UnOfficial`,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      images: [article.coverImageUrl || '/default-og.png'],
      type: 'article',
      publishedTime: article.publishedAt?.toDate().toISOString(),
      authors: [article.authorName],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.tweetPreview || article.title,
      description: article.excerpt,
      images: [article.coverImageUrl || '/default-og.png'],
    },
  }
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params
  const article = await getArticleBySlug(slug)

  if (!article || article.status !== 'published') {
    notFound()
  }

  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
  const articleUrl = `${siteUrl}/posts/${article.slug}`

  // Get related articles (same series or recent)
  let related = await getPublishedArticles(
    article.series ? { series: article.series, lim: 4 } : { lim: 4 }
  ).catch(() => [])
  related = related.filter(a => a.id !== article.id).slice(0, 3)

  return (
    <article className="bg-[#0a0a0f]">
      {/* Cover image */}
      {article.coverImageUrl && (
        <div className="relative h-64 sm:h-96 w-full overflow-hidden">
          <Image
            src={article.coverImageUrl}
            alt={article.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/40 to-transparent" />
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Article header */}
        <header className={`${article.coverImageUrl ? '-mt-20 relative' : 'pt-12'} mb-8`}>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <SeriesBadge series={article.series} />
            <ReadTimeDisplay minutes={article.readTimeMinutes} />
          </div>
          <h1 className="font-mono font-bold text-3xl sm:text-4xl text-[#e8e6e3] leading-tight mb-4">
            {article.title}
          </h1>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm font-mono text-[#5a5a64]">
              <span className="text-[#8a8a94]">{article.authorName}</span>
              {article.publishedAt && (
                <>
                  {' '}·{' '}
                  <time dateTime={article.publishedAt.toDate().toISOString()}>
                    {formatDate(article.publishedAt)}
                  </time>
                </>
              )}
            </div>
            <ShareBar url={articleUrl} title={article.title} tweetPreview={article.tweetPreview} />
          </div>
        </header>

        {/* Audio player */}
        {article.audioUrl && (
          <div className="mb-8">
            <AudioPlayer url={article.audioUrl} title={`Listen: ${article.title}`} />
          </div>
        )}

        {/* Article body */}
        <div className="prose prose-invert max-w-none mb-16">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
          >
            {article.content}
          </ReactMarkdown>
        </div>

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-12 pt-8 border-t border-[#1e1e2a]">
            <span className="text-xs font-mono text-[#5a5a64] uppercase tracking-widest">Tags:</span>
            {article.tags.map(tag => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs font-mono text-[#8a8a94] bg-[#111118] border border-[#1e1e2a] rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Share footer */}
        <div className="mb-12 p-6 bg-[#111118] border border-[#1e1e2a] rounded-xl">
          <div className="font-mono text-sm text-[#8a8a94] mb-3">If this hit different, share it.</div>
          <ShareBar url={articleUrl} title={article.title} tweetPreview={article.tweetPreview} />
        </div>

        {/* Tip CTA */}
        <div className="mb-12 p-6 bg-[#111118] border border-[#1e1e2a] rounded-xl text-center">
          <div className="font-mono text-sm text-[#8a8a94] mb-1">Like what you read?</div>
          <a
            href="https://buymeacoffee.com/theunofficialjb"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm text-[#fbbf24] hover:text-[#f59e0b] transition-colors"
          >
            ☕ Tip the UnOfficial
          </a>
        </div>

        {/* Subscribe CTA */}
        <div className="mb-16 p-8 bg-[#111118] border border-[#fbbf24]/20 rounded-2xl text-center">
          <div className="font-mono font-bold text-[#fbbf24] text-xl mb-2">Stay Locked In</div>
          <p className="text-[#8a8a94] mb-6">Get the next one straight to your inbox.</p>
          <div className="max-w-md mx-auto">
            <EmailSubscribe source="article-footer" />
          </div>
        </div>
      </div>

      {/* Related articles */}
      {related.length > 0 && (
        <div className="border-t border-[#1e1e2a]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="font-mono text-xs tracking-widest text-[#5a5a64] uppercase">
                {article.series ? 'More from this Series' : 'More Reads'}
              </div>
              <div className="flex-1 h-px bg-[#1e1e2a]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {related.map(a => (
                <ArticleCard key={a.id} article={a} baseUrl={siteUrl} />
              ))}
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

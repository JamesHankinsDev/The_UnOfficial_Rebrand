'use client'

import React, { useState, useEffect } from 'react'
import { getPublishedArticles, getUpcomingScheduled, ArticleDoc } from '@/lib/firestore'
import { ArticleCard } from '@/components/articles/ArticleCard'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const SERIES_TABS = [
  { value: '', label: 'All' },
  { value: 'value-meal', label: 'Value Meal' },
  { value: 'trajectory-twins', label: 'Trajectory Twins' },
  { value: 'picks-pops-rolls', label: 'Picks Pops & Rolls' },
]

function PostsContent() {
  const searchParams = useSearchParams()
  const seriesParam = searchParams.get('series') || ''
  const [activeSeries, setActiveSeries] = useState(seriesParam)
  const [articles, setArticles] = useState<ArticleDoc[]>([])
  const [upcoming, setUpcoming] = useState<ArticleDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    Promise.all([
      getPublishedArticles(activeSeries ? { series: activeSeries } : {}).catch(() => [] as ArticleDoc[]),
      getUpcomingScheduled().catch(() => [] as ArticleDoc[]),
    ])
      .then(([pub, sched]) => {
        setArticles(pub)
        setUpcoming(sched)
      })
      .catch(() => setError('Could not load articles. Check your connection and try again.'))
      .finally(() => setLoading(false))
  }, [activeSeries])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-10">
        <h1 className="font-mono font-bold text-4xl text-[#e8e6e3] mb-2">All Articles</h1>
        <p className="text-[#8a8a94]">Everything we&apos;ve cooked up. Sorted by latest.</p>
      </div>

      {/* Series filter tabs */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1">
        {SERIES_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveSeries(tab.value)}
            className={`flex-shrink-0 px-4 py-2 text-xs font-mono tracking-widest uppercase rounded-md border transition-colors ${
              activeSeries === tab.value
                ? 'bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/30'
                : 'border-[#1e1e2a] text-[#8a8a94] hover:text-[#e8e6e3] hover:border-[#3a3a44]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Upcoming scheduled */}
      {upcoming.length > 0 && !activeSeries && (
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="font-mono text-xs tracking-widest text-[#5a5a64] uppercase">
              Coming Soon
            </div>
            <div className="flex-1 h-px bg-[#1e1e2a]" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcoming.map(article => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      )}

      {/* Article grid */}
      {error ? (
        <div className="text-center py-24 text-brand-muted font-mono text-sm">{error}</div>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-[#111118] border border-[#1e1e2a] rounded-xl h-64 animate-pulse"
            />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-24 text-[#5a5a64] font-mono">
          Nothing published yet. Don&apos;t sleep on the content calendar.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map(article => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function PostsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-[#111118] border border-[#1e1e2a] rounded-xl h-64 animate-pulse" />
            ))}
          </div>
        </div>
      }
    >
      <PostsContent />
    </Suspense>
  )
}

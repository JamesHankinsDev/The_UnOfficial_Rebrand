'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  getPublishedArticles,
  getPublishedArticlesPaginated,
  getUpcomingScheduled,
  ArticleDoc,
} from '@/lib/firestore'
import { ArticleCard } from '@/components/articles/ArticleCard'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Fuse from 'fuse.js'

const SERIES_TABS = [
  { value: '', label: 'All' },
  { value: 'value-meal', label: 'Value Meal' },
  { value: 'trajectory-twins', label: 'Trajectory Twins' },
  { value: 'picks-pops-rolls', label: 'Picks Pops & Rolls' },
]

const PAGE_SIZE = 9

function PostsContent() {
  const searchParams = useSearchParams()
  const seriesParam = searchParams.get('series') || ''
  const tagParam = searchParams.get('tag') || ''

  const [activeSeries, setActiveSeries] = useState(seriesParam)
  const [activeTag, setActiveTag] = useState(tagParam)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Paginated browsing state
  const [articles, setArticles] = useState<ArticleDoc[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // Search state — all articles fetched once for Fuse.js
  const [allArticles, setAllArticles] = useState<ArticleDoc[] | null>(null)
  const [loadingSearch, setLoadingSearch] = useState(false)

  const [upcoming, setUpcoming] = useState<ArticleDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(null)

  const isSearching = debouncedQuery.length >= 2
  const isTagFiltering = activeTag.length > 0
  const needsAllArticles = isSearching || isTagFiltering

  // Debounce search input
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(value.trim())
    }, 300)
  }, [])

  // Load initial paginated articles + upcoming
  useEffect(() => {
    if (needsAllArticles) return
    setLoading(true)
    setError('')
    setAllArticles(null) // reset search cache when filters change
    Promise.all([
      getPublishedArticlesPaginated({
        series: activeSeries || undefined,
        pageSize: PAGE_SIZE,
      }).catch(() => ({ articles: [] as ArticleDoc[], hasMore: false })),
      getUpcomingScheduled().catch(() => [] as ArticleDoc[]),
    ])
      .then(([result, sched]) => {
        setArticles(result.articles)
        setHasMore(result.hasMore)
        setUpcoming(sched)
      })
      .catch(() => setError('Could not load articles. Check your connection and try again.'))
      .finally(() => setLoading(false))
  }, [activeSeries, needsAllArticles])

  // Load more (cursor-based)
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore || articles.length === 0) return
    setLoadingMore(true)
    try {
      const lastArticle = articles[articles.length - 1]
      const result = await getPublishedArticlesPaginated({
        series: activeSeries || undefined,
        pageSize: PAGE_SIZE,
        lastPublishedAt: lastArticle.publishedAt ?? undefined,
      })
      setArticles((prev) => [...prev, ...result.articles])
      setHasMore(result.hasMore)
    } catch {
      // silently fail — user can retry
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, articles, activeSeries])

  // Fetch all articles for search/tag filtering (once, cached until series changes)
  useEffect(() => {
    if (!needsAllArticles) return
    if (allArticles !== null) return // already cached
    setLoadingSearch(true)
    getPublishedArticles(activeSeries ? { series: activeSeries } : {})
      .then((docs) => setAllArticles(docs))
      .catch(() => setError('Failed to load articles. Please try again.'))
      .finally(() => setLoadingSearch(false))
  }, [needsAllArticles, activeSeries, allArticles])

  // Reset search cache when series changes
  useEffect(() => {
    setAllArticles(null)
  }, [activeSeries])

  // Prepare searchable articles with HTML-stripped content
  const searchableArticles = useMemo(() => {
    if (!allArticles) return null
    return allArticles.map((a) => ({
      ...a,
      searchContent: a.content
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    }))
  }, [allArticles])

  // Fuse.js search
  const searchResults = useMemo(() => {
    if (!isSearching || !searchableArticles) return null
    const fuse = new Fuse(searchableArticles, {
      keys: [
        { name: 'title', weight: 0.35 },
        { name: 'searchContent', weight: 0.3 },
        { name: 'excerpt', weight: 0.15 },
        { name: 'tags', weight: 0.1 },
        { name: 'authorName', weight: 0.1 },
      ],
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 2,
    })
    return fuse.search(debouncedQuery).map((r) => r.item)
  }, [isSearching, searchableArticles, debouncedQuery])

  // Tag-filtered articles
  const tagFiltered = useMemo(() => {
    if (!isTagFiltering || !allArticles) return null
    return allArticles.filter((a) =>
      a.tags.some((t) => t.toLowerCase() === activeTag.toLowerCase()),
    )
  }, [isTagFiltering, allArticles, activeTag])

  const displayedArticles = isSearching
    ? (searchResults ?? [])
    : isTagFiltering
      ? (tagFiltered ?? [])
      : articles
  const showLoading = loading || (needsAllArticles && loadingSearch)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-10">
        <h1 className="font-mono font-bold text-4xl text-[#e8e6e3] mb-2">All Articles</h1>
        <p className="text-[#8a8a94]">Everything we&apos;ve cooked up. Sorted by latest.</p>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
          <svg
            className="w-4 h-4 text-[#5a5a64]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search articles by title, topic, or author..."
          className="w-full bg-[#111118] border border-[#1e1e2a] rounded-lg pl-11 pr-4 py-3 text-sm text-[#e8e6e3] placeholder-[#5a5a64] font-mono focus:outline-none focus:border-[#fbbf24]/50 focus:ring-1 focus:ring-[#fbbf24]/20 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('')
              setDebouncedQuery('')
            }}
            className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#5a5a64] hover:text-[#e8e6e3] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Series filter tabs */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1">
        {SERIES_TABS.map((tab) => (
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

      {/* Active tag filter */}
      {isTagFiltering && (
        <div className="flex items-center gap-2 mb-6">
          <span className="text-sm font-mono text-[#5a5a64]">Filtered by tag:</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono text-[#fbbf24] bg-[#fbbf24]/10 border border-[#fbbf24]/30 rounded-md">
            {activeTag}
            <button
              onClick={() => setActiveTag('')}
              className="text-[#fbbf24]/60 hover:text-[#fbbf24] transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
          {!showLoading && (
            <span className="text-sm font-mono text-[#5a5a64]">
              ({displayedArticles.length} article{displayedArticles.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>
      )}

      {/* Result count when searching */}
      {isSearching && !showLoading && (
        <div className="mb-6 text-sm font-mono text-[#5a5a64]">
          {displayedArticles.length} result{displayedArticles.length !== 1 ? 's' : ''} for &ldquo;{debouncedQuery}&rdquo;
          {activeSeries && (
            <span>
              {' '}in{' '}
              <span className="text-[#fbbf24]">
                {SERIES_TABS.find((t) => t.value === activeSeries)?.label}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Upcoming scheduled */}
      {upcoming.length > 0 && !activeSeries && !isSearching && !isTagFiltering && (
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="font-mono text-xs tracking-widest text-[#5a5a64] uppercase">
              Coming Soon
            </div>
            <div className="flex-1 h-px bg-[#1e1e2a]" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcoming.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      )}

      {/* Article grid */}
      {error ? (
        <div className="text-center py-24 text-brand-muted font-mono text-sm">{error}</div>
      ) : showLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-[#111118] border border-[#1e1e2a] rounded-xl h-64 animate-pulse"
            />
          ))}
        </div>
      ) : displayedArticles.length === 0 ? (
        <div className="text-center py-24 text-[#5a5a64] font-mono">
          {isSearching
            ? 'No articles match your search. Try different keywords.'
            : isTagFiltering
              ? `No articles tagged "${activeTag}".`
              : "Nothing published yet. Don\u2019t sleep on the content calendar."}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedArticles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>

          {/* Load More button — only in paginated (non-search) mode */}
          {!isSearching && !isTagFiltering && hasMore && (
            <div className="flex justify-center mt-10">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-6 py-3 text-sm font-mono tracking-widest uppercase border border-[#1e1e2a] rounded-lg text-[#8a8a94] hover:text-[#fbbf24] hover:border-[#fbbf24]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
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

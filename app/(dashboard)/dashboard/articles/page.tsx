'use client'

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  getArticlesByAuthor,
  deleteArticle,
  toggleFeatured,
  ArticleDoc,
} from '@/lib/firestore'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SeriesBadge } from '@/components/articles/SeriesBadge'
import { formatShortDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const statusColors: Record<string, 'green' | 'gray' | 'blue'> = {
  published: 'green',
  draft: 'gray',
  scheduled: 'blue',
}

type StatusFilter = 'all' | 'draft' | 'scheduled' | 'published'

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
]

function MyArticlesContent() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const initialStatus = (searchParams.get('status') as StatusFilter) || 'all'

  const [articles, setArticles] = useState<ArticleDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    STATUS_TABS.some((t) => t.value === initialStatus) ? initialStatus : 'all',
  )
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    if (!user) return
    getArticlesByAuthor(user.uid)
      .then(setArticles)
      .catch(() => setError('Could not load articles. Try refreshing.'))
      .finally(() => setLoading(false))
  }, [user])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebouncedSearch(value.trim().toLowerCase()), 200)
  }

  const filtered = useMemo(() => {
    let list = articles
    if (statusFilter !== 'all') {
      list = list.filter((a) => a.status === statusFilter)
    }
    if (debouncedSearch) {
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(debouncedSearch) ||
          a.tags.some((t) => t.toLowerCase().includes(debouncedSearch)),
      )
    }
    return list
  }, [articles, statusFilter, debouncedSearch])

  // Clear selections that no longer match the current filter
  useEffect(() => {
    setSelected((prev) => {
      const visibleIds = new Set(filtered.map((a) => a.id))
      const next = new Set<string>()
      for (const id of prev) if (visibleIds.has(id)) next.add(id)
      return next
    })
  }, [filtered])

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((a) => selected.has(a.id))
  const someVisibleSelected =
    filtered.some((a) => selected.has(a.id)) && !allVisibleSelected

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((a) => a.id)))
    }
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this article? This cannot be undone.')) return
    try {
      await deleteArticle(id)
      setArticles((prev) => prev.filter((a) => a.id !== id))
      toast.success('Article deleted.')
    } catch {
      toast.error('Could not delete article.')
    }
  }

  const handleToggleFeatured = async (id: string, current: boolean) => {
    try {
      await toggleFeatured(id, !current)
      setArticles((prev) =>
        prev.map((a) => (a.id === id ? { ...a, featured: !current } : a)),
      )
      toast.success(current ? 'Removed from featured.' : 'Added to featured.')
    } catch {
      toast.error('Could not update featured status.')
    }
  }

  const handleBulkDelete = async () => {
    if (selected.size === 0) return
    if (
      !confirm(
        `Delete ${selected.size} article${selected.size === 1 ? '' : 's'}? This cannot be undone.`,
      )
    )
      return
    setBulkBusy(true)
    const ids = Array.from(selected)
    const results = await Promise.allSettled(ids.map((id) => deleteArticle(id)))
    const okIds = new Set<string>()
    let failures = 0
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') okIds.add(ids[i])
      else failures++
    })
    setArticles((prev) => prev.filter((a) => !okIds.has(a.id)))
    setSelected(new Set())
    setBulkBusy(false)
    if (failures === 0) {
      toast.success(`Deleted ${okIds.size} article${okIds.size === 1 ? '' : 's'}.`)
    } else {
      toast.error(`${failures} could not be deleted.`)
    }
  }

  const handleBulkFeature = async (feature: boolean) => {
    if (selected.size === 0) return
    setBulkBusy(true)
    const ids = Array.from(selected)
    const results = await Promise.allSettled(
      ids.map((id) => toggleFeatured(id, feature)),
    )
    const okIds = new Set<string>()
    let failures = 0
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') okIds.add(ids[i])
      else failures++
    })
    setArticles((prev) =>
      prev.map((a) => (okIds.has(a.id) ? { ...a, featured: feature } : a)),
    )
    setSelected(new Set())
    setBulkBusy(false)
    if (failures === 0) {
      toast.success(
        feature
          ? `Featured ${okIds.size} article${okIds.size === 1 ? '' : 's'}.`
          : `Removed ${okIds.size} from featured.`,
      )
    } else {
      toast.error(`${failures} could not be updated.`)
    }
  }

  const counts = useMemo(() => {
    return {
      all: articles.length,
      draft: articles.filter((a) => a.status === 'draft').length,
      scheduled: articles.filter((a) => a.status === 'scheduled').length,
      published: articles.filter((a) => a.status === 'published').length,
    }
  }, [articles])

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-mono font-bold text-2xl text-[#e8e6e3] mb-1">
            My Articles
          </h1>
          <p className="text-sm text-[#5a5a64] font-mono">
            {articles.length} total
          </p>
        </div>
        <Link href="/dashboard/articles/new">
          <Button variant="primary">+ New Article</Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
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
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by title or tag..."
            className="w-full bg-[#111118] border border-[#1e1e2a] rounded-lg pl-9 pr-3 py-2 text-sm text-[#e8e6e3] placeholder-[#5a5a64] font-mono focus:outline-none focus:border-[#fbbf24]/50 focus:ring-1 focus:ring-[#fbbf24]/20 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`flex-shrink-0 px-3 py-2 text-xs font-mono tracking-widest uppercase rounded-md border transition-colors ${
                statusFilter === tab.value
                  ? 'bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/30'
                  : 'border-[#1e1e2a] text-[#8a8a94] hover:text-[#e8e6e3] hover:border-[#3a3a44]'
              }`}
            >
              {tab.label}{' '}
              <span className="text-[#5a5a64] ml-1">{counts[tab.value]}</span>
            </button>
          ))}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 bg-[#fbbf24]/10 border border-[#fbbf24]/30 rounded-lg px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
          <span className="font-mono text-sm text-[#fbbf24]">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleBulkFeature(true)}
              disabled={bulkBusy}
            >
              Feature
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleBulkFeature(false)}
              disabled={bulkBusy}
            >
              Unfeature
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleBulkDelete}
              disabled={bulkBusy}
            >
              Delete
            </Button>
            <button
              onClick={() => setSelected(new Set())}
              disabled={bulkBusy}
              className="font-mono text-xs text-[#5a5a64] hover:text-[#e8e6e3] px-2"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {error ? (
        <div className="text-center py-16 bg-[#111118] border border-[#1e1e2a] rounded-xl">
          <div className="font-mono text-red-400 text-sm">{error}</div>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 bg-[#111118] border border-[#1e1e2a] rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-[#111118] border border-[#1e1e2a] rounded-xl">
          <div className="font-mono text-[#5a5a64] text-sm mb-2">
            {articles.length === 0
              ? "Nothing published yet. Don't sleep on the content calendar."
              : 'No articles match your filters.'}
          </div>
          {articles.length === 0 && (
            <Link href="/dashboard/articles/new">
              <Button variant="secondary" size="sm" className="mt-4">
                Write Something
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-[#111118] border border-[#1e1e2a] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e1e2a]">
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someVisibleSelected
                    }}
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                    className="accent-[#fbbf24] cursor-pointer"
                  />
                </th>
                <th className="text-left px-3 sm:px-5 py-3 text-xs font-mono text-[#5a5a64] uppercase tracking-widest">
                  Title
                </th>
                <th className="text-left px-3 sm:px-5 py-3 text-xs font-mono text-[#5a5a64] uppercase tracking-widest hidden sm:table-cell">
                  Series
                </th>
                <th className="text-left px-3 sm:px-5 py-3 text-xs font-mono text-[#5a5a64] uppercase tracking-widest">
                  Status
                </th>
                <th className="text-left px-3 sm:px-5 py-3 text-xs font-mono text-[#5a5a64] uppercase tracking-widest hidden md:table-cell">
                  Date
                </th>
                <th className="px-3 sm:px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((article) => (
                <tr
                  key={article.id}
                  className="border-b border-[#1e1e2a] last:border-0 hover:bg-[#1e1e2a]/30 transition-colors"
                >
                  <td className="px-3 py-4">
                    <input
                      type="checkbox"
                      checked={selected.has(article.id)}
                      onChange={() => toggleOne(article.id)}
                      aria-label={`Select ${article.title}`}
                      className="accent-[#fbbf24] cursor-pointer"
                    />
                  </td>
                  <td className="px-3 sm:px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-[#e8e6e3] line-clamp-1">
                        {article.title || 'Untitled'}
                      </span>
                      {article.featured && (
                        <span
                          className="text-[#fbbf24] text-xs"
                          title="Featured"
                        >
                          ★
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#5a5a64] font-mono mt-0.5 truncate">
                      {article.readTimeMinutes} min
                      {article.tags.length > 0
                        ? ` · ${article.tags.slice(0, 2).join(', ')}`
                        : ''}
                    </div>
                  </td>
                  <td className="px-3 sm:px-5 py-4 hidden sm:table-cell">
                    <SeriesBadge series={article.series} />
                  </td>
                  <td className="px-3 sm:px-5 py-4">
                    <Badge variant={statusColors[article.status] || 'gray'}>
                      {article.status}
                    </Badge>
                  </td>
                  <td className="px-3 sm:px-5 py-4 hidden md:table-cell">
                    <span className="text-xs font-mono text-[#5a5a64]">
                      {article.publishedAt
                        ? formatShortDate(article.publishedAt)
                        : formatShortDate(article.createdAt)}
                    </span>
                  </td>
                  <td className="px-3 sm:px-5 py-4">
                    <div className="flex items-center gap-2 sm:gap-3 justify-end whitespace-nowrap">
                      <button
                        onClick={() =>
                          handleToggleFeatured(article.id, article.featured)
                        }
                        className={`text-xs font-mono transition-colors ${
                          article.featured
                            ? 'text-[#fbbf24]'
                            : 'text-[#5a5a64] hover:text-[#fbbf24]'
                        }`}
                        title={
                          article.featured
                            ? 'Remove from featured'
                            : 'Feature this article'
                        }
                      >
                        {article.featured ? '★' : '☆'}
                      </button>
                      {article.status === 'published' && (
                        <Link
                          href={`/posts/${article.slug}`}
                          target="_blank"
                          className="hidden sm:inline text-xs font-mono text-[#5a5a64] hover:text-[#e8e6e3] transition-colors"
                        >
                          View
                        </Link>
                      )}
                      <Link
                        href={`/dashboard/articles/${article.id}/edit`}
                        className="text-xs font-mono text-[#8a8a94] hover:text-[#fbbf24] transition-colors"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(article.id)}
                        className="hidden sm:inline text-xs font-mono text-[#5a5a64] hover:text-red-400 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function MyArticlesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 sm:p-8">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 bg-[#111118] border border-[#1e1e2a] rounded-lg animate-pulse"
              />
            ))}
          </div>
        </div>
      }
    >
      <MyArticlesContent />
    </Suspense>
  )
}

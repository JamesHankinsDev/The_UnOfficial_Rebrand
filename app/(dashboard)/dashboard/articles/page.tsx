'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { getArticlesByAuthor, deleteArticle, toggleFeatured, ArticleDoc } from '@/lib/firestore'
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

export default function MyArticlesPage() {
  const { user } = useAuth()
  const [articles, setArticles] = useState<ArticleDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    getArticlesByAuthor(user.uid)
      .then(setArticles)
      .catch(() => setError('Could not load articles. Try refreshing.'))
      .finally(() => setLoading(false))
  }, [user])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this article? This cannot be undone.')) return
    try {
      await deleteArticle(id)
      setArticles(prev => prev.filter(a => a.id !== id))
      toast.success('Article deleted.')
    } catch {
      toast.error('Could not delete article.')
    }
  }

  const handleToggleFeatured = async (id: string, current: boolean) => {
    try {
      await toggleFeatured(id, !current)
      setArticles(prev => prev.map(a => a.id === id ? { ...a, featured: !current } : a))
      toast.success(current ? 'Removed from featured.' : 'Added to featured.')
    } catch {
      toast.error('Could not update featured status.')
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-mono font-bold text-2xl text-[#e8e6e3] mb-1">
            What are we cooking today?
          </h1>
          <p className="text-sm text-[#5a5a64] font-mono">{articles.length} article{articles.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/dashboard/articles/new">
          <Button variant="primary">+ New Article</Button>
        </Link>
      </div>

      {error ? (
        <div className="text-center py-16 bg-brand-dark border border-brand-border rounded-xl">
          <div className="font-mono text-red-400 text-sm">{error}</div>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-[#111118] border border-[#1e1e2a] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16 bg-[#111118] border border-[#1e1e2a] rounded-xl">
          <div className="font-mono text-[#5a5a64] text-sm mb-2">
            Nothing published yet. Don&apos;t sleep on the content calendar.
          </div>
          <Link href="/dashboard/articles/new">
            <Button variant="secondary" size="sm" className="mt-4">
              Write Something
            </Button>
          </Link>
        </div>
      ) : (
        <div className="bg-[#111118] border border-[#1e1e2a] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e1e2a]">
                <th className="text-left px-5 py-3 text-xs font-mono text-[#5a5a64] uppercase tracking-widest">Title</th>
                <th className="text-left px-5 py-3 text-xs font-mono text-[#5a5a64] uppercase tracking-widest hidden sm:table-cell">Series</th>
                <th className="text-left px-5 py-3 text-xs font-mono text-[#5a5a64] uppercase tracking-widest">Status</th>
                <th className="text-left px-5 py-3 text-xs font-mono text-[#5a5a64] uppercase tracking-widest hidden md:table-cell">Date</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {articles.map(article => (
                <tr key={article.id} className="border-b border-[#1e1e2a] last:border-0 hover:bg-[#1e1e2a]/30 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-[#e8e6e3] line-clamp-1">
                        {article.title}
                      </span>
                      {article.featured && (
                        <span className="text-[#fbbf24] text-xs" title="Featured">★</span>
                      )}
                    </div>
                    <div className="text-xs text-[#5a5a64] font-mono mt-0.5">
                      {article.readTimeMinutes} min · {article.tags.slice(0, 2).join(', ')}
                    </div>
                  </td>
                  <td className="px-5 py-4 hidden sm:table-cell">
                    <SeriesBadge series={article.series} />
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={statusColors[article.status] || 'gray'}>
                      {article.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    <span className="text-xs font-mono text-[#5a5a64]">
                      {article.publishedAt
                        ? formatShortDate(article.publishedAt)
                        : formatShortDate(article.createdAt)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => handleToggleFeatured(article.id, article.featured)}
                        className={`text-xs font-mono transition-colors ${
                          article.featured ? 'text-[#fbbf24]' : 'text-[#5a5a64] hover:text-[#fbbf24]'
                        }`}
                        title={article.featured ? 'Remove from featured' : 'Feature this article'}
                      >
                        {article.featured ? '★' : '☆'}
                      </button>
                      {article.status === 'published' && (
                        <Link
                          href={`/posts/${article.slug}`}
                          target="_blank"
                          className="text-xs font-mono text-[#5a5a64] hover:text-[#e8e6e3] transition-colors"
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
                        className="text-xs font-mono text-[#5a5a64] hover:text-red-400 transition-colors"
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

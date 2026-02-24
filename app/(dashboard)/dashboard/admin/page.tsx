'use client'

import React, { useState, useEffect } from 'react'
import {
  getAllUsers,
  getAllArticlesAdmin,
  getAllInvites,
  getAllSubscribers,
  createInvite,
  updateUserRole,
  toggleFeatured,
  deleteArticle,
  UserDoc,
  ArticleDoc,
  InviteDoc,
  SubscriberDoc,
} from '@/lib/firestore'
import { useAdmin } from '@/hooks/useAdmin'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SeriesBadge } from '@/components/articles/SeriesBadge'
import { formatShortDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://the-un-official.com'

type Tab = 'invites' | 'writers' | 'articles' | 'subscribers'

export default function AdminPage() {
  const { isAdmin, loading } = useAdmin()
  const { user } = useAuth()
  const router = useRouter()

  const [tab, setTab] = useState<Tab>('invites')
  const [users, setUsers] = useState<UserDoc[]>([])
  const [articles, setArticles] = useState<ArticleDoc[]>([])
  const [invites, setInvites] = useState<InviteDoc[]>([])
  const [subscribers, setSubscribers] = useState<SubscriberDoc[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!loading && !isAdmin) router.push('/dashboard')
  }, [isAdmin, loading, router])

  useEffect(() => {
    if (!isAdmin) return
    setDataLoading(true)
    Promise.all([
      getAllUsers(),
      getAllArticlesAdmin(),
      getAllInvites(),
      getAllSubscribers(),
    ]).then(([u, a, i, s]) => {
      setUsers(u)
      setArticles(a)
      setInvites(i)
      setSubscribers(s)
      setDataLoading(false)
    })
  }, [isAdmin])

  const handleCreateInvite = async () => {
    if (!user) return
    try {
      const invite = await createInvite(user.uid)
      setInvites(prev => [invite, ...prev])
      const url = `${SITE_URL}/join/${invite.id}`
      await navigator.clipboard.writeText(url)
      toast.success('Invite created & copied to clipboard.')
    } catch {
      toast.error('Failed to create invite.')
    }
  }

  const handleCopyInvite = async (id: string) => {
    const url = `${SITE_URL}/join/${id}`
    await navigator.clipboard.writeText(url)
    toast.success('Invite link copied.')
  }

  const handleRevokeWriter = async (uid: string) => {
    if (!confirm('Revoke this writer\'s access?')) return
    try {
      await updateUserRole(uid, 'revoked')
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: 'revoked' } : u))
      toast.success('Access revoked.')
    } catch {
      toast.error('Failed to revoke access.')
    }
  }

  const handleToggleFeatured = async (id: string, current: boolean) => {
    try {
      await toggleFeatured(id, !current)
      setArticles(prev => prev.map(a => a.id === id ? { ...a, featured: !current } : a))
    } catch {
      toast.error('Update failed.')
    }
  }

  const handleDeleteArticle = async (id: string) => {
    if (!confirm('Delete this article?')) return
    try {
      await deleteArticle(id)
      setArticles(prev => prev.filter(a => a.id !== id))
      toast.success('Article deleted.')
    } catch {
      toast.error('Delete failed.')
    }
  }

  const exportSubscribersCSV = () => {
    const rows = [
      ['Email', 'Subscribed At', 'Source'],
      ...subscribers.map(s => [
        s.email,
        formatShortDate(s.subscribedAt),
        s.source,
      ]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'subscribers.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const getInviteStatus = (invite: InviteDoc): { label: string; variant: 'green' | 'red' | 'gray' } => {
    if (invite.used) return { label: 'Used', variant: 'green' }
    if (invite.expiresAt.toMillis() < Date.now()) return { label: 'Expired', variant: 'red' }
    return { label: 'Pending', variant: 'gray' }
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'invites', label: 'Invites', count: invites.length },
    { id: 'writers', label: 'Writers', count: users.length },
    { id: 'articles', label: 'All Articles', count: articles.length },
    { id: 'subscribers', label: 'Subscribers', count: subscribers.length },
  ]

  if (loading || !isAdmin) return null

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-mono font-bold text-2xl text-[#e8e6e3] mb-1">Admin Panel</h1>
        <p className="text-sm text-[#5a5a64] font-mono">Don&apos;t break anything.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-[#1e1e2a] pb-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-mono border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-[#fbbf24] text-[#fbbf24]'
                : 'border-transparent text-[#8a8a94] hover:text-[#e8e6e3]'
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs text-[#5a5a64]">{t.count}</span>
          </button>
        ))}
      </div>

      {dataLoading ? (
        <div className="font-mono text-[#5a5a64] animate-pulse py-12 text-center">Loading…</div>
      ) : (
        <>
          {/* Invites tab */}
          {tab === 'invites' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-[#8a8a94]">
                  Generate invite links for new writers. Links expire after 48 hours.
                </p>
                <Button onClick={handleCreateInvite} variant="primary" size="sm">
                  Generate Invite
                </Button>
              </div>
              <div className="bg-[#111118] border border-[#1e1e2a] rounded-xl overflow-hidden">
                {invites.length === 0 ? (
                  <div className="p-8 text-center font-mono text-[#5a5a64] text-sm">
                    No invites generated yet.
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#1e1e2a]">
                        <th className="text-left px-5 py-3 text-xs font-mono text-[#5a5a64] uppercase tracking-widest">Invite ID</th>
                        <th className="text-left px-5 py-3 text-xs font-mono text-[#5a5a64] uppercase tracking-widest">Created</th>
                        <th className="text-left px-5 py-3 text-xs font-mono text-[#5a5a64] uppercase tracking-widest">Expires</th>
                        <th className="text-left px-5 py-3 text-xs font-mono text-[#5a5a64] uppercase tracking-widest">Status</th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {invites.map(invite => {
                        const { label, variant } = getInviteStatus(invite)
                        return (
                          <tr key={invite.id} className="border-b border-[#1e1e2a] last:border-0">
                            <td className="px-5 py-3">
                              <span className="font-mono text-xs text-[#8a8a94]">{invite.id.slice(0, 8)}…</span>
                            </td>
                            <td className="px-5 py-3 text-xs font-mono text-[#5a5a64]">
                              {formatShortDate(invite.createdAt)}
                            </td>
                            <td className="px-5 py-3 text-xs font-mono text-[#5a5a64]">
                              {formatShortDate(invite.expiresAt)}
                            </td>
                            <td className="px-5 py-3">
                              <Badge variant={variant}>{label}</Badge>
                            </td>
                            <td className="px-5 py-3">
                              {!invite.used && invite.expiresAt.toMillis() > Date.now() && (
                                <button
                                  onClick={() => handleCopyInvite(invite.id)}
                                  className="text-xs font-mono text-[#8a8a94] hover:text-[#fbbf24] transition-colors"
                                >
                                  Copy Link
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Writers tab */}
          {tab === 'writers' && (
            <div className="bg-[#111118] border border-[#1e1e2a] rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1e1e2a]">
                    <th className="text-left px-5 py-3 text-xs font-mono text-[#5a5a64] uppercase tracking-widest">Name</th>
                    <th className="text-left px-5 py-3 text-xs font-mono text-[#5a5a64] uppercase tracking-widest">Email</th>
                    <th className="text-left px-5 py-3 text-xs font-mono text-[#5a5a64] uppercase tracking-widest">Role</th>
                    <th className="text-left px-5 py-3 text-xs font-mono text-[#5a5a64] uppercase tracking-widest">Joined</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.uid} className="border-b border-[#1e1e2a] last:border-0">
                      <td className="px-5 py-3 font-mono text-sm text-[#e8e6e3]">{u.displayName}</td>
                      <td className="px-5 py-3 text-xs font-mono text-[#8a8a94]">{u.email}</td>
                      <td className="px-5 py-3">
                        <Badge variant={u.role === 'admin' ? 'gold' : u.role === 'revoked' ? 'red' : 'gray'}>
                          {u.role}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-xs font-mono text-[#5a5a64]">
                        {formatShortDate(u.createdAt)}
                      </td>
                      <td className="px-5 py-3">
                        {u.role !== 'admin' && u.role !== 'revoked' && (
                          <button
                            onClick={() => handleRevokeWriter(u.uid)}
                            className="text-xs font-mono text-[#5a5a64] hover:text-red-400 transition-colors"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* All articles tab */}
          {tab === 'articles' && (
            <div className="bg-[#111118] border border-[#1e1e2a] rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1e1e2a]">
                    <th className="text-left px-5 py-3 text-xs font-mono text-[#5a5a64] uppercase tracking-widest">Title</th>
                    <th className="text-left px-5 py-3 text-xs font-mono text-[#5a5a64] uppercase tracking-widest hidden sm:table-cell">Author</th>
                    <th className="text-left px-5 py-3 text-xs font-mono text-[#5a5a64] uppercase tracking-widest hidden sm:table-cell">Series</th>
                    <th className="text-left px-5 py-3 text-xs font-mono text-[#5a5a64] uppercase tracking-widest">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {articles.map(a => (
                    <tr key={a.id} className="border-b border-[#1e1e2a] last:border-0 hover:bg-[#1e1e2a]/30">
                      <td className="px-5 py-3">
                        <div className="font-mono text-sm text-[#e8e6e3] line-clamp-1 flex items-center gap-1.5">
                          {a.featured && <span className="text-[#fbbf24]">★</span>}
                          {a.title}
                        </div>
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell text-xs font-mono text-[#8a8a94]">{a.authorName}</td>
                      <td className="px-5 py-3 hidden sm:table-cell"><SeriesBadge series={a.series} /></td>
                      <td className="px-5 py-3">
                        <Badge variant={a.status === 'published' ? 'green' : a.status === 'scheduled' ? 'blue' : 'gray'}>
                          {a.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3 justify-end">
                          <button
                            onClick={() => handleToggleFeatured(a.id, a.featured)}
                            className={`text-xs font-mono transition-colors ${a.featured ? 'text-[#fbbf24]' : 'text-[#5a5a64] hover:text-[#fbbf24]'}`}
                          >
                            {a.featured ? '★ Unfeature' : '☆ Feature'}
                          </button>
                          <button
                            onClick={() => handleDeleteArticle(a.id)}
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

          {/* Subscribers tab */}
          {tab === 'subscribers' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-[#8a8a94]">
                  {subscribers.length} subscriber{subscribers.length !== 1 ? 's' : ''} total.
                </p>
                <Button onClick={exportSubscribersCSV} variant="secondary" size="sm">
                  Export CSV
                </Button>
              </div>
              <div className="bg-[#111118] border border-[#1e1e2a] rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1e1e2a]">
                      <th className="text-left px-5 py-3 text-xs font-mono text-[#5a5a64] uppercase tracking-widest">Email</th>
                      <th className="text-left px-5 py-3 text-xs font-mono text-[#5a5a64] uppercase tracking-widest">Date</th>
                      <th className="text-left px-5 py-3 text-xs font-mono text-[#5a5a64] uppercase tracking-widest">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers.map(s => (
                      <tr key={s.id} className="border-b border-[#1e1e2a] last:border-0">
                        <td className="px-5 py-3 font-mono text-sm text-[#e8e6e3]">{s.email}</td>
                        <td className="px-5 py-3 text-xs font-mono text-[#5a5a64]">{formatShortDate(s.subscribedAt)}</td>
                        <td className="px-5 py-3 text-xs font-mono text-[#8a8a94]">{s.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

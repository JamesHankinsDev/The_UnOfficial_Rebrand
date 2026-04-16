'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { formatDistanceToNow } from 'date-fns'

interface Comment {
  id: string
  articleId: string
  displayName: string
  content: string
  createdAt: number
  reactions: Record<string, number>
}

const EMOJIS = ['🔥', '💯', '🏀', '🧊', '💀', '👀'] as const
const STORAGE_NAME_KEY = 'unofficial-comment-name'
const STORAGE_REACTIONS_KEY = 'unofficial-reactions'
const MAX_CONTENT = 2000
const COOLDOWN_MS = 30_000

function getMyReactions(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_REACTIONS_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveMyReactions(data: Record<string, string[]>) {
  try {
    localStorage.setItem(STORAGE_REACTIONS_KEY, JSON.stringify(data))
  } catch { /* noop */ }
}

export function CommentSection({ articleId }: { articleId: string }) {
  const { user, role } = useAuth()
  const isAdmin = role === 'admin' || role === 'owner'

  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [myReactions, setMyReactions] = useState<Record<string, string[]>>({})

  const onCooldown = now < cooldownUntil

  // Restore saved name and reactions
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_NAME_KEY)
      if (saved) setDisplayName(saved)
    } catch { /* noop */ }
    setMyReactions(getMyReactions())
  }, [])

  // Tick for cooldown countdown
  useEffect(() => {
    if (!onCooldown) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [onCooldown])

  // Fetch comments
  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?articleId=${encodeURIComponent(articleId)}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setComments(data.comments)
    } catch {
      // silently fail — empty state is fine
    } finally {
      setLoading(false)
    }
  }, [articleId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting || onCooldown) return

    const trimmedName = displayName.trim()
    const trimmedContent = content.trim()

    if (!trimmedName) { setError('Please enter your name.'); return }
    if (!trimmedContent) { setError('Please enter a comment.'); return }
    if (trimmedContent.length > MAX_CONTENT) { setError(`Comment must be ${MAX_CONTENT} characters or less.`); return }

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, displayName: trimmedName, content: trimmedContent }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to post comment.')
        return
      }

      // Save name for next time
      try { localStorage.setItem(STORAGE_NAME_KEY, trimmedName) } catch { /* noop */ }

      setComments((prev) => [...prev, data.comment])
      setContent('')
      setCooldownUntil(Date.now() + COOLDOWN_MS)
      setNow(Date.now())
    } catch {
      setError('Failed to post comment. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    if (!user) return
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/comments?id=${encodeURIComponent(commentId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId))
      }
    } catch {
      // silently fail
    }
  }

  const handleReaction = async (commentId: string, emoji: string) => {
    const current = myReactions[commentId] || []
    const hasReacted = current.includes(emoji)
    const action = hasReacted ? 'remove' : 'add'

    // Optimistic update
    const updated = { ...myReactions }
    if (hasReacted) {
      updated[commentId] = current.filter((e) => e !== emoji)
    } else {
      updated[commentId] = [...current, emoji]
    }
    setMyReactions(updated)
    saveMyReactions(updated)

    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c
        const reactions = { ...c.reactions }
        const count = (reactions[emoji] || 0) + (hasReacted ? -1 : 1)
        if (count <= 0) {
          delete reactions[emoji]
        } else {
          reactions[emoji] = count
        }
        return { ...c, reactions }
      }),
    )

    // Fire and forget
    fetch('/api/comments/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId, emoji, action }),
    })
  }

  const cooldownSeconds = Math.ceil((cooldownUntil - now) / 1000)

  return (
    <div className="border-t border-[#1e1e2a] pt-10 mb-16">
      <h2 className="font-mono font-bold text-xl text-[#e8e6e3] mb-6">Comments</h2>

      {/* Comment list */}
      {loading ? (
        <div className="space-y-4 mb-8">
          {[1, 2].map((i) => (
            <div key={i} className="bg-[#111118] border border-[#1e1e2a] rounded-lg p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-[#5a5a64] font-mono mb-8">No comments yet. Be the first.</p>
      ) : (
        <div className="space-y-4 mb-8">
          {comments.map((comment) => {
            const mine = myReactions[comment.id] || []
            return (
              <div key={comment.id} className="bg-[#111118] border border-[#1e1e2a] rounded-lg p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 text-sm font-mono">
                    <span className="text-[#e8e6e3] font-bold">{comment.displayName}</span>
                    <span className="text-[#5a5a64]">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="text-xs font-mono text-[#5a5a64] hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="text-sm text-[#8a8a94] leading-relaxed whitespace-pre-wrap break-words mb-3">
                  {comment.content}
                </p>

                {/* Emoji reactions */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {EMOJIS.map((emoji) => {
                    const count = comment.reactions[emoji] || 0
                    const active = mine.includes(emoji)
                    return (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(comment.id, emoji)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono transition-colors ${
                          active
                            ? 'bg-[#fbbf24]/15 border border-[#fbbf24]/30 text-[#fbbf24]'
                            : 'bg-[#0a0a0f] border border-[#1e1e2a] text-[#5a5a64] hover:border-[#3a3a44] hover:text-[#8a8a94]'
                        }`}
                      >
                        <span>{emoji}</span>
                        {count > 0 && <span>{count}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Comment form */}
      <form onSubmit={handleSubmit} className="bg-[#111118] border border-[#1e1e2a] rounded-xl p-5">
        <div className="font-mono text-sm text-[#8a8a94] mb-4">Leave a comment</div>

        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name"
          maxLength={50}
          className="w-full bg-[#0a0a0f] border border-[#1e1e2a] rounded-lg px-4 py-2.5 text-sm text-[#e8e6e3] placeholder-[#5a5a64] font-mono mb-3 focus:outline-none focus:border-[#fbbf24]/50 transition-colors"
        />

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          rows={4}
          maxLength={MAX_CONTENT}
          className="w-full bg-[#0a0a0f] border border-[#1e1e2a] rounded-lg px-4 py-2.5 text-sm text-[#e8e6e3] placeholder-[#5a5a64] font-mono resize-y mb-1 focus:outline-none focus:border-[#fbbf24]/50 transition-colors"
        />

        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono text-[#5a5a64]">
            {content.length}/{MAX_CONTENT}
          </span>
        </div>

        {error && (
          <div className="text-sm font-mono text-red-400 mb-3">{error}</div>
        )}

        <button
          type="submit"
          disabled={submitting || onCooldown}
          className="px-5 py-2.5 text-sm font-mono font-bold tracking-widest uppercase bg-[#fbbf24]/10 text-[#fbbf24] border border-[#fbbf24]/30 rounded-lg hover:bg-[#fbbf24]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting
            ? 'Posting...'
            : onCooldown
              ? `Wait ${cooldownSeconds}s`
              : 'Post Comment'}
        </button>
      </form>
    </div>
  )
}

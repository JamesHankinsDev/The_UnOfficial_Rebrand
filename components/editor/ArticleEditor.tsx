'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import {
  createArticle,
  updateArticle,
  getArticleById,
  ArticleDoc,
} from '@/lib/firestore'
import { Timestamp } from 'firebase/firestore'
import { RichTextEditor } from './RichTextEditor'
import { ImageUploader } from './ImageUploader'
import { AudioRecorder } from './AudioRecorder'
import { TweetPreview } from '@/components/social/TweetPreview'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Toggle } from '@/components/ui/Toggle'
import { calcReadTime, slugify } from '@/lib/utils'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'

const SERIES_OPTIONS = [
  { value: '', label: '— No Series —' },
  { value: 'value-meal', label: 'Value Meal' },
  { value: 'trajectory-twins', label: 'Trajectory Twins' },
  { value: 'picks-pops-rolls', label: 'Picks Pops & Rolls' },
]

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
]

interface ArticleEditorProps {
  editId?: string
}

export function ArticleEditor({ editId }: ArticleEditorProps) {
  const { user, userDoc } = useAuth()
  const router = useRouter()

  const [articleId] = useState(editId || uuidv4())
  const [loading, setLoading] = useState(!!editId)
  const [saving, setSaving] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [series, setSeries] = useState('')
  const [status, setStatus] = useState<'draft' | 'scheduled' | 'published'>('draft')
  const [featured, setFeatured] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [tweetPreview, setTweetPreview] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [sourceMode, setSourceMode] = useState(false)

  // Auto-save (preserves current status)
  useEffect(() => {
    if (!editId) return
    const interval = setInterval(() => {
      handleSave(status, true)
    }, 60_000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, title, content, tags, series, status, featured, tweetPreview])

  // Load existing article
  useEffect(() => {
    if (!editId) return
    getArticleById(editId).then(article => {
      if (!article) return
      setTitle(article.title)
      setContent(article.content)
      setTags(article.tags.join(', '))
      setSeries(article.series || '')
      setStatus(article.status)
      setFeatured(article.featured)
      setTweetPreview(article.tweetPreview || '')
      setCoverImageUrl(article.coverImageUrl || null)
      setAudioUrl(article.audioUrl || null)
      if (article.scheduledAt) {
        const d = article.scheduledAt.toDate()
        setScheduledAt(d.toISOString().slice(0, 16))
      }
      setLoading(false)
    })
  }, [editId])

  const buildData = useCallback(
    (overrideStatus?: typeof status): Partial<ArticleDoc> => {
      const data: Partial<ArticleDoc> = {
        title: title || 'Untitled',
        content,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        series: (series as ArticleDoc['series']) || null,
        status: overrideStatus || status,
        featured,
        scheduledAt:
          status === 'scheduled' && scheduledAt
            ? Timestamp.fromDate(new Date(scheduledAt))
            : null,
      }
      if (tweetPreview) data.tweetPreview = tweetPreview
      if (coverImageUrl) data.coverImageUrl = coverImageUrl
      if (audioUrl) data.audioUrl = audioUrl
      return data
    },
    [title, content, tags, series, status, featured, tweetPreview, coverImageUrl, audioUrl, scheduledAt]
  )

  const handleSave = async (
    overrideStatus?: typeof status,
    silent = false
  ) => {
    if (!user || !userDoc) return
    setSaving(true)
    try {
      const data = buildData(overrideStatus)
      if (editId) {
        await updateArticle(editId, data)
      } else {
        await createArticle(user.uid, userDoc.displayName, {
          ...data,
          // Use the pre-generated articleId as slug source
        })
      }
      if (!silent) {
        const msg = overrideStatus === 'published'
          ? 'Published. Go off.'
          : overrideStatus === 'scheduled'
          ? 'Scheduled. Mark your calendar.'
          : 'Draft saved.'
        toast.success(msg)
        if (!editId) {
          router.push('/dashboard/articles')
        }
      }
    } catch (e: unknown) {
      if (!silent) toast.error(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const slugPreview = slugify(title || 'untitled')
  const readTime = calcReadTime(content)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="font-mono text-[#5a5a64] animate-pulse">Loading article…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-0 lg:min-h-screen">
      {/* Main editor area */}
      <div className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 lg:max-w-4xl">
        <div className="mb-6">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Article Title"
            className="w-full bg-transparent font-mono font-bold text-2xl sm:text-3xl text-[#e8e6e3] placeholder:text-[#3a3a44] focus:outline-none border-b border-[#1e1e2a] pb-3 mb-2"
          />
          <div className="text-xs font-mono text-[#3a3a44]">
            /posts/<span className="text-[#5a5a64]">{slugPreview}</span>
            {' · '}
            <span>{readTime} min read</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setSourceMode(false)}
            className={`px-3 py-1 text-xs font-mono rounded transition-colors cursor-pointer ${
              !sourceMode
                ? 'bg-[#1e1e2a] text-[#e8e6e3]'
                : 'text-[#5a5a64] hover:text-[#8a8a94]'
            }`}
          >
            Editor
          </button>
          <button
            onClick={() => setSourceMode(true)}
            className={`px-3 py-1 text-xs font-mono rounded transition-colors cursor-pointer ${
              sourceMode
                ? 'bg-[#1e1e2a] text-[#e8e6e3]'
                : 'text-[#5a5a64] hover:text-[#8a8a94]'
            }`}
          >
            Source HTML
          </button>
        </div>

        {sourceMode ? (
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            className="w-full min-h-[600px] bg-[#111118] border border-[#1e1e2a] rounded-lg p-4 font-mono text-sm text-[#e8e6e3] placeholder:text-[#3a3a44] focus:outline-none focus:border-[#fbbf24]/30 resize-y"
            placeholder="Paste or write raw HTML here."
            spellCheck={false}
          />
        ) : (
          <RichTextEditor
            content={content}
            onChange={setContent}
            articleId={articleId}
            placeholder="Start writing. Make it count."
          />
        )}
      </div>

      {/* Sidebar: below editor on mobile, sticky right-rail on desktop */}
      <aside className="w-full lg:w-72 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-[#1e1e2a] p-4 sm:p-5 flex flex-col gap-5 lg:overflow-y-auto lg:sticky lg:top-0 lg:h-screen">
        {/* Publish actions */}
        <div className="flex flex-col gap-2">
          {status === 'published' ? (
            <>
              <Button
                onClick={() => handleSave('published')}
                variant="primary"
                size="sm"
                loading={saving}
                className="w-full"
              >
                Update Article
              </Button>
              <Button
                onClick={() => handleSave('draft')}
                variant="ghost"
                size="sm"
                loading={saving}
                className="w-full justify-start text-red-400 hover:text-red-300"
              >
                Unpublish
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => handleSave('draft')}
                variant="ghost"
                size="sm"
                loading={saving}
                className="w-full justify-start"
              >
                Save Draft
              </Button>
              <Button
                onClick={() => handleSave('scheduled')}
                variant="secondary"
                size="sm"
                loading={saving}
                className="w-full"
              >
                Schedule
              </Button>
              <Button
                onClick={() => handleSave('published')}
                variant="primary"
                size="sm"
                loading={saving}
                className="w-full"
              >
                Publish Now
              </Button>
            </>
          )}
        </div>

        {editId && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={async () => {
              await handleSave(status, true)
              window.open(`/dashboard/articles/${editId}/preview`, '_blank')
            }}
          >
            Preview
          </Button>
        )}

        <div className="h-px bg-[#1e1e2a]" />

        {/* Metadata */}
        <Select
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={e => setStatus(e.target.value as typeof status)}
        />

        {status === 'scheduled' && (
          <Input
            label="Scheduled Date & Time"
            type="datetime-local"
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
          />
        )}

        <Select
          label="Series"
          options={SERIES_OPTIONS}
          value={series}
          onChange={e => setSeries(e.target.value)}
        />

        <Input
          label="Tags"
          type="text"
          placeholder="nba, analytics, value"
          value={tags}
          onChange={e => setTags(e.target.value)}
          hint="Comma-separated"
        />

        <Toggle
          checked={featured}
          onChange={setFeatured}
          label="Featured article"
        />

        <div className="h-px bg-[#1e1e2a]" />

        {/* Cover image */}
        <ImageUploader
          articleId={articleId}
          currentUrl={coverImageUrl}
          onUpload={url => setCoverImageUrl(url)}
        />

        <div className="h-px bg-[#1e1e2a]" />

        {/* Audio */}
        <AudioRecorder
          articleId={articleId}
          currentUrl={audioUrl}
          onUpload={url => setAudioUrl(url)}
        />

        <div className="h-px bg-[#1e1e2a]" />

        {/* Tweet preview */}
        <div>
          <Textarea
            label="Custom Tweet Text"
            placeholder={`${title || 'Article title'} via @TheUnOfficial`}
            value={tweetPreview}
            onChange={e => setTweetPreview(e.target.value.slice(0, 240))}
            rows={3}
            hint={`${240 - tweetPreview.length} chars remaining`}
          />
          <div className="mt-2">
            <TweetPreview
              text={tweetPreview || undefined}
              title={title || 'Untitled'}
            />
          </div>
        </div>

        <div className="h-px bg-[#1e1e2a]" />

        {/* Stats */}
        <div className="text-xs font-mono text-[#5a5a64] flex flex-col gap-1">
          <div>
            Words:{' '}
            <span className="text-[#8a8a94]">
              {content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length.toLocaleString()}
            </span>
          </div>
          <div>
            Read time:{' '}
            <span className="text-[#8a8a94]">{readTime} min</span>
          </div>
        </div>

        {/* Spacer so the mobile sticky bar doesn't obscure sidebar bottom */}
        <div className="h-16 lg:hidden" />
      </aside>

      {/* Mobile-only sticky action bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0a0a0f]/95 backdrop-blur border-t border-[#1e1e2a] px-3 py-2.5 flex items-center gap-2">
        {status === 'published' ? (
          <Button
            onClick={() => handleSave('published')}
            variant="primary"
            size="sm"
            loading={saving}
            className="flex-1"
          >
            Update
          </Button>
        ) : (
          <>
            <Button
              onClick={() => handleSave('draft')}
              variant="ghost"
              size="sm"
              loading={saving}
              className="flex-1"
            >
              Save Draft
            </Button>
            <Button
              onClick={() => handleSave('published')}
              variant="primary"
              size="sm"
              loading={saving}
              className="flex-1"
            >
              Publish
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

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

  // Auto-save
  useEffect(() => {
    if (!editId) return
    const interval = setInterval(() => {
      handleSave('draft', true)
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
    (overrideStatus?: typeof status): Partial<ArticleDoc> => ({
      title: title || 'Untitled',
      content,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      series: (series as ArticleDoc['series']) || null,
      status: overrideStatus || status,
      featured,
      tweetPreview: tweetPreview || undefined,
      coverImageUrl: coverImageUrl || undefined,
      audioUrl: audioUrl || undefined,
      scheduledAt:
        status === 'scheduled' && scheduledAt
          ? Timestamp.fromDate(new Date(scheduledAt))
          : null,
    }),
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
    <div className="flex gap-0 min-h-screen">
      {/* Main editor area */}
      <div className="flex-1 p-8 max-w-4xl">
        <div className="mb-6">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Article Title"
            className="w-full bg-transparent font-mono font-bold text-3xl text-[#e8e6e3] placeholder:text-[#3a3a44] focus:outline-none border-b border-[#1e1e2a] pb-3 mb-2"
          />
          <div className="text-xs font-mono text-[#3a3a44]">
            /posts/<span className="text-[#5a5a64]">{slugPreview}</span>
            {' · '}
            <span>{readTime} min read</span>
          </div>
        </div>

        <RichTextEditor
          content={content}
          onChange={setContent}
          articleId={articleId}
          placeholder="Start writing. Make it count."
        />
      </div>

      {/* Sidebar */}
      <aside className="w-72 flex-shrink-0 border-l border-[#1e1e2a] p-5 flex flex-col gap-5 overflow-y-auto sticky top-0 h-screen">
        {/* Publish actions */}
        <div className="flex flex-col gap-2">
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
        </div>

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

        {/* Read time */}
        <div className="text-xs font-mono text-[#5a5a64]">
          Estimated read time:{' '}
          <span className="text-[#8a8a94]">{readTime} min</span>
        </div>
      </aside>
    </div>
  )
}

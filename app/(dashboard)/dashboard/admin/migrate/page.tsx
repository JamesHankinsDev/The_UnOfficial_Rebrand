'use client'

import React, { useState } from 'react'
import { collection, getDocs, addDoc, query, where, limit, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAdmin } from '@/hooks/useAdmin'
import { slugify, calcReadTime, generateExcerpt } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { useRouter } from 'next/navigation'

interface MigrationResult {
  migrated: number
  skipped: number
  errors: number
}

export default function MigratePage() {
  const { isAdmin, loading } = useAdmin()
  const router = useRouter()
  const [previewing, setPreviewing] = useState(false)
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [result, setResult] = useState<MigrationResult | null>(null)
  const [postCount, setPostCount] = useState<number | null>(null)

  if (loading) return null
  if (!isAdmin) {
    router.push('/dashboard')
    return null
  }

  const addLog = (msg: string) => setLog(prev => [...prev, msg])

  // Firestore rejects documents with `undefined` values with a permission-denied
  // error in the JS SDK. Strip them out before writing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripUndefined = (obj: Record<string, any>): Record<string, any> =>
    Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))

  const handlePreview = async () => {
    setPreviewing(true)
    setLog([])
    try {
      const snap = await getDocs(collection(db, 'posts'))
      setPostCount(snap.docs.length)
      if (snap.docs.length === 0) {
        addLog('No documents found in the posts collection.')
        return
      }
      addLog(`Found ${snap.docs.length} post(s) in the V1 collection.`)
      addLog('')
      addLog('Sample post fields (first document):')
      const sample = snap.docs[0].data()
      Object.entries(sample).forEach(([k, v]) => {
        const display = v instanceof Timestamp
          ? `Timestamp(${new Date(v.toMillis()).toISOString()})`
          : typeof v === 'string' && v.length > 80
            ? `"${v.slice(0, 80)}…"`
            : JSON.stringify(v)
        addLog(`  ${k}: ${display}`)
      })
    } catch (err) {
      addLog(`Error reading posts collection: ${err}`)
    } finally {
      setPreviewing(false)
    }
  }

  const handleMigrate = async () => {
    setRunning(true)
    setLog([])
    setResult(null)

    let migrated = 0
    let skipped = 0
    let errors = 0

    try {
      const snap = await getDocs(collection(db, 'posts'))
      addLog(`Starting migration of ${snap.docs.length} post(s)…`)
      addLog('')

      for (const postDoc of snap.docs) {
        const p = postDoc.data()
        const title = p.title || 'Untitled'

        // Build a slug, falling back to generated
        const slug = (p.slug as string | undefined) || slugify(title || postDoc.id)

        // Skip if already migrated
        const existing = await getDocs(
          query(collection(db, 'articles'), where('slug', '==', slug), limit(1))
        )
        if (!existing.empty) {
          addLog(`↩ Skipped  "${title}" — already exists`)
          skipped++
          continue
        }

        try {
          const content = (p.content || p.body || '') as string
          const now = Timestamp.now()
          const publishedAt = p.publishedAt || p.createdAt || now

          // Map status: handle alternate V1 status values
          let status: 'draft' | 'published' | 'scheduled' = 'draft'
          const rawStatus = (p.status || '').toLowerCase()
          if (rawStatus === 'published' || rawStatus === 'live' || rawStatus === 'active') {
            status = 'published'
          } else if (rawStatus === 'scheduled') {
            status = 'scheduled'
          }

          await addDoc(collection(db, 'articles'), stripUndefined({
            title,
            slug,
            authorId:        p.authorId || '',
            authorName:      p.authorName || p.author || p.authorDisplayName || '',
            content,
            excerpt:         p.excerpt || p.summary || p.description || generateExcerpt(content),
            coverImageUrl:   p.coverImageUrl || p.imageUrl || p.coverImage || p.image || p.thumbnail || null,
            audioUrl:        p.audioUrl || p.audio || null,
            tags:            p.tags || p.categories || [],
            series:          p.series || null,
            status,
            featured:        p.featured || p.isFeatured || false,
            scheduledAt:     p.scheduledAt || p.releaseDate || null,
            publishedAt:     status === 'published' ? publishedAt : null,
            createdAt:       p.createdAt || now,
            updatedAt:       p.updatedAt || now,
            readTimeMinutes: p.readTimeMinutes || p.readTime || calcReadTime(content),
            tweetPreview:    p.tweetPreview || p.tweet || null,
          }))

          addLog(`✓ Migrated "${title}" (${status})`)
          migrated++
        } catch (err) {
          addLog(`✗ Error on  "${title}": ${err}`)
          errors++
        }
      }

      addLog('')
      addLog(`Done. Migrated: ${migrated} | Skipped: ${skipped} | Errors: ${errors}`)
      setResult({ migrated, skipped, errors })
    } catch (err) {
      addLog(`Fatal error reading posts: ${err}`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <div className="font-mono text-xs tracking-widest text-[#5a5a64] uppercase mb-1">
          One-Time Tool
        </div>
        <h1 className="font-mono font-bold text-2xl text-[#e8e6e3] mb-2">
          Migrate V1 Posts → Articles
        </h1>
        <p className="text-sm text-[#8a8a94]">
          Copies all documents from the legacy <code className="text-[#fbbf24] text-xs">posts</code> collection
          into the V2 <code className="text-[#fbbf24] text-xs">articles</code> collection.
          Already-migrated posts (matched by slug) are skipped automatically.
          The original <code className="text-[#fbbf24] text-xs">posts</code> documents are not deleted.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="secondary"
          size="sm"
          onClick={handlePreview}
          loading={previewing}
          disabled={running}
        >
          Preview posts collection
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleMigrate}
          loading={running}
          disabled={previewing || (!!result && result.errors === 0)}
        >
          {result && result.errors === 0 ? 'Migration complete' : result ? 'Retry failed posts' : 'Run migration'}
        </Button>
      </div>

      {/* Result banner */}
      {result && (
        <div className={`mb-6 p-4 rounded-xl border font-mono text-sm ${
          result.errors > 0
            ? 'border-red-500/30 bg-red-500/5'
            : 'border-[#10b981]/30 bg-[#10b981]/5'
        }`}>
          <span className={result.errors > 0 ? 'text-red-400' : 'text-[#10b981]'}>
            {result.errors > 0 ? '⚠ ' : '✓ '}
          </span>
          <span className="text-[#e8e6e3]">{result.migrated} migrated</span>
          {result.skipped > 0 && (
            <span className="text-[#5a5a64] ml-3">{result.skipped} skipped</span>
          )}
          {result.errors > 0 && (
            <span className="text-red-400 ml-3">{result.errors} failed — click &quot;Retry failed posts&quot; to try again</span>
          )}
        </div>
      )}

      {/* Log output */}
      {log.length > 0 && (
        <div className="bg-[#111118] border border-[#1e1e2a] rounded-xl p-5 font-mono text-xs text-[#8a8a94] max-h-96 overflow-y-auto whitespace-pre-wrap">
          {log.map((line, i) => (
            <div
              key={i}
              className={
                line.startsWith('✓') ? 'text-[#10b981]' :
                line.startsWith('✗') ? 'text-red-400' :
                line.startsWith('↩') ? 'text-[#5a5a64]' :
                line.startsWith('Done') ? 'text-[#e8e6e3] font-bold mt-2' :
                ''
              }
            >
              {line || '\u00A0'}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

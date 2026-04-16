'use client'

import { useEffect } from 'react'

const STORAGE_KEY = 'unofficial-viewed'

export function ViewTracker({ articleId }: { articleId: string }) {
  useEffect(() => {
    try {
      const viewed: string[] = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]')
      if (viewed.includes(articleId)) return

      fetch('/api/articles/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId }),
      })

      viewed.push(articleId)
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(viewed))
    } catch {
      // sessionStorage unavailable (SSR, private browsing) — skip silently
    }
  }, [articleId])

  return null
}

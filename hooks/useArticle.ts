'use client'

import { useState, useEffect } from 'react'
import { ArticleDoc, getArticleById } from '@/lib/firestore'

export function useArticle(id: string | null) {
  const [article, setArticle] = useState<ArticleDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }
    getArticleById(id)
      .then(setArticle)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  return { article, loading, error }
}

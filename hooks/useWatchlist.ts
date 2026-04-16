import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'unofficial-watchlist'
const MAX_PLAYERS = 20

function readFromStorage(): number[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function writeToStorage(ids: number[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch { /* noop */ }
}

export function useWatchlist() {
  const [watchedIds, setWatchedIds] = useState<number[]>(() => readFromStorage())

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setWatchedIds(readFromStorage())
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const isWatched = useCallback(
    (id: number) => watchedIds.includes(id),
    [watchedIds],
  )

  const addToWatchlist = useCallback((id: number) => {
    setWatchedIds(prev => {
      if (prev.includes(id) || prev.length >= MAX_PLAYERS) return prev
      const next = [...prev, id]
      writeToStorage(next)
      return next
    })
  }, [])

  const removeFromWatchlist = useCallback((id: number) => {
    setWatchedIds(prev => {
      const next = prev.filter(x => x !== id)
      writeToStorage(next)
      return next
    })
  }, [])

  return { watchedIds, isWatched, addToWatchlist, removeFromWatchlist }
}

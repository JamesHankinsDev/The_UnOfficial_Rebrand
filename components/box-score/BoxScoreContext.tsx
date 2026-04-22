'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { BoxScoreModal } from './BoxScoreModal'

interface BoxScoreContextValue {
  openBoxScore: (gameId: number) => void
  closeBoxScore: () => void
}

const BoxScoreContext = createContext<BoxScoreContextValue | null>(null)

export function BoxScoreProvider({ children }: { children: ReactNode }) {
  const [gameId, setGameId] = useState<number | null>(null)

  const openBoxScore = useCallback((id: number) => setGameId(id), [])
  const closeBoxScore = useCallback(() => setGameId(null), [])

  return (
    <BoxScoreContext.Provider value={{ openBoxScore, closeBoxScore }}>
      {children}
      <BoxScoreModal gameId={gameId} onClose={closeBoxScore} />
    </BoxScoreContext.Provider>
  )
}

export function useBoxScore(): BoxScoreContextValue {
  const ctx = useContext(BoxScoreContext)
  if (!ctx) {
    throw new Error('useBoxScore must be used within <BoxScoreProvider>')
  }
  return ctx
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Modal } from '@/components/ui/Modal'
import { parseLocalDate } from '@/lib/utils'

interface GameMeta {
  gameId: number
  gameDate: string
  postseason: boolean
  status: string
  homeTeam: { id: number; abbr: string; fullName: string }
  visitorTeam: { id: number; abbr: string; fullName: string }
  homeScore: number
  visitorScore: number
}

interface PlayerLine {
  playerId: number
  firstName: string
  lastName: string
  position: string
  teamId: number
  min: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  turnover: number
  fgm: number
  fga: number
  fg3m: number
  fg3a: number
  ftm: number
  fta: number
}

function fmtMin(min: number): string {
  if (!min || !Number.isFinite(min)) return '0'
  return String(Math.round(min))
}

function fmtPct(m: number, a: number): string {
  if (!a) return '—'
  return `${Math.round((m / a) * 1000) / 10}%`
}

interface BoxScoreModalProps {
  gameId: number | null
  onClose: () => void
}

export function BoxScoreModal({ gameId, onClose }: BoxScoreModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<GameMeta | null>(null)
  const [lines, setLines] = useState<PlayerLine[]>([])

  useEffect(() => {
    if (gameId == null) {
      setMeta(null)
      setLines([])
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const [gameSnap, playerSnap] = await Promise.all([
          getDoc(doc(db, 'games', String(gameId))),
          getDocs(
            query(collectionGroup(db, 'games'), where('gameId', '==', gameId)),
          ),
        ])
        if (cancelled) return
        if (!gameSnap.exists()) {
          setError('Game not found')
          setLoading(false)
          return
        }
        setMeta(gameSnap.data() as GameMeta)
        setLines(
          playerSnap.docs
            .map((d) => d.data() as PlayerLine)
            .filter((p) => Number(p.min) > 0 || p.pts > 0 || p.reb > 0 || p.ast > 0),
        )
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        // Surface the underlying code (e.g. permission-denied, failed-
        // precondition=missing-index) in the console — much more
        // actionable than the generic "couldn't load" the user sees.
        console.warn('[box-score] load failed:', err)
        const code =
          err && typeof err === 'object' && 'code' in err
            ? String((err as { code: unknown }).code)
            : null
        if (code === 'permission-denied') {
          setError('Box score access denied — rules may need to be deployed.')
        } else if (code === 'failed-precondition') {
          setError('Box score index still building — try again in a minute.')
        } else {
          setError('Couldn’t load box score')
        }
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [gameId])

  const { visitorLines, homeLines } = useMemo(() => {
    if (!meta) return { visitorLines: [], homeLines: [] }
    const byPts = (a: PlayerLine, b: PlayerLine) => b.pts - a.pts
    return {
      visitorLines: lines.filter((l) => l.teamId === meta.visitorTeam.id).sort(byPts),
      homeLines: lines.filter((l) => l.teamId === meta.homeTeam.id).sort(byPts),
    }
  }, [lines, meta])

  const title = meta
    ? `${meta.visitorTeam.abbr} @ ${meta.homeTeam.abbr}`
    : 'Box Score'

  return (
    <Modal open={gameId != null} onClose={onClose} title={title} size="xl">
      {loading && (
        <div className="py-10 text-center font-mono text-sm text-[#5a5a64]">
          Loading box score…
        </div>
      )}

      {!loading && error && (
        <div className="py-10 text-center font-mono text-sm text-[#5a5a64]">
          {error}
        </div>
      )}

      {!loading && !error && meta && (
        <>
          <GameHeader meta={meta} />
          {lines.length === 0 ? (
            <div className="mt-6 py-6 text-center font-mono text-xs text-[#5a5a64] bg-[#0a0a0f] border border-[#1e1e2a] rounded-lg">
              Player stats aren&apos;t available for this game yet. Final stats
              usually post within a few minutes of the game ending.
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <TeamTable
                teamName={meta.visitorTeam.fullName}
                abbr={meta.visitorTeam.abbr}
                score={meta.visitorScore}
                lines={visitorLines}
                isWinner={meta.visitorScore > meta.homeScore && meta.status === 'Final'}
              />
              <TeamTable
                teamName={meta.homeTeam.fullName}
                abbr={meta.homeTeam.abbr}
                score={meta.homeScore}
                lines={homeLines}
                isWinner={meta.homeScore > meta.visitorScore && meta.status === 'Final'}
              />
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

function GameHeader({ meta }: { meta: GameMeta }) {
  const dateLabel = parseLocalDate(meta.gameDate)?.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) ?? meta.gameDate

  return (
    <div className="flex items-center justify-between pb-4 border-b border-[#1e1e2a]">
      <div className="font-mono text-xs tracking-widest uppercase text-[#5a5a64]">
        {dateLabel}
        {meta.postseason && (
          <span className="ml-2 text-[#fbbf24]">Playoffs</span>
        )}
      </div>
      <div className="font-mono text-xs tracking-widest uppercase text-[#5a5a64]">
        {meta.status === 'Final' ? 'Final' : meta.status || 'Scheduled'}
      </div>
    </div>
  )
}

function TeamTable({
  teamName,
  abbr,
  score,
  lines,
  isWinner,
}: {
  teamName: string
  abbr: string
  score: number
  lines: PlayerLine[]
  isWinner: boolean
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4
          className={`font-mono text-sm font-bold tracking-wide ${
            isWinner ? 'text-[#fbbf24]' : 'text-[#e8e6e3]'
          }`}
        >
          {teamName}{' '}
          <span className="text-[#5a5a64] text-xs">({abbr})</span>
        </h4>
        <span
          className={`font-mono text-lg tabular-nums ${
            isWinner ? 'text-[#fbbf24] font-bold' : 'text-[#8a8a94]'
          }`}
        >
          {score}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full font-mono text-xs">
          <thead>
            <tr className="text-[#5a5a64] uppercase tracking-widest text-[10px]">
              <th className="text-left py-2 pr-2">Player</th>
              <th className="text-right px-1.5">MIN</th>
              <th className="text-right px-1.5">PTS</th>
              <th className="text-right px-1.5">REB</th>
              <th className="text-right px-1.5">AST</th>
              <th className="text-right px-1.5">STL</th>
              <th className="text-right px-1.5">BLK</th>
              <th className="text-right px-1.5">TO</th>
              <th className="text-right px-1.5">FG</th>
              <th className="text-right px-1.5">3P</th>
              <th className="text-right pl-1.5">FT</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((p) => (
              <tr
                key={p.playerId}
                className="border-t border-[#1e1e2a] text-[#8a8a94]"
              >
                <td className="py-1.5 pr-2 text-[#e8e6e3]">
                  {p.firstName} {p.lastName}
                  {p.position && (
                    <span className="text-[#5a5a64] ml-1">· {p.position}</span>
                  )}
                </td>
                <td className="text-right tabular-nums px-1.5">{fmtMin(p.min)}</td>
                <td className="text-right tabular-nums px-1.5 text-[#e8e6e3]">{p.pts}</td>
                <td className="text-right tabular-nums px-1.5">{p.reb}</td>
                <td className="text-right tabular-nums px-1.5">{p.ast}</td>
                <td className="text-right tabular-nums px-1.5">{p.stl}</td>
                <td className="text-right tabular-nums px-1.5">{p.blk}</td>
                <td className="text-right tabular-nums px-1.5">{p.turnover}</td>
                <td className="text-right tabular-nums px-1.5">
                  {p.fgm}/{p.fga}
                  <span className="text-[#5a5a64] ml-1">{fmtPct(p.fgm, p.fga)}</span>
                </td>
                <td className="text-right tabular-nums px-1.5">
                  {p.fg3m}/{p.fg3a}
                </td>
                <td className="text-right tabular-nums pl-1.5">
                  {p.ftm}/{p.fta}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

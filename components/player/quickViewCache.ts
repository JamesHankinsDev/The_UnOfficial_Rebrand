import type { QuickViewPayload } from '@/app/api/nba/players/[id]/quick-view/route'

const cache = new Map<number, Promise<QuickViewPayload>>()
const HOVER_TIMEOUT_MS = 6000

export function fetchQuickView(playerId: number): Promise<QuickViewPayload> {
  const hit = cache.get(playerId)
  if (hit) return hit
  const p = fetch(`/api/nba/players/${playerId}/quick-view`, {
    signal: AbortSignal.timeout(HOVER_TIMEOUT_MS),
  }).then(async (r) => {
    if (!r.ok) throw new Error(`quick view ${r.status}`)
    return (await r.json()) as QuickViewPayload
  })
  cache.set(playerId, p)
  // Drop failed or timed-out fetches so future hovers retry instead of
  // replaying a dead promise forever.
  p.catch(() => cache.delete(playerId))
  return p
}

export type { QuickViewPayload }

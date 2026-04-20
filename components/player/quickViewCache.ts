import type { QuickViewPayload } from '@/app/api/nba/players/[id]/quick-view/route'

const cache = new Map<number, Promise<QuickViewPayload>>()

export function fetchQuickView(playerId: number): Promise<QuickViewPayload> {
  const hit = cache.get(playerId)
  if (hit) return hit
  const p = fetch(`/api/nba/players/${playerId}/quick-view`).then(async (r) => {
    if (!r.ok) throw new Error(`quick view ${r.status}`)
    return (await r.json()) as QuickViewPayload
  })
  cache.set(playerId, p)
  // Drop failed fetches so future hovers retry
  p.catch(() => cache.delete(playerId))
  return p
}

export type { QuickViewPayload }

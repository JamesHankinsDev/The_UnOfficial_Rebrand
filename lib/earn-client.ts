import type { User } from 'firebase/auth'

export interface EarnRequest {
  source: 'trivia.draft-order' | 'trivia.stat-ranking'
  amount: number
}

export interface EarnResponse {
  credited: number
  wasOverCap: boolean
  willCapAfter: boolean
  earnedInWindow: number
  cap: number
  resetsInMs: number
  newBalance: number
}

export interface CapStateResponse {
  earnedInWindow: number
  cap: number
  resetsInMs: number
}

export async function earnBucks(
  user: User,
  req: EarnRequest,
): Promise<EarnResponse> {
  const token = await user.getIdToken()
  const res = await fetch('/api/tcg/earn', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`earn failed: ${res.status} ${err}`)
  }
  return (await res.json()) as EarnResponse
}

export async function fetchCapState(user: User): Promise<CapStateResponse> {
  const token = await user.getIdToken()
  const res = await fetch('/api/tcg/earn', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`cap state failed: ${res.status}`)
  return (await res.json()) as CapStateResponse
}

/**
 * "3h 42m" / "12m" / "just a sec". Used in cap-hit toasts.
 */
export function formatResetsIn(ms: number): string {
  if (ms <= 0) return 'just a sec'
  const totalMinutes = Math.ceil(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

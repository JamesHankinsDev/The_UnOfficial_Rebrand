import { NextResponse } from 'next/server'

/**
 * Thrown when BallDontLie responds with 429. Carries the Retry-After
 * hint (in seconds) so top-level route handlers can pass it through.
 */
export class BdlRateLimitError extends Error {
  readonly retryAfterSeconds: number
  constructor(retryAfter = 30) {
    super('BallDontLie rate limit')
    this.name = 'BdlRateLimitError'
    this.retryAfterSeconds = retryAfter
  }
}

const DEFAULT_TIMEOUT_MS = 8000

/**
 * fetch() wrapper for BallDontLie calls. Adds an 8s timeout and throws
 * BdlRateLimitError on 429 so a hung upstream can never pin an API route
 * open indefinitely and rate-limits propagate to the client instead of
 * degrading to silent 500s.
 */
export async function bdlFetch(
  url: string | URL,
  apiKey: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const res = await fetch(url, {
    headers: { Authorization: apiKey },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (res.status === 429) {
    const header = res.headers.get('retry-after')
    const parsed = header ? parseInt(header, 10) : NaN
    throw new BdlRateLimitError(Number.isFinite(parsed) ? parsed : 30)
  }
  return res
}

/**
 * If `err` is a rate-limit error, return a 429 NextResponse with a
 * Retry-After header. Otherwise return null so the caller falls through
 * to its own error path.
 */
export function rateLimitResponse(err: unknown): NextResponse | null {
  if (err instanceof BdlRateLimitError) {
    return NextResponse.json(
      {
        error: 'Upstream rate limit hit. Try again shortly.',
        retryAfter: err.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(err.retryAfterSeconds) },
      },
    )
  }
  return null
}

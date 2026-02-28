/**
 * Server-side cache using Next.js Data Cache (shared across Vercel instances).
 *
 * - Uses `unstable_cache` so cached data persists across serverless function
 *   invocations and is shared across all Vercel instances.
 * - Keeps an in-process inflight map for request coalescing: if N requests
 *   arrive simultaneously for the same key, only 1 fetcher call runs.
 */

import { unstable_cache } from "next/cache";

const inflight = new Map<string, Promise<unknown>>();

/**
 * Return cached data if fresh, otherwise call `fetcher` and cache the result.
 * Uses Next.js Data Cache (Vercel-shared) with in-process request coalescing.
 *
 * IMPORTANT: Return values must be JSON-serializable (no Maps, Sets, Dates, etc).
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  // Coalesce: if another caller in this instance is already fetching, share it
  const pending = inflight.get(key);
  if (pending) {
    return pending as Promise<T>;
  }

  const revalidate = Math.max(1, Math.round(ttlMs / 1000));
  const cachedFetcher = unstable_cache(fetcher, [key], { revalidate });

  const promise = cachedFetcher()
    .then((data) => {
      inflight.delete(key);
      return data as T;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise;
}

// ── Common TTL constants (ms) ────────────────────────────────────────
export const TTL = {
  /** 5 minutes — live scores, game logs */
  SHORT: 5 * 60 * 1000,
  /** 10 minutes — standings, leaders, season averages */
  MEDIUM: 10 * 60 * 1000,
  /** 1 hour — player detail, computed leaders */
  LONG: 60 * 60 * 1000,
  /** 12 hours — contracts/salary */
  HALF_DAY: 12 * 60 * 60 * 1000,
  /** 24 hours — teams list, trivia pool */
  DAY: 24 * 60 * 60 * 1000,
} as const;

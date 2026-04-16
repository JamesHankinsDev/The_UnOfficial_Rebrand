/**
 * Server-side cache using Next.js Data Cache (shared across Vercel instances).
 *
 * - Uses `unstable_cache` so cached data persists across serverless function
 *   invocations and is shared across Vercel instances.
 * - Keeps an in-process inflight map for request coalescing: if N requests
 *   arrive simultaneously for the same key, only 1 fetch fires.
 */

import { unstable_cache, revalidateTag } from "next/cache";

const inflight = new Map<string, Promise<unknown>>();

/**
 * Return cached data if fresh, otherwise call `fetcher` and cache the result.
 * Uses Next.js Data Cache (shared) with in-process request coalescing.
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
  const cachedFetcher = unstable_cache(fetcher, [key], {
    revalidate,
    tags: [key, "all-api-cache"],
  });

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

/**
 * Purge all cached data. Call via the /api/cache/purge endpoint
 * or after a deployment to force fresh API fetches.
 */
export function purgeAllCache(): void {
  revalidateTag("all-api-cache");
  inflight.clear();
}

/**
 * Purge a specific cache key.
 */
export function purgeCache(key: string): void {
  revalidateTag(key);
  inflight.delete(key);
}

// ── Common TTL constants (ms) ───────────────────────────────────────────────
export const TTL = {
  /** 60 seconds — in-progress game scores, live box scores */
  LIVE: 60 * 1000,
  /** 3 minutes — recent game logs, today/yesterday scores */
  SHORT: 3 * 60 * 1000,
  /** 10 minutes — standings, leaders, season averages */
  MEDIUM: 10 * 60 * 1000,
  /** 1 hour — player detail, computed leaders */
  LONG: 60 * 60 * 1000,
  /** 12 hours — contracts/salary cap */
  HALF_DAY: 12 * 60 * 60 * 1000,
  /** 24 hours — teams list, trivia pool */
  DAY: 24 * 60 * 60 * 1000,
} as const;

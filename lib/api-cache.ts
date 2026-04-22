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
 * Hard ceiling on how long a single fetcher invocation can take before
 * we reject and free the in-flight slot. Without this, a hung upstream
 * (e.g. BallDontLie not responding) pins the coalesced promise open and
 * every subsequent caller waits on the same dead promise.
 */
const FETCHER_TIMEOUT_MS = 30_000;

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`cache fetcher timed out after ${ms}ms: ${label}`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

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
  const cachedFetcher = unstable_cache(
    () => withTimeout(fetcher(), FETCHER_TIMEOUT_MS, key),
    [key],
    {
      revalidate,
      tags: [key, "all-api-cache"],
    },
  );

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
  revalidateTag("all-api-cache", "max");
  inflight.clear();
}

/**
 * Purge a specific cache key.
 */
export function purgeCache(key: string): void {
  revalidateTag(key, "max");
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

// ── HTTP cache headers for browser/CDN caching ─────────────────────────────

/**
 * Build Cache-Control + CDN headers for a given TTL.
 * - `s-maxage`: CDN cache duration (full TTL)
 * - `max-age`: browser cache (shorter, 1/3 of TTL, min 30s)
 * - `stale-while-revalidate`: serve stale while refreshing in background
 */
export function cacheHeaders(ttlMs: number): HeadersInit {
  const cdnSeconds = Math.max(1, Math.round(ttlMs / 1000));
  const browserSeconds = Math.max(30, Math.round(cdnSeconds / 3));
  return {
    "Cache-Control": `public, s-maxage=${cdnSeconds}, max-age=${browserSeconds}, stale-while-revalidate=${cdnSeconds * 2}`,
  };
}

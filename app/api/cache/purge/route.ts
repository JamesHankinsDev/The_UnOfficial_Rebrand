import { NextResponse } from "next/server";
import { purgeAllCache, purgeCache } from "@/lib/api-cache";

/**
 * POST /api/cache/purge
 *
 * Purges the server-side data cache. Requires CACHE_PURGE_SECRET
 * in the Authorization header to prevent unauthorized access.
 *
 * Body (optional): { "key": "some-cache-key" } to purge a specific key.
 * Omit body to purge all cached data.
 *
 * Usage:
 *   curl -X POST https://the-un-official.com/api/cache/purge \
 *     -H "Authorization: Bearer YOUR_SECRET"
 */
export async function POST(request: Request) {
  const secret = process.env.CACHE_PURGE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CACHE_PURGE_SECRET not configured" },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    const key = body?.key as string | undefined;

    if (key) {
      purgeCache(key);
      return NextResponse.json({ purged: key });
    }

    purgeAllCache();
    return NextResponse.json({ purged: "all" });
  } catch (error) {
    console.error("Cache purge error:", error);
    return NextResponse.json({ error: "Purge failed" }, { status: 500 });
  }
}

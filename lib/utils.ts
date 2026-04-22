export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function calcReadTime(content: string): number {
  const words = content.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 200))
}

export function generateExcerpt(content: string, maxLen = 150): string {
  const stripped = content
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (stripped.length <= maxLen) return stripped
  return stripped.slice(0, maxLen).replace(/\s+\S*$/, '') + '…'
}

export function formatDate(
  date: Date | { toDate(): Date } | string | number | null | undefined
): string {
  if (!date) return ''
  let d: Date
  if (date && typeof date === 'object' && 'toDate' in date) {
    d = (date as { toDate(): Date }).toDate()
  } else {
    d = new Date(date as string | number | Date)
  }
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function formatShortDate(
  date: Date | { toDate(): Date } | string | number | null | undefined
): string {
  if (!date) return ''
  let d: Date
  if (date && typeof date === 'object' && 'toDate' in date) {
    d = (date as { toDate(): Date }).toDate()
  } else {
    d = new Date(date as string | number | Date)
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Time of day in the user's local timezone, e.g. "8:00 PM" or "20:00"
 * depending on locale. Returns '' for invalid inputs so callers can use
 * it inline without a guard.
 */
export function formatLocalTime(
  input: Date | string | number | null | undefined,
): string {
  if (input == null || input === '') return ''
  const d = input instanceof Date ? input : new Date(input)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/**
 * Local YYYY-MM-DD. Used for "today"/"yesterday" query params so a user
 * in LA at 11pm doesn't see tomorrow's games as "today" (which would
 * happen with toISOString().split('T')[0] — that's UTC).
 */
export function localDateString(d: Date = new Date()): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse a "YYYY-MM-DD" string as a local calendar date. `new Date(s)`
 * treats a bare date string as UTC midnight, which shifts into the
 * previous day for any user west of UTC when rendered — this avoids
 * that. Returns null for malformed input.
 */
export function parseLocalDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr)
  if (!m) return null
  const y = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10)
  const d = parseInt(m[3], 10)
  const parsed = new Date(y, mo - 1, d)
  return isNaN(parsed.getTime()) ? null : parsed
}

const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T/

/**
 * Human-readable rendering of BallDontLie's `game.status` field, which
 * can be any of:
 *   - "" (empty)  → "TBD"
 *   - "Final"     → "FINAL"
 *   - ISO string  → tip-off time in the user's locale, e.g. "8:00 PM"
 *   - anything else (live game-clock state) → passed through as-is
 */
export function formatGameStatus(status: string | null | undefined): string {
  if (!status) return 'TBD'
  if (status === 'Final') return 'FINAL'
  if (ISO_TIMESTAMP_RE.test(status)) {
    return formatLocalTime(status) || 'TBD'
  }
  return status
}

/** `true` when a status string indicates an in-progress game. */
export function isGameLive(status: string | null | undefined): boolean {
  if (!status || status === 'Final') return false
  if (ISO_TIMESTAMP_RE.test(status)) return false
  return true
}

export function tweetUrl(text: string, url: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
}

export async function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}

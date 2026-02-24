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
  const stripped = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
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

export function tweetUrl(text: string, url: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
}

export async function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}

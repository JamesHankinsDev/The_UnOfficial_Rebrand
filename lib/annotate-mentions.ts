import type { ActivePlayerRow } from '@/lib/nba-persons'
import { PLAYER_ALIASES } from '@/lib/player-aliases'

const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g

// Tags whose text content should NOT get mentions injected
const EXCLUDE_TAGS = new Set([
  'a',
  'code',
  'pre',
  'script',
  'style',
  'textarea',
])

// HTML void/self-closing elements (no closing tag to pop)
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'source', 'track', 'wbr',
])

// First/last names shorter than this are only matched via the curated alias
// table — avoids wrapping 2-letter tokens that show up as common English words.
const SHORT_NAME_MIN = 3

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/** Strip combining diacritics + lowercase — "Dončić" → "doncic", "LeBron" → "lebron". */
function deburr(str: string): string {
  return str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/**
 * For each ASCII base-letter in the alias, expand to a character class that
 * accepts the same letter with or without common Latin diacritics. Makes the
 * compiled regex match "Jokic" and "Jokić" with a single pattern.
 */
const DIACRITIC_CLASS: Record<string, string> = {
  a: '[aáàâäãåāăąǎ]',
  c: '[cćčç]',
  d: '[dďđ]',
  e: '[eéèêëēėęěĕ]',
  g: '[gğġģǧ]',
  h: '[hȟḣḧ]',
  i: '[iíìîïĩīįǐ]',
  j: '[jǰ]',
  k: '[kķǩ]',
  l: '[lĺľłļ]',
  n: '[nńñňņ]',
  o: '[oóòôöõøōŏőǒ]',
  r: '[rŕřŗ]',
  s: '[sśšşș]',
  t: '[tťțţ]',
  u: '[uúùûüũūŭůűųǔ]',
  w: '[wŵẃẁẅ]',
  y: '[yýÿỳŷȳ]',
  z: '[zźžżẑ]',
}

/**
 * Compile a regex-pattern fragment that tolerates diacritic variants for each
 * letter. Input is deburred first, so "Dončić" and "Doncic" both yield the
 * same tolerant pattern.
 */
function aliasRegexPattern(alias: string): string {
  const normalized = deburr(alias)
  let out = ''
  for (const ch of normalized) {
    out += DIACRITIC_CLASS[ch] ?? escapeRegex(ch)
  }
  return out
}

interface Token {
  type: 'text' | 'tag'
  content: string
  tagName?: string
  closing?: boolean
  selfClosing?: boolean
}

function tokenize(html: string): Token[] {
  const tokens: Token[] = []
  let lastIdx = 0
  let m: RegExpExecArray | null
  TAG_RE.lastIndex = 0
  while ((m = TAG_RE.exec(html)) !== null) {
    if (m.index > lastIdx) {
      tokens.push({ type: 'text', content: html.slice(lastIdx, m.index) })
    }
    const raw = m[0]
    const tagName = m[1].toLowerCase()
    const closing = raw.startsWith('</')
    const selfClosing = raw.endsWith('/>') || VOID_ELEMENTS.has(tagName)
    tokens.push({ type: 'tag', content: raw, tagName, closing, selfClosing })
    lastIdx = m.index + raw.length
  }
  if (lastIdx < html.length) {
    tokens.push({ type: 'text', content: html.slice(lastIdx) })
  }
  return tokens
}

/** Walks tokens once, invoking `onText` for every text node NOT inside an excluded tag. */
function walkTextNodes(tokens: Token[], onText: (text: string) => string | void): string {
  const stack: string[] = []
  const out: string[] = []
  for (const tok of tokens) {
    if (tok.type === 'tag') {
      out.push(tok.content)
      if (tok.selfClosing || !tok.tagName) continue
      if (tok.closing) {
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i] === tok.tagName) {
            stack.splice(i, 1)
            break
          }
        }
      } else {
        stack.push(tok.tagName)
      }
      continue
    }
    const inExcluded = stack.some((t) => EXCLUDE_TAGS.has(t))
    if (inExcluded) {
      out.push(tok.content)
      continue
    }
    const replaced = onText(tok.content)
    out.push(typeof replaced === 'string' ? replaced : tok.content)
  }
  return out.join('')
}

/**
 * Two-pass annotator:
 *   1. Scan article text for full-name matches → "confirmed" player set.
 *   2. Wrap occurrences of each confirmed player's full name, first name,
 *      last name (if unambiguous within this article), and curated nicknames.
 *
 * Rules:
 *   - Skips content inside <a>, <code>, <pre>, <script>, <style>, <textarea>.
 *   - First/last names must be ≥3 chars AND unique among confirmed players
 *     in the article to be eligible (e.g., "Curry" is skipped if both
 *     Stephen and Seth appear).
 *   - Nicknames come from the curated PLAYER_ALIASES map.
 *   - Each distinct text form (case-insensitive) is marked at most once to
 *     keep articles readable — full name, short name, and each nickname
 *     each get one underline.
 *   - Longer aliases are matched before shorter ones so "LeBron James" wins
 *     over "LeBron" at the same location.
 */
export function annotatePlayerMentions(
  html: string,
  players: ActivePlayerRow[],
): string {
  if (!html || players.length === 0) return html

  // Normalize keys: strip diacritics + trailing punctuation, lowercase.
  // Same transform applied to text-match lookups, so "Dončić" and "Doncic"
  // both map to the same key.
  const normKey = (s: string) => deburr(s).replace(/\.+$/, '')

  const byFullName = new Map<string, ActivePlayerRow>()
  for (const p of players) byFullName.set(normKey(p.name), p)

  // ── Pass 1: confirm which players are discussed via their full name ──
  const multiToken = Array.from(byFullName.keys())
    .filter((n) => n.includes(' '))
    .sort((a, b) => b.length - a.length)
  if (multiToken.length === 0) return html

  // `u` flag: makes \b respect non-ASCII letters (so matching "Dončić" with a
  // diacritic-tolerant pattern still has a trailing word boundary).
  const fullNameRe = new RegExp(
    `\\b(${multiToken.map(aliasRegexPattern).join('|')})\\b`,
    'giu',
  )

  const tokens = tokenize(html)
  const confirmedById = new Map<number, ActivePlayerRow>()
  walkTextNodes(tokens, (text) => {
    for (const m of text.matchAll(fullNameRe)) {
      const row = byFullName.get(normKey(m[0]))
      if (row && !confirmedById.has(row.bl_id)) confirmedById.set(row.bl_id, row)
    }
    return undefined
  })

  if (confirmedById.size === 0) return html

  // ── Build alias → player_id map, scoped to confirmed players ──
  const aliasToId = new Map<string, number>()

  // (a) Full names — always included
  for (const row of confirmedById.values()) {
    aliasToId.set(normKey(row.name), row.bl_id)
  }

  // (b) First / last names — only if unique among the confirmed set
  const firstNameCounts = new Map<string, number>()
  const lastNameCounts = new Map<string, number>()
  for (const row of confirmedById.values()) {
    const fn = normKey(row.first_name)
    const ln = normKey(row.last_name)
    firstNameCounts.set(fn, (firstNameCounts.get(fn) ?? 0) + 1)
    lastNameCounts.set(ln, (lastNameCounts.get(ln) ?? 0) + 1)
  }
  for (const row of confirmedById.values()) {
    const fn = normKey(row.first_name)
    const ln = normKey(row.last_name)
    if (fn.length >= SHORT_NAME_MIN && firstNameCounts.get(fn) === 1) {
      aliasToId.set(fn, row.bl_id)
    }
    if (ln.length >= SHORT_NAME_MIN && lastNameCounts.get(ln) === 1) {
      aliasToId.set(ln, row.bl_id)
    }
  }

  // (c) Curated nicknames (lookup by original BallDontLie full name)
  for (const row of confirmedById.values()) {
    const aliases = PLAYER_ALIASES[row.name]
    if (!aliases) continue
    for (const a of aliases) aliasToId.set(normKey(a), row.bl_id)
  }

  // ── Pass 2: replace matches, longest aliases first ──
  const allAliases = Array.from(aliasToId.keys()).sort(
    (a, b) => b.length - a.length,
  )
  if (allAliases.length === 0) return html

  const aliasRe = new RegExp(
    `\\b(${allAliases.map(aliasRegexPattern).join('|')})\\b`,
    'giu',
  )

  const used = new Set<string>()

  // Re-walk the same tokens for the replacement pass
  return walkTextNodes(tokens, (text) =>
    text.replace(aliasRe, (match) => {
      const key = normKey(match)
      const id = aliasToId.get(key)
      if (!id || used.has(key)) return match
      used.add(key)
      return `<span data-player-id="${id}" data-player-name="${escapeAttr(match)}" class="player-mention">${match}</span>`
    }),
  )
}

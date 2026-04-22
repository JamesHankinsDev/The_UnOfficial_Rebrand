/**
 * Earn ceiling — shared cap math for any coin-earning surface.
 *
 * Window: 8:00 AM ET → 8:00 AM ET next day. Fixed TZ (America/New_York)
 * handles DST correctly. 8am chosen so late-night-game + post-game-trivia
 * sessions land in the same window instead of getting split across
 * midnight.
 */

export const DAILY_EARN_CAP = 100
const EARN_RESET_HOUR_ET = 8
const ET_ZONE = 'America/New_York'

function etHour(d: Date): number {
  return parseInt(
    d.toLocaleString('en-US', { timeZone: ET_ZONE, hour: '2-digit', hour12: false }),
    10,
  )
}

function etDateParts(d: Date): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: ET_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value]),
  )
  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
  }
}

/**
 * Given an ET calendar date, return the UTC-anchored Date representing
 * 08:00 AM on that date in ET. Handles DST by probing both common offsets
 * (EST: UTC-5, EDT: UTC-4) and picking whichever actually formats to 08:00.
 */
function etMorning(etYear: number, etMonth: number, etDay: number): Date {
  for (const utcHour of [12, 13]) {
    const guess = new Date(Date.UTC(etYear, etMonth - 1, etDay, utcHour, 0, 0))
    if (etHour(guess) === EARN_RESET_HOUR_ET) return guess
  }
  // Fallback to EDT if TZ data is weird (shouldn't happen in practice).
  return new Date(Date.UTC(etYear, etMonth - 1, etDay, 12, 0, 0))
}

/**
 * Most recent 08:00 ET boundary at or before `now`. This is the anchor
 * for "earnings in the current window."
 */
export function currentEarnWindowStart(now: Date = new Date()): Date {
  const { year, month, day } = etDateParts(now)
  if (etHour(now) < EARN_RESET_HOUR_ET) {
    // Before 8am ET — window started yesterday.
    const anchor = new Date(Date.UTC(year, month - 1, day, 12))
    anchor.setUTCDate(anchor.getUTCDate() - 1)
    const prev = etDateParts(anchor)
    return etMorning(prev.year, prev.month, prev.day)
  }
  return etMorning(year, month, day)
}

/** Next 08:00 ET boundary after `now`. */
export function nextEarnWindowStart(now: Date = new Date()): Date {
  const current = currentEarnWindowStart(now)
  // +30h safely crosses any DST boundary into the next ET calendar day.
  const tomorrow = new Date(current.getTime() + 30 * 60 * 60 * 1000)
  const { year, month, day } = etDateParts(tomorrow)
  return etMorning(year, month, day)
}

export interface CapState {
  earnedInWindow: number
  windowStart: Date
}

export interface CapApplication {
  credited: number
  newEarnedInWindow: number
  wasOverCap: boolean
  willCapAfter: boolean
  resetsInMs: number
}

/**
 * Pure cap math. Given the current window state and a proposed `amount`,
 * returns what to actually credit and whether the user has crossed the
 * daily ceiling.
 *
 * Rule (per product): full amount is always awarded — users may exceed
 * the cap on the run that crosses it. Subsequent calls during the same
 * window credit 0. This keeps any single trivia/game attempt from being
 * partially-scored mid-run.
 */
export function applyCap(
  state: CapState,
  amount: number,
  now: Date = new Date(),
  cap: number = DAILY_EARN_CAP,
): CapApplication {
  const wasOverCap = state.earnedInWindow >= cap
  const credited = wasOverCap ? 0 : Math.max(0, Math.floor(amount))
  const newEarnedInWindow = state.earnedInWindow + credited
  const willCapAfter = !wasOverCap && newEarnedInWindow >= cap
  const resetsInMs = Math.max(0, nextEarnWindowStart(now).getTime() - now.getTime())
  return { credited, newEarnedInWindow, wasOverCap, willCapAfter, resetsInMs }
}

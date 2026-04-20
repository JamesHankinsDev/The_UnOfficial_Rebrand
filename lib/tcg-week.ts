/**
 * Week-window helpers for the TCG lineup feature.
 *
 * A "week" runs from Monday 00:00 America/Los_Angeles to the following
 * Monday 00:00 LA. Lineups are hard-locked at each week boundary, so every
 * calendar day during that range belongs to exactly one week.
 *
 * `weekId` is the YYYY-MM-DD calendar date of the LA Monday that starts it.
 */

const TZ = "America/Los_Angeles";

/** Parts extracted for the given instant, as rendered in the LA calendar. */
interface LAParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday, 1 = Monday, … 6 = Saturday */
  weekday: number;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getLAParts(d: Date): LAParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(d);
  const pick = (t: string) => parts.find((p) => p.type === t)!.value;
  return {
    year: parseInt(pick("year"), 10),
    month: parseInt(pick("month"), 10),
    day: parseInt(pick("day"), 10),
    hour: parseInt(pick("hour"), 10),
    minute: parseInt(pick("minute"), 10),
    second: parseInt(pick("second"), 10),
    weekday: WEEKDAYS.indexOf(pick("weekday")),
  };
}

/**
 * Returns the UTC offset (in minutes) for `America/Los_Angeles` at the
 * given instant — accounts for PST/PDT.
 */
function tzOffsetMinutes(date: Date): number {
  const p = getLAParts(date);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return (asIfUtc - date.getTime()) / 60000;
}

/**
 * Given any instant, returns a UTC `Date` for LA-local (year, month, day, 0,0,0).
 * DST-safe: we ask the tz library twice so the returned instant always formats
 * back to the requested wall time.
 */
function laMidnightToUtc(year: number, month: number, day: number): Date {
  // First pass — pretend the offset is the one for the current moment.
  const rough = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const offset1 = tzOffsetMinutes(rough);
  const corrected = new Date(rough.getTime() - offset1 * 60000);
  // Second pass — re-check the offset at the corrected instant; if DST shifts,
  // fix up.
  const offset2 = tzOffsetMinutes(corrected);
  if (offset2 !== offset1) {
    return new Date(rough.getTime() - offset2 * 60000);
  }
  return corrected;
}

function formatWeekId(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/** Parses a YYYY-MM-DD string into its components. Throws on invalid input. */
function parseWeekId(weekId: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekId);
  if (!match) throw new Error(`Invalid weekId: ${weekId}`);
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
    day: parseInt(match[3], 10),
  };
}

export interface WeekWindow {
  /** ISO date of the LA Monday that starts the week, e.g. "2026-04-20". */
  weekId: string;
  /** UTC instant of Monday 00:00 LA. */
  startUtc: Date;
  /** UTC instant of the following Monday 00:00 LA (exclusive end). */
  endUtc: Date;
}

/** Returns the week window for the LA-local Monday that owns `now`. */
export function currentWeekWindow(now: Date = new Date()): WeekWindow {
  const p = getLAParts(now);
  // Shift back to the Monday of this LA week. Sunday (0) is the tail-end of the
  // prior Mon-Sun range → subtract 6, not -1.
  const daysBack = p.weekday === 0 ? 6 : p.weekday - 1;

  // Build LA calendar date for Monday.
  const monday = new Date(Date.UTC(p.year, p.month - 1, p.day - daysBack));
  const year = monday.getUTCFullYear();
  const month = monday.getUTCMonth() + 1;
  const day = monday.getUTCDate();

  const startUtc = laMidnightToUtc(year, month, day);
  const next = new Date(Date.UTC(year, month - 1, day + 7));
  const endUtc = laMidnightToUtc(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
  );

  return { weekId: formatWeekId(year, month, day), startUtc, endUtc };
}

/** Returns the week window for the Monday seven days before the current one. */
export function previousWeekWindow(now: Date = new Date()): WeekWindow {
  const cur = currentWeekWindow(now);
  const prevInstant = new Date(cur.startUtc.getTime() - 1_000); // just before Monday
  return currentWeekWindow(prevInstant);
}

/** Returns the week window for an explicit weekId like "2026-04-20". */
export function weekWindowFromId(weekId: string): WeekWindow {
  const { year, month, day } = parseWeekId(weekId);
  const startUtc = laMidnightToUtc(year, month, day);
  const next = new Date(Date.UTC(year, month - 1, day + 7));
  const endUtc = laMidnightToUtc(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
  );
  return { weekId, startUtc, endUtc };
}

/** "Week of Apr 20, 2026" — short calendar label for a weekId. */
export function formatWeekLabel(weekId: string): string {
  const { year, month, day } = parseWeekId(weekId);
  const d = new Date(Date.UTC(year, month - 1, day));
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
  return `Week of ${label}`;
}

/** BallDontLie stats endpoint takes ISO date strings like "2026-04-20". */
export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Recent week IDs in descending order (most recent first), starting from the
 * current LA-local week. Used to populate the leaderboard's week selector
 * without a Firestore round-trip.
 */
export function recentWeekIds(count: number, now: Date = new Date()): string[] {
  const out: string[] = [];
  let probe = now;
  for (let i = 0; i < count; i++) {
    const w = currentWeekWindow(probe);
    out.push(w.weekId);
    probe = new Date(w.startUtc.getTime() - 1_000);
  }
  return out;
}

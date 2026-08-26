/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

/**
 * Timezone-aware date helpers.
 *
 * "Today" for a clinic means today IN THE CLINIC'S timezone (Settings.timezone,
 * default Asia/Kolkata) — not the server's timezone. A UTC server would
 * otherwise start the clinic's day at 05:30 local time, misaligning daily
 * revenue and appointment reports by 5½ hours.
 *
 * All helpers take an IANA timezone name and work via the Intl API (no
 * external date library needed).
 */

/** True if `tz` is a valid IANA timezone identifier. */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

interface TzParts {
  y: number
  m: number
  day: number
  h: number
  mi: number
  s: number
}

function partsInTz(tz: string, d: Date): TzParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const map: Record<string, number> = {}
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== 'literal') map[p.type] = Number(p.value)
  }
  return {
    y: map.year,
    m: map.month,
    day: map.day,
    // `hour: '24'` is emitted by some ICU versions for midnight — normalise.
    h: map.hour % 24,
    mi: map.minute,
    s: map.second,
  }
}

/** Offset of `tz` from UTC at instant `d`, in milliseconds. */
function tzOffsetMs(tz: string, d: Date): number {
  const p = partsInTz(tz, d)
  const asUtc = Date.UTC(p.y, p.m - 1, p.day, p.h, p.mi, p.s)
  return asUtc - d.getTime()
}

/** Calendar date of instant `d` in `tz`, as 'YYYY-MM-DD'. */
export function zonedDateKey(d: Date, tz: string): string {
  const p = partsInTz(tz, d)
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/**
 * UTC instant of local midnight at the START of the given calendar date
 * ('YYYY-MM-DD') in `tz`. Two offset iterations converge correctly across
 * DST boundaries.
 */
export function zonedDayStart(dateKey: string, tz: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number)
  let ts = Date.UTC(y, m - 1, d)
  for (let i = 0; i < 2; i++) {
    ts = Date.UTC(y, m - 1, d) - tzOffsetMs(tz, new Date(ts))
  }
  return new Date(ts)
}

/** UTC instant 1ms before local midnight of the NEXT day (inclusive end). */
export function zonedDayEnd(dateKey: string, tz: string): Date {
  return new Date(zonedDayStart(nextDayKey(dateKey), tz).getTime() - 1)
}

/** The calendar date key after 'YYYY-MM-DD' (pure string/UTC math). */
export function nextDayKey(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Inclusive list of day keys from `fromKey` to `toKey` ('YYYY-MM-DD'). */
export function dayKeyRange(fromKey: string, toKey: string): string[] {
  const keys: string[] = []
  let cursor = fromKey
  // Hard guard: never loop more than ~10 years.
  for (let i = 0; i < 3700 && cursor <= toKey; i++) {
    keys.push(cursor)
    cursor = nextDayKey(cursor)
  }
  return keys
}

/** Today's date key ('YYYY-MM-DD') in `tz`. */
export function todayKey(tz: string): string {
  return zonedDateKey(new Date(), tz)
}

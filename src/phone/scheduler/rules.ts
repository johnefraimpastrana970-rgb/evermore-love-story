import type { Reminder } from '../types';

/*
 * Recurrence and time-zone math for reminders. No libraries: uses Intl for zone offsets.
 *
 * A reminder is a wall-clock time ("08:00") on a local date, in a time zone:
 * - tz = ''      → "floating": follows whatever zone the device is in (8:00 stays 8:00 when travelling)
 * - tz = 'Area/City' → locked to that zone (8:00 Manila time wherever she is)
 * Daylight-saving gaps (a time that doesn't exist that night) move forward by the gap; repeated hours use the first.
 * Monthly reminders on the 29th–31st skip months without that day; yearly reminders on Feb 29 only fire in leap years.
 */

const DAY = 86_400_000;

export function deviceTz(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}
export const zoneOf = (r: Pick<Reminder, 'tz'>) => r.tz || deviceTz();

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    fmtCache.set(tz, f);
  }
  return f;
}

/** Wall-clock fields of an instant in a zone. */
export function wallClock(tz: string, ms: number) {
  const o: Record<string, number> = {};
  for (const p of fmt(tz).formatToParts(new Date(ms))) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return { y: o.year, m: o.month, d: o.day, h: o.hour === 24 ? 0 : o.hour, mi: o.minute, s: o.second };
}

/** Offset of a zone from UTC at an instant, in ms (Manila = +8h). */
export function tzOffset(tz: string, ms: number): number {
  const w = wallClock(tz, ms);
  return Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) - Math.floor(ms / 1000) * 1000;
}

/** The instant when a zone's clock shows y-m-d hh:mm. */
export function zonedToUtc(y: number, m: number, d: number, hh: number, mm: number, tz: string): number {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = tzOffset(tz, guess - tzOffset(tz, guess));
  let utc = guess - off1;
  const off2 = tzOffset(tz, utc);
  if (off2 !== off1) utc = guess - Math.min(off1, off2); // DST gap: jump forward (02:30 → 03:30)
  return utc;
}

// Calendar-day arithmetic on plain dates (no zone involved).
export const dayNum = (y: number, m: number, d: number) => Math.round(Date.UTC(y, m - 1, d) / DAY);
export function fromDayNum(n: number) {
  const t = new Date(n * DAY);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), dow: t.getUTCDay() };
}
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function parseDate(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}
export function parseTime(s: string) {
  const [h, mi] = s.split(':').map(Number);
  return { h: h || 0, mi: mi || 0 };
}
export function isValidReminder(r: Pick<Reminder, 'date' | 'time'>) {
  const { y, m, d } = parseDate(r.date);
  return /^\d{4}-\d{2}-\d{2}$/.test(r.date) && /^\d{2}:\d{2}$/.test(r.time) && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

/** All occurrence instants in [fromMs, toMs), oldest first. */
export function occurrences(r: Reminder, fromMs: number, toMs: number, limit = 1000): number[] {
  if (r.deleted || !r.enabled || !isValidReminder(r) || toMs <= fromMs) return [];
  const tz = zoneOf(r);
  const { y: Y, m: M, d: D } = parseDate(r.date);
  const { h, mi } = parseTime(r.time);
  const start = dayNum(Y, M, D);
  const f = wallClock(tz, fromMs);
  const fromDay = dayNum(f.y, f.m, f.d) - 1;
  const out: number[] = [];
  /** Returns false once past the range. */
  const at = (y: number, m: number, d: number) => {
    const t = zonedToUtc(y, m, d, h, mi, tz);
    if (t >= toMs) return false;
    if (t >= fromMs) out.push(t);
    return out.length < limit;
  };
  switch (r.repeat) {
    case 'none':
      at(Y, M, D);
      break;
    case 'daily':
    case 'weekdays':
      for (let n = Math.max(start, fromDay); ; n++) {
        const c = fromDayNum(n);
        if (r.repeat === 'weekdays' && (c.dow === 0 || c.dow === 6)) continue;
        if (!at(c.y, c.m, c.d)) break;
      }
      break;
    case 'weekly':
      for (let n = start + 7 * Math.max(0, Math.floor((fromDay - start) / 7)); ; n += 7) {
        const c = fromDayNum(n);
        if (!at(c.y, c.m, c.d)) break;
      }
      break;
    case 'monthly': {
      for (let k = Math.max(Y * 12 + M - 1, f.y * 12 + f.m - 2); ; k++) {
        const y = Math.floor(k / 12), m = (k % 12) + 1;
        if (D > daysInMonth(y, m)) continue;
        if (!at(y, m, D)) break;
      }
      break;
    }
    case 'yearly':
      for (let y = Math.max(Y, f.y - 1); ; y++) {
        if (M === 2 && D === 29 && !isLeap(y)) continue;
        if (!at(y, M, D)) break;
      }
      break;
  }
  return out;
}

/** The first occurrence strictly after `afterMs`, or null if there are no more. */
export function nextOccurrence(r: Reminder, afterMs: number): number | null {
  const horizon = (r.repeat === 'yearly' ? 1500 : 400) * DAY;
  if (r.repeat === 'none') {
    const t = occurrences(r, afterMs + 1, Number.MAX_SAFE_INTEGER, 1);
    return t[0] ?? null;
  }
  return occurrences(r, afterMs + 1, afterMs + horizon, 1)[0] ?? null;
}

export const REPEAT_LABEL: Record<Reminder['repeat'], string> = {
  none: 'Does not repeat', daily: 'Every day', weekdays: 'Every weekday', weekly: 'Every week', monthly: 'Every month', yearly: 'Every year',
};

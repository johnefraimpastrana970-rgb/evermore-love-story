import type { OccasionDef, OccasionRule } from '../content/types';

function mmdd(d: Date) {
  return (d.getMonth() + 1) * 100 + d.getDate();
}
function parseMMDD(s: string) {
  const [m, d] = s.split('-').map(Number);
  return m * 100 + d;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function lastDayOfMonth(y: number, m0: number) {
  return new Date(y, m0 + 1, 0).getDate();
}

export function ruleMatches(rule: OccasionRule, date: Date): boolean {
  switch (rule.type) {
    case 'manual':
      return false;
    case 'fixed': {
      const [y, m, d] = rule.date.split('-').map(Number);
      return sameDay(date, new Date(y, m - 1, d));
    }
    case 'yearly': {
      const dur = Math.max(1, rule.durationDays ?? 1);
      const lead = Math.max(0, rule.leadDays ?? 0);
      // Check this year's and last year's occurrence (for spans crossing New Year).
      for (const y of [date.getFullYear(), date.getFullYear() - 1, date.getFullYear() + 1]) {
        const start = new Date(y, rule.month - 1, rule.day - lead);
        const end = new Date(y, rule.month - 1, rule.day + dur - 1, 23, 59, 59);
        if (date >= start && date <= end) return true;
      }
      return false;
    }
    case 'monthly': {
      // Clamp e.g. day 31 to the last day of shorter months.
      const want = Math.min(rule.day, lastDayOfMonth(date.getFullYear(), date.getMonth()));
      return date.getDate() === want;
    }
    case 'range': {
      const v = mmdd(date), a = parseMMDD(rule.start), b = parseMMDD(rule.end);
      return a <= b ? v >= a && v <= b : v >= a || v <= b;
    }
    case 'nthWeekday': {
      if (date.getMonth() !== rule.month - 1 || date.getDay() !== rule.weekday) return false;
      if (rule.nth > 0) return Math.ceil(date.getDate() / 7) === rule.nth;
      return date.getDate() + 7 > lastDayOfMonth(date.getFullYear(), date.getMonth());
    }
  }
}

/** Active occasions, highest priority first. */
export function activeOccasions(defs: OccasionDef[], date: Date, manual: string[] = []): OccasionDef[] {
  return defs
    // Manual toggles force an occasion on (useful to preview a disabled template).
    .filter((o) => manual.includes(o.id) || (o.enabled && ruleMatches(o.rule, date)))
    .sort((a, b) => b.priority - a.priority);
}

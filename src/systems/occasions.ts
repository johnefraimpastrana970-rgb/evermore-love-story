import type { OccasionDef, OccasionRule } from '../content/types';
import { rng } from '../core/rng';

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

/** Active occasions for the device's real local date, highest priority first. */
export function activeOccasions(defs: OccasionDef[], date: Date): OccasionDef[] {
  return defs
    .filter((o) => o.enabled && !o.placeholder && ruleMatches(o.rule, date))
    .sort((a, b) => b.priority - a.priority);
}

const THEME_VARIANTS: Record<string, OccasionDef['theme'][]> = {
  valentines: [
    { tint: 0xffc8d8, decorations: ['hearts', 'petals', 'lights'], music: 'festive' },
    { tint: 0xffd9c8, decorations: ['hearts', 'balloons'], music: 'cozy' },
    { tint: 0xe9d2ff, decorations: ['petals', 'lights'], music: 'outdoor' },
  ],
  christmas: [
    { tint: 0xd8ecff, decorations: ['snow', 'lights'], music: 'festive' },
    { tint: 0xd8f0df, decorations: ['snow', 'lights'], music: 'cozy' },
    { tint: 0xffe6c9, decorations: ['lights', 'snow'], music: 'night' },
  ],
  newyear: [
    { tint: 0xfff2d0, decorations: ['confetti', 'lights'], music: 'festive' },
    { tint: 0xd6e8ff, decorations: ['confetti', 'balloons'], music: 'outdoor' },
    { tint: 0xf9d6ec, decorations: ['confetti', 'lights', 'hearts'], music: 'cozy' },
  ],
  halloween: [
    { tint: 0xffd6b0, decorations: ['pumpkins', 'lights'], music: 'night' },
    { tint: 0xe8d9ff, decorations: ['pumpkins', 'confetti'], music: 'outdoor' },
    { tint: 0xf2e5bf, decorations: ['pumpkins', 'lights'], music: 'cozy' },
  ],
  'just-because': [
    { tint: 0xffe6f0, decorations: ['hearts', 'balloons'], music: 'festive' },
    { tint: 0xe1f4ff, decorations: ['petals', 'lights'], music: 'outdoor' },
    { tint: 0xfff0cf, decorations: ['hearts', 'confetti'], music: 'cozy' },
  ],
  anniversary: [
    { tint: 0xffd0e0, decorations: ['hearts', 'lights', 'petals'], music: 'festive' },
    { tint: 0xf4d8ff, decorations: ['hearts', 'balloons'], music: 'cozy' },
    { tint: 0xffe6c9, decorations: ['petals', 'lights'], music: 'outdoor' },
  ],
  'her-birthday': [
    { tint: 0xfff0c8, decorations: ['balloons', 'confetti', 'lights'], music: 'festive' },
    { tint: 0xf9d9ff, decorations: ['balloons', 'hearts'], music: 'cozy' },
    { tint: 0xd8efff, decorations: ['confetti', 'lights'], music: 'outdoor' },
  ],
  'his-birthday': [
    { tint: 0xd8e8ff, decorations: ['balloons', 'confetti'], music: 'festive' },
    { tint: 0xd8f0df, decorations: ['balloons', 'lights'], music: 'outdoor' },
    { tint: 0xffe6c9, decorations: ['confetti', 'hearts'], music: 'cozy' },
  ],
  monthsary: [
    { tint: 0xffe0ea, decorations: ['hearts', 'petals'], music: 'festive' },
    { tint: 0xe1f4ff, decorations: ['hearts', 'lights'], music: 'cozy' },
    { tint: 0xfff0cf, decorations: ['petals', 'balloons'], music: 'outdoor' },
  ],
};

/** Pick one stable, locally varied atmosphere for this occasion and calendar day. */
export function occasionThemeForDay(occasion: OccasionDef, date: Date): OccasionDef['theme'] {
  const variants = THEME_VARIANTS[occasion.id];
  if (!variants?.length) return occasion.theme;
  const key = `${occasion.id}:${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const variant = rng(key).pick(variants);
  return { ...occasion.theme, ...variant, banner: occasion.theme.banner };
}

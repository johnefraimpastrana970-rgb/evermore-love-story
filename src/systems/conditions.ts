import type { Condition, LocationId, TimeOfDay } from '../content/types';
import type { GameState } from '../core/state';

export interface CondCtx {
  state: GameState;
  time: TimeOfDay;
  occasions: string[];
  location: LocationId;
  day: string;
}

/** Replace {day} in flag names so flags can be once-per-day. */
export function dayFlag(name: string, day: string) {
  return name.replace(/\{day\}/g, day);
}

export function checkCondition(c: Condition | undefined, ctx: CondCtx): boolean {
  if (!c) return true;
  const s = ctx.state;
  if (c.minLevel !== undefined && s.level < c.minLevel) return false;
  if (c.maxLevel !== undefined && s.level > c.maxLevel) return false;
  if (c.flag && !s.flags[dayFlag(c.flag, ctx.day)]) return false;
  if (c.notFlag && s.flags[dayFlag(c.notFlag, ctx.day)]) return false;
  if (c.time && !c.time.includes(ctx.time)) return false;
  if (c.occasion) {
    if (c.occasion === '*' ? ctx.occasions.length === 0 : !ctx.occasions.includes(c.occasion)) return false;
  }
  if (c.location && c.location !== ctx.location) return false;
  if (c.questDone && !s.quests.completed[c.questDone]) return false;
  if (c.questActive && !s.quests.active[c.questActive]) return false;
  if (c.minAffection !== undefined && s.affection < c.minAffection) return false;
  if (c.secret && !s.secrets[c.secret]) return false;
  if (c.achievement && !s.achievements[c.achievement]) return false;
  if (c.chance !== undefined && Math.random() > c.chance) return false;
  return true;
}

/** First variant whose condition passes, preferring the most specific (last matching wins for overrides). */
export function pickVariant<T extends { if?: Condition }>(variants: T[], ctx: CondCtx): T | undefined {
  // Variants with conditions take priority over unconditional ones.
  const conditional = variants.filter((v) => v.if && checkCondition(v.if, ctx));
  if (conditional.length) return conditional[conditional.length - 1];
  return variants.find((v) => !v.if);
}

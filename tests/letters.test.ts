import { describe, expect, it } from 'vitest';
import { LETTERS, fillLetter, letterFacts } from '../src/content/letters';
import { ACHIEVEMENTS } from '../src/content/achievements';
import { PERSONAL } from '../src/content/personal';
import { defaultState } from '../src/core/state';
import { checkCondition } from '../src/systems/conditions';

describe('letters', () => {
  it('every achievement sends its own letter', () => {
    for (const a of ACHIEVEMENTS) {
      const mine = LETTERS.filter((l) => l.unlock?.achievement === a.id);
      expect(mine.length, a.id).toBe(1);
    }
    for (const l of LETTERS) if (l.unlock?.achievement) expect(ACHIEVEMENTS.some((a) => a.id === l.unlock!.achievement), l.id).toBe(true);
  });

  it('every letter is different, finished, and signed by him', () => {
    expect(new Set(LETTERS.map((l) => l.id)).size).toBe(LETTERS.length);
    expect(new Set(LETTERS.map((l) => l.title)).size).toBe(LETTERS.length);
    expect(new Set(LETTERS.map((l) => l.body)).size).toBe(LETTERS.length);
    for (const l of LETTERS) {
      expect(l.placeholder, l.id).toBeFalsy();
      expect(l.body, l.id).not.toMatch(/[⟦⟧]/);
      expect(l.body, l.id).toContain('{him}');
      expect(l.body!.length, l.id).toBeGreaterThan(120);
    }
    // They replace the old templates in the game.
    expect(PERSONAL.filter((p) => p.kind === 'letter' && p.placeholder)).toEqual([]);
  });

  it('only uses facts the game knows, and fills them from her game', () => {
    const s = defaultState();
    s.level = 7; s.stats.collected = 123; s.stats.hugs = 9; s.daily.bestStreak = 4;
    const facts = letterFacts(s, new Date(2026, 10, 13));
    for (const l of LETTERS) {
      const filled = fillLetter(l.body!, facts).replace(/\{(her|him)\}/g, '');
      expect(filled, l.id).not.toMatch(/\{\w+\}/);
    }
    expect(fillLetter('{charms} charms, {hugs} hugs, level {level}, {her}', facts)).toBe('123 charms, 9 hugs, level 7, {her}');
  });

  it('a letter arrives with its achievement, not before', () => {
    const s = defaultState();
    const l = LETTERS.find((x) => x.unlock?.achievement === 'hug-25')!;
    const ctx = { state: s, time: 'day' as const, occasions: [], location: 'bedroom' as const, day: '2026-11-13' };
    expect(checkCondition(l.unlock, ctx)).toBe(false);
    s.achievements['hug-25'] = Date.now();
    expect(checkCondition(l.unlock, ctx)).toBe(true);
  });
});

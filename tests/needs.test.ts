import { describe, expect, it } from 'vitest';
import { defaultState, migrate, SAVE_VERSION } from '../src/core/state';
import { drainHunger, restoreHunger } from '../src/systems/needs';

describe('character needs', () => {
  it('starts full and only drains by elapsed active play time', () => {
    const state = defaultState();
    expect(state.hunger).toBe(100);
    expect(drainHunger(state, 30)).toBeCloseTo(99);
    expect(drainHunger(state, -10)).toBeCloseTo(99);
  });

  it('clamps hunger at zero and meals restore no more than full', () => {
    const state = defaultState();
    state.hunger = 1;
    expect(drainHunger(state, 300)).toBe(0);
    expect(restoreHunger(state, 45)).toBe(45);
    expect(restoreHunger(state, 100)).toBe(100);
  });

  it('adds hunger to old saves and repairs invalid saved values', () => {
    expect(migrate({ version: SAVE_VERSION - 1 }).hunger).toBe(100);
    expect(migrate({ version: SAVE_VERSION, hunger: -10 }).hunger).toBe(0);
    expect(migrate({ version: SAVE_VERSION, hunger: 150 }).hunger).toBe(100);
    expect(migrate({ version: SAVE_VERSION, hunger: 'hungry' }).hunger).toBe(100);
  });
});

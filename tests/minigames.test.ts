import { afterEach, describe, expect, it } from 'vitest';
import { defaultState } from '../src/core/state';
import { store } from '../src/core/store';
import { minigameResult } from '../src/systems/game';

afterEach(() => store.unload());

describe('backyard grill activities', () => {
  it.each(['grill-flip', 'skewer-memory'] as const)('%s awards normal minigame XP and tokens', (id) => {
    const state = defaultState();
    store.load(state);

    const result = minigameResult(id, 80);

    expect(result.xp).toBe(97);
    expect(result.tokens).toBe(11);
    expect(state.xp).toBe(97);
    expect(state.minigameBest[id]).toBe(80);
    expect(state.stats[`mg-${id}`]).toBe(1);
  });
});

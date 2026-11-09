import type { GameState } from '../core/state';

export const HUNGER_DRAIN_PER_SECOND = 1 / 30;
export const MEAL_HUNGER_RESTORE = 45;

/** Hunger only drains for seconds actually spent playing. */
export function drainHunger(state: Pick<GameState, 'hunger'>, seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return state.hunger;
  state.hunger = Math.max(0, Math.min(100, state.hunger - seconds * HUNGER_DRAIN_PER_SECOND));
  return state.hunger;
}

export function restoreHunger(state: Pick<GameState, 'hunger'>, amount = MEAL_HUNGER_RESTORE): number {
  state.hunger = Math.max(0, Math.min(100, state.hunger + amount));
  return state.hunger;
}

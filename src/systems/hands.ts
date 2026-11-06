import { bus } from '../core/events';

/*
 * Holding hands: her choice, toggled with the 🤝 button (or H). It stays on between rooms until she lets go,
 * and is not saved (each session starts with free hands).
 */
let holding = false;

export const isHoldingHands = () => holding;

export function setHoldingHands(on: boolean) {
  if (holding === on) return;
  holding = on;
  bus.emit('hands', on);
}

export const toggleHands = () => setHoldingHands(!holding);

import { store } from '../core/store';
import { bus } from '../core/events';
import { toast } from '../systems/game';
import { playDialogue } from '../ui/dialogue';
import { START_COINS, UNLOCK_LEVEL, sk } from './logic';

/** Unlock the pizza shop the first time she reaches UNLOCK_LEVEL (also for saves that were already past it). */
export function checkPizzaUnlock() {
  if (!store.hasGame) return;
  const s = store.state;
  if (s.level < UNLOCK_LEVEL || s.flags['pizza-gift']) return;
  s.flags['pizza-gift'] = true;
  s.pizza.unlocked = true;
  s.pizza.coins += START_COINS;
  // A small starter pantry: enough for a couple of cheese pizzas.
  for (const k of ['dough', 'tomato', 'mozzarella', 'box'] as const) s.pizza.stock[sk(k, 1)] = (s.pizza.stock[sk(k, 1)] ?? 0) + 2;
  store.save();
  void playDialogue({
    lines: [
      { speaker: 'him', text: '{her}! Close your eyes. …Okay, open them.', mood: 'happy' },
      { speaker: 'him', text: 'The little pizza shop in town needed a new owner. So… it’s ours now. Our own pizza shop ♡', mood: 'cute' },
      { speaker: 'her', text: 'Wait, really?!', mood: 'surprised' },
      { speaker: 'him', text: 'I saved up some coins for ingredients. You cook, I carry boxes. Deal?', mood: 'laughing' },
      { speaker: 'narrator', text: 'Open the Pizza Shop and the Market from the Map.' },
    ],
  }).then(() => toast('Pizza Shop unlocked! 🍕', 'heart', 'good'));
}

export function initPizza() {
  bus.on('world-ready', checkPizzaUnlock);
  bus.on('levelup', (e: { level: number }) => { if (e.level >= UNLOCK_LEVEL) setTimeout(checkPizzaUnlock, 600); });
}

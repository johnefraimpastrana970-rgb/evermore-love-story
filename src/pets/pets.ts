import { store } from '../core/store';
import { bus } from '../core/events';
import { audio } from '../audio/audio';
import { toast, giveItem, gainXp, bumpStat, afterChange } from '../systems/game';
import { playDialogue } from '../ui/dialogue';
import { LOCATIONS } from '../content/locations';
import { ITEMS } from '../content/items';
import { PET_ROOMS, STRAY_LEVEL } from './data';
import { maybeStray, rollGifts, takeGift, tickAll } from './logic';
import { partnerAway } from '../work/work';
import type { LocationId } from '../content/types';

/*
 * Pets at runtime: needs catch up with real time, pets leave gifts while she's away, and from level 3 a stray
 * cat starts visiting the backyard (he brings home some cat food the first time).
 */

const widths = Object.fromEntries(PET_ROOMS.map((r) => [r, LOCATIONS[r].width])) as Partial<Record<LocationId, number>>;

export function runPetsPass(now = Date.now()) {
  if (!store.hasGame) return;
  const s = store.state;
  tickAll(s.pets, now);
  const fresh = rollGifts(s.pets, now, widths);
  if (fresh.length) bus.emit('pets:gifts');
  const stray = maybeStray(s.pets, s.level, now);
  if (stray) void strayIntro();
}

async function strayIntro() {
  const s = store.state;
  // A little cat food to start with.
  s.pets.food['kibble-cat'] = (s.pets.food['kibble-cat'] ?? 0) + 3;
  s.pets.food.fish = (s.pets.food.fish ?? 0) + 2;
  store.save();
  const wait = () => new Promise<void>((r) => { const t = setInterval(() => { if (!store.blocked) { clearInterval(t); r(); } }, 800); });
  await wait();
  await playDialogue({ lines: partnerAway() ? [
    { speaker: 'narrator', text: 'Something small and orange is peeking over the backyard fence… A cat! There’s a bag of cat food by the back door, as if someone planned for this.' },
  ] : [
    { speaker: 'him', text: '{her}! Don’t move… there’s a little cat in our backyard.', mood: 'surprised' },
    { speaker: 'him', text: 'It’s been coming every day. I, um… may have bought cat food. Just in case ♡', mood: 'shy' },
    { speaker: 'narrator', text: 'Go to the backyard and gently feed the stray. If it trusts you, maybe it will stay.' },
  ] });
  toast('A stray cat is visiting the backyard 🐈', 'heart', 'good');
  bus.emit('pets:changed');
}

/** She picked up something a pet left on the floor. */
export function collectGift(id: string) {
  const s = store.state;
  const g = takeGift(s.pets, id);
  if (!g) return;
  const from = s.pets.list.find((p) => p.id === g.gift.from)?.name ?? 'Your pet';
  if (g.def.tokens) s.tokens += g.def.tokens;
  if (g.def.item && ITEMS[g.def.item]) giveItem(g.def.item);
  audio.sfx('collect');
  toast(`${from} left you ${store.fmt(g.def.name)} ${g.def.emoji}${g.def.tokens ? ` +${g.def.tokens}` : ''}`, 'heart', 'good');
  bumpStat('pet-gifts');
  gainXp(5, 'pet');
  afterChange();
  store.save();
}

let timer: number | undefined;
export function initPets() {
  bus.on('world-ready', () => setTimeout(() => runPetsPass(), 2500));
  bus.on('levelup', (e: { level: number }) => { if (e.level >= STRAY_LEVEL) setTimeout(() => runPetsPass(), 1500); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(() => runPetsPass(), 1000); });
  clearInterval(timer);
  timer = window.setInterval(() => { if (store.hasGame) runPetsPass(); }, 30_000);
}

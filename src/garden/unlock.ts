import { store } from '../core/store';
import { bus } from '../core/events';
import { toast, setFlag, afterChange } from '../systems/game';
import { playDialogue } from '../ui/dialogue';
import { PERSONAL } from '../content/personal';
import { AUTHORED, parseScene, type SceneLine } from '../content/authored';
import { COSMETICS } from '../content/cosmetics';
import { deliver } from '../phone/scheduler/scheduler';
import { GARDEN_DECOR, UNLOCK_LEVEL, bloomFlag, plantDef, type SpecialDef } from './data';
import { giveStarterSeeds, newlyReady } from './logic';

export const gardenUnlocked = () => store.hasGame && store.state.garden.unlocked;
let retry: number | undefined;

/** Unlock the garden the first time she reaches UNLOCK_LEVEL (also for saves already past it). */
export function checkGardenUnlock() {
  if (!store.hasGame) return;
  const s = store.state;
  if (s.level < UNLOCK_LEVEL || s.flags['garden-gift']) return;
  // Wait for any open dialogue / level-up card / pizza scene, so she never misses this one.
  if (store.blocked) { clearTimeout(retry); retry = window.setTimeout(checkGardenUnlock, 1500); return; }
  s.flags['garden-gift'] = true;
  giveStarterSeeds(s.garden);
  store.save();
  void playDialogue({
    lines: [
      { speaker: 'him', text: '{her}, come out to the backyard for a second?', mood: 'happy' },
      { speaker: 'him', text: 'I dug up the old flower bed and made it bigger. Four little plots… one for every season of us ♡', mood: 'cute' },
      { speaker: 'her', text: 'You made us a garden?!', mood: 'surprised' },
      { speaker: 'him', text: 'I got us some seeds too. Whatever we grow, we can sell at a little stall, or… you could make me a bouquet. Just saying.', mood: 'laughing' },
      { speaker: 'narrator', text: 'Tap the Flower Bed in the backyard (or Garden on the Map) to start growing. Plants keep growing even while you’re away.' },
    ],
  }).then(() => toast('Garden unlocked! 🌷', 'heart', 'good'));
}

// ------------------------------------------------------------------ first blooms

export interface BloomResult {
  scene: SceneLine[];
  /** Personal entries (letters, photos…) that opened because of this bloom. */
  entries: { id: string; title: string; kind: string }[];
  cosmetics: string[];
  decor: string[];
  coins: number;
}

/**
 * Play the rewards of a special plant's first bloom: set its flag (letters/photos written for it in the Author tool
 * unlock through the usual journal rules), give outfits, and return the scene to show.
 */
export function bloomRewards(sp: SpecialDef): BloomResult {
  const s = store.state;
  const before = new Set(Object.keys(s.unlocked));
  setFlag(bloomFlag(sp.id));
  const cosmetics: string[] = [];
  for (const id of sp.reward.cosmetic ?? []) {
    if (COSMETICS.some((c) => c.id === id) && !s.cosmetics.owned.includes(id)) { s.cosmetics.owned.push(id); cosmetics.push(id); }
  }
  afterChange();
  const entries = PERSONAL.filter((e) => s.unlocked[e.id] && !before.has(e.id)).map((e) => ({ id: e.id, title: store.fmtLiteral(e.title), kind: e.kind }));
  const written = AUTHORED.garden[sp.id]?.scene;
  const scene: SceneLine[] = written ? parseScene(written) : [{ speaker: 'him', text: sp.line }];
  return {
    scene, entries, cosmetics,
    decor: sp.reward.decor && GARDEN_DECOR.some((d) => d.id === sp.reward.decor) ? [sp.reward.decor] : [],
    coins: sp.reward.coins ?? 0,
  };
}

// ------------------------------------------------------------------ "ready to pick" notifications

let gardenOnScreen = false;
/** The garden screen tells us when it is open, so it can announce ready plants itself. */
export function setGardenOnScreen(v: boolean) { gardenOnScreen = v; }

const pickLine = (n: number, first: string) => {
  const name = plantDef(first)?.name ?? 'Something';
  const emoji = plantDef(first)?.emoji ?? '🌷';
  if (n === 1) return [`Your ${name.toLowerCase()} ${plantDef(first)?.kind === 'flower' || plantDef(first)?.kind === 'special' ? 'bloomed' : 'are ready'} ${emoji} Come pick ${plantDef(first)?.kind === 'special' ? 'it' : 'them'}?`,
    `Psst… the ${name.toLowerCase()} are ready in our garden ${emoji}`];
  return [`${n} things are ready in our garden ${emoji} I didn’t pick any, I promise.`, `The garden is full of surprises today: ${n} plants are ready ${emoji}`];
};

/** Check for newly ready plants. Off-screen, one message from him covers all of them. */
export function runGardenPass(now = Date.now()): { plot: number; plantId: string }[] {
  if (!gardenUnlocked()) return [];
  const g = store.state.garden;
  const ready = newlyReady(g, now);
  if (!ready.length) return ready;
  if (gardenOnScreen) { bus.emit('garden:ready', ready); store.save(); return ready; }
  const lines = pickLine(ready.length, ready[0].plantId);
  const special = ready.find((r) => plantDef(r.plantId)?.kind === 'special');
  const text = store.fmt(special ? `Something special is blooming in our garden ✨ Come see?` : lines[now % lines.length]);
  const d = deliver(text, now, 'garden', ready.map((r) => r.plot).join(','), 'Garden', 'chat');
  store.save();
  bus.emit('phone:notify', [d]);
  return ready;
}

let timer: number | undefined;
export function initGarden() {
  let ready = false;
  const run = () => { if (ready && store.hasGame && !store.blocked) runGardenPass(); };
  bus.on('world-ready', () => { ready = true; checkGardenUnlock(); setTimeout(run, 4000); });
  bus.on('to-title', () => { ready = false; });
  bus.on('levelup', (e: { level: number }) => { if (e.level >= UNLOCK_LEVEL) setTimeout(checkGardenUnlock, 900); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(run, 1500); });
  clearInterval(timer);
  timer = window.setInterval(() => { if (ready && store.hasGame && (gardenOnScreen || !store.blocked)) runGardenPass(); }, 15_000);
}

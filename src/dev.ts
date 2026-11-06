import { store } from './core/store';
import { bus } from './core/events';
import { gainXp, toast } from './systems/game';
import { xpToNext } from './systems/progression';

/*
 * Developer shortcuts, only while running `npm run dev` (never in a build, so they can't reach her phone).
 *   ?level=25   level the loaded story up to 25 the normal way (earned XP), so every level reward and unlock happens
 */
export function initDev() {
  if (!import.meta.env.DEV) return;
  const params = new URLSearchParams(location.search);
  const target = Number(params.get('level'));
  if (!Number.isInteger(target) || target < 2) return;
  const off = bus.on('world-ready', () => {
    off();
    const s = store.state;
    if (target <= s.level) { toast(`Already level ${s.level}`, 'heart'); return; }
    let need = -s.xp;
    for (let l = s.level; l < target; l++) need += xpToNext(l);
    gainXp(need, 'dev');
    store.save();
    toast(`Dev: now level ${s.level} ✨`, 'sparkle', 'good');
    // Drop the parameter so a reload doesn't do it again.
    params.delete('level');
    history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
  });
}

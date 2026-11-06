import { store } from '../../core/store';
import { bus } from '../../core/events';
import { el, esc } from '../../ui/dom';
import { applyEffects, bumpStat, toast } from '../../systems/game';

/** In-phone confirm sheet (never a browser dialog). */
export function confirmSheet(host: HTMLElement, text: string, ok = 'Delete', danger = true): Promise<boolean> {
  return new Promise((resolve) => {
    const sheet = el('div', 'ph-sheet', `<div class="ph-sheet-card"><p>${esc(text)}</p>
      <div class="ph-row-btns"><button class="ph-btn ghost" data-no>Cancel</button><button class="ph-btn ${danger ? 'danger' : ''}" data-ok>${esc(ok)}</button></div></div>`);
    const root = host.closest('.ph-screen') ?? host;
    root.appendChild(sheet);
    const done = (v: boolean) => { sheet.remove(); resolve(v); };
    sheet.querySelector('[data-no]')!.addEventListener('click', () => done(false));
    sheet.querySelector('[data-ok]')!.addEventListener('click', () => done(true));
    sheet.addEventListener('click', (e) => { if (e.target === sheet) done(false); });
  });
}

export function changed() {
  store.state.updatedAt = Date.now();
  bus.emit('phone');
}

export function timeLabel(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** "Today", "Yesterday", "Mon", or "Nov 3". */
export function dayLabel(ms: number) {
  const d = new Date(ms), now = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

const DAILY_CAP = 30;
/** Small heart-token reward for the phone games, capped per day so it stays a treat. */
export function gameReward(game: string, score: number, perToken: number) {
  const s = store.state;
  const best = s.phone.bests[game] ?? 0;
  const isBest = score > best;
  if (isBest) s.phone.bests[game] = score;
  bumpStat(`phone-${game}`);
  const key = `phone-tokens-${store.today()}`;
  const got = s.stats[key] ?? 0;
  const amount = Math.max(0, Math.min(10, Math.floor(score / perToken), DAILY_CAP - got));
  if (amount > 0) {
    s.stats[key] = got + amount;
    applyEffects([{ type: 'tokens', amount }]);
    toast(`+${amount} heart tokens`, 'coin', 'good');
  }
  store.save();
  return { isBest, best: Math.max(best, score), amount };
}

import { bus } from '../core/events';
import { iconURL } from '../art/icons';
import { el, esc, uiRoot } from './dom';
import { audio } from '../audio/audio';

let host: HTMLElement;
const queue: { text: string; icon: string; kind: string }[] = [];
let showing = 0;

export function initToasts() {
  host = el('div', 'toasts');
  uiRoot().appendChild(host);
  bus.on('toast', (t) => {
    queue.push(t);
    pump();
  });
  bus.on('xp', ({ amount }) => floatXp(amount));
}

function pump() {
  while (showing < 3 && queue.length) {
    const t = queue.shift()!;
    showing++;
    const node = el('div', `toast toast-${t.kind}`, `<img src="${iconURL(t.icon, 48)}" alt=""><span>${esc(t.text)}</span>`);
    host.appendChild(node);
    if (t.kind === 'ach') audio.sfx('achievement');
    else if (t.kind === 'quest') audio.sfx('quest');
    requestAnimationFrame(() => node.classList.add('in'));
    setTimeout(() => {
      node.classList.remove('in');
      node.classList.add('out');
      setTimeout(() => {
        node.remove();
        showing--;
        pump();
      }, 400);
    }, t.kind === 'ach' ? 3800 : 2600);
  }
}

let xpAcc = 0;
let xpTimer: number | undefined;
function floatXp(amount: number) {
  xpAcc += amount;
  if (xpTimer) return;
  xpTimer = window.setTimeout(() => {
    const badge = document.querySelector('.hud-level');
    if (badge) {
      const f = el('div', 'xp-float', `+${Math.round(xpAcc)} XP`);
      badge.appendChild(f);
      setTimeout(() => f.remove(), 1400);
    }
    xpAcc = 0;
    xpTimer = undefined;
  }, 120);
}

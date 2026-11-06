import { store } from '../core/store';
import { bus } from '../core/events';
import { audio } from '../audio/audio';
import { el, esc, uiRoot } from '../ui/dom';
import { isPhoneOpen, navigate, openPhone, partnerAvatar } from './phone';
import type { Delivery } from './scheduler/scheduler';

/*
 * In-game notification banner: slides down from the top like a phone notification.
 * Tap it to open the conversation (or the reminder); swipe it up or wait to dismiss.
 * Several deliveries at once are shown one after another.
 */

let host: HTMLElement;
const queue: Delivery[] = [];
let showing = false;

export function initBanner() {
  host = el('div', 'ph-banner-host');
  uiRoot().appendChild(host);
  bus.on('phone:notify', (list: Delivery[]) => { queue.push(...list); void pump(); });
}

async function pump() {
  if (showing) return;
  const d = queue.shift();
  if (!d) return;
  showing = true;
  // Already reading the chat? Just a soft sound.
  const inChat = isPhoneOpen() && document.querySelector('.app[data-app=messages] .chat');
  audio.sfx(d.log.source === 'reminder' ? 'quest' : 'heart');
  if (!inChat) await show(d);
  showing = false;
  void pump();
}

function show(d: Delivery): Promise<void> {
  return new Promise((resolve) => {
    const reminder = d.log.source === 'reminder';
    const b = el('button', `ph-banner ${reminder ? 'is-reminder' : ''}`, `
      <img src="${partnerAvatar()}" alt="">
      <span><b>${esc(store.partnerName())}${reminder ? ' · 🔔 Reminder' : d.log.source === 'garden' ? ' · 🌷 Garden' : ''}</b><small>${esc(d.message.text.split('\n')[0])}</small></span>
      <time>now</time>`);
    b.setAttribute('aria-live', 'polite');
    host.appendChild(b);
    requestAnimationFrame(() => b.classList.add('in'));
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      clearTimeout(t);
      b.classList.remove('in');
      setTimeout(() => { b.remove(); resolve(); }, 280);
    };
    const t = window.setTimeout(close, 5200);
    let sy = 0;
    b.addEventListener('pointerdown', (e) => { sy = e.clientY; });
    b.addEventListener('pointerup', (e) => {
      if (sy - e.clientY > 25) { close(); return; } // swiped up
      d.log.opened = Date.now();
      const route = d.log.source === 'garden' ? 'garden' : 'messages';
      if (isPhoneOpen()) navigate(route);
      else if (!store.blocked) openPhone(route);
      close();
    });
  });
}

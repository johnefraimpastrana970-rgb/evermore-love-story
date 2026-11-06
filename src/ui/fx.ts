import { store } from '../core/store';
import { bus } from '../core/events';

/*
 * Shared interaction feedback for every button-like element:
 *  - ripple from the exact tap/click point
 *  - springy press (works on touch, not just hover)
 *  - tiny haptic tick on phones (Android / Capacitor)
 *  - heart bursts for rewarding actions
 */

const INTERACTIVE = [
  'button', '.entry', '.swatch', '.inv-slot', '.pin-loc', '.mood-btn', '.tab', '.nav-btn', '.slot-btn', '.mbtn',
  '.dlg-choice', '.mem-card', '.tile', '.slide-tile', '.hud-quest', '.hud-level', '.prompt', '.joy-act',
].join(',');

function reduced() {
  return store.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function target(e: Event): HTMLElement | null {
  const el = (e.target as HTMLElement | null)?.closest?.(INTERACTIVE) as HTMLElement | null;
  if (!el || (el as HTMLButtonElement).disabled || el.classList.contains('locked')) return null;
  return el;
}

function ripple(el: HTMLElement, x: number, y: number) {
  if (reduced()) return;
  const cs = getComputedStyle(el);
  if (cs.position === 'static') el.style.position = 'relative';
  let wrap = el.querySelector(':scope > .rpl-wrap') as HTMLElement | null;
  if (!wrap) {
    wrap = document.createElement('span');
    wrap.className = 'rpl-wrap';
    el.appendChild(wrap);
  }
  const r = el.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * 2.2;
  const dot = document.createElement('span');
  dot.className = 'rpl';
  dot.style.width = dot.style.height = `${size}px`;
  dot.style.left = `${x - r.left - size / 2}px`;
  dot.style.top = `${y - r.top - size / 2}px`;
  wrap.appendChild(dot);
  setTimeout(() => dot.remove(), 650);
}

function haptic(ms = 8) {
  try { navigator.vibrate?.(ms); } catch { /* not supported */ }
}

export function initFx() {
  let pressed: HTMLElement | null = null;
  const release = () => {
    if (!pressed) return;
    const el = pressed;
    pressed = null;
    el.classList.remove('pressed');
    if (!reduced()) {
      el.classList.remove('released');
      void el.offsetWidth;
      el.classList.add('released');
      setTimeout(() => el.classList.remove('released'), 420);
    }
  };
  document.addEventListener('pointerdown', (e) => {
    const el = target(e);
    if (!el) return;
    pressed = el;
    el.classList.add('pressed');
    ripple(el, e.clientX, e.clientY);
    if (e.pointerType === 'touch') haptic();
  }, true);
  document.addEventListener('pointerup', release, true);
  document.addEventListener('pointercancel', release, true);
  document.addEventListener('pointerleave', release, true);
  // Keyboard activation gets the same feedback.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = document.activeElement as HTMLElement | null;
    if (!el || !el.matches?.(INTERACTIVE)) return;
    const r = el.getBoundingClientRect();
    ripple(el, r.left + r.width / 2, r.top + r.height / 2);
  }, true);

  // The HUD is covered while dialogue / windows are open – show that it's inactive.
  bus.on('blocking', (n: number) => document.querySelector('.hud')?.classList.toggle('blocked', n > 0));
}

/** Little hearts flying out of an element – for gifts, purchases, completed challenges… */
export function burstHearts(el: Element | null, count = 8, glyph = '♥') {
  if (!el || reduced()) return;
  const r = el.getBoundingClientRect();
  const host = document.getElementById('ui')!;
  for (let i = 0; i < count; i++) {
    const h = document.createElement('span');
    h.className = 'fx-heart';
    h.textContent = glyph;
    const ang = (-90 + (Math.random() - 0.5) * 150) * (Math.PI / 180);
    const dist = 50 + Math.random() * 60;
    h.style.left = `${r.left + r.width / 2}px`;
    h.style.top = `${r.top + r.height / 2}px`;
    h.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
    h.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
    h.style.setProperty('--rot', `${(Math.random() - 0.5) * 60}deg`);
    h.style.animationDelay = `${i * 22}ms`;
    h.style.fontSize = `${14 + Math.random() * 12}px`;
    host.appendChild(h);
    setTimeout(() => h.remove(), 1100 + i * 22);
  }
}

/** Mark freshly opened containers so their items animate in once (not on every re-render). */
export function freshen(el: HTMLElement, ms = 700) {
  if (reduced()) return;
  el.classList.add('fresh');
  setTimeout(() => el.classList.remove('fresh'), ms);
}

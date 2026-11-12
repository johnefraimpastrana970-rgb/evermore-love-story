import { store } from '../core/store';
import { bus } from '../core/events';
import { el, isTouch, uiRoot } from './dom';

let root: HTMLElement;
let release: () => void = () => {};

/** A tiny tap of the phone's vibration motor, where there is one (Android); silently nothing elsewhere. */
export function haptic(ms = 8) {
  try { if (!store.settings.reducedMotion) navigator.vibrate?.(ms); } catch { /* not supported */ }
}

/**
 * On-screen joystick + action button for touch devices.
 * The joystick listens on a bigger invisible pad around the ring (a thumb that lands a little off still steers),
 * tracks one finger by pointer id (so the other thumb can press the action button at the same time), and lets go
 * cleanly whenever it loses that finger: lifted, cancelled, or the controls hidden by a dialogue mid-drag.
 */
export function initJoystick() {
  root = el('div', 'touch-controls hidden');
  root.innerHTML = `<div class="joy-pad"><div class="joy"><i class="joy-dir"></i><div class="joy-knob"></div></div></div>
    <button class="joy-act" aria-label="Interact"><span class="joy-ico">♥</span></button>`;
  uiRoot().appendChild(root);
  const pad = root.querySelector('.joy-pad') as HTMLElement;
  const base = root.querySelector('.joy') as HTMLElement;
  const knob = root.querySelector('.joy-knob') as HTMLElement;
  const dir = root.querySelector('.joy-dir') as HTMLElement;
  let id: number | null = null;
  const R = 46;
  const move = (e: PointerEvent) => {
    const r = base.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    const nx = d ? dx / d : 0, ny = d ? dy / d : 0; // direction (before the knob is held inside the ring)
    if (d > R) { dx = nx * R; dy = ny * R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    // A small dead zone, then the full range (so a gentle push already walks, a full push runs).
    const m = Math.min(1, d / R);
    const live = m < 0.14 ? 0 : (m - 0.14) / 0.86;
    store.joy.x = nx * live;
    store.joy.y = ny * live;
    dir.style.opacity = String(live * 0.9);
    dir.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
  };
  release = () => {
    id = null;
    base.classList.remove('held');
    knob.style.transform = '';
    dir.style.opacity = '0';
    store.joy.x = 0;
    store.joy.y = 0;
  };
  pad.addEventListener('pointerdown', (e) => {
    if (id !== null) return; // already steering with another finger
    e.preventDefault();
    id = e.pointerId;
    try { pad.setPointerCapture(e.pointerId); } catch { /* some browsers refuse capture; moves still arrive while over the pad */ }
    base.classList.add('held');
    move(e);
  });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
  const end = (e: PointerEvent) => { if (e.pointerId === id) release(); };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
  pad.addEventListener('lostpointercapture', end);
  const act = root.querySelector('.joy-act') as HTMLElement;
  act.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    store.joy.action = true;
    haptic();
    act.classList.remove('tap'); void act.offsetWidth; act.classList.add('tap');
  });
  // Long-press menus / text selection never pop up over the game.
  for (const t of [root, document.getElementById('game')]) t?.addEventListener('contextmenu', (e) => e.preventDefault());
}

let wanted = false;
export function showJoystick(on: boolean) {
  wanted = on;
  root.classList.toggle('hidden', !(on && isTouch()));
  if (!on) release();
}

/** What the action button would do right now (an emoji), or null when nothing is in reach. */
export function setActionIcon(icon: string | null) {
  const b = root?.querySelector('.joy-act');
  if (!b) return;
  (b.querySelector('.joy-ico') as HTMLElement).textContent = icon ?? '♥';
  b.classList.toggle('near', !!icon);
}

// Hide while dialogue / menus / mini-games are open (and never keep walking on a thumb that was there).
bus.on('blocking', (n: number) => {
  if (n > 0) release();
  if (!root || !wanted || !isTouch()) return;
  root.classList.toggle('hidden', n > 0);
});

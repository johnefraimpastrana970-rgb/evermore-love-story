import { store } from '../core/store';
import { bus } from '../core/events';
import { el, isTouch, uiRoot } from './dom';

let root: HTMLElement;

/** On-screen joystick + action button for touch devices. */
export function initJoystick() {
  root = el('div', 'touch-controls hidden');
  root.innerHTML = `<div class="joy"><div class="joy-knob"></div></div><button class="joy-act" aria-label="Interact">♥</button>`;
  uiRoot().appendChild(root);
  const base = root.querySelector('.joy') as HTMLElement;
  const knob = root.querySelector('.joy-knob') as HTMLElement;
  let id: number | null = null;
  const R = 52;
  const move = (e: PointerEvent) => {
    const r = base.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    store.joy.x = Math.abs(dx) < 8 ? 0 : dx / R;
    store.joy.y = Math.abs(dy) < 8 ? 0 : dy / R;
  };
  base.addEventListener('pointerdown', (e) => {
    id = e.pointerId;
    base.setPointerCapture(e.pointerId);
    move(e);
  });
  base.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = null;
    knob.style.transform = '';
    store.joy.x = 0;
    store.joy.y = 0;
  };
  base.addEventListener('pointerup', end);
  base.addEventListener('pointercancel', end);
  root.querySelector('.joy-act')!.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    store.joy.action = true;
  });
}

let wanted = false;
export function showJoystick(on: boolean) {
  wanted = on;
  root.classList.toggle('hidden', !(on && isTouch()));
}

// Hide while dialogue / menus / mini-games are open.
bus.on('blocking', (n: number) => {
  if (!root || !wanted || !isTouch()) return;
  root.classList.toggle('hidden', n > 0);
});

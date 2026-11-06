import './pizza.css';
import { store } from '../core/store';
import { audio } from '../audio/audio';
import { el, esc, uiRoot } from '../ui/dom';
import { HER_PORTRAITS, HIS_PORTRAITS } from '../content/characters';
import type { Mood } from '../content/types';
import { CUSTOMERS, PARTNER_LINES, type CustomerDef } from './data';

/** A full-screen pizza layer (shop or market). Blocks the world while open. */
export function overlay(cls: string): { root: HTMLElement; close: () => void } {
  const root = el('div', `pz-layer ${cls}`);
  uiRoot().appendChild(root);
  store.block();
  audio.sfx('open');
  requestAnimationFrame(() => root.classList.add('in'));
  let closed = false;
  return {
    root,
    close: () => {
      if (closed) return;
      closed = true;
      root.classList.remove('in');
      audio.sfx('close');
      setTimeout(() => root.remove(), 260);
      store.unblock();
      store.save();
    },
  };
}

export const coinsHtml = (n: number) => `<span class="pz-coins" title="Shop coins"><i>🪙</i><b>${n}</b></span>`;

// ------------------------------------------------------------------ customers (placeholder art until real images exist)

const artKnown = new Map<string, boolean>();
/** Check once whether real art was added for a customer. */
function probeArt(id: string, onFound: () => void) {
  if (artKnown.has(id)) return;
  artKnown.set(id, false);
  const img = new Image();
  img.onload = () => { artKnown.set(id, true); onFound(); };
  img.src = `assets/customers/${id}.webp`;
}

export function customerFace(c: CustomerDef, mood: 'happy' | 'neutral' | 'sad' | 'angry' = 'neutral', size = 72): string {
  if (artKnown.get(c.id)) return `<img class="cust-img" src="assets/customers/${c.id}.webp" alt="${esc(c.name)}" width="${size}" height="${size}">`;
  const mouth = { happy: 'M40 64 Q50 74 60 64', neutral: 'M42 66 L58 66', sad: 'M42 70 Q50 62 58 70', angry: 'M42 70 Q50 64 58 70' }[mood];
  const brows = mood === 'angry' ? '<path d="M36 44 L46 48 M64 44 L54 48" stroke="#3a2a2a" stroke-width="3" stroke-linecap="round"/>' : '';
  return `<svg class="cust-svg" viewBox="0 0 100 100" width="${size}" height="${size}" aria-label="${esc(c.name)}">
    <circle cx="50" cy="50" r="50" fill="#fff4f0"/>
    <path d="M14 100 Q16 78 50 76 Q84 78 86 100Z" fill="${c.shirt}"/>
    <circle cx="50" cy="52" r="24" fill="${c.skin}"/>
    <path d="M25 50 Q24 24 50 22 Q76 24 75 50 Q66 36 50 36 Q34 36 25 50Z" fill="${c.hair}"/>
    <circle cx="41" cy="55" r="3" fill="#2a2024"/><circle cx="59" cy="55" r="3" fill="#2a2024"/>
    <circle cx="35" cy="62" r="3.5" fill="#ff9ab0" opacity=".55"/><circle cx="65" cy="62" r="3.5" fill="#ff9ab0" opacity=".55"/>
    <path d="${mouth}" stroke="#7a3a3a" stroke-width="3" fill="none" stroke-linecap="round"/>${brows}</svg>`;
}
/** Start checking for real customer art (re-render when any appears). */
export function probeCustomers(onFound: () => void) {
  for (const c of CUSTOMERS) probeArt(c.id, onFound);
}

// ------------------------------------------------------------------ partner helper

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

const avatarOf = (who: 'her' | 'him', mood: Mood) => {
  const t = who === 'him' ? HIS_PORTRAITS : HER_PORTRAITS;
  return (t[mood] ?? t.happy ?? t.natural ?? '').replace('.webp', '-avatar.webp');
};
export const partnerAvatar = (mood: Mood = 'happy') => avatarOf(store.partner(), mood);
export const playerAvatar = (mood: Mood = 'happy') => avatarOf(store.playAs(), mood);

/** The partner standing in the shop, with a speech bubble and little actions. */
export class Helper {
  el: HTMLElement;
  private bubbleTimer = 0;
  constructor(host: HTMLElement) {
    this.el = el('div', 'pz-helper', `<div class="pz-bubble hidden"></div><span class="pz-ava"><img alt=""><span class="apron-slot"></span></span><b>${esc(store.partnerName())}</b>`);
    host.appendChild(this.el);
    this.face('happy');
  }
  /** Show the apron the two of you are wearing. */
  apron(html: string) {
    (this.el.querySelector('.apron-slot') as HTMLElement).innerHTML = html;
  }
  face(m: Mood) {
    (this.el.querySelector('img') as HTMLImageElement).src = partnerAvatar(m);
  }
  say(key: keyof typeof PARTNER_LINES | string, mood: Mood = 'happy') {
    const lines = (PARTNER_LINES as Record<string, string[]>)[key];
    const text = store.fmt(lines ? pick(lines) : key);
    const b = this.el.querySelector('.pz-bubble') as HTMLElement;
    b.textContent = text;
    b.classList.remove('hidden', 'pop');
    void b.offsetWidth;
    b.classList.add('pop');
    this.face(mood);
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = window.setTimeout(() => b.classList.add('hidden'), 3400);
  }
  /** Play a little action: carry ingredients, stand by the oven, hand a box, celebrate, comfort. */
  act(kind: 'carry' | 'oven' | 'box' | 'cheer' | 'comfort' | 'idle') {
    this.el.classList.remove('carry', 'oven', 'box', 'cheer', 'comfort');
    void this.el.offsetWidth;
    if (kind !== 'idle') this.el.classList.add(kind);
    if (kind === 'cheer' && !store.settings.reducedMotion) confetti(this.el.closest('.pz-layer') as HTMLElement);
  }
}

export function confetti(host: HTMLElement | null) {
  if (!host) return;
  const c = el('div', 'pz-confetti', Array.from({ length: 30 }, (_, i) =>
    `<i style="left:${(i * 37) % 100}%;animation-delay:${(i % 8) * 0.07}s;--h:${(i * 53) % 360}deg"></i>`).join(''));
  host.appendChild(c);
  setTimeout(() => c.remove(), 2200);
}

export function stars(n: number) {
  return `<span class="pz-stars">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}" style="--d:${i * 0.12}s">★</i>`).join('')}</span>`;
}

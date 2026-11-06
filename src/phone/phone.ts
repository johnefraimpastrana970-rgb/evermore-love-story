import './phone.css';
import { store } from '../core/store';
import { bus } from '../core/events';
import { audio } from '../audio/audio';
import { el, esc, uiRoot } from '../ui/dom';
import { HER_AVATAR, HIS_AVATAR } from '../content/characters';
import { APP_ICON, iconTile } from './icons';
import type { AppId } from './types';
import { APP_ORDER, parseRoute } from './routes';

export { APP_ORDER, parseRoute };

/*
 * The in-game smartphone shell: handset frame, status bar, home screen and app routing.
 * Apps live in ./apps and register themselves with registerApp(). Routes look like "home", "messages",
 * "calendar?date=2026-11-20". Deep links (#/phone/calendar, evermore://phone/calendar) map onto the same routes.
 */

export interface AppCtx {
  /** The app's content area. */
  host: HTMLElement;
  params: URLSearchParams;
  title(text: string): void;
  /** Right-hand header button (e.g. "+"). Pass null to remove. */
  action(html: string | null, onClick?: () => void, label?: string): void;
  /** Handle the back button inside the app (return true if handled, e.g. closing a sub-page). */
  onBack(fn: (() => boolean) | null): void;
  go(route: string): void;
  close(): void;
}

export interface PhoneApp {
  id: AppId;
  name: string;
  /** Hide the header (games draw their own). */
  bare?: boolean;
  open(ctx: AppCtx): void | (() => void);
}


const registry = new Map<AppId, PhoneApp>();
export function registerApp(app: PhoneApp) {
  registry.set(app.id, app);
}

let layer: HTMLElement;
let phone: HTMLElement;
let screen: HTMLElement;
let open = false;
let route = 'home';
let appCleanup: (() => void) | null = null;
let appBack: (() => boolean) | null = null;
let clockTimer: number | undefined;
let pending: string | null = null;
let worldReady = false;

export const isPhoneOpen = () => open;

export function partnerAvatar(): string {
  return store.partner() === 'him' ? HIS_AVATAR : HER_AVATAR;
}

/** Messages from the partner she hasn't seen yet. */
export function unreadCount(): number {
  if (!store.hasGame) return 0;
  const p = store.state.phone;
  return p.messages.filter((m) => m.from !== 'me' && m.at > p.readAt).length;
}

/** A deep link that arrived before a story was loaded (used by the title screen to auto-continue). */
export function pendingRoute() {
  return pending;
}
/** Queue a deep link; opens as soon as the world is ready and nothing else is on screen. */
export function queueRoute(r: string | null) {
  if (!r) return;
  pending = r;
  tryPending();
}

function tryPending() {
  if (!pending || !worldReady || !store.hasGame) return;
  if (open) { const r = pending; pending = null; navigate(r); return; }
  if (store.blocked) return;
  const r = pending;
  pending = null;
  openPhone(r);
}

export function initPhone() {
  layer = el('div', 'phone-layer hidden');
  layer.innerHTML = `
    <div class="phone" role="dialog" aria-label="Phone">
      <div class="ph-bezel">
        <div class="ph-status"><span class="ph-time"></span><span class="ph-notch"></span><span class="ph-sys">
          <svg viewBox="0 0 18 12" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
          <span class="ph-batt"><i></i></span></span></div>
        <div class="ph-screen"></div>
        <button class="ph-homebar" aria-label="Home"></button>
      </div>
    </div>`;
  uiRoot().appendChild(layer);
  phone = layer.querySelector('.phone') as HTMLElement;
  screen = layer.querySelector('.ph-screen') as HTMLElement;
  layer.addEventListener('pointerdown', (e) => { if (e.target === layer) closePhone(); });
  layer.querySelector('.ph-homebar')!.addEventListener('click', () => (route === 'home' ? closePhone() : navigate('home')));

  window.addEventListener('keydown', (e) => {
    if (open) {
      if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); back(); }
      return;
    }
    if (e.code === 'KeyP' && store.hasGame && !store.blocked && (e.target as HTMLElement)?.tagName !== 'INPUT') {
      const hud = document.querySelector('.hud');
      if (hud && !hud.classList.contains('hidden')) { e.preventDefault(); openPhone(); }
    }
  }, true);

  // Deep links: in the browser as #/phone/…, on Android forwarded by the native bridge.
  queueRoute(parseRoute(location.hash));
  window.addEventListener('hashchange', () => queueRoute(parseRoute(location.hash)));
  bus.on('world-ready', () => { worldReady = true; tryPending(); });
  bus.on('to-title', () => { worldReady = false; });
  bus.on('blocking', (n: number) => { if (!n) tryPending(); });
  bus.on('phone', () => { if (open && route === 'home') renderHome(); });
  // Battery level, where the browser shares it (purely cosmetic).
  (navigator as any).getBattery?.().then((b: any) => {
    const upd = () => phone.style.setProperty('--batt', String(Math.max(0.08, b.level)));
    upd();
    b.addEventListener('levelchange', upd);
  }).catch(() => {});
}

export function openPhone(r = 'home') {
  if (!store.hasGame) return;
  if (!open) {
    open = true;
    store.block();
    audio.sfx('open');
    layer.classList.remove('hidden');
    requestAnimationFrame(() => layer.classList.add('in'));
    tickClock();
    clockTimer = window.setInterval(tickClock, 10_000);
    if (location.hash.startsWith('#/phone')) history.replaceState(null, '', location.pathname + location.search);
  }
  navigate(r);
}

export function closePhone() {
  if (!open) return;
  teardownApp();
  open = false;
  clearInterval(clockTimer);
  audio.sfx('close');
  layer.classList.remove('in');
  setTimeout(() => { if (!open) layer.classList.add('hidden'); }, 260);
  store.unblock();
  store.save();
  bus.emit('phone');
}

function back() {
  if (appBack?.()) return;
  if (route === 'home') closePhone();
  else navigate('home');
}

function teardownApp() {
  try { appCleanup?.(); } catch (e) { console.error('[phone] app cleanup failed', e); }
  appCleanup = null;
  appBack = null;
}

function tickClock() {
  const now = new Date();
  (layer.querySelector('.ph-time') as HTMLElement).textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (route === 'home') {
    const t = screen.querySelector('.home-time');
    if (t) t.textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '');
  }
}

export function navigate(r: string) {
  const [id, query = ''] = r.split('?');
  teardownApp();
  const app = registry.get(id as AppId);
  if (id === 'home' || !app) {
    route = 'home';
    renderHome();
    return;
  }
  route = r;
  audio.sfx('click');
  screen.innerHTML = `
    <div class="app ${app.bare ? 'bare' : ''}" data-app="${app.id}">
      ${app.bare ? '' : `<header class="app-head"><button class="app-back" aria-label="Back">‹</button><h3></h3><span class="app-act"></span></header>`}
      <div class="app-body"></div>
    </div>`;
  const root = screen.querySelector('.app') as HTMLElement;
  const host = root.querySelector('.app-body') as HTMLElement;
  root.querySelector('.app-back')?.addEventListener('click', back);
  const ctx: AppCtx = {
    host,
    params: new URLSearchParams(query),
    title: (t) => { const h = root.querySelector('.app-head h3'); if (h) h.textContent = t; },
    action: (html, onClick, label = '') => {
      const slot = root.querySelector('.app-act');
      if (!slot) return;
      slot.innerHTML = '';
      if (html === null) return;
      const b = el('button', /^[A-Za-z]{3,}$/.test(html) ? 'app-btn text' : 'app-btn', html);
      if (label) b.setAttribute('aria-label', label);
      b.addEventListener('click', () => onClick?.());
      slot.appendChild(b);
    },
    onBack: (fn) => { appBack = fn; },
    go: (to) => navigate(to),
    close: () => closePhone(),
  };
  ctx.title(app.name);
  const c = app.open(ctx);
  if (typeof c === 'function') appCleanup = c;
}

function renderHome() {
  const s = store.state;
  const now = new Date();
  const unread = unreadCount();
  const lastFromPartner = [...s.phone.messages].reverse().find((m) => m.from === 'partner');
  const next = nextReminderLabel?.() ?? null;
  screen.innerHTML = `
    <div class="home wp-${esc(s.phone.wallpaper)}">
      <button class="home-bell" data-go="notifications" aria-label="Notifications">🔔${s.phone.history.some((h) => !h.opened && h.at > s.phone.readAt) ? '<i></i>' : ''}</button>
      <div class="home-clock">
        <div class="home-time">${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '')}</div>
        <div class="home-date">${now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      </div>
      <div class="home-widgets">
        <button class="hw hw-msg" data-go="messages">
          ${partnerAvatar() ? `<img src="${partnerAvatar()}" alt="">` : ''}
          <span><b>${esc(store.partnerName())}</b><small>${lastFromPartner ? esc(lastFromPartner.text) : 'No messages yet'}</small></span>
          ${unread ? `<i class="badge">${unread}</i>` : ''}
        </button>
        <button class="hw hw-cal" data-go="calendar">
          <span class="hw-day"><small>${now.toLocaleDateString([], { weekday: 'short' })}</small><b>${now.getDate()}</b></span>
          <span><b>Up next</b><small>${next ? esc(next) : 'Nothing planned'}</small></span>
        </button>
      </div>
      <div class="home-grid">${APP_ORDER.map((id) => {
        const app = registry.get(id);
        return `<button class="app-icon" data-go="${id}" ${app ? '' : 'disabled'}>${iconTile(id, now.getDate())}
          ${id === 'messages' && unread ? `<i class="badge">${unread}</i>` : ''}<span>${esc(app?.name ?? id)}</span></button>`;
      }).join('')}</div>
    </div>`;
  screen.querySelectorAll<HTMLElement>('[data-go]').forEach((b) => b.addEventListener('click', () => {
    const tile = b.querySelector('.app-tile') as HTMLElement | null;
    if (tile) { // zoom the app open from its icon
      const r = tile.getBoundingClientRect(), sr = screen.getBoundingClientRect();
      screen.style.setProperty('--ox', `${r.left + r.width / 2 - sr.left}px`);
      screen.style.setProperty('--oy', `${r.top + r.height / 2 - sr.top}px`);
    } else {
      screen.style.setProperty('--ox', '50%');
      screen.style.setProperty('--oy', '40%');
    }
    navigate(b.dataset.go!);
  }));
  tickClock();
}

/** Set by the calendar module: a short "Tomorrow 8:00 · Dentist" style label for the home widget. */
let nextReminderLabel: (() => string | null) | null = null;
export function setNextReminderLabel(fn: () => string | null) {
  nextReminderLabel = fn;
}

export { APP_ICON };

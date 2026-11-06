import type { AppId } from './types';

/** App icon glyphs (white, 48x48 viewBox) and their tile gradients. */
export const APP_ICON: Record<AppId, { bg: [string, string]; svg: string }> = {
  messages: {
    bg: ['#ff9ab8', '#e8577d'],
    svg: '<path d="M8 10h32a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H20l-9 7v-7H8a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z" fill="#fff"/><path d="M24 30c-5-3.5-8-6.4-8-9.4a4 4 0 0 1 8-1.2 4 4 0 0 1 8 1.2c0 3-3 5.9-8 9.4z" fill="#e8577d"/>',
  },
  contacts: {
    bg: ['#c7b4f0', '#8a6fd1'],
    svg: '<circle cx="24" cy="17" r="8" fill="#fff"/><path d="M8 41c1.5-9 8-13 16-13s14.5 4 16 13z" fill="#fff"/>',
  },
  gallery: {
    bg: ['#ffd38a', '#f29b5b'],
    svg: '<rect x="6" y="9" width="36" height="30" rx="5" fill="#fff"/><circle cx="17" cy="19" r="4" fill="#f6b26b"/><path d="M8 37l11-12 7 7 5-5 9 10z" fill="#f29b5b"/>',
  },
  calendar: {
    bg: ['#ffffff', '#f3e7ee'],
    svg: '<rect x="6" y="8" width="36" height="34" rx="6" fill="#fff" stroke="#f0d4de" stroke-width="2"/><path d="M6 14a6 6 0 0 1 6-6h24a6 6 0 0 1 6 6v4H6z" fill="#e8577d"/>',
  },
  notes: {
    bg: ['#fff2a8', '#f5cf4a'],
    svg: '<rect x="10" y="6" width="28" height="36" rx="4" fill="#fff"/><path d="M15 16h18M15 22h18M15 28h12" stroke="#e0b52e" stroke-width="2.6" stroke-linecap="round"/>',
  },
  calculator: {
    bg: ['#7c8496', '#3f4656'],
    svg: '<rect x="10" y="5" width="28" height="38" rx="5" fill="#fff"/><rect x="14" y="9" width="20" height="8" rx="2" fill="#9aa3b5"/><g fill="#3f4656"><circle cx="17" cy="23" r="2.2"/><circle cx="24" cy="23" r="2.2"/><circle cx="31" cy="23" r="2.2"/><circle cx="17" cy="30" r="2.2"/><circle cx="24" cy="30" r="2.2"/><circle cx="17" cy="37" r="2.2"/><circle cx="24" cy="37" r="2.2"/></g><rect x="29" y="28" width="4.4" height="11" rx="2.2" fill="#ff8f6b"/>',
  },
  snake: {
    bg: ['#9ee6b8', '#3fae76'],
    svg: '<path d="M10 34c0-6 6-6 9-6s9 0 9-6-6-6-9-6" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><circle cx="34" cy="16" r="6" fill="#fff"/><circle cx="36" cy="14.5" r="1.4" fill="#3fae76"/><path d="M39 33a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" fill="#ff6b8a"/>',
  },
  maze: {
    bg: ['#8ec5ff', '#5568d8'],
    svg: '<path d="M8 8h32v32H8z M16 8v16 M8 32h16 M24 16h16 M32 24v16" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round" opacity=".85"/><path d="M28 36c-3-2-5-3.8-5-5.6a2.4 2.4 0 0 1 5-.8 2.4 2.4 0 0 1 5 .8c0 1.8-2 3.6-5 5.6z" fill="#ffd1e0"/>',
  },
  notifications: {
    bg: ['#ffe08a', '#f2a93b'],
    svg: '<path d="M24 8a10 10 0 0 0-10 10v8l-4 6h28l-4-6v-8A10 10 0 0 0 24 8z" fill="#fff"/><circle cx="24" cy="37" r="4" fill="#fff"/>',
  },
  rps: {
    bg: ['#ffb3c7', '#b45fd1'],
    svg: '<circle cx="14" cy="16" r="7" fill="#fff"/><rect x="27" y="9" width="14" height="14" rx="3" fill="#fff" opacity=".9"/><path d="M15 30l9 10M24 30l-9 10" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><circle cx="35" cy="35" r="5" fill="none" stroke="#fff" stroke-width="3"/>',
  },
};

export function iconTile(id: AppId, day?: number): string {
  const ic = APP_ICON[id];
  const extra = id === 'calendar' && day
    ? `<text x="24" y="36" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="17" font-weight="600" fill="#4a2a3e">${day}</text>`
    : '';
  return `<span class="app-tile" style="--a:${ic.bg[0]};--b:${ic.bg[1]}"><svg viewBox="0 0 48 48" aria-hidden="true">${ic.svg}${extra}</svg></span>`;
}

/** Small phone glyph for the HUD button. */
export const PHONE_GLYPH = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="17" y="5" width="30" height="54" rx="8" fill="#4a2a3e"/><rect x="20.5" y="11" width="23" height="40" rx="3" fill="#ffd9e5"/><path d="M32 38c-5-3.4-8-6.2-8-9a4 4 0 0 1 8-1.2 4 4 0 0 1 8 1.2c0 2.8-3 5.6-8 9z" fill="#e8577d"/><rect x="27" y="53.5" width="10" height="2.4" rx="1.2" fill="#ffd9e5"/></svg>',
)}`;

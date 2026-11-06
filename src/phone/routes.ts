import type { AppId } from './types';

export const APP_ORDER: AppId[] = ['messages', 'contacts', 'gallery', 'calendar', 'notes', 'calculator', 'garden', 'snake', 'maze', 'rps'];/** Screens that open by route but have no home-screen icon. */
export const EXTRA_ROUTES: AppId[] = ['notifications'];

/**
 * Deep links → phone routes.
 * "evermore://phone/calendar?date=2026-11-20" | "#/phone/calendar?date=…" | "/phone" → "calendar?date=…" | "home".
 * Anything that isn't a phone link returns null; an unknown app opens the home screen.
 */
export function parseRoute(input: string): string | null {
  let s = (input || '').trim().replace(/^evermore:\/\//i, '').replace(/^#?\/*/, '');
  if (!/^phone(\/|\?|$)/i.test(s)) return null;
  s = s.slice(5).replace(/^\/+/, '');
  const [id, query = ''] = s.split('?');
  if (!id) return 'home';
  if (!APP_ORDER.includes(id as AppId) && !EXTRA_ROUTES.includes(id as AppId)) return 'home';
  return query ? `${id}?${query}` : id;
}

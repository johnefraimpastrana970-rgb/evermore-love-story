// Data kept by the in-game phone. Stored inside the save (GameState.phone), so it syncs with the rest of the game.
// Records that can be edited on two devices carry `updatedAt` and a `deleted` tombstone so sync can merge them.

export type AppId = 'messages' | 'contacts' | 'gallery' | 'calendar' | 'notes' | 'calculator' | 'snake' | 'maze' | 'rps' | 'notifications' | 'garden';

export type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';

export interface Reminder {
  id: string;
  title: string;
  note?: string;
  /** Local wall-clock date of the first occurrence, YYYY-MM-DD. */
  date: string;
  /** Local wall-clock time, HH:MM (24h). */
  time: string;
  /** IANA time zone the reminder was written in, e.g. "Asia/Manila". */
  tz: string;
  repeat: Repeat;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
  /** Epoch ms of the last occurrence already delivered. */
  lastFired?: number;
}

export interface PhoneMessage {
  id: string;
  from: 'partner' | 'me' | 'evermore';
  text: string;
  at: number;
  kind?: 'greeting' | 'reminder' | 'chat' | 'system';
  reminderId?: string;
}

export interface PhoneContact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  note?: string;
  updatedAt: number;
  deleted?: boolean;
}

export interface PhoneNote {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  deleted?: boolean;
}

export interface NotificationLog {
  id: string;
  title: string;
  body: string;
  /** When it was (or should have been) delivered. */
  at: number;
  source: 'reminder' | 'greeting' | 'garden';
  refId?: string;
  /** How it reached her: inside the game, a browser notification, or an Android notification. */
  channel: 'game' | 'browser' | 'android';
  opened?: number;
  /** Came due while the game was closed for too long, so it was logged instead of sent. */
  missed?: boolean;
}

export interface PhoneState {
  messages: PhoneMessage[];
  contacts: PhoneContact[];
  notes: PhoneNote[];
  reminders: Reminder[];
  history: NotificationLog[];
  /** Best scores of the phone games. */
  bests: Record<string, number>;
  /** Greeting slot -> day key it was last delivered on. */
  greetings: Record<string, string>;
  wallpaper: string;
  /** Last time the messages thread was read (for the unread badge). */
  readAt: number;
}

export function defaultPhone(): PhoneState {
  return { messages: [], contacts: [], notes: [], reminders: [], history: [], bests: {}, greetings: {}, wallpaper: 'blush', readAt: 0 };
}

export const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

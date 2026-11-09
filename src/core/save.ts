import { GameState, migrate, Settings, defaultSettings } from './state';

export type SlotId = 'auto' | 'slot1' | 'slot2' | 'slot3';
export const SLOTS: SlotId[] = ['auto', 'slot1', 'slot2', 'slot3'];

const PREFIX = 'evermore.';

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function memoryKV(): KV {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

function detectKV(): KV {
  try {
    const ls = globalThis.localStorage;
    const probe = PREFIX + 'probe';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    console.warn('[save] localStorage unavailable – progress will not persist this session');
    return memoryKV();
  }
}

let kv: KV = detectKV();
export function useStorage(store: KV) {
  kv = store;
}

export interface SlotInfo {
  slot: SlotId;
  updatedAt: number;
  level: number;
  herName: string;
  /** Name of whoever is being played in that save. */
  playerName: string;
  playAs: 'her' | 'him';
  location: string;
}

export function writeSlot(slot: SlotId, state: GameState): boolean {
  state.updatedAt = Date.now();
  const json = JSON.stringify(state);
  try {
    // Keep the previous good copy so a crash mid-write can't wipe progress.
    const prev = kv.getItem(PREFIX + slot);
    if (prev) kv.setItem(PREFIX + slot + '.bak', prev);
    kv.setItem(PREFIX + slot, json);
    return true;
  } catch (e) {
    console.error('[save] write failed', e);
    return false;
  }
}

export function readSlot(slot: SlotId): GameState | null {
  for (const key of [PREFIX + slot, PREFIX + slot + '.bak']) {
    const raw = kv.getItem(key);
    if (!raw) continue;
    try {
      return migrate(JSON.parse(raw));
    } catch (e) {
      console.warn(`[save] ${key} unreadable, trying backup`, e);
    }
  }
  return null;
}

export function deleteSlot(slot: SlotId) {
  kv.removeItem(PREFIX + slot);
  kv.removeItem(PREFIX + slot + '.bak');
}

export function slotInfo(slot: SlotId): SlotInfo | null {
  const s = readSlot(slot);
  if (!s) return null;
  return { slot, updatedAt: s.updatedAt, level: s.level, herName: s.profile.herName,
    playerName: s.profile.playAs === 'him' ? s.profile.hisName : s.profile.herName, playAs: s.profile.playAs, location: s.location };
}

export function latestSlot(): SlotId | null {
  let best: SlotInfo | null = null;
  for (const slot of SLOTS) {
    const info = slotInfo(slot);
    if (info && (!best || info.updatedAt > best.updatedAt)) best = info;
  }
  return best?.slot ?? null;
}

export function exportSave(state: GameState): string {
  return JSON.stringify({ app: 'project-evermore', exportedAt: new Date().toISOString(), state }, null, 1);
}

export function importSave(text: string): GameState {
  const parsed = JSON.parse(text);
  const raw = parsed && parsed.app === 'project-evermore' ? parsed.state : parsed;
  return migrate(raw);
}

export function loadSettings(): Settings {
  try {
    const raw = kv.getItem(PREFIX + 'settings');
    if (raw) {
      const saved = JSON.parse(raw) as Record<string, unknown>;
      const hadDateOverride = 'debugDate' in saved;
      const hadManualOccasions = 'manualOccasions' in saved;
      delete saved.debugDate;
      delete saved.manualOccasions;
      const settings = { ...defaultSettings(), ...saved };
      if (hadDateOverride || hadManualOccasions) kv.setItem(PREFIX + 'settings', JSON.stringify(settings));
      return settings;
    }
  } catch { /* fall through */ }
  return defaultSettings();
}

export function saveSettings(s: Settings) {
  try {
    kv.setItem(PREFIX + 'settings', JSON.stringify(s));
  } catch (e) {
    console.error('[save] settings write failed', e);
  }
}

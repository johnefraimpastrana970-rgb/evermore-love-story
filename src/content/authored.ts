import type { Condition, OccasionDef, OccasionRule, PersonalEntry, PersonalKind, TimeOfDay } from './types';
import data from './authored.json';
import { SPECIALS } from '../garden/data';

/*
 * Content written in the Author tool (`npm run author`). It is saved to src/content/authored.json and bundled into
 * the game on the next build. Authored entries replace the template with the same id (personal.ts) or are added as
 * new ones; authored special days switch on the matching template in occasions.ts.
 * Nothing here is written by the game itself.
 */

export interface OccasionOverride {
  enabled: boolean;
  name?: string;
  rule?: Extract<OccasionRule, { type: 'yearly' } | { type: 'monthly' }>;
  /** The greeting played once on the day (replaces the template line). */
  greeting?: string;
  /** Birthdays only: the year of birth, so the banner can say "Happy 19th Birthday". */
  year?: number;
}
export interface AuthoredContent {
  version: 1;
  /** Pre-filled names on New Story. */
  names: { her: string; him: string };
  /** Hide templates that were never written, so she never sees ⟦…⟧ placeholders. */
  hideTemplates: boolean;
  entries: PersonalEntry[];
  occasions: Record<string, OccasionOverride>;
  /** Extra chalkboard-puzzle words. */
  words: string[];
  /** Garden special plant id -> the little scene that plays when it first blooms. */
  garden: Record<string, { scene: string }>;
}

export type SceneLine = { speaker: 'her' | 'him' | 'narrator'; text: string };
/**
 * A bloom scene as written in the Author tool: one line per paragraph, "her: …" or "him: …" for who speaks
 * (always the real her and him), anything else is narration.
 */
export function parseScene(text: string): SceneLine[] {
  return text.split(/\n+/).map((raw) => raw.trim()).filter(Boolean).map((line) => {
    const m = /^(her|him)\s*:\s*(.+)$/i.exec(line);
    return m ? { speaker: m[1].toLowerCase() as 'her' | 'him', text: m[2].trim() } : { speaker: 'narrator' as const, text: line };
  });
}

export const PERSONAL_KINDS: PersonalKind[] = ['letter', 'message', 'memory', 'photo', 'joke', 'date', 'challenge', 'surprise'];
/** Special days the Author tool can set (they exist as disabled templates in occasions.ts). */
export const AUTHORABLE_OCCASIONS = ['anniversary', 'her-birthday', 'his-birthday', 'monthsary'] as const;

const str = (v: unknown, max = 20000) => (typeof v === 'string' ? v.slice(0, max) : '');
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const int = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : undefined);

function cleanCondition(v: unknown): Condition | undefined {
  if (!isObj(v)) return undefined;
  const c: Condition = {};
  const lvl = int(v.minLevel, 1, 999);
  if (lvl) c.minLevel = lvl;
  if (Array.isArray(v.time)) {
    const t = v.time.filter((x): x is TimeOfDay => ['morning', 'day', 'sunset', 'night'].includes(x as string));
    if (t.length) c.time = t;
  }
  for (const k of ['occasion', 'secret', 'flag', 'questDone'] as const) if (str(v[k], 80)) c[k] = str(v[k], 80);
  return Object.keys(c).length ? c : undefined;
}

function cleanEntry(v: unknown): PersonalEntry | null {
  if (!isObj(v)) return null;
  const id = str(v.id, 80).replace(/[^a-z0-9-]/gi, '');
  const kind = v.kind as PersonalKind;
  if (!id || !PERSONAL_KINDS.includes(kind)) return null;
  const e: PersonalEntry = { id, kind, title: str(v.title, 200) };
  if (str(v.body)) e.body = str(v.body);
  if (str(v.date, 40)) e.date = str(v.date, 40);
  const img = str(v.image, 300);
  if (img && /^assets\/photos\/[\w./-]+$/.test(img) && !img.includes('..')) e.image = img;
  const unlock = cleanCondition(v.unlock);
  if (unlock) e.unlock = unlock;
  const xp = int(v.rewardXp, 0, 100000);
  if (xp !== undefined) e.rewardXp = xp;
  if (Array.isArray(v.tags)) e.tags = v.tags.map((t) => str(t, 40)).filter(Boolean).slice(0, 10);
  return e;
}

function cleanOverride(v: unknown): OccasionOverride | null {
  if (!isObj(v)) return null;
  const o: OccasionOverride = { enabled: v.enabled === true };
  if (str(v.name, 80)) o.name = str(v.name, 80);
  if (str(v.greeting, 2000)) o.greeting = str(v.greeting, 2000);
  const r = v.rule;
  if (isObj(r) && r.type === 'yearly') {
    const month = int(r.month, 1, 12), day = int(r.day, 1, 31);
    if (month && day) o.rule = { type: 'yearly', month, day, durationDays: 1 };
  } else if (isObj(r) && r.type === 'monthly') {
    const day = int(r.day, 1, 31);
    if (day) o.rule = { type: 'monthly', day };
  }
  if (o.enabled && !o.rule) o.enabled = false; // never switch on a day without a real date
  const year = int(v.year, 1900, 2100);
  if (year && o.rule?.type === 'yearly') o.year = year;
  return o;
}

/** "1st", "2nd", "19th"… */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** A special day's banner with {age} filled in (birthdays with a birth year), for the given date. */
export function occasionBanner(o: OccasionDef, now: Date): string | undefined {
  const b = o.theme.banner;
  if (!b) return b;
  return o.sinceYear ? b.replace('{age}', ordinal(now.getFullYear() - o.sinceYear)) : b.replace('{age} ', '');
}

/** Validate whatever is in authored.json (hand edits, imports) into a safe shape. */
export function normalizeAuthored(raw: unknown): AuthoredContent {
  const r = isObj(raw) ? raw : {};
  const names = isObj(r.names) ? r.names : {};
  const seen = new Set<string>();
  const entries = (Array.isArray(r.entries) ? r.entries : []).map(cleanEntry).filter((e): e is PersonalEntry => {
    if (!e || seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
  const occasions: Record<string, OccasionOverride> = {};
  if (isObj(r.occasions)) for (const id of AUTHORABLE_OCCASIONS) { const o = cleanOverride(r.occasions[id]); if (o) occasions[id] = o; }
  const words = (Array.isArray(r.words) ? r.words : [])
    .map((w) => str(w, 24).toUpperCase().replace(/[^A-Z]/g, ''))
    .filter((w, i, a) => w.length >= 3 && a.indexOf(w) === i)
    .slice(0, 200);
  const garden: Record<string, { scene: string }> = {};
  if (isObj(r.garden)) for (const s of SPECIALS) {
    const g = r.garden[s.id];
    const scene = isObj(g) ? str(g.scene, 4000).trim() : '';
    if (scene) garden[s.id] = { scene };
  }
  return { version: 1, names: { her: str(names.her, 40), him: str(names.him, 40) }, hideTemplates: r.hideTemplates === true, entries, occasions, words, garden };
}

/** Templates + authored entries: authored ones replace same-id templates (and are never placeholders). */
export function mergeEntries(templates: PersonalEntry[], a: AuthoredContent): PersonalEntry[] {
  // Only finished entries count: a title plus some text (or a photo). Half-started ones stay out of her game.
  const written = (e: PersonalEntry) => !!e.title.trim() && (!!(e.body ?? '').trim() || !!e.image);
  const byId = new Map(a.entries.filter(written).map((e) => [e.id, e]));
  const out: PersonalEntry[] = [];
  for (const t of templates) {
    const e = byId.get(t.id);
    if (e) { out.push({ ...e, placeholder: false }); byId.delete(t.id); }
    else if (!(a.hideTemplates && t.placeholder)) out.push(t);
  }
  for (const e of byId.values()) out.push({ ...e, placeholder: false });
  return out;
}

export function mergeOccasions(templates: OccasionDef[], a: AuthoredContent): OccasionDef[] {
  return templates.map((t) => {
    const o = a.occasions[t.id];
    if (!o) return t;
    const merged: OccasionDef = { ...t, name: o.name || t.name.replace(/[⟦⟧]/g, ''), rule: o.rule ?? t.rule, enabled: o.enabled && !!o.rule, placeholder: !o.rule };
    // With a birth year, birthday banners show the age.
    if (o.year && (t.id === 'her-birthday' || t.id === 'his-birthday')) {
      merged.sinceYear = o.year;
      merged.theme = { ...t.theme, banner: t.id === 'her-birthday' ? 'Happy {age} Birthday, {her}!' : 'It’s {him}’s {age} birthday!' };
    }
    return merged;
  });
}

type Line = { speaker: 'her' | 'him' | 'narrator'; text: string };
export function mergeGreetings(templates: OccasionDef[], dialogue: Record<string, Line[]>, a: AuthoredContent): Record<string, Line[]> {
  const out = { ...dialogue };
  for (const t of templates) {
    const text = a.occasions[t.id]?.greeting;
    if (!text || !t.greeting) continue;
    const speaker = dialogue[t.greeting]?.[0]?.speaker ?? 'him';
    out[t.greeting] = text.split(/\n{2,}/).map((p) => ({ speaker, text: p.trim() })).filter((l) => l.text);
  }
  return out;
}

export const AUTHORED: AuthoredContent = normalizeAuthored(data);

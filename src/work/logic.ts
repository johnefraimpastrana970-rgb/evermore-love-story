import {
  BENTO_SLOTS, CRAVINGS, NOTE_MAX, SHIFTS_PER_DAY, SHIFT_MINUTES, SOUVENIRS, UNLOCK_LEVEL, WORK_MESSAGES, WRAPS, food,
  type BentoSlot,
} from './data';

/*
 * His work day, as pure functions over the saved state (tests move the clock).
 * Timeline of a shift: she packs a bento → he leaves (away) → messages at set minutes → at returnAt he's at the door
 * (waiting) → she opens the door and he hands over what he brought (home again).
 */

export interface Bento { slots: Partial<Record<BentoSlot, string>>; note: string; wrap: string }
export interface Shift {
  leftAt: number;
  returnAt: number;
  bento: Bento;
  score: number;
  craved: boolean;
  /** Indexes into WORK_MESSAGES already delivered. */
  sent: number[];
}
export interface WorkState {
  /** Day key of `shifts`. */
  day: string;
  shifts: number;
  total: number;
  away: Shift | null;
  /** He's home and waiting at the front door. */
  waiting: Shift | null;
  /** The last bento she packed (the editor starts from it). */
  last: Bento | null;
}

export function defaultWork(): WorkState {
  return { day: '', shifts: 0, total: 0, away: null, waiting: null, last: null };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function cleanBento(v: unknown): Bento | null {
  if (!isObj(v)) return null;
  const slots: Bento['slots'] = {};
  if (isObj(v.slots)) for (const { slot } of BENTO_SLOTS) {
    const id = v.slots[slot];
    if (typeof id === 'string' && food(id)?.slot === slot) slots[slot] = id;
  }
  const note = typeof v.note === 'string' ? v.note.slice(0, NOTE_MAX) : '';
  const wrap = typeof v.wrap === 'string' && WRAPS.some((w) => w.id === v.wrap) ? v.wrap : WRAPS[0].id;
  return { slots, note, wrap };
}
function cleanShift(v: unknown): Shift | null {
  if (!isObj(v) || !Number.isFinite(v.leftAt) || !Number.isFinite(v.returnAt)) return null;
  const bento = cleanBento(v.bento);
  if (!bento) return null;
  return {
    leftAt: Number(v.leftAt), returnAt: Number(v.returnAt), bento, score: Number(v.score) || 0, craved: v.craved === true,
    sent: Array.isArray(v.sent) ? v.sent.filter((n): n is number => Number.isInteger(n)) : [],
  };
}

/** Make an older or damaged save safe to use. */
export function repairWork(w: WorkState) {
  if (typeof w.day !== 'string') w.day = '';
  for (const k of ['shifts', 'total'] as const) if (!Number.isInteger(w[k]) || w[k] < 0) w[k] = 0;
  w.away = cleanShift(w.away);
  w.waiting = cleanShift(w.waiting);
  if (w.away && w.waiting) w.away = null;
  w.last = cleanBento(w.last);
}

/** Small stable hash (the day's craving doesn't change between reloads). */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
export const cravingFor = (day: string) => CRAVINGS[hash(`craving|${day}`) % CRAVINGS.length];

/** 0–8: one per filled compartment, plus a note, his craving, and anything from the garden. */
export function bentoScore(b: Bento, day: string): { score: number; craved: boolean; garden: boolean } {
  const filled = BENTO_SLOTS.filter(({ slot }) => b.slots[slot]).length;
  const c = cravingFor(day);
  const craved = c.foods.includes(b.slots[c.slot] ?? '');
  const garden = Object.values(b.slots).some((id) => !!food(id ?? '')?.garden);
  const kinds = new Set(Object.values(b.slots)).size;
  return { score: filled + (b.note.trim() ? 1 : 0) + (craved ? 1 : 0) + (garden ? 1 : 0) - (kinds < filled ? 1 : 0), craved, garden };
}

export type WorkStatus = 'home' | 'away' | 'waiting';
export const status = (w: WorkState): WorkStatus => (w.waiting ? 'waiting' : w.away ? 'away' : 'home');

export function shiftsLeft(w: WorkState, day: string) {
  return SHIFTS_PER_DAY - (w.day === day ? w.shifts : 0);
}

/** Why he can't go right now, or null if he can. */
export function cantGo(w: WorkState, level: number, day: string, b: Bento): string | null {
  if (level < UNLOCK_LEVEL) return `He starts his job at level ${UNLOCK_LEVEL}`;
  if (status(w) === 'away') return 'He’s at work right now';
  if (status(w) === 'waiting') return 'He’s waiting at the front door!';
  if (shiftsLeft(w, day) <= 0) return 'He’s done with work for today ♡';
  if (!BENTO_SLOTS.some(({ slot }) => b.slots[slot])) return 'Put something in the lunch box first';
  return null;
}

/** She hands him the bento and he heads to work. */
export function startShift(w: WorkState, b: Bento, now: number, day: string, level: number): Shift | null {
  if (cantGo(w, level, day, b)) return null;
  if (w.day !== day) { w.day = day; w.shifts = 0; }
  const { score, craved } = bentoScore(b, day);
  const shift: Shift = { leftAt: now, returnAt: now + SHIFT_MINUTES * 60_000, bento: { slots: { ...b.slots }, note: b.note.slice(0, NOTE_MAX), wrap: b.wrap }, score, craved, sent: [] };
  w.shifts++;
  w.total++;
  w.away = shift;
  w.last = { slots: { ...b.slots }, note: b.note, wrap: b.wrap };
  return shift;
}

/** Messages that came due (marks them as sent). With the game closed for a while, several can be due at once. */
export function dueMessages(w: WorkState, now: number): { index: number; at: number }[] {
  const s = w.away ?? w.waiting;
  if (!s) return [];
  const out: { index: number; at: number }[] = [];
  WORK_MESSAGES.forEach((m, i) => {
    const at = s.leftAt + m.at * 60_000;
    if (at <= now && at < s.returnAt && !s.sent.includes(i)) { s.sent.push(i); out.push({ index: i, at }); }
  });
  return out;
}

/** The text of a work message: the lunch one mentions something from the bento. */
export function messageText(s: Shift, index: number, rand = Math.random): string {
  const m = WORK_MESSAGES[index];
  let text = m.lines[Math.floor(rand() * m.lines.length)];
  if (text.includes('{food}')) {
    const foods = Object.values(s.bento.slots).map((id) => food(id ?? '')).filter(Boolean);
    const f = foods.find((x) => x!.garden) ?? foods[Math.floor(rand() * foods.length)];
    text = text.replace('{food}', f?.says ?? 'something delicious');
  }
  return text;
}

/** He gets home: he waits at the door until she opens it. Returns true the moment it happens. */
export function arrive(w: WorkState, now: number): boolean {
  if (!w.away || now < w.away.returnAt) return false;
  w.waiting = w.away;
  w.away = null;
  return true;
}

export interface Souvenir { id: string; item?: string; tokens?: number; text: string }

/** She opens the door: he's home, with souvenirs (more for a lovingly packed lunch). */
export function greet(w: WorkState, rand = Math.random): { shift: Shift; souvenirs: Souvenir[] } | null {
  const s = w.waiting;
  if (!s) return null;
  w.waiting = null;
  const n = 1 + Math.floor(s.score / 3) + (s.craved ? 1 : 0);
  const pool = SOUVENIRS.filter((x) => s.score >= x.minScore);
  const out: Souvenir[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    const total = pool.reduce((a, b) => a + b.weight, 0);
    let r = rand() * total;
    let pickI = 0;
    for (let k = 0; k < pool.length; k++) { r -= pool[k].weight; if (r <= 0) { pickI = k; break; } }
    const x = pool.splice(pickI, 1)[0];
    out.push({ id: x.id, item: x.item, tokens: x.tokens, text: x.text });
  }
  return { shift: s, souvenirs: out };
}

/** When he'll be back, for an Android notification while the game is closed. */
export const returnTime = (w: WorkState): number | null => w.away?.returnAt ?? null;

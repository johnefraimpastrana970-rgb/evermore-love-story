import { store } from '../../core/store';
import { bus } from '../../core/events';
import { addMessage } from '../inbox';
import { uid, type NotificationLog, type PhoneMessage } from '../types';
import { MISSED_SUFFIX, PHONE_GREETINGS, REMINDER_LINES, type GreetingSlot } from '../../content/phone';
import { OCCASION_DIALOGUE } from '../../content/occasions';
import { currentOccasions } from '../../systems/game';
import { occurrences } from './rules';

/*
 * The partner's schedule (no AI, only predefined lines):
 * - greeting slots (morning / afternoon / night) send at most once a day, at a time picked inside the slot's window
 * - an active occasion sends its greeting once that day
 * - calendar reminders arrive at their time
 *
 * Catch-up rules when the game was closed:
 * - a greeting whose window already ended is skipped for that day (no "good morning" at night)
 * - reminders that came due within CATCH_UP are delivered once, marked "(this was for 9:30)"; several missed
 *   occurrences of the same reminder become one message; anything older is only logged in the history as missed.
 *
 * Everything is driven by `runScheduler(now)` so tests can move the clock.
 */

export const CATCH_UP = 12 * 3600_000;
const HISTORY_MAX = 200;

const pad = (n: number) => String(n).padStart(2, '0');
export const localDay = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
function localAt(day: string, hhmm: string) {
  const [y, m, d] = day.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, h, mi).getTime();
}
/** Stable small hash so a day's choices don't change between reloads. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** When a slot's message goes out on a given day (inside the first 60% of its window). */
export function slotSendTime(slot: GreetingSlot, day: string) {
  const start = localAt(day, slot.from), end = localAt(day, slot.to);
  const span = Math.max(1, Math.floor(((end - start) * 0.6) / 60_000));
  return start + (hash(`${day}|${slot.id}`) % span) * 60_000;
}
function slotActiveToday(slot: GreetingSlot, day: string) {
  return slot.chance === undefined || (hash(`${day}|${slot.id}|chance`) % 1000) / 1000 < slot.chance;
}

export interface Delivery { message: PhoneMessage; log: NotificationLog }

function log(entry: Omit<NotificationLog, 'id' | 'channel'> & { channel?: NotificationLog['channel'] }) {
  const h = store.state.phone.history;
  const rec: NotificationLog = { id: uid('h'), channel: 'game', ...entry };
  h.push(rec);
  h.sort((a, b) => a.at - b.at);
  if (h.length > HISTORY_MAX) h.splice(0, h.length - HISTORY_MAX);
  return rec;
}

export function deliver(text: string, at: number, source: NotificationLog['source'], refId: string, title: string, kind: PhoneMessage['kind']): Delivery {
  const message = addMessage({ from: 'partner', text, at, kind, reminderId: source === 'reminder' ? refId : undefined });
  const entry = log({ title, body: text, at, source, refId });
  return { message, log: entry };
}

export function reminderText(title: string, note: string | undefined, at: number, missed: boolean) {
  const time = new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const line = REMINDER_LINES[hash(`${title}|${at}`) % REMINDER_LINES.length];
  let text = store.fmt(line).replace('{title}', title).replace('{time}', time);
  if (note) text += `\n${note}`;
  if (missed) text += MISSED_SUFFIX.replace('{time}', time);
  return text;
}

/** Run one scheduling pass. Returns what was delivered (for the alert banner). */
export function runScheduler(now = Date.now()): Delivery[] {
  if (!store.hasGame) return [];
  const p = store.state.phone;
  const out: Delivery[] = [];
  const today = localDay(now);
  const partner = store.partnerName();

  // Greetings.
  for (const slot of PHONE_GREETINGS) {
    if (p.greetings[slot.id] === today) continue;
    const start = localAt(today, slot.from);
    if (now < start) continue;
    if (!slotActiveToday(slot, today)) { p.greetings[slot.id] = today; continue; }
    const sendAt = slotSendTime(slot, today);
    if (now < sendAt) continue;
    p.greetings[slot.id] = today;
    if (now > localAt(today, slot.to)) continue; // window missed: skip today
    const text = store.fmt(slot.lines[hash(`${today}|${slot.id}|line`) % slot.lines.length]);
    out.push(deliver(text, sendAt, 'greeting', slot.id, partner, 'greeting'));
  }

  // Occasion greeting (the partner's own line from the occasion, skipping unwritten templates).
  if (now >= localAt(today, '07:00')) {
    for (const occ of currentOccasions()) {
      const k = `occ:${occ.id}`;
      if (!occ.greeting || p.greetings[k] === today) continue;
      p.greetings[k] = today;
      const line = OCCASION_DIALOGUE[occ.greeting]?.find((l) => l.speaker !== 'narrator'
        && (occ.literal ? l.speaker : store.cast(l.speaker)) === store.partner() && !l.text.includes('⟦'));
      if (!line) continue;
      const text = occ.literal ? store.fmtLiteral(line.text) : store.fmt(line.text);
      out.push(deliver(text, now, 'greeting', k, partner, 'greeting'));
    }
  }

  // Calendar reminders.
  for (const r of p.reminders) {
    if (r.deleted || !r.enabled) continue;
    const since = r.lastFired ?? r.createdAt;
    const due = occurrences(r, since + 1, now + 1, 1000);
    if (!due.length) continue;
    const latest = due[due.length - 1];
    r.lastFired = latest;
    if (now - latest > CATCH_UP) {
      log({ title: r.title, body: `Missed while away${due.length > 1 ? ` (${due.length}×)` : ''}`, at: latest, source: 'reminder', refId: r.id, missed: true });
      continue;
    }
    const missed = now - latest > 2 * 60_000;
    out.push(deliver(reminderText(r.title, r.note, latest, missed), latest, 'reminder', r.id, r.title, 'reminder'));
  }

  if (out.length) {
    store.save();
    bus.emit('phone:notify', out);
  }
  return out;
}

let timer: number | undefined;
let ready = false;
/** Start the background pass: every 15 s while a story is loaded, plus on resume and when reminders change. */
export function startScheduler() {
  const run = () => { if (ready && store.hasGame) runScheduler(); };
  bus.on('world-ready', () => { ready = true; run(); });
  bus.on('to-title', () => { ready = false; });
  bus.on('reminders', run);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) run(); });
  clearInterval(timer);
  timer = window.setInterval(run, 15_000);
}

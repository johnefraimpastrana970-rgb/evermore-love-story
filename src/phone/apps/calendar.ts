import { registerApp, setNextReminderLabel } from '../phone';
import { store } from '../../core/store';
import { bus } from '../../core/events';
import { esc } from '../../ui/dom';
import { OCCASIONS } from '../../content/occasions';
import { activeOccasions } from '../../systems/occasions';
import { uid, type Reminder, type Repeat } from '../types';
import { deviceTz, isValidReminder, nextOccurrence, occurrences, REPEAT_LABEL } from '../scheduler/rules';
import { changed, confirmSheet, dayLabel, timeLabel } from './util';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DAY = 86_400_000;

/** Reminders that can fire (not deleted). */
export const liveReminders = () => store.state.phone.reminders.filter((r) => !r.deleted);

/** Soonest upcoming reminder across all of them. */
export function upcoming(after = Date.now(), count = 5): { r: Reminder; at: number }[] {
  return liveReminders()
    .map((r) => ({ r, at: nextOccurrence(r, after) }))
    .filter((x): x is { r: Reminder; at: number } => x.at !== null)
    .sort((a, b) => a.at - b.at)
    .slice(0, count);
}

/** "Today 8:00 AM", "Tomorrow 9:30 AM", "Sat, Nov 14 9:30 AM" (calendar days, not 24h windows). */
export function whenLabel(at: number) {
  const d = new Date(at), now = new Date();
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / DAY);
  const day = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday'
    : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} ${timeLabel(at)}`;
}

setNextReminderLabel(() => {
  if (!store.hasGame) return null;
  const n = upcoming(Date.now(), 1)[0];
  return n ? `${whenLabel(n.at)} · ${n.r.title}` : null;
});

/** Occasions (from content/occasions.ts) that fall on a date. Disabled templates are skipped. */
function occasionsOn(date: Date) {
  return activeOccasions(OCCASIONS, date);
}

registerApp({
  id: 'calendar',
  name: 'Calendar',
  open(ctx) {
    const q = ctx.params.get('date');
    let sel = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? new Date(`${q}T12:00`) : new Date();
    if (Number.isNaN(sel.getTime())) sel = new Date();
    let month = new Date(sel.getFullYear(), sel.getMonth(), 1);

    const view = () => {
      ctx.title(month.toLocaleDateString([], { month: 'long', year: 'numeric' }));
      ctx.onBack(null);
      ctx.action('＋', () => form(null), 'New reminder');
      const first = new Date(month);
      const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
      const gridEnd = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + 42);
      // Dots for every reminder occurrence visible in the grid.
      const marks = new Map<string, number>();
      for (const r of liveReminders()) for (const t of occurrences(r, gridStart.getTime(), gridEnd.getTime(), 200)) {
        const k = ymd(new Date(t));
        marks.set(k, (marks.get(k) ?? 0) + 1);
      }
      const today = ymd(new Date());
      const cells: string[] = [];
      for (let i = 0; i < 42; i++) {
        const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
        const k = ymd(d);
        const occ = occasionsOn(d).length > 0;
        const n = marks.get(k) ?? 0;
        cells.push(`<button class="cal-d ${d.getMonth() !== month.getMonth() ? 'out' : ''} ${k === today ? 'today' : ''} ${k === ymd(sel) ? 'sel' : ''}" data-d="${k}" aria-label="${d.toLocaleDateString([], { dateStyle: 'full' })}">
          <span>${d.getDate()}</span><i>${occ ? '<b class="o">★</b>' : ''}${n ? '<b class="r"></b>'.repeat(Math.min(3, n)) : ''}</i></button>`);
      }
      const wd = Array.from({ length: 7 }, (_, i) => new Date(2026, 1, 1 + i).toLocaleDateString([], { weekday: 'narrow' }));
      ctx.host.innerHTML = `<div class="cal">
        <div class="cal-nav"><button data-m="-1" aria-label="Previous month">‹</button><button data-today>Today</button><button data-m="1" aria-label="Next month">›</button></div>
        <div class="cal-wd">${wd.map((w) => `<span>${w}</span>`).join('')}</div>
        <div class="cal-grid">${cells.join('')}</div>
        <div class="cal-agenda"></div></div>`;
      ctx.host.querySelectorAll<HTMLElement>('[data-m]').forEach((b) => b.addEventListener('click', () => shift(Number(b.dataset.m))));
      ctx.host.querySelector('[data-today]')!.addEventListener('click', () => { sel = new Date(); month = new Date(sel.getFullYear(), sel.getMonth(), 1); view(); });
      ctx.host.querySelectorAll<HTMLElement>('[data-d]').forEach((b) => b.addEventListener('click', () => {
        sel = new Date(`${b.dataset.d}T12:00`);
        if (sel.getMonth() !== month.getMonth()) month = new Date(sel.getFullYear(), sel.getMonth(), 1);
        view();
      }));
      let sx = 0;
      const grid = ctx.host.querySelector('.cal-grid') as HTMLElement;
      grid.addEventListener('pointerdown', (e) => { sx = e.clientX; });
      grid.addEventListener('pointerup', (e) => { const dx = e.clientX - sx; if (Math.abs(dx) > 50) shift(dx < 0 ? 1 : -1); });
      agenda();
    };

    const shift = (n: number) => {
      month = new Date(month.getFullYear(), month.getMonth() + n, 1);
      sel = new Date(month);
      view();
    };

    const agenda = () => {
      const host = ctx.host.querySelector('.cal-agenda') as HTMLElement;
      const start = new Date(sel.getFullYear(), sel.getMonth(), sel.getDate()).getTime();
      const items = liveReminders().flatMap((r) => occurrences(r, start, start + DAY, 10).map((at) => ({ r, at }))).sort((a, b) => a.at - b.at);
      const occ = occasionsOn(sel);
      host.innerHTML = `<h4>${esc(sel.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }))}</h4>
        ${occ.map((o) => `<div class="ag-occ">★ ${esc(store.fmtLiteral(o.name))}</div>`).join('')}
        ${items.map(({ r, at }) => `<button class="ag-item" data-r="${r.id}"><time>${timeLabel(at)}</time><span><b>${esc(r.title)}</b>
          <small>${esc(REPEAT_LABEL[r.repeat])}${r.tz ? ` · ${esc(r.tz)}` : ''}${r.note ? ` · ${esc(r.note)}` : ''}</small></span></button>`).join('')}
        ${!items.length && !occ.length ? `<p class="ag-empty">Nothing on this day. <button class="linkish" data-add>Add a reminder</button></p>` : ''}
        ${disabledCount() ? `<p class="ag-off">${disabledCount()} reminder(s) switched off · <button class="linkish" data-list>See all</button></p>` : `<p class="ag-off"><button class="linkish" data-list>All reminders</button></p>`}`;
      host.querySelectorAll<HTMLElement>('[data-r]').forEach((b) => b.addEventListener('click', () => form(liveReminders().find((r) => r.id === b.dataset.r) ?? null)));
      host.querySelector('[data-add]')?.addEventListener('click', () => form(null));
      host.querySelector('[data-list]')?.addEventListener('click', all);
    };
    const disabledCount = () => liveReminders().filter((r) => !r.enabled).length;

    const all = () => {
      ctx.title('Reminders');
      ctx.action('＋', () => form(null), 'New reminder');
      ctx.onBack(() => { view(); return true; });
      const list = liveReminders().sort((a, b) => (nextOccurrence(a, Date.now()) ?? Infinity) - (nextOccurrence(b, Date.now()) ?? Infinity));
      ctx.host.innerHTML = list.length ? `<ul class="ph-list">${list.map((r) => {
        const n = nextOccurrence(r, Date.now());
        return `<li><button class="ph-row ${r.enabled ? '' : 'off'}" data-r="${r.id}"><span><b>${esc(r.title)}</b>
          <small>${r.enabled ? (n ? `Next: ${esc(whenLabel(n))}` : 'Already passed') : 'Off'} · ${esc(REPEAT_LABEL[r.repeat])}</small></span></button></li>`;
      }).join('')}</ul>` : '<div class="ph-empty"><b>🔔</b>No reminders yet.</div>';
      ctx.host.querySelectorAll<HTMLElement>('[data-r]').forEach((b) => b.addEventListener('click', () => form(liveReminders().find((r) => r.id === b.dataset.r) ?? null, all)));
    };

    const form = (r: Reminder | null, backTo: () => void = view) => {
      const tz = deviceTz();
      const now = new Date();
      const defTime = `${pad(Math.min(23, now.getHours() + 1))}:00`;
      ctx.title(r ? 'Edit reminder' : 'New reminder');
      ctx.action(null);
      ctx.onBack(() => { backTo(); return true; });
      const repeats = Object.keys(REPEAT_LABEL) as Repeat[];
      ctx.host.innerHTML = `<form class="ph-form" novalidate>
        <label>Title<input name="title" maxlength="60" required placeholder="e.g. Drink water" value="${esc(r?.title ?? '')}"></label>
        <div class="ph-2col"><label>Date<input name="date" type="date" required value="${r?.date ?? ymd(sel)}"></label>
        <label>Time<input name="time" type="time" required value="${r?.time ?? defTime}"></label></div>
        <label>Repeat<select name="repeat">${repeats.map((k) => `<option value="${k}" ${(r?.repeat ?? 'none') === k ? 'selected' : ''}>${REPEAT_LABEL[k]}</option>`).join('')}</select></label>
        <label>Note<textarea name="note" rows="2" maxlength="200" placeholder="Optional">${esc(r?.note ?? '')}</textarea></label>
        <label class="ph-check"><input type="checkbox" name="lock" ${r?.tz ? 'checked' : ''}> <span>Keep in ${esc(r?.tz || tz)} time<small>Off: follows your phone’s time zone when you travel.</small></span></label>
        ${r ? `<label class="ph-check"><input type="checkbox" name="enabled" ${r.enabled ? 'checked' : ''}> <span>Reminder on</span></label>` : ''}
        <p class="ph-error hidden"></p>
        <div class="ph-row-btns">${r ? '<button type="button" class="ph-btn danger" data-del>Delete</button>' : ''}<button class="ph-btn">Save</button></div>
      </form>`;
      const f = ctx.host.querySelector('form') as HTMLFormElement;
      const err = f.querySelector('.ph-error') as HTMLElement;
      const v = (k: string) => (f.elements.namedItem(k) as HTMLInputElement);
      if (!r) v('title').focus();
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = v('title').value.trim();
        const rec = { date: v('date').value, time: v('time').value };
        const problem = !title ? 'Please give it a title.' : !isValidReminder(rec) ? 'Please pick a valid date and time.' : '';
        if (problem) { err.textContent = problem; err.classList.remove('hidden'); return; }
        const t = Date.now();
        const target: Reminder = r ?? { id: uid('r'), title, date: rec.date, time: rec.time, tz: '', repeat: 'none', enabled: true, createdAt: t, updatedAt: t };
        Object.assign(target, {
          title, ...rec,
          repeat: v('repeat').value as Repeat,
          note: v('note').value.trim() || undefined,
          tz: v('lock').checked ? (r?.tz || tz) : '',
          enabled: r ? v('enabled').checked : true,
          updatedAt: t,
          lastFired: Math.max(target.lastFired ?? 0, t - 60_000), // editing never re-sends past occurrences
        });
        if (!r) store.state.phone.reminders.push(target);
        changed();
        bus.emit('reminders');
        sel = new Date(`${target.date}T12:00`);
        month = new Date(sel.getFullYear(), sel.getMonth(), 1);
        const next = nextOccurrence(target, Date.now());
        backTo();
        const note = ctx.host.querySelector('.cal-agenda h4, .ph-list') as HTMLElement | null;
        if (note && target.enabled) note.insertAdjacentHTML('beforebegin', `<p class="ph-toast">${next ? `Saved · next ${esc(whenLabel(next))}` : 'Saved · that time has already passed'}</p>`);
      });
      f.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!r || !(await confirmSheet(ctx.host, `Delete “${r.title}”?`))) return;
        r.deleted = true;
        r.updatedAt = Date.now();
        changed();
        bus.emit('reminders');
        backTo();
      });
    };

    if (ctx.params.get('reminder')) {
      const r = liveReminders().find((x) => x.id === ctx.params.get('reminder'));
      if (r) { sel = new Date(`${r.date}T12:00`); view(); form(r); return; }
    }
    view();
  },
});

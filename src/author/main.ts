import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/caveat/700.css';
import './author.css';
import { PERSONAL_TEMPLATES } from '../content/personal';
import { OCCASION_TEMPLATES } from '../content/occasions';
import { AUTHORABLE_OCCASIONS, PERSONAL_KINDS, normalizeAuthored, type AuthoredContent, type OccasionOverride } from '../content/authored';
import type { PersonalEntry, PersonalKind } from '../content/types';
import { SPECIALS, bloomFlag } from '../garden/data';

const bloomOf = (e: PersonalEntry) => SPECIALS.find((s) => e.unlock?.flag === bloomFlag(s.id));

/*
 * Author mode: write the letters, memories, photos and special days for her.
 * Runs only with `npm run author` (a local page with a small save API, see tools/vite-author.ts).
 * Everything is saved to src/content/authored.json and goes into the game on the next build.
 */

const KIND: Record<PersonalKind, { label: string; icon: string; where: string }> = {
  letter: { label: 'Letters', icon: '💌', where: 'the mailbox in the backyard' },
  message: { label: 'Daily messages', icon: '💬', where: 'the welcome card, one per day' },
  memory: { label: 'Memories', icon: '📌', where: 'the memory board in the bedroom' },
  photo: { label: 'Photos', icon: '📷', where: 'the journal, Memory game and Photo Puzzle' },
  joke: { label: 'Inside jokes', icon: '😂', where: 'the kitchen fridge' },
  date: { label: 'Dates', icon: '📅', where: 'the living-room calendar and picnic table' },
  challenge: { label: 'Challenges', icon: '🏅', where: 'the school board (she ticks them off for XP)' },
  surprise: { label: 'Surprises', icon: '🎁', where: 'hidden secrets and special days' },
};
const OCC_INFO: Record<string, { label: string; hint: string; monthly?: boolean }> = {
  anniversary: { label: 'Our anniversary', hint: 'Hearts, lights and a surprise all day.' },
  'her-birthday': { label: 'Her birthday', hint: 'Balloons and confetti; the banner uses her real name.' },
  'his-birthday': { label: 'Your birthday', hint: 'She gets a little celebration for you.' },
  monthsary: { label: 'Monthsary', hint: 'Every month on this day.', monthly: true },
};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const app = document.getElementById('author')!;
let data: AuthoredContent = normalizeAuthored({});
let tab: 'entries' | 'garden' | 'days' | 'names' | 'backup' = 'entries';
let filter: PersonalKind | 'all' = 'all';
let saveTimer = 0;
let saving: Promise<void> = Promise.resolve();

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const strip = (s = '') => s.replace(/[⟦⟧]/g, '').trim();
const template = (id: string) => PERSONAL_TEMPLATES.find((t) => t.id === id);
const authored = (id: string) => data.entries.find((e) => e.id === id);

// ------------------------------------------------------------------ saving

function setStatus(text: string, kind: 'ok' | 'busy' | 'err' = 'ok') {
  const s = document.querySelector('.au-status');
  if (s) { s.textContent = text; s.className = `au-status ${kind}`; }
}
function scheduleSave() {
  setStatus('Saving…', 'busy');
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveNow, 500);
}
function saveNow() {
  clearTimeout(saveTimer);
  data = normalizeAuthored(data);
  const body = JSON.stringify(data);
  saving = saving.then(async () => {
    try {
      const r = await fetch('/__author/content', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? r.statusText);
      setStatus('Saved ✓');
    } catch (e) {
      setStatus(`Not saved: ${e instanceof Error ? e.message : e}`, 'err');
    }
  });
  return saving;
}
window.addEventListener('beforeunload', (e) => { if (saveTimer && document.querySelector('.au-status.busy')) { saveNow(); e.preventDefault(); } });

/** Shrink big phone photos before saving (keeps the app small). */
async function uploadPhoto(file: File): Promise<string> {
  let blob: Blob = file;
  let name = file.name;
  if (file.type !== 'image/gif') {
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
      const png = file.type === 'image/png' && k === 1;
      blob = png ? file : await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not read the image'))), 'image/jpeg', 0.86));
      if (!png) name = name.replace(/\.[^.]+$/, '') + '.jpg';
    } catch { /* unusual format: upload as-is */ }
  }
  const r = await fetch(`/__author/photo?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? 'Upload failed');
  return j.path as string;
}

// ------------------------------------------------------------------ entries

/** Create (or return) the authored copy of an entry, starting from its template. */
function own(id: string): PersonalEntry {
  let e = authored(id);
  if (e) return e;
  const t = template(id)!;
  e = { id, kind: t.kind, title: strip(t.title), unlock: t.unlock ? { ...t.unlock } : undefined, rewardXp: t.rewardXp, tags: t.tags ? [...t.tags] : undefined };
  if (t.date && !t.date.includes('⟦')) e.date = t.date;
  e.body = '';
  data.entries.push(e);
  return e;
}
function unlockText(e: PersonalEntry): string {
  const u = e.unlock ?? {};
  const parts: string[] = [];
  if (u.minLevel) parts.push(`from level ${u.minLevel}`);
  if (u.time?.length) parts.push(`only at ${u.time.join('/')}`);
  if (u.secret) parts.push('when she finds a hidden secret');
  if (u.occasion) parts.push(`on ${OCCASION_TEMPLATES.find((o) => o.id === u.occasion)?.name.replace(/[⟦⟧]/g, '') ?? u.occasion}`);
  if (u.questDone) parts.push('after a story chapter');
  const bloom = bloomOf(e);
  if (bloom) parts.push(`when the ${bloom.name} ${bloom.emoji} first blooms in the garden`);
  else if (u.flag) parts.push('after a story moment');
  return parts.length ? parts.join(', ') : 'from the start';
}
function problems(e: PersonalEntry | undefined, kind: PersonalKind): string[] {
  if (!e) return [];
  const p: string[] = [];
  if (!e.title.trim()) p.push('needs a title');
  if (kind === 'photo' && !e.image) p.push('needs a photo');
  if (kind !== 'photo' && !(e.body ?? '').trim()) p.push('nothing written yet');
  return p;
}
function statusChip(id: string, kind: PersonalKind) {
  const e = authored(id);
  const isNew = !template(id);
  if (!e) return '<span class="chip tmpl">Template · not written</span>';
  const p = problems(e, kind);
  if (p.length) return `<span class="chip warn">⚠ ${esc(p.join(', '))}</span>`;
  return `<span class="chip ok">${isNew ? 'New · ' : ''}Written ✓</span>`;
}

function entryCard(id: string): string {
  const t = template(id);
  const e = authored(id);
  const kind = (e ?? t)!.kind;
  const shown = (e ?? t)!;
  const photo = kind === 'photo' || kind === 'memory';
  const dated = kind === 'memory' || kind === 'date';
  const img = e?.image;
  return `<article class="card" data-id="${esc(id)}">
    <header><span class="kind">${KIND[kind].icon} ${esc(KIND[kind].label.replace(/s$/, ''))}</span><span class="status">${statusChip(id, kind)}</span></header>
    <p class="when">She sees it ${esc(unlockText(shown))} · in ${esc(KIND[kind].where)}</p>
    <label>Title <span>(shown to her)</span><input data-f="title" maxlength="200" value="${esc(e?.title ?? '')}" placeholder="${esc(strip(t?.title) || 'A title')}"></label>
    ${dated ? `<label>Date <span>(as you want it shown, e.g. 14 Feb 2024)</span><input data-f="date" maxlength="40" value="${esc(e?.date ?? '')}" placeholder="When was it?"></label>` : ''}
    ${kind !== 'photo' ? `<label>${kind === 'letter' ? 'Letter' : 'Text'} <span>({her} and {him} become your names)</span><textarea data-f="body" rows="${kind === 'letter' ? 9 : 4}" placeholder="${esc(strip(t?.body) || 'Write it here…')}">${esc(e?.body ?? '')}</textarea></label>` : ''}
    ${photo ? `<div class="photo-row">${img ? `<img src="/${esc(img)}" alt="">` : '<div class="noimg">No photo</div>'}
      <label class="btn ghost">${img ? 'Change photo' : 'Add a photo'}<input type="file" accept="image/*" data-photo hidden></label>
      ${img ? '<button class="btn ghost" data-nophoto>Remove photo</button>' : ''}</div>` : ''}
    <div class="row">
      <label class="inline">From level <input type="number" min="1" max="999" data-f="minLevel" value="${shown.unlock?.minLevel ?? ''}" placeholder="any"></label>
      ${!shown.unlock?.flag || bloomOf(shown) ? `<label class="inline">🌷 When a garden flower blooms <select data-bloom><option value="">—</option>${SPECIALS.map((s) => `<option value="${s.id}" ${bloomOf(shown)?.id === s.id ? 'selected' : ''}>${s.emoji} ${esc(s.name)}</option>`).join('')}</select></label>` : ''}
      ${kind === 'challenge' ? `<label class="inline">XP reward <input type="number" min="0" max="5000" data-f="rewardXp" value="${shown.rewardXp ?? 100}"></label>` : ''}
      <span class="grow"></span>
      ${t ? (e ? '<button class="btn ghost" data-reset>Back to template</button>' : '') : '<button class="btn danger" data-del>Delete</button>'}
    </div>
  </article>`;
}

function bindCard(card: HTMLElement) {
  const id = card.dataset.id!;
  const kind = (authored(id) ?? template(id))!.kind;
  const refreshChip = () => { card.querySelector('.status')!.innerHTML = statusChip(id, kind); updateCounts(); };
  // A just-uploaded photo can take a moment before the dev server serves it: retry once.
  const thumb = card.querySelector<HTMLImageElement>('.photo-row img');
  thumb?.addEventListener('error', () => {
    if (thumb.dataset.retried) return;
    thumb.dataset.retried = '1';
    setTimeout(() => { thumb.src = `${thumb.src.split('?')[0]}?t=${Date.now()}`; }, 600);
  });
  card.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-f]').forEach((inp) => inp.addEventListener('input', () => {
    const e = own(id);
    const f = inp.dataset.f!;
    if (f === 'minLevel') {
      const n = Number(inp.value);
      e.unlock = { ...(e.unlock ?? {}) };
      if (inp.value && Number.isInteger(n) && n >= 1) e.unlock.minLevel = n; else delete e.unlock.minLevel;
    } else if (f === 'rewardXp') e.rewardXp = Math.max(0, Math.min(5000, Number(inp.value) || 0));
    else (e as unknown as Record<string, string>)[f] = inp.value;
    // A template that was only just opened gets its title from the hint, so it never stays empty.
    if (f !== 'title' && !e.title.trim()) {
      e.title = strip(template(id)?.title) || e.title;
      const ti = card.querySelector<HTMLInputElement>('[data-f=title]');
      if (ti && !ti.value) ti.value = e.title;
    }
    refreshChip();
    scheduleSave();
  }));
  card.querySelector<HTMLSelectElement>('[data-bloom]')?.addEventListener('change', (ev) => {
    const e = own(id);
    const sp = (ev.target as HTMLSelectElement).value;
    e.unlock = { ...(e.unlock ?? {}) };
    if (sp) e.unlock.flag = bloomFlag(sp); else delete e.unlock.flag;
    if (!e.title.trim()) e.title = strip(template(id)?.title) || e.title;
    card.querySelector('.when')!.textContent = `She sees it ${unlockText(e)} · in ${KIND[kind].where}`;
    refreshChip();
    scheduleSave();
  });
  card.querySelector<HTMLInputElement>('[data-photo]')?.addEventListener('change', async (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    setStatus('Uploading photo…', 'busy');
    try {
      const path = await uploadPhoto(file);
      const e = own(id);
      e.image = path;
      if (!e.title.trim()) e.title = strip(template(id)?.title) || 'A photo of us';
      await saveNow();
      renderEntries();
    } catch (err) { setStatus(`Photo not saved: ${err instanceof Error ? err.message : err}`, 'err'); }
  });
  card.querySelector('[data-nophoto]')?.addEventListener('click', () => { delete own(id).image; scheduleSave(); renderEntries(); });
  card.querySelector('[data-reset]')?.addEventListener('click', () => {
    if (!confirm('Throw away what you wrote here and go back to the empty template?')) return;
    data.entries = data.entries.filter((x) => x.id !== id);
    scheduleSave(); renderEntries();
  });
  card.querySelector('[data-del]')?.addEventListener('click', () => {
    if (!confirm('Delete this entry?')) return;
    data.entries = data.entries.filter((x) => x.id !== id);
    scheduleSave(); renderEntries();
  });
}

function allIds(): string[] {
  const ids = PERSONAL_TEMPLATES.map((t) => t.id);
  for (const e of data.entries) if (!ids.includes(e.id)) ids.push(e.id);
  return ids;
}
function updateCounts() {
  const written = PERSONAL_TEMPLATES.filter((t) => { const e = authored(t.id); return e && !problems(e, t.kind).length; }).length;
  const extra = data.entries.filter((e) => !template(e.id)).length;
  const el = document.querySelector('.au-count');
  if (el) el.textContent = `${written} of ${PERSONAL_TEMPLATES.length} templates written${extra ? ` · ${extra} extra` : ''}`;
}

function renderEntries() {
  const main = document.querySelector('.au-main') as HTMLElement;
  const ids = allIds().filter((id) => filter === 'all' || (authored(id) ?? template(id))!.kind === filter);
  main.innerHTML = `<div class="filters">
      <button data-k="all" class="${filter === 'all' ? 'on' : ''}">All</button>
      ${PERSONAL_KINDS.map((k) => `<button data-k="${k}" class="${filter === k ? 'on' : ''}">${KIND[k].icon} ${KIND[k].label}</button>`).join('')}
    </div>
    <div class="addbar"><span class="au-count"></span><span class="grow"></span>
      <select data-newkind>${PERSONAL_KINDS.map((k) => `<option value="${k}" ${filter === k ? 'selected' : ''}>${KIND[k].icon} ${KIND[k].label.replace(/s$/, '')}</option>`).join('')}</select>
      <button class="btn" data-add>+ Add new</button></div>
    <div class="cards">${ids.map(entryCard).join('') || '<p class="empty">Nothing here yet.</p>'}</div>`;
  main.querySelectorAll<HTMLElement>('[data-k]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.k as PersonalKind | 'all'; renderEntries(); }));
  main.querySelector('[data-add]')!.addEventListener('click', () => {
    const kind = (main.querySelector('[data-newkind]') as HTMLSelectElement).value as PersonalKind;
    let n = 1;
    while (allIds().includes(`my-${kind}-${n}`)) n++;
    const e: PersonalEntry = { id: `my-${kind}-${n}`, kind, title: '', body: '' };
    if (kind === 'challenge') e.rewardXp = 100;
    data.entries.push(e);
    filter = kind;
    scheduleSave();
    renderEntries();
    const cards = main.querySelectorAll<HTMLElement>('.card');
    const last = cards[cards.length - 1];
    last?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    last?.querySelector<HTMLInputElement>('[data-f=title]')?.focus();
  });
  main.querySelectorAll<HTMLElement>('.card').forEach(bindCard);
  updateCounts();
}

// ------------------------------------------------------------------ garden: special flowers

function renderGarden() {
  const main = document.querySelector('.au-main') as HTMLElement;
  main.innerHTML = `<p class="lead">Six special flowers grow from mystery seeds in the garden (from level 5), always in this order.
      When one blooms for the first time, your little scene plays, and any letter, photo or memory you linked to it opens in her Journal.</p>
    <div class="cards">${SPECIALS.map((s, i) => {
      const linked = data.entries.filter((e) => bloomOf(e)?.id === s.id);
      return `<article class="card" data-sp="${s.id}">
        <header><span class="kind">${s.emoji} ${i + 1}. ${esc(s.name)}</span><span class="status">${data.garden[s.id]?.scene ? '<span class="chip ok">Scene written ✓</span>' : '<span class="chip tmpl">Default line</span>'}</span></header>
        <p class="when">Grows in ${s.growMin >= 60 ? `${s.growMin / 60} h` : `${s.growMin} min`} · before it blooms she reads: “${esc(s.hint)}”</p>
        <label>The scene when it blooms <span>(one line each; start with <b>her:</b> or <b>him:</b> for who says it, anything else is narration)</span>
          <textarea data-scene rows="5" placeholder="him: ${esc(s.line)}">${esc(data.garden[s.id]?.scene ?? '')}</textarea></label>
        <div class="row"><span class="when">${linked.length ? `Opens with it: ${linked.map((e) => `${KIND[e.kind].icon} ${esc(e.title || 'untitled')}`).join(', ')}` : 'Nothing linked yet.'}</span><span class="grow"></span>
          <select data-kind>${(['letter', 'photo', 'memory', 'surprise'] as PersonalKind[]).map((k) => `<option value="${k}">${KIND[k].icon} ${KIND[k].label.replace(/s$/, '')}</option>`).join('')}</select>
          <button class="btn ghost" data-link>+ Write one for this flower</button></div>
      </article>`;
    }).join('')}</div>`;
  main.querySelectorAll<HTMLElement>('[data-sp]').forEach((card) => {
    const id = card.dataset.sp!;
    card.querySelector('[data-scene]')!.addEventListener('input', (e) => {
      const v = (e.target as HTMLTextAreaElement).value;
      if (v.trim()) data.garden[id] = { scene: v }; else delete data.garden[id];
      card.querySelector('.status')!.innerHTML = v.trim() ? '<span class="chip ok">Scene written ✓</span>' : '<span class="chip tmpl">Default line</span>';
      scheduleSave();
    });
    card.querySelector('[data-link]')!.addEventListener('click', () => {
      const kind = (card.querySelector('[data-kind]') as HTMLSelectElement).value as PersonalKind;
      let n = 1;
      while (allIds().includes(`garden-${kind}-${n}`)) n++;
      data.entries.push({ id: `garden-${kind}-${n}`, kind, title: '', body: '', unlock: { flag: bloomFlag(id) } });
      filter = kind;
      tab = 'entries';
      scheduleSave();
      render();
      const cards = document.querySelectorAll<HTMLElement>('.card');
      const last = cards[cards.length - 1];
      last?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      last?.querySelector<HTMLInputElement>('[data-f=title]')?.focus();
    });
  });
}

// ------------------------------------------------------------------ special days

function renderDays() {
  const main = document.querySelector('.au-main') as HTMLElement;
  main.innerHTML = `<p class="lead">Turn on the days that matter to you two. On each day the game decorates every room, plays your message once, and gives bonus XP.</p>
    <div class="cards">${AUTHORABLE_OCCASIONS.map((id) => {
      const info = OCC_INFO[id];
      const t = OCCASION_TEMPLATES.find((o) => o.id === id)!;
      const o: OccasionOverride = data.occasions[id] ?? { enabled: false };
      const r = o.rule;
      const month = r?.type === 'yearly' ? r.month : 0;
      const day = r ? r.day : 0;
      return `<article class="card day" data-occ="${id}">
        <header><span class="kind">🎉 ${esc(info.label)}</span>
          <label class="switch"><input type="checkbox" data-on ${o.enabled ? 'checked' : ''}><span></span> Celebrate</label></header>
        <p class="when">${esc(info.hint)}</p>
        <div class="row">
          ${info.monthly ? '' : `<label class="inline">Month <select data-month><option value="0">—</option>${MONTHS.map((m, i) => `<option value="${i + 1}" ${month === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label>`}
          <label class="inline">Day <select data-day><option value="0">—</option>${Array.from({ length: 31 }, (_, i) => `<option ${day === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label>
          <span class="day-warn"></span>
        </div>
        <label>Name of the day <span>(the banner)</span><input data-name maxlength="80" value="${esc(o.name ?? '')}" placeholder="${esc(strip(t.name))}"></label>
        <label>What you say that day <span>(a blank line starts a new speech bubble)</span><textarea data-greet rows="4" placeholder="Your message…">${esc(o.greeting ?? '')}</textarea></label>
      </article>`;
    }).join('')}</div>`;
  main.querySelectorAll<HTMLElement>('[data-occ]').forEach((card) => {
    const id = card.dataset.occ!;
    const monthly = !!OCC_INFO[id].monthly;
    const sync = () => {
      const o: OccasionOverride = data.occasions[id] ?? { enabled: false };
      const m = Number((card.querySelector('[data-month]') as HTMLSelectElement | null)?.value ?? 0);
      const d = Number((card.querySelector('[data-day]') as HTMLSelectElement).value);
      o.rule = monthly ? (d ? { type: 'monthly', day: d } : undefined) : (m && d ? { type: 'yearly', month: m, day: d, durationDays: 1 } : undefined);
      o.enabled = (card.querySelector('[data-on]') as HTMLInputElement).checked;
      o.name = (card.querySelector('[data-name]') as HTMLInputElement).value;
      o.greeting = (card.querySelector('[data-greet]') as HTMLTextAreaElement).value;
      data.occasions[id] = o;
      const bad = !monthly && m && d && d > new Date(2024, m, 0).getDate();
      card.querySelector('.day-warn')!.textContent = o.enabled && !o.rule ? '⚠ Pick the date to turn it on' : bad ? '⚠ That month is shorter' : '';
      scheduleSave();
    };
    card.querySelectorAll('input, select, textarea').forEach((x) => x.addEventListener(x.tagName === 'SELECT' || (x as HTMLInputElement).type === 'checkbox' ? 'change' : 'input', sync));
  });
}

// ------------------------------------------------------------------ names & words

function renderNames() {
  const main = document.querySelector('.au-main') as HTMLElement;
  main.innerHTML = `<div class="cards">
    <article class="card"><header><span class="kind">💕 Names</span></header>
      <p class="when">Filled in for her when she starts a New Story (she can still change them).</p>
      <div class="row"><label class="inline grow">Her name <input data-her maxlength="40" value="${esc(data.names.her)}"></label>
      <label class="inline grow">Your name <input data-him maxlength="40" value="${esc(data.names.him)}"></label></div></article>
    <article class="card"><header><span class="kind">🧩 Inside-joke words</span></header>
      <p class="when">Extra words for the chalkboard puzzle. Letters only, at least 3, separated by commas or new lines.</p>
      <textarea data-words rows="4" placeholder="PANCAKES, CHICHI, …">${esc(data.words.join(', '))}</textarea></article>
    <article class="card"><header><span class="kind">🙈 Unwritten templates</span></header>
      <label class="switch big"><input type="checkbox" data-hide ${data.hideTemplates ? 'checked' : ''}><span></span> Hide every template I haven’t written yet</label>
      <p class="when">Recommended before you give her the game, so she never sees the striped ⟦…⟧ placeholders.</p></article>
  </div>`;
  main.querySelector('[data-her]')!.addEventListener('input', (e) => { data.names.her = (e.target as HTMLInputElement).value; scheduleSave(); });
  main.querySelector('[data-him]')!.addEventListener('input', (e) => { data.names.him = (e.target as HTMLInputElement).value; scheduleSave(); });
  main.querySelector('[data-words]')!.addEventListener('input', (e) => { data.words = (e.target as HTMLTextAreaElement).value.split(/[,\n]/).map((w) => w.trim()); scheduleSave(); });
  main.querySelector('[data-hide]')!.addEventListener('change', (e) => { data.hideTemplates = (e.target as HTMLInputElement).checked; scheduleSave(); });
}

// ------------------------------------------------------------------ backup

interface Backup { format: 'evermore-author-backup'; version: 1; savedAt: string; content: AuthoredContent; photos: Record<string, string> }

const toDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(r.error); r.readAsDataURL(b); });

async function exportBackup() {
  await saveNow();
  const photos: Record<string, string> = {};
  for (const e of data.entries) {
    if (!e.image?.startsWith('assets/') || photos[e.image]) continue;
    const r = await fetch('/' + e.image);
    if (r.ok) photos[e.image] = await toDataUrl(await r.blob());
  }
  const b: Backup = { format: 'evermore-author-backup', version: 1, savedAt: new Date().toISOString(), content: data, photos };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(b)], { type: 'application/json' }));
  a.download = `evermore-content-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  setStatus('Backup downloaded ✓');
}

async function importBackup(file: File) {
  let b: Backup;
  try { b = JSON.parse(await file.text()); } catch { setStatus('That file isn’t an Evermore backup', 'err'); return; }
  if (b?.format !== 'evermore-author-backup' || !b.content) { setStatus('That file isn’t an Evermore backup', 'err'); return; }
  if (!confirm('Replace everything here with this backup? (Your current version is kept in .author-backups/.)')) return;
  setStatus('Restoring…', 'busy');
  const content = normalizeAuthored(b.content);
  const moved = new Map<string, string>();
  for (const [p, url] of Object.entries(b.photos ?? {})) {
    try {
      const blob = await (await fetch(url)).blob();
      const name = p.split('/').pop() || 'photo.jpg';
      const r = await fetch(`/__author/photo?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob });
      if (r.ok) moved.set(p, (await r.json()).path);
    } catch { /* skip a broken photo */ }
  }
  for (const e of content.entries) if (e.image && moved.has(e.image)) e.image = moved.get(e.image);
  data = content;
  await saveNow();
  render();
  setStatus('Backup restored ✓');
}

function renderBackup() {
  const main = document.querySelector('.au-main') as HTMLElement;
  main.innerHTML = `<div class="cards">
    <article class="card"><header><span class="kind">💾 Where your words live</span></header>
      <p>Everything saves by itself to <code>src/content/authored.json</code>. Photos go to <code>public/assets/photos/authored/</code>.
      The last 30 versions are kept in <code>.author-backups/</code>.</p>
      <p>To put it on her phone, build the app as usual (<code>npm run android:sync</code>, then build the APK in Android Studio).</p>
      <p class="warn-note">Anything inside the app can be pulled out by someone technical, so keep truly private things out of it.</p></article>
    <article class="card"><header><span class="kind">⬇️ Export</span></header>
      <p>One file with all your writing and photos, to keep safe or move to another computer.</p>
      <button class="btn" data-export>Download backup</button></article>
    <article class="card"><header><span class="kind">⬆️ Import</span></header>
      <p>Load a backup file. It replaces what is here now.</p>
      <label class="btn ghost">Choose backup file<input type="file" accept="application/json,.json" data-import hidden></label></article>
  </div>`;
  main.querySelector('[data-export]')!.addEventListener('click', () => void exportBackup());
  main.querySelector('[data-import]')!.addEventListener('change', (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void importBackup(f); });
}

// ------------------------------------------------------------------ shell

function render() {
  app.innerHTML = `<header class="au-top">
      <h1>✍️ Evermore <span>Author mode</span></h1>
      <span class="au-status ok">Saved ✓</span>
      <a class="btn ghost" href="/" target="_blank" rel="noopener">Open the game ↗</a>
    </header>
    <nav class="au-tabs">
      ${([['entries', '💌 Letters & memories'], ['garden', '🌷 Garden flowers'], ['days', '🎉 Special days'], ['names', '💕 Names & words'], ['backup', '💾 Backup']] as const)
        .map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}
    </nav>
    <main class="au-main"></main>`;
  app.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab as typeof tab; render(); }));
  ({ entries: renderEntries, garden: renderGarden, days: renderDays, names: renderNames, backup: renderBackup })[tab]();
}

async function start() {
  try {
    const r = await fetch('/__author/content', { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    data = normalizeAuthored(await r.json());
    render();
  } catch {
    app.innerHTML = `<div class="au-off"><h1>✍️ Author mode isn’t running</h1>
      <p>Open a terminal in the game folder and run:</p><pre>npm run author</pre>
      <p>This page only works on your own computer while that command is running.</p></div>`;
  }
}
void start();

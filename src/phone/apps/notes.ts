import { registerApp } from '../phone';
import { store } from '../../core/store';
import { esc } from '../../ui/dom';
import { uid, type PhoneNote } from '../types';
import { changed, confirmSheet, dayLabel, timeLabel } from './util';

registerApp({
  id: 'notes',
  name: 'Notes',
  open(ctx) {
    const notes = () => store.state.phone.notes;
    let query = '';
    let saveTimer: number | undefined;
    /** Saves the note being edited right away (used when leaving or closing the phone). */
    let flush: (() => void) | null = null;

    const list = () => {
      ctx.title('Notes');
      ctx.onBack(null);
      flush = null;
      ctx.action('＋', () => edit(null), 'New note');
      const items = notes().filter((n) => !n.deleted)
        .filter((n) => !query || (n.title + ' ' + n.body).toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt);
      ctx.host.innerHTML = `<div class="ph-search"><input type="search" placeholder="Search notes" value="${esc(query)}" aria-label="Search notes"></div>
        ${items.length ? `<ul class="ph-list notes-list">${items.map((n) => `<li><button class="ph-row" data-id="${n.id}">
          <span><b>${n.pinned ? '📌 ' : ''}${esc(n.title || firstLine(n.body) || 'New note')}</b>
          <small>${esc(dayLabel(n.updatedAt) === 'Today' ? timeLabel(n.updatedAt) : dayLabel(n.updatedAt))} · ${esc(preview(n))}</small></span></button></li>`).join('')}</ul>`
        : `<div class="ph-empty"><b>✎</b>${query ? 'No notes match.' : 'No notes yet. Tap ＋ to write one.'}</div>`}`;
      const search = ctx.host.querySelector('input') as HTMLInputElement;
      search.addEventListener('input', () => { query = search.value; const pos = search.selectionStart; list(); const s2 = ctx.host.querySelector('input') as HTMLInputElement; s2.focus(); s2.setSelectionRange(pos, pos); });
      ctx.host.querySelectorAll<HTMLElement>('[data-id]').forEach((b) => b.addEventListener('click', () => edit(notes().find((n) => n.id === b.dataset.id) ?? null)));
    };

    const edit = (existing: PhoneNote | null) => {
      const now = Date.now();
      const note: PhoneNote = existing ?? { id: uid('n'), title: '', body: '', createdAt: now, updatedAt: now };
      let stored = !!existing;
      ctx.title(existing ? 'Note' : 'New note');
      ctx.host.innerHTML = `<div class="note-edit">
        <input class="note-title" placeholder="Title" maxlength="80" value="${esc(note.title)}" aria-label="Title">
        <small class="note-meta">${existing ? `Edited ${esc(dayLabel(note.updatedAt))} ${esc(timeLabel(note.updatedAt))}` : 'Saved as you type'}</small>
        <textarea class="note-body" placeholder="Write something…" aria-label="Note">${esc(note.body)}</textarea>
        ${existing ? '<button class="ph-btn danger note-del">Delete note</button>' : ''}
      </div>`;
      const title = ctx.host.querySelector('.note-title') as HTMLInputElement;
      const body = ctx.host.querySelector('.note-body') as HTMLTextAreaElement;
      const persist = () => {
        note.title = title.value.trim();
        note.body = body.value;
        if (!note.title && !note.body.trim()) return; // empty notes are not kept
        note.updatedAt = Date.now();
        if (!stored) { notes().push(note); stored = true; }
        changed();
        (ctx.host.querySelector('.note-meta') as HTMLElement).textContent = 'Saved';
      };
      const pinBtn = () => ctx.action(note.pinned ? '📌' : '📍', () => { note.pinned = !note.pinned; persist(); pinBtn(); }, note.pinned ? 'Unpin' : 'Pin');
      pinBtn();
      flush = () => { clearTimeout(saveTimer); persist(); };
      const queue = () => { clearTimeout(saveTimer); saveTimer = window.setTimeout(persist, 350); };
      title.addEventListener('input', queue);
      body.addEventListener('input', queue);
      ctx.host.querySelector('.note-del')?.addEventListener('click', async () => {
        if (!(await confirmSheet(ctx.host, 'Delete this note?'))) return;
        note.deleted = true;
        note.updatedAt = Date.now();
        changed();
        list();
      });
      if (!existing) setTimeout(() => body.focus(), 50);
      ctx.onBack(() => { flush?.(); store.save(); list(); return true; });
    };

    const open = ctx.params.get('id');
    const target = open ? notes().find((n) => n.id === open && !n.deleted) : null;
    if (target) edit(target); else list();
    return () => { flush?.(); };
  },
});

function firstLine(s: string) {
  return s.trim().split('\n')[0].slice(0, 60);
}
function preview(n: PhoneNote) {
  const lines = n.body.trim().split('\n');
  return (n.title ? lines[0] : lines[1] ?? '').slice(0, 60) || 'No additional text';
}

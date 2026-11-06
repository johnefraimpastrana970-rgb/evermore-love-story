import { registerApp, partnerAvatar } from '../phone';
import { store } from '../../core/store';
import { esc } from '../../ui/dom';
import { uid, type PhoneContact } from '../types';
import { changed, confirmSheet } from './util';

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

registerApp({
  id: 'contacts',
  name: 'Contacts',
  open(ctx) {
    const contacts = () => store.state.phone.contacts;

    const list = () => {
      ctx.title('Contacts');
      ctx.onBack(null);
      ctx.action('＋', () => form(null), 'Add contact');
      const items = contacts().filter((c) => !c.deleted).sort((a, b) => a.name.localeCompare(b.name));
      let letter = '';
      ctx.host.innerHTML = `
        <button class="ph-row me-card" data-partner>
          ${partnerAvatar() ? `<img class="ph-ava" src="${partnerAvatar()}" alt="">` : `<span class="ph-ava">${esc(initials(store.partnerName()))}</span>`}
          <span><b>${esc(store.partnerName())} ♡</b><small>Favourite</small></span></button>
        ${items.length ? `<ul class="ph-list">${items.map((c) => {
          const l = c.name[0]?.toUpperCase() ?? '#';
          const head = l !== letter ? `<li class="ph-letter">${esc((letter = l))}</li>` : '';
          return `${head}<li><button class="ph-row" data-id="${c.id}"><span class="ph-ava">${esc(initials(c.name))}</span>
            <span><b>${esc(c.name)}</b>${c.phone ? `<small>${esc(c.phone)}</small>` : ''}</span></button></li>`;
        }).join('')}</ul>` : '<div class="ph-empty small">Add people with ＋. Only the ones you add are here.</div>'}`;
      ctx.host.querySelector('[data-partner]')!.addEventListener('click', partner);
      ctx.host.querySelectorAll<HTMLElement>('[data-id]').forEach((b) => b.addEventListener('click', () => detail(contacts().find((c) => c.id === b.dataset.id)!)));
    };

    const partner = () => {
      ctx.title('');
      ctx.action(null);
      ctx.onBack(() => { list(); return true; });
      ctx.host.innerHTML = `<div class="contact-card">
        ${partnerAvatar() ? `<img class="contact-big" src="${partnerAvatar()}" alt="">` : ''}
        <h2>${esc(store.partnerName())}</h2><p class="contact-sub">♡ Favourite</p>
        <div class="contact-acts"><button class="ph-btn" data-msg>💬 Message</button></div>
        <p class="contact-note">Change the name in Settings → Gameplay.</p></div>`;
      ctx.host.querySelector('[data-msg]')!.addEventListener('click', () => ctx.go('messages?thread=partner'));
    };

    const detail = (c: PhoneContact) => {
      ctx.title('');
      ctx.action('Edit', () => form(c), 'Edit contact');
      ctx.onBack(() => { list(); return true; });
      const tel = c.phone?.replace(/[^\d+*#]/g, '');
      ctx.host.innerHTML = `<div class="contact-card">
        <span class="contact-big ph-ava">${esc(initials(c.name))}</span>
        <h2>${esc(c.name)}</h2>
        <div class="contact-acts">
          ${tel ? `<a class="ph-btn" href="tel:${esc(tel)}">📞 Call</a><a class="ph-btn ghost" href="sms:${esc(tel)}">✉ Text</a>` : ''}
          ${c.email ? `<a class="ph-btn ghost" href="mailto:${esc(c.email)}">@ Email</a>` : ''}
        </div>
        <dl class="contact-fields">
          ${c.phone ? `<div><dt>Phone</dt><dd>${esc(c.phone)}</dd></div>` : ''}
          ${c.email ? `<div><dt>Email</dt><dd>${esc(c.email)}</dd></div>` : ''}
          ${c.note ? `<div><dt>Notes</dt><dd>${esc(c.note).replace(/\n/g, '<br>')}</dd></div>` : ''}
        </dl></div>`;
    };

    const form = (c: PhoneContact | null) => {
      ctx.title(c ? 'Edit contact' : 'New contact');
      ctx.action(null);
      ctx.onBack(() => { if (c) detail(c); else list(); return true; });
      ctx.host.innerHTML = `<form class="ph-form" novalidate>
        <label>Name<input name="name" required maxlength="40" autocomplete="off" value="${esc(c?.name ?? '')}"></label>
        <label>Phone<input name="phone" type="tel" maxlength="24" inputmode="tel" value="${esc(c?.phone ?? '')}"></label>
        <label>Email<input name="email" type="email" maxlength="60" value="${esc(c?.email ?? '')}"></label>
        <label>Notes<textarea name="note" rows="3" maxlength="300">${esc(c?.note ?? '')}</textarea></label>
        <p class="ph-error hidden"></p>
        <div class="ph-row-btns">${c ? '<button type="button" class="ph-btn danger" data-del>Delete</button>' : ''}<button class="ph-btn">Save</button></div>
      </form>`;
      const f = ctx.host.querySelector('form') as HTMLFormElement;
      const err = f.querySelector('.ph-error') as HTMLElement;
      (f.elements.namedItem('name') as HTMLInputElement).focus();
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = (k: string) => (f.elements.namedItem(k) as HTMLInputElement).value.trim();
        const name = val('name'), phone = val('phone'), email = val('email');
        const problem = !name ? 'Please add a name.'
          : phone && !/^[+\d][\d\s()\-.*#]{2,}$/.test(phone) ? 'That phone number looks off.'
          : email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'That email looks off.' : '';
        if (problem) { err.textContent = problem; err.classList.remove('hidden'); return; }
        const rec: PhoneContact = c ?? { id: uid('c'), name, updatedAt: 0 };
        Object.assign(rec, { name, phone: phone || undefined, email: email || undefined, note: val('note') || undefined, updatedAt: Date.now() });
        if (!c) contacts().push(rec);
        changed();
        detail(rec);
      });
      f.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!c || !(await confirmSheet(ctx.host, `Delete ${c.name}?`))) return;
        c.deleted = true;
        c.updatedAt = Date.now();
        changed();
        list();
      });
    };

    list();
  },
});

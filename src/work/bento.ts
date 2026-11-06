import './work.css';
import { store } from '../core/store';
import { audio } from '../audio/audio';
import { esc } from '../ui/dom';
import { burstHearts } from '../ui/fx';
import { toast } from '../systems/game';
import { overlay, partnerAvatar } from '../pizza/ui';
import { BENTO_SLOTS, FOODS, NOTE_MAX, SHIFTS_PER_DAY, SHIFT_MINUTES, UNLOCK_LEVEL, WRAPS, food, type BentoSlot } from './data';
import { bentoScore, cantGo, cravingFor, shiftsLeft, status, type Bento } from './logic';
import { sendOff } from './work';

/*
 * The bento editor: five compartments, a love note and a wrapping cloth. Packing it sends him to work for 15 minutes.
 * Garden foods only show when the garden basket has the produce (one is used per bento).
 */

const LAYOUT: Record<BentoSlot, string> = { rice: 'b-rice', main: 'b-main', side: 'b-side', veggie: 'b-veg', sweet: 'b-sweet' };

/** Draw the open bento box (HTML, so it scales crisply). */
export function bentoHtml(b: Bento, small = false): string {
  const wrap = WRAPS.find((w) => w.id === b.wrap) ?? WRAPS[0];
  return `<div class="bento ${small ? 'small' : ''}" style="--wrap:${wrap.color}">${BENTO_SLOTS.map(({ slot, label }) => {
    const f = b.slots[slot] ? food(b.slots[slot]!) : undefined;
    const n = slot === 'rice' ? 1 : slot === 'main' ? 3 : 4;
    return `<div class="bento-cell ${LAYOUT[slot]} ${f ? 'full' : ''}" data-cell="${slot}" style="${f ? `--food:${f.color}` : ''}">
      ${f ? `<span class="bento-food">${Array.from({ length: n }, (_, i) => `<i style="--i:${i}">${f.emoji}</i>`).join('')}</span>` : `<small>${esc(label)}</small>`}</div>`;
  }).join('')}${b.note.trim() ? '<span class="bento-note" title="Love note">💌</span>' : ''}</div>`;
}

const gardenHas = (plant: string) => store.state.garden.unlocked && (store.state.garden.basket[plant] ?? 0) > 0;
const available = (id: string) => { const f = food(id); return !!f && (!f.garden || gardenHas(f.garden)); };

export function openBento(): Promise<void> {
  const s = store.state;
  if (s.level < UNLOCK_LEVEL) { toast(`You can pack lunches for {him} from level ${UNLOCK_LEVEL} ♡`, 'heart'); return Promise.resolve(); }
  return new Promise((resolve) => {
    const { root, close } = overlay('bt-layer');
    const day = store.today();
    const craving = cravingFor(day);
    const start = s.work.last;
    const b: Bento = { slots: {}, note: start?.note ?? '', wrap: start?.wrap ?? WRAPS[0].id };
    for (const [slot, id] of Object.entries(start?.slots ?? {})) if (id && available(id)) b.slots[slot as BentoSlot] = id;
    let tab: BentoSlot = BENTO_SLOTS.find(({ slot }) => !b.slots[slot])?.slot ?? 'rice';
    root.innerHTML = `<div class="pz-frame bt-frame">
      <header class="pz-top bt-top"><h2>🍱 Lunch for ${esc(store.partnerName())}</h2><span class="bt-shifts"></span>
        <button class="pz-exit" aria-label="Close">Close ✕</button></header>
      <main class="bt-main">
        <section class="bt-left">
          <div class="bt-craving"><img src="${partnerAvatar('cute')}" alt=""><span><b>${esc(store.partnerName())}</b>${esc(store.fmt(craving.line))}</span></div>
          <div class="bt-box"></div>
          <div class="bt-score"></div>
        </section>
        <section class="bt-right">
          <nav class="pz-tabs bt-tabs"></nav>
          <div class="bt-foods"></div>
          <label class="bt-notel">💌 A note for him <small>(optional)</small>
            <input class="bt-note" maxlength="${NOTE_MAX}" placeholder="Have a good day, my love ♡"></label>
          <div class="bt-wraps"></div>
          <button class="pz-btn big bt-go"></button>
        </section>
      </main></div>`;
    const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
    const note = $<HTMLInputElement>('.bt-note');
    note.value = b.note;

    const render = () => {
      $('.bt-box').innerHTML = bentoHtml(b);
      $('.bt-box').querySelectorAll<HTMLElement>('[data-cell]').forEach((c) => c.addEventListener('click', () => {
        const slot = c.dataset.cell as BentoSlot;
        if (b.slots[slot] && tab === slot) { delete b.slots[slot]; audio.sfx('click'); }
        tab = slot;
        render();
      }));
      $('.bt-tabs').innerHTML = BENTO_SLOTS.map(({ slot, label }) => `<button data-tab="${slot}" class="${tab === slot ? 'on' : ''}">${b.slots[slot] ? '✓ ' : ''}${esc(label)}</button>`).join('');
      $('.bt-tabs').querySelectorAll<HTMLElement>('[data-tab]').forEach((t) => t.addEventListener('click', () => { tab = t.dataset.tab as BentoSlot; audio.sfx('click'); render(); }));
      $('.bt-foods').innerHTML = FOODS.filter((f) => f.slot === tab).map((f) => {
        const ok = available(f.id);
        const on = b.slots[tab] === f.id;
        const crave = craving.slot === tab && craving.foods.includes(f.id);
        return `<button class="bt-food ${on ? 'on' : ''}" data-food="${f.id}" ${ok ? '' : 'disabled'}><span>${f.emoji}</span><b>${esc(f.name)}</b>
          ${f.garden ? `<small>${ok ? '🌱 from our garden' : '🌱 grow it in the garden'}</small>` : ''}${crave ? '<em>craving ♡</em>' : ''}</button>`;
      }).join('');
      $('.bt-foods').querySelectorAll<HTMLElement>('[data-food]').forEach((x) => x.addEventListener('click', () => {
        const id = x.dataset.food!;
        if (b.slots[tab] === id) delete b.slots[tab]; else { b.slots[tab] = id; audio.sfx('plop'); burstHearts(x, 3, food(id)!.emoji); }
        // Move on to the next empty compartment.
        if (b.slots[tab]) tab = BENTO_SLOTS.find(({ slot }) => !b.slots[slot])?.slot ?? tab;
        render();
      }));
      $('.bt-wraps').innerHTML = `<span>Wrap it in:</span>${WRAPS.map((w) => `<button class="bt-wrap ${w.id === b.wrap ? 'on' : ''}" data-wrap="${w.id}" title="${esc(w.name)}" style="background:${w.color}"></button>`).join('')}`;
      $('.bt-wraps').querySelectorAll<HTMLElement>('[data-wrap]').forEach((x) => x.addEventListener('click', () => { b.wrap = x.dataset.wrap!; audio.sfx('click'); render(); }));
      const sc = bentoScore(b, day);
      const hearts = Math.max(0, Math.min(5, Math.round((sc.score / 8) * 5)));
      $('.bt-score').innerHTML = `<span class="bt-hearts">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= hearts ? 'on' : ''}">♥</i>`).join('')}</span>
        <small>${sc.craved ? 'His craving ✓ · ' : ''}${sc.garden ? 'Garden fresh ✓ · ' : ''}${b.note.trim() ? 'Love note ✓' : 'Add a note for extra love'}</small>`;
      const left = shiftsLeft(s.work, day);
      $('.bt-shifts').textContent = status(s.work) === 'home' ? `${left} of ${SHIFTS_PER_DAY} work trips left today` : status(s.work) === 'away' ? 'He’s at work' : 'He’s at the door!';
      const why = cantGo(s.work, s.level, day, b);
      const go = $<HTMLButtonElement>('.bt-go');
      go.disabled = !!why;
      go.textContent = why ?? `Pack it & send him to work (${SHIFT_MINUTES} min) ♡`;
    };
    note.addEventListener('input', () => { b.note = note.value.slice(0, NOTE_MAX); render(); });
    $('.bt-go').addEventListener('click', async () => {
      if (cantGo(s.work, s.level, day, b)) return;
      audio.sfx('chime');
      burstHearts($('.bt-go'), 10);
      leave();
      await new Promise((r) => setTimeout(r, 320));
      await sendOff(b);
    });
    const leave = () => { window.removeEventListener('keydown', onKey, true); close(); resolve(); };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); leave(); }
    };
    window.addEventListener('keydown', onKey, true);
    $('.pz-exit').addEventListener('click', leave);
    render();
  });
}

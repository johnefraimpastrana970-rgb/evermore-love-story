import './pets.css';
import { store } from '../core/store';
import { bus } from '../core/events';
import { audio } from '../audio/audio';
import { el, esc, uiRoot } from '../ui/dom';
import { burstHearts } from '../ui/fx';
import { toast, gainXp, bumpStat, afterChange } from '../systems/game';
import { playDialogue } from '../ui/dialogue';
import { partnerAway } from '../work/work';
import { CAT_NAMES, PERSONALITIES, PET_FOODS, PET_LINES, STRAY_FEEDS, breed } from './data';
import {
  MOOD_LABEL, addPhoto, adoptStray, bondLevel, canEat, feed, feedStray, foodsFor, mood, pat, speciesOf, strayReadyIn, strayWantsToStay, tick,
  type Pet,
} from './logic';
import { petPortrait } from './draw';

/*
 * The card that opens when she taps a pet: needs, Pet / Feed / Photo (and Care & Play once the pet shop is open),
 * or, for the stray, feeding it until it trusts her enough to stay.
 */

export interface CardHooks {
  /** Show a pet doing something in the world. */
  react(pet: Pet | null, anim: 'happy' | 'eat' | 'sit', ms: number, line?: string): void;
  /** Open the care & play screen (set by the pet shop phase). */
  care?(pet: Pet): void;
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const bar = (label: string, icon: string, v: number) => `<div class="pc-need"><span>${icon}</span><i><b style="width:${Math.round(v)}%;--h:${Math.round(v * 1.2)}"></b></i><small>${esc(label)}</small></div>`;
const hearts = (n: number) => `<span class="pc-hearts">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}">♥</i>`).join('')}</span>`;

function layer(): { root: HTMLElement; close: () => void } {
  const root = el('div', 'pc-layer');
  uiRoot().appendChild(root);
  store.block();
  requestAnimationFrame(() => root.classList.add('in'));
  let done = false;
  return { root, close: () => { if (done) return; done = true; root.classList.remove('in'); setTimeout(() => root.remove(), 220); store.unblock(); store.save(); } };
}

export function openPetCard(pet: Pet | null, hooks: CardHooks): Promise<void> {
  return pet ? petCard(pet, hooks) : strayCard(hooks);
}

function petCard(p: Pet, hooks: CardHooks): Promise<void> {
  return new Promise((resolve) => {
    const s = store.state;
    const b = breed(p.breed)!;
    const { root, close } = layer();
    let feeding = false;
    const render = () => {
      tick(p, Date.now());
      const m = mood(p);
      const pers = PERSONALITIES[p.personality];
      const foods = foodsFor(s.pets, p);
      root.innerHTML = `<div class="pc-card">
        <button class="pc-x" aria-label="Close">✕</button>
        <div class="pc-head"><img class="pc-ava" src="${petPortrait(b, m === 'happy' ? 'happy' : 'sit')}" alt="">
          <div><h3>${esc(p.name)}</h3><small>${esc(b.name)} · ${pers.emoji} ${esc(pers.label)}</small>${hearts(bondLevel(p.bond))}</div></div>
        <p class="pc-mood">${esc(MOOD_LABEL[m])} · <span>${esc(pers.desc)}</span></p>
        <div class="pc-needs">${bar('Food', '🍽️', p.needs.hunger)}${bar('Joy', '💗', p.needs.joy)}${bar('Clean', '🫧', p.needs.clean)}${bar('Nails', '💅', p.needs.nails)}</div>
        ${feeding ? `<div class="pc-foods">${foods.length ? foods.map((f) => `<button class="pc-food" data-food="${f.id}"><span>${f.emoji}</span><b>${esc(f.name)}</b><small>×${s.pets.food[f.id]}</small></button>`).join('')
          : `<p class="pc-empty">No ${speciesOf(p)} food left. ${s.level >= 4 ? 'Buy some at the Pet Shop (Map) ♡' : 'The Pet Shop opens at level 4.'}</p>`}
          <button class="pz-btn ghost small" data-back>Back</button></div>`
        : `<div class="pc-acts">
          <button class="pz-btn" data-pet>💗 Pet</button>
          <button class="pz-btn" data-feed>🍽️ Feed</button>
          ${hooks.care ? '<button class="pz-btn" data-care>🛁 Care & play</button>' : ''}
          <button class="pz-btn ghost" data-photo>📷 Photo</button></div>`}
      </div>`;
      root.querySelector('.pc-x')!.addEventListener('click', leave);
      root.querySelector('[data-pet]')?.addEventListener('click', (e) => {
        if (!pat(p, Date.now())) { hooks.react(p, 'happy', 900, '♡'); return; }
        audio.sfx('heart');
        burstHearts(e.currentTarget as HTMLElement, 6);
        hooks.react(p, 'happy', 1800, pick(speciesOf(p) === 'dog' ? PET_LINES.petDog : PET_LINES.pet));
        bumpStat('pets-petted');
        gainXp(3, 'pet');
        render();
      });
      root.querySelector('[data-feed]')?.addEventListener('click', () => { feeding = true; audio.sfx('click'); render(); });
      root.querySelector('[data-back]')?.addEventListener('click', () => { feeding = false; render(); });
      root.querySelectorAll<HTMLElement>('[data-food]').forEach((x) => x.addEventListener('click', () => {
        if (!feed(s.pets, p, x.dataset.food!, Date.now())) { audio.sfx('error'); return; }
        audio.sfx('plop');
        hooks.react(p, 'eat', 2600, pick(PET_LINES.fed));
        bumpStat('pets-fed');
        gainXp(4, 'pet');
        feeding = false;
        render();
      }));
      root.querySelector('[data-care]')?.addEventListener('click', () => { leave(); hooks.care?.(p); });
      root.querySelector('[data-photo]')?.addEventListener('click', () => {
        addPhoto(s.pets, { at: Date.now(), room: s.location, pets: [{ breed: p.breed, name: p.name, pose: mood(p) === 'happy' ? 'happy' : 'sit' }] });
        flash(root);
        toast(`📷 ${p.name} saved to your phone’s Gallery (Pets album)`, 'heart', 'good');
        hooks.react(p, 'happy', 1500, '📸');
      });
    };
    const leave = () => { window.removeEventListener('keydown', onKey, true); close(); afterChange(); resolve(); };
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); leave(); } };
    window.addEventListener('keydown', onKey, true);
    root.addEventListener('click', (e) => { if (e.target === root) leave(); });
    render();
  });
}

function strayCard(hooks: CardHooks): Promise<void> {
  return new Promise((resolve) => {
    const s = store.state;
    const st = s.pets.stray;
    if (!st) { resolve(); return; }
    const b = breed(st.breed)!;
    const { root, close } = layer();
    const render = () => {
      const now = Date.now();
      const stays = strayWantsToStay(s.pets);
      const wait = strayReadyIn(s.pets, now);
      const foods = PET_FOODS.filter((f) => (s.pets.food[f.id] ?? 0) > 0 && canEat(f.id, 'cat'));
      const names = [...CAT_NAMES].sort(() => Math.random() - 0.5).slice(0, 4);
      root.innerHTML = `<div class="pc-card stray">
        <button class="pc-x" aria-label="Close">✕</button>
        <div class="pc-head"><img class="pc-ava" src="${petPortrait(b, stays ? 'happy' : 'sit')}" alt="">
          <div><h3>${stays ? 'The little orange cat' : 'A stray cat'}</h3><small>${'🐾'.repeat(st.feeds)}${'·'.repeat(Math.max(0, STRAY_FEEDS - st.feeds))} trust</small></div></div>
        ${stays ? `<p class="pc-mood">It won’t leave your side anymore… and it’s purring. Can it stay with you two? ♡</p>
          <label class="pc-name">Give it a name<input maxlength="16" placeholder="${esc(names[0])}"></label>
          <div class="pc-suggest">${names.map((n) => `<button data-name="${esc(n)}">${esc(n)}</button>`).join('')}</div>
          <div class="pc-acts"><button class="pz-btn" data-adopt>🏠 Welcome home</button></div>`
        : `<p class="pc-mood">${st.feeds === 0 ? 'It watches you from the fence, ready to run… It looks hungry.' : wait > 0 ? `It ate it all and is washing its face. Come back in ${Math.ceil(wait / 60_000)} min, it might trust you more.` : 'It’s back, and it remembers you!'}</p>
          <div class="pc-foods">${foods.length ? foods.map((f) => `<button class="pc-food" data-food="${f.id}" ${wait > 0 ? 'disabled' : ''}><span>${f.emoji}</span><b>${esc(f.name)}</b><small>×${s.pets.food[f.id]}</small></button>`).join('')
            : `<p class="pc-empty">No cat food left. ${s.level >= 4 ? 'Get some at the Pet Shop (Map).' : esc(store.fmt('Maybe {him} can bring some home from work…'))}</p>`}</div>`}
      </div>`;
      root.querySelector('.pc-x')!.addEventListener('click', leave);
      root.querySelectorAll<HTMLElement>('[data-food]').forEach((x) => x.addEventListener('click', () => {
        const n = feedStray(s.pets, x.dataset.food!, Date.now());
        if (n < 0) { audio.sfx('error'); return; }
        audio.sfx('plop');
        hooks.react(null, 'eat', 2600, n >= STRAY_FEEDS ? '💗' : pick(['…nom', '😋', '…♡']));
        gainXp(8, 'pet');
        store.save();
        render();
      }));
      root.querySelectorAll<HTMLElement>('[data-name]').forEach((x) => x.addEventListener('click', () => { (root.querySelector('.pc-name input') as HTMLInputElement).value = x.dataset.name!; }));
      root.querySelector('[data-adopt]')?.addEventListener('click', async () => {
        const input = root.querySelector('.pc-name input') as HTMLInputElement;
        const name = input.value.trim() || input.placeholder;
        const p = adoptStray(s.pets, name, Date.now());
        if (!p) return;
        audio.sfx('levelup');
        bumpStat('pets-adopted');
        gainXp(40, 'pet');
        store.save();
        leave();
        bus.emit('pets:changed');
        await playDialogue({ lines: partnerAway() ? [
          { speaker: 'narrator', text: `${p.name} moved in! {him} is going to be so surprised when he gets home ♡` },
        ] : [
          { speaker: 'him', text: `${p.name}… I love it. Welcome to the family, little one ♡`, mood: 'love' },
          { speaker: 'her', text: 'We have a cat now!', mood: 'happy' },
        ] });
        toast(`${p.name} is part of the family now 🐈`, 'heart', 'good');
      });
    };
    const leave = () => { window.removeEventListener('keydown', onKey, true); close(); afterChange(); resolve(); };
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); leave(); } };
    window.addEventListener('keydown', onKey, true);
    root.addEventListener('click', (e) => { if (e.target === root) leave(); });
    render();
  });
}

function flash(root: HTMLElement) {
  const f = el('div', 'pc-flash');
  root.appendChild(f);
  audio.sfx('click');
  setTimeout(() => f.remove(), 500);
}

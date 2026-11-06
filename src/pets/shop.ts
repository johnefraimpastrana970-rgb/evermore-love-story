import './care.css';
import { store } from '../core/store';
import { bus } from '../core/events';
import { audio } from '../audio/audio';
import { esc } from '../ui/dom';
import { burstHearts } from '../ui/fx';
import { iconURL } from '../art/icons';
import { toast, gainXp, bumpStat, afterChange } from '../systems/game';
import { overlay, confetti } from '../pizza/ui';
import { CAT_NAMES, DOG_NAMES, MAX_PETS, PERSONALITIES, PET_FOODS, breed } from './data';
import { SHOP_LEVEL, buyFood, buyPet, lineup, mood, MOOD_LABEL } from './logic';
import { petPortrait } from './draw';
import { openCare } from './care';

/*
 * "Paws & Whiskers", the pet shop in town (from level 4): adopt today's animals and buy pet food with heart tokens,
 * and bring a pet to the Spa & Play corner for care activities.
 */

export const petShopOpen = () => store.hasGame && store.state.level >= SHOP_LEVEL;

const tokensHtml = (n: number) => `<span class="pz-coins ps-tokens" title="Heart tokens"><img src="${iconURL('coin', 32)}" alt=""><b>${n}</b></span>`;
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function openPetShop(tab: 'pets' | 'food' | 'spa' = 'pets'): Promise<void> {
  if (!petShopOpen()) { toast(`The pet shop opens at level ${SHOP_LEVEL} 🐾`, 'heart'); return Promise.resolve(); }
  return new Promise((resolve) => {
    const s = store.state;
    const { root, close } = overlay('ps-layer');
    let cur = tab;
    root.innerHTML = `<div class="pz-frame ps-frame">
      <header class="pz-top ps-top"><h2>🐾 Paws & Whiskers</h2><span class="ps-say"></span><span class="ps-tok"></span><button class="pz-exit" aria-label="Leave the shop">Leave ✕</button></header>
      <nav class="ps-tabs"></nav><main class="ps-main"></main></div>`;
    const main = root.querySelector('.ps-main') as HTMLElement;
    const say = (t: string) => { (root.querySelector('.ps-say') as HTMLElement).textContent = `🐰 Mrs. Bun: “${t}”`; };
    say(pick(['Welcome! Every little one here is waiting for a forever home ♡', 'Fresh treats just came in!', 'Bring your pets to the spa anytime ♡']));

    const render = () => {
      (root.querySelector('.ps-tok') as HTMLElement).innerHTML = tokensHtml(s.tokens);
      (root.querySelector('.ps-tabs') as HTMLElement).innerHTML = ([['pets', '🐱 Adopt'], ['food', '🥣 Food & treats'], ['spa', '🛁 Spa & Play']] as const)
        .map(([k, l]) => `<button data-tab="${k}" class="${cur === k ? 'on' : ''}">${l}</button>`).join('');
      root.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => { cur = b.dataset.tab as typeof cur; audio.sfx('click'); render(); }));
      if (cur === 'pets') pets(); else if (cur === 'food') food(); else spa();
    };

    const pets = () => {
      const offers = lineup(store.today(), s.level);
      const full = s.pets.list.length >= MAX_PETS;
      main.innerHTML = `<p class="ps-note">New friends arrive every day. ${full ? 'Your home is full of love already (8 pets)!' : ''}</p>
        <div class="ps-grid">${offers.map((o) => {
          const b = breed(o.breed)!;
          const p = PERSONALITIES[o.personality];
          return `<div class="ps-card"><div class="ps-window"><img src="${petPortrait(b, 'sit')}" alt=""></div>
            <b>${esc(b.name)}</b><small>${b.species === 'dog' ? '🐶 Puppy' : '🐱 Kitten'} · ${p.emoji} ${esc(p.label)}</small>
            <p>${esc(p.desc)}</p>
            <button class="pz-btn small" data-adopt="${o.breed}" ${s.tokens >= o.price && !full ? '' : 'disabled'}><img src="${iconURL('coin', 32)}" alt=""> ${o.price}</button></div>`;
        }).join('')}</div>`;
      main.querySelectorAll<HTMLElement>('[data-adopt]').forEach((x) => x.addEventListener('click', () => nameIt(x.dataset.adopt!)));
    };

    const nameIt = (breedId: string) => {
      const b = breed(breedId)!;
      const names = [...(b.species === 'dog' ? DOG_NAMES : CAT_NAMES)].sort(() => Math.random() - 0.5).slice(0, 4);
      const m = document.createElement('div');
      m.className = 'pz-modal';
      m.innerHTML = `<div class="pz-card ps-name"><img src="${petPortrait(b, 'happy')}" alt=""><h3>Name your new ${b.species === 'dog' ? 'puppy' : 'kitten'}</h3>
        <input maxlength="16" placeholder="${esc(names[0])}"><div class="pc-suggest">${names.map((n) => `<button data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div>
        <div class="pz-row"><button class="pz-btn ghost" data-x>Cancel</button><button class="pz-btn" data-ok>🏠 Take home</button></div></div>`;
      root.querySelector('.pz-frame')!.appendChild(m);
      const input = m.querySelector('input') as HTMLInputElement;
      m.querySelectorAll<HTMLElement>('[data-n]').forEach((x) => x.addEventListener('click', () => { input.value = x.dataset.n!; }));
      m.querySelector('[data-x]')!.addEventListener('click', () => m.remove());
      m.querySelector('[data-ok]')!.addEventListener('click', () => {
        const p = buyPet(s.pets, s, store.today(), s.level, breedId, input.value.trim() || input.placeholder, Date.now());
        if (!p) { audio.sfx('error'); return; }
        m.remove();
        audio.sfx('levelup');
        confetti(root);
        bumpStat('pets-adopted');
        gainXp(30, 'pet');
        say(`${p.name} is going to love it at your place ♡`);
        toast(`${p.name} is coming home with you! 🏠`, 'heart', 'good');
        store.save();
        bus.emit('pets:changed');
        render();
      });
      input.focus();
    };

    const food = () => {
      main.innerHTML = `<p class="ps-note">In your cupboard: ${PET_FOODS.filter((f) => s.pets.food[f.id]).map((f) => `${f.emoji}×${s.pets.food[f.id]}`).join(' ') || 'nothing yet'}</p>
        <div class="ps-grid food">${PET_FOODS.map((f) => `<div class="ps-card"><div class="ps-window food"><span>${f.emoji}</span></div>
          <b>${esc(f.name)}</b><small>${f.for === 'both' ? 'Cats & dogs' : f.for === 'cat' ? 'For cats' : 'For dogs'} · pack of ${f.pack}</small>
          <p>${f.joy >= 12 ? 'A favourite treat!' : 'A filling meal.'}</p>
          <button class="pz-btn small" data-food="${f.id}" ${s.tokens >= f.price ? '' : 'disabled'}><img src="${iconURL('coin', 32)}" alt=""> ${f.price}</button></div>`).join('')}</div>`;
      main.querySelectorAll<HTMLElement>('[data-food]').forEach((x) => x.addEventListener('click', () => {
        if (!buyFood(s.pets, s, x.dataset.food!)) { audio.sfx('error'); return; }
        audio.sfx('register');
        burstHearts(x, 5);
        if (Math.random() < 0.3) say(pick(['Good choice!', 'They’re going to love that ♡', 'Yum!']));
        store.save();
        render();
      }));
    };

    const spa = () => {
      const list = s.pets.list;
      main.innerHTML = list.length ? `<p class="ps-note">Who’s getting pampered today?</p><div class="ps-grid">${list.map((p) => {
        const b = breed(p.breed)!;
        return `<button class="ps-card spa" data-spa="${p.id}"><div class="ps-window"><img src="${petPortrait(b, mood(p) === 'happy' ? 'happy' : 'sit')}" alt=""></div>
          <b>${esc(p.name)}</b><small>${esc(MOOD_LABEL[mood(p)])}</small></button>`;
      }).join('')}</div>` : '<p class="ps-note big">Adopt a pet first, then bring them here for baths, nail trims, brushing and play ♡</p>';
      main.querySelectorAll<HTMLElement>('[data-spa]').forEach((x) => x.addEventListener('click', async () => {
        const p = s.pets.list.find((q) => q.id === x.dataset.spa)!;
        root.classList.add('hidden-behind');
        await openCare(p);
        root.classList.remove('hidden-behind');
        render();
      }));
    };

    const leave = () => { window.removeEventListener('keydown', onKey, true); close(); afterChange(); resolve(); };
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape' || root.classList.contains('hidden-behind')) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const m = root.querySelector('.pz-modal'); if (m) m.remove(); else leave();
    };
    window.addEventListener('keydown', onKey, true);
    root.querySelector('.pz-exit')!.addEventListener('click', leave);
    render();
  });
}

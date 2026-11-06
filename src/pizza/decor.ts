import { store } from '../core/store';
import { audio } from '../audio/audio';
import { esc } from '../ui/dom';
import { DECOR, DECOR_SLOTS, type DecorSlot } from './data';
import { buyDecor, useDecor, type PizzaState } from './logic';
import { coinsHtml, type Helper } from './ui';

const def = (id: string) => DECOR.find((d) => d.id === id)!;

/** Data attributes that switch the shop's look (see pizza.css "decor"). */
export function decorAttrs(p: PizzaState): string {
  return (['wall', 'lights', 'tables', 'sign', 'plant'] as DecorSlot[]).map((s) => `data-deco-${s}="${p.decor.on[s]}"`).join(' ');
}

/** Extra scenery for the counter view: lights along the top and plants on the counter. */
export function decorScenery(p: PizzaState): string {
  const lights = p.decor.on.lights;
  const plant = p.decor.on.plant;
  let html = '';
  if (lights === 'lights-fairy') html += `<div class="decor-fairy">${Array.from({ length: 18 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>`;
  if (lights === 'lights-lanterns') html += `<div class="decor-lanterns">${Array.from({ length: 5 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>`;
  if (lights === 'lights-neon') html += `<div class="decor-neon">Pizza <span>♡</span></div>`;
  const flower = { 'plant-fern': '🌿', 'plant-sunflower': '🌻', 'plant-roses': '🌹' }[plant];
  if (flower) html += `<div class="decor-plant"><span>${flower}${flower}</span><i></i></div>`;
  return html;
}

/** A small apron badge in the chosen style (shown on both of you). */
export function apronBadge(p: PizzaState): string {
  return `<span class="pz-apron" title="${esc(def(p.decor.on.apron).name)}"><i style="background:${def(p.decor.on.apron).swatch}"></i></span>`;
}

/** Decorate menu: buy or switch decor per category. Calls onChange after every change. */
export function openDecorate(host: HTMLElement, p: PizzaState, helper: Helper, onChange: () => void): Promise<void> {
  return new Promise((resolve) => {
    let tab: DecorSlot = 'wall';
    const modal = document.createElement('div');
    modal.className = 'pz-modal';
    host.appendChild(modal);
    const render = () => {
      modal.innerHTML = `<div class="pz-card decor-card">
        <div class="decor-head"><h3>🎨 Decorate our shop</h3>${coinsHtml(p.coins)}</div>
        <div class="pz-tabs decor-tabs">${DECOR_SLOTS.map((s) => `<button data-tab="${s.slot}" class="${s.slot === tab ? 'on' : ''}">${s.icon} ${s.label}</button>`).join('')}</div>
        <div class="decor-grid">${DECOR.filter((d) => d.slot === tab).map((d) => {
          const owned = p.decor.owned.includes(d.id);
          const using = p.decor.on[d.slot] === d.id;
          const afford = p.coins >= d.price;
          return `<div class="decor-item ${using ? 'using' : ''}">
            <span class="decor-swatch ${d.slot === 'apron' ? 'apron' : ''}" style="background:${d.swatch}"></span>
            <b>${esc(d.name)}</b>
            ${using ? '<em>In use ♡</em>' : owned
              ? `<button class="pz-btn small" data-use="${d.id}">Use</button>`
              : `<button class="pz-btn small" data-buy="${d.id}" ${afford ? '' : 'disabled'}>🪙${d.price}</button>`}
          </div>`;
        }).join('')}</div>
        ${tab === 'apron' ? '<p class="decor-note">Aprons come in pairs: you both wear the same one ♡</p>' : ''}
        <div class="pz-row"><button class="pz-btn" data-x>Done</button></div>
      </div>`;
      modal.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab as DecorSlot; audio.sfx('click'); render(); }));
      const changed = (id: string) => {
        helper.say(def(id).slot === 'apron' ? 'apron' : 'decor', 'happy');
        onChange();
        store.save();
        render();
      };
      modal.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) => b.addEventListener('click', () => {
        if (!buyDecor(p, b.dataset.buy!)) { audio.sfx('error'); return; }
        audio.sfx('register');
        changed(b.dataset.buy!);
      }));
      modal.querySelectorAll<HTMLButtonElement>('[data-use]').forEach((b) => b.addEventListener('click', () => {
        if (!useDecor(p, b.dataset.use!)) return;
        audio.sfx('heart');
        changed(b.dataset.use!);
      }));
      modal.querySelector('[data-x]')!.addEventListener('click', () => { modal.remove(); resolve(); });
    };
    render();
  });
}

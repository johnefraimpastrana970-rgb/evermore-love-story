import { store } from '../core/store';
import { audio } from '../audio/audio';
import { esc } from '../ui/dom';
import { INGREDIENTS, type IngKind } from './data';
import {
  CUSTOM_LIMITS, TOPPING_KINDS, customPriceRange, customRecipeDef, haveAny, isValidCustom,
  type CustomRecipe, type PizzaState,
} from './logic';
import { GRID, cellXY, drawPizza, emptyLook, type PizzaLook } from './draw';
import type { RecipeDef } from './data';

/** A finished-looking pizza for previews (menu cards, the editor). */
export function previewLook(r: Pick<RecipeDef, 'sauce' | 'toppings'>): PizzaLook {
  const look = emptyLook();
  const full = new Uint8Array(GRID * GRID);
  for (let i = 0; i < full.length; i++) { const [x, y] = cellXY(i); if (Math.hypot(x, y) < 0.8) full[i] = 1; }
  look.dough = { size: 0.93, tier: 2 };
  look.sauce = { kind: r.sauce, tier: 2, cells: full };
  look.cheese = { tier: 2, cells: full };
  look.bake = 0.7;
  // Spread pieces on a sunflower spiral so every kind is visible and evenly placed.
  const all: IngKind[] = [];
  const max = Math.max(0, ...r.toppings.map((t) => t.count));
  for (let i = 0; i < max; i++) for (const t of r.toppings) if (i < t.count) all.push(t.kind);
  all.forEach((kind, i) => {
    const a = i * 2.39996, d = 0.68 * Math.sqrt((i + 0.6) / all.length);
    look.pieces.push({ kind, tier: 2, x: Math.cos(a) * d, y: Math.sin(a) * d, rot: (i * 1.7) % Math.PI });
  });
  return look;
}

export function drawPreview(canvas: HTMLCanvasElement, r: Pick<RecipeDef, 'sauce' | 'toppings'>) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = canvas.clientWidth || 160, h = canvas.clientHeight || 160;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const g = canvas.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  drawPizza(g, previewLook(r), w / 2, h / 2, Math.min(w, h) * 0.42, 0);
}

/**
 * Her own pizza of the day: pick a sauce, up to three toppings with amounts, a name and a price.
 * Resolves with the saved recipe, or null if she cancelled.
 */
export function openCustomEditor(host: HTMLElement, p: PizzaState): Promise<CustomRecipe | null> {
  return new Promise((resolve) => {
    const draft: CustomRecipe = p.custom
      ? { ...p.custom, toppings: p.custom.toppings.map((t) => ({ ...t })) }
      : { name: `${store.playerName()}’s Special`.slice(0, CUSTOM_LIMITS.name), sauce: 'tomato', toppings: [], price: 0 };
    if (!draft.price) draft.price = customPriceRange(draft).fair;
    const modal = document.createElement('div');
    modal.className = 'pz-modal';
    host.appendChild(modal);
    const done = (v: CustomRecipe | null) => { modal.remove(); resolve(v); };

    // Until she moves the slider herself, the price follows the fair price as the recipe changes.
    let priceTouched = !!p.custom;
    const clampPrice = () => {
      const { min, max, fair } = customPriceRange(draft);
      if (!priceTouched) draft.price = fair;
      draft.price = Math.max(min, Math.min(max, draft.price));
    };
    const render = () => {
      clampPrice();
      const { min, max, fair } = customPriceRange(draft);
      const chosen = new Map(draft.toppings.map((t) => [t.kind, t.count]));
      const full = draft.toppings.length >= CUSTOM_LIMITS.kinds;
      const verdict = draft.price <= fair * 0.85 ? 'A bargain! Lots of orders.' : draft.price >= fair * 1.2 ? 'Pricey: fewer orders, more coins each.' : 'A fair price.';
      modal.innerHTML = `<div class="pz-card custom-card">
        <h3>✨ Pizza of the day</h3>
        <p>Your very own pizza. Customers can order it once it’s on today’s menu.</p>
        <div class="custom-grid">
          <div class="custom-preview"><canvas></canvas><b class="custom-name-show">${esc(draft.name || 'Your pizza')}</b></div>
          <div class="custom-form">
            <label class="custom-field">Name<input data-name maxlength="${CUSTOM_LIMITS.name}" value="${esc(draft.name)}" placeholder="Name your pizza"></label>
            <div class="custom-field">Sauce
              <div class="seg">${(['tomato', 'cream'] as const).map((s) => `<button data-sauce="${s}" class="${draft.sauce === s ? 'on' : ''}">${INGREDIENTS[s].emoji} ${s === 'tomato' ? 'Tomato' : 'Cream'}</button>`).join('')}</div>
            </div>
            <div class="custom-field">Toppings <small>(up to ${CUSTOM_LIMITS.kinds})</small>
              <div class="custom-tops">${TOPPING_KINDS.map((k) => {
                const on = chosen.has(k);
                const n = haveAny(p, k);
                return `<div class="ctop ${on ? 'on' : ''} ${!on && full ? 'off' : ''}">
                  <button data-top="${k}" ${!on && full ? 'disabled' : ''} title="${esc(INGREDIENTS[k].names[0])}"><span>${INGREDIENTS[k].emoji}</span><small>${esc(INGREDIENTS[k].names[0])}</small><i class="${n ? '' : 'none'}">${n ? `have ${n}` : 'none yet'}</i></button>
                  ${on ? `<span class="ctop-n"><button data-dec="${k}" aria-label="Fewer">−</button><b>${chosen.get(k)}</b><button data-inc="${k}" aria-label="More">+</button></span>` : ''}
                </div>`;
              }).join('')}</div>
            </div>
            <label class="custom-field">Price <b class="price-now">🪙${draft.price}</b>
              <input type="range" data-price min="${min}" max="${max}" step="1" value="${draft.price}">
              <small class="price-hint">Fair price 🪙${fair} · ${verdict}</small>
            </label>
          </div>
        </div>
        <div class="pz-row">${p.custom ? '<button class="pz-btn ghost" data-del>Remove</button>' : ''}<button class="pz-btn ghost" data-x>Cancel</button><button class="pz-btn" data-save ${draft.name.trim() ? '' : 'disabled'}>Save my pizza</button></div>
      </div>`;
      const canvas = modal.querySelector('canvas') as HTMLCanvasElement;
      requestAnimationFrame(() => drawPreview(canvas, draft));

      const nameIn = modal.querySelector('[data-name]') as HTMLInputElement;
      nameIn.addEventListener('input', () => {
        draft.name = nameIn.value.slice(0, CUSTOM_LIMITS.name);
        (modal.querySelector('.custom-name-show') as HTMLElement).textContent = draft.name || 'Your pizza';
        (modal.querySelector('[data-save]') as HTMLButtonElement).disabled = !draft.name.trim();
      });
      modal.querySelectorAll<HTMLButtonElement>('[data-sauce]').forEach((b) => b.addEventListener('click', () => {
        draft.sauce = b.dataset.sauce as 'tomato' | 'cream'; audio.sfx('click'); render();
      }));
      modal.querySelectorAll<HTMLButtonElement>('[data-top]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.top as IngKind;
        if (chosen.has(k)) draft.toppings = draft.toppings.filter((t) => t.kind !== k);
        else if (draft.toppings.length < CUSTOM_LIMITS.kinds) draft.toppings.push({ kind: k, count: 5 });
        audio.sfx('plop');
        render();
      }));
      const step = (k: IngKind, d: number) => {
        const t = draft.toppings.find((x) => x.kind === k);
        if (!t) return;
        t.count = Math.max(CUSTOM_LIMITS.minCount, Math.min(CUSTOM_LIMITS.maxCount, t.count + d));
        audio.sfx('type');
        render();
      };
      modal.querySelectorAll<HTMLButtonElement>('[data-inc]').forEach((b) => b.addEventListener('click', () => step(b.dataset.inc as IngKind, 1)));
      modal.querySelectorAll<HTMLButtonElement>('[data-dec]').forEach((b) => b.addEventListener('click', () => step(b.dataset.dec as IngKind, -1)));
      const price = modal.querySelector('[data-price]') as HTMLInputElement;
      price.addEventListener('input', () => {
        draft.price = Number(price.value);
        priceTouched = true;
        (modal.querySelector('.price-now') as HTMLElement).textContent = `🪙${draft.price}`;
      });
      price.addEventListener('change', render);
      modal.querySelector('[data-x]')!.addEventListener('click', () => done(null));
      modal.querySelector('[data-del]')?.addEventListener('click', () => {
        p.custom = null;
        p.menu = p.menu.filter((id) => id !== customRecipeDef(draft).id);
        done(null);
      });
      modal.querySelector('[data-save]')!.addEventListener('click', () => {
        const saved: CustomRecipe = { ...draft, name: draft.name.trim() };
        if (!isValidCustom(saved)) { audio.sfx('error'); return; }
        p.custom = saved;
        store.save();
        done(saved);
      });
    };
    render();
  });
}

import { store } from '../core/store';
import { audio } from '../audio/audio';
import { esc } from '../ui/dom';
import { burstHearts } from '../ui/fx';
import { ING_ORDER, INGREDIENTS, TIERS, TIER_LABEL, TIER_UNLOCK, type IngCategory, type IngKind } from './data';
import { allRecipes, buy, have, missingFor, price, recipeUnlocked, shopLevel, tierUnlocked } from './logic';
import { Helper, coinsHtml, overlay } from './ui';

const TABS: [string, IngCategory[]][] = [['Base & sauce', ['base', 'sauce']], ['Cheese', ['cheese']], ['Toppings', ['topping']], ['Boxes', ['packaging']]];

/** The Ingredient Market. Resolves when she leaves. */
export function openMarket(): Promise<void> {
  return new Promise((resolve) => {
    const { root, close } = overlay('pz-market');
    const p = store.state.pizza;
    let tab = 0;
    root.innerHTML = `<div class="pz-frame market-frame">
      <header class="pz-top"><h2>🧺 Evermore Market</h2><span class="pz-sub">Fresh ingredients for your shop</span><span class="pz-coin-slot"></span>
        <button class="pz-exit" aria-label="Leave the market">Leave ✕</button></header>
      <div class="mk-body"><nav class="mk-tabs"></nav><div class="mk-list"></div>
        <aside class="mk-side"><h4>Shopping list</h4><div class="mk-needs"></div></aside></div>
    </div>`;
    const helper = new Helper(root.querySelector('.pz-frame') as HTMLElement);
    helper.say('I’ll carry the bags ♡');
    helper.act('carry');

    const render = () => {
      (root.querySelector('.pz-coin-slot') as HTMLElement).innerHTML = coinsHtml(p.coins);
      const lvl = shopLevel(p.xp);
      root.querySelector('.mk-tabs')!.innerHTML = TABS.map(([n], i) => `<button class="${i === tab ? 'on' : ''}" data-tab="${i}">${n}</button>`).join('');
      const kinds = ING_ORDER.filter((k) => TABS[tab][1].includes(INGREDIENTS[k].category));
      root.querySelector('.mk-list')!.innerHTML = kinds.map((k) => {
        const d = INGREDIENTS[k];
        return `<div class="mk-row"><div class="mk-ing"><span class="mk-emoji">${d.emoji}</span><b>${esc(d.names[0].replace(/^(Plain|Shredded|Canned|Dried|White|Button|Green|Black) /, ''))}</b></div>
          <div class="mk-tiers">${TIERS.map((t) => {
            const unlocked = tierUnlocked(p, t);
            const cost = price(k, t);
            return `<div class="mk-tier t${t} ${unlocked ? '' : 'locked'}">
              <span class="mk-swatch" style="background:${d.colors[t - 1]}"></span>
              <span class="mk-name">${esc(d.names[t - 1])}<small>${TIER_LABEL[t]} · own ${have(p, k, t)}</small></span>
              ${unlocked ? `<span class="mk-buy"><button data-k="${k}" data-t="${t}" data-q="1" ${cost > p.coins ? 'disabled' : ''}>🪙${cost}</button>
                <button data-k="${k}" data-t="${t}" data-q="5" ${cost * 5 > p.coins ? 'disabled' : ''}>×5</button></span>`
                : `<span class="mk-lock">🔒 Shop Lv ${TIER_UNLOCK[t]}</span>`}
            </div>`;
          }).join('')}</div></div>`;
      }).join('');
      // Shopping list: what the unlocked recipes still need.
      const needs = allRecipes(p).filter((r) => recipeUnlocked(p, r)).map((r) => ({ r, miss: missingFor(p, r) }));
      const basics = [...new Set(allRecipes(p).filter((r) => recipeUnlocked(p, r)).flatMap((r) => missingFor(p, r)))];
      const bundleCost = basics.reduce((s, k) => s + price(k, 1) * 3, 0);
      root.querySelector('.mk-needs')!.innerHTML = `${needs.map(({ r, miss }) => `<div class="mk-need ${miss.length ? '' : 'ready'}"><b>${esc(r.name)}</b>
          <small>${miss.length ? 'Need: ' + miss.map((k) => INGREDIENTS[k].emoji + ' ' + esc(INGREDIENTS[k].names[0])).join(', ') : 'Ready to make ✓'}</small></div>`).join('')}
        ${basics.length ? `<button class="pz-btn" data-bundle ${bundleCost > p.coins ? 'disabled' : ''}>Buy 3 of each missing (basic) · 🪙${bundleCost}</button>` : ''}
        <p class="mk-tip">Shop Lv ${lvl}. Better tiers unlock as your shop grows: they cost more, look fancier and earn more stars and tips.</p>`;
      root.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = Number(b.dataset.tab); audio.sfx('click'); render(); }));
      root.querySelectorAll<HTMLButtonElement>('[data-k]').forEach((b) => b.addEventListener('click', () => {
        if (buy(p, b.dataset.k as IngKind, Number(b.dataset.t) as 1 | 2 | 3, Number(b.dataset.q))) {
          audio.sfx('collect');
          burstHearts(b, 5, '🪙');
          if (Math.random() < 0.25) helper.say(['Got it!', 'Into the basket ♡', 'Ooh, fancy.'][Math.floor(Math.random() * 3)]);
          render();
        } else audio.sfx('error');
      }));
      root.querySelector('[data-bundle]')?.addEventListener('click', (e) => {
        let ok = true;
        for (const k of basics) ok = buy(p, k, 1, 3) && ok;
        audio.sfx(ok ? 'success' : 'error');
        if (ok) { burstHearts(e.currentTarget as HTMLElement, 10); helper.say('That should cover the menu!'); helper.act('carry'); }
        render();
      });
    };
    render();
    const leave = () => { window.removeEventListener('keydown', onKey, true); close(); resolve(); };
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); leave(); } };
    window.addEventListener('keydown', onKey, true);
    root.querySelector('.pz-exit')!.addEventListener('click', leave);
  });
}

import './garden.css';
import { store } from '../core/store';
import { bus } from '../core/events';
import { audio } from '../audio/audio';
import { esc } from '../ui/dom';
import { burstHearts } from '../ui/fx';
import { gainXp, toast, bumpStat, notify, afterChange } from '../systems/game';
import { COSMETICS } from '../content/cosmetics';
import { Helper, coinsHtml, confetti, overlay, partnerAvatar, playerAvatar } from '../pizza/ui';
import { pizzaUnlocked } from '../pizza/shop';
import {
  BOUQUET, GARDEN_DECOR, GARDEN_DECOR_SLOTS, GARDEN_LINES, SPECIALS, UNLOCK_LEVEL, WRAPS, plantDef,
  type GardenDecorSlot, type SpecialDef,
} from './data';
import {
  MYSTERY, bouquetValue, buyGardenDecor, buyPlot, buySeeds, dig, gardenLevel, giftBouquet, harvest, isBouquetFlower, levelSeeds,
  makeBouquet, nextLevelXp, photoBouquet, photoGarden, plant, plotPrice, readyAt, seedsForSale, sell, sellAll, sellBouquet, stage,
  useGardenDecor, visitGarden, water, type Bouquet, type Harvest,
} from './logic';
import { bouquetSvg, plantSvg } from './draw';
import { bloomRewards, gardenUnlocked, setGardenOnScreen, type BloomResult } from './unlock';

/*
 * The backyard garden. Plants grow in real time (also while the game is closed) and never wilt.
 * Tap a seed in the bag, then an empty plot. Tap a growing plant to water it (once, it grows faster).
 * Tap a ready plant to pick it. Flowers go to the basket (bouquets, stall), toppings go to the pizza pantry.
 */

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const line = (k: keyof typeof GARDEN_LINES | string) => GARDEN_LINES[k] ? pick(GARDEN_LINES[k]) : k;

export function timeLeft(ms: number): string {
  const m = Math.ceil(ms / 60_000);
  if (m <= 1) return ms <= 0 ? 'Ready!' : '<1m';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

let open = false;
export const isGardenOpen = () => open;

/** Open the garden screen. Resolves when she leaves. */
export function openGarden(): Promise<void> {
  if (!gardenUnlocked()) {
    toast(`The garden opens at level ${UNLOCK_LEVEL} ♡`, 'heart');
    return Promise.resolve();
  }
  if (open) return Promise.resolve();
  return new Promise((resolve) => {
    open = true;
    setGardenOnScreen(true);
    const s = store.state;
    const g = s.garden;
    const w = s.pizza; // shared coins + pantry
    const now = () => Date.now();
    const { root, close } = overlay('gd-layer');
    root.innerHTML = `<div class="pz-frame garden-frame">
      <header class="pz-top gd-top"><h2>🌷 Our Garden</h2><span class="pz-level"></span><span class="pz-coin-slot"></span>
        <span class="gd-actions">
          <button class="pz-btn ghost small" data-stall>🧺 Stall</button>
          <button class="pz-btn ghost small" data-bouquet>💐 Bouquets</button>
          <button class="pz-btn ghost small" data-decor aria-label="Decorate">🎨</button>
          <button class="pz-btn ghost small" data-photo aria-label="Take a photo">📷</button>
        </span>
        <button class="pz-exit" aria-label="Leave the garden">Leave ✕</button></header>
      <main class="pz-main gd-main">
        <div class="gd-scene"><div class="gd-sky"></div><div class="gd-fence"></div><div class="gd-lights"></div>
          <div class="gd-plots"></div><div class="gd-extras"></div></div>
        <div class="gd-bag"><div class="gd-hint"></div><div class="gd-seeds"></div></div>
      </main>
    </div>`;
    const frame = root.querySelector('.pz-frame') as HTMLElement;
    const scene = root.querySelector('.gd-scene') as HTMLElement;
    const plotsEl = root.querySelector('.gd-plots') as HTMLElement;
    const seedsEl = root.querySelector('.gd-seeds') as HTMLElement;
    const hintEl = root.querySelector('.gd-hint') as HTMLElement;
    const helper = new Helper(frame);
    let selected: string | null = null;
    let busy = false; // a modal is open

    const save = () => store.save();
    const say = (k: string, mood: Parameters<Helper['say']>[1] = 'happy') => helper.say(store.fmt(line(k)), mood);
    const hint = (t: string) => { hintEl.textContent = t; };

    // ---------------------------------------------------------------- header & scenery
    const header = () => {
      const lvl = gardenLevel(g.xp);
      const next = nextLevelXp(g.xp);
      (root.querySelector('.pz-coin-slot') as HTMLElement).innerHTML = coinsHtml(w.coins);
      (root.querySelector('.pz-level') as HTMLElement).innerHTML = `Garden Lv ${lvl}<i class="pz-xp"><b style="width:${Math.min(100, (g.xp / next) * 100)}%"></b></i>`;
    };
    const scenery = () => {
      for (const slot of Object.keys(g.decor.on) as GardenDecorSlot[]) scene.dataset[`deco${slot[0].toUpperCase()}${slot.slice(1)}`] = g.decor.on[slot];
      scene.dataset.time = store.timeOfDay();
      const extras = (['bench', 'ornament'] as const).map((sl) => GARDEN_DECOR.find((d) => d.id === g.decor.on[sl])).filter((d) => d && !d.id.endsWith('none'));
      (root.querySelector('.gd-extras') as HTMLElement).innerHTML = extras.map((d, i) => `<span class="gd-extra e${i}" title="${esc(d!.name)}">${d!.emoji}</span>`).join('');
      const lights = g.decor.on.lights;
      (root.querySelector('.gd-lights') as HTMLElement).innerHTML = lights === 'lights-none' ? '' : Array.from({ length: 14 }, (_, i) => `<i style="--i:${i}"></i>`).join('');
    };

    // ---------------------------------------------------------------- plots
    const plotHtml = (i: number) => {
      const p = g.plots[i];
      const t = now();
      if (!p.plantId) return `<button class="gd-plot empty ${selected ? 'can' : ''}" data-plot="${i}" aria-label="Empty plot">${plantSvg(null, 0, 78)}<b class="gd-tag">${selected ? 'Plant here' : 'Empty'}</b></button>`;
      const d = plantDef(p.plantId)!;
      const st = stage(p, t);
      const at = readyAt(p) ?? t;
      const ready = st === 3;
      const special = d.kind === 'special';
      const known = !special || !!g.bloomed[d.id];
      return `<button class="gd-plot st${st} ${ready ? 'ready' : ''} ${special ? 'special' : ''} ${p.wateredAt !== null ? 'watered' : ''}" data-plot="${i}"
        aria-label="${esc(known ? d.name : 'Mystery plant')}${ready ? ', ready to pick' : ''}">
        ${plantSvg(p.plantId, st, 78, ready)}
        <b class="gd-tag">${ready ? `Pick ${known ? d.emoji : '✨'}` : `${known ? esc(d.name) : '???'} · <span data-left>${timeLeft(at - t)}</span>`}</b>
        ${!ready && p.wateredAt === null ? '<i class="gd-can" title="Tap to water">💧</i>' : ''}${p.wateredAt !== null && !ready ? '<i class="gd-drops"></i>' : ''}</button>`;
    };
    let stages: string[] = [];
    const renderPlots = () => {
      const price = plotPrice(g);
      plotsEl.innerHTML = g.plots.map((_, i) => plotHtml(i)).join('')
        + (price !== null ? `<button class="gd-plot buy" data-buyplot ${w.coins >= price ? '' : 'disabled'}><span>＋</span><b class="gd-tag">New plot · 🪙${price}</b></button>` : '');
      stages = g.plots.map((p) => `${p.plantId}:${stage(p, now())}:${p.wateredAt !== null}`);
      plotsEl.querySelectorAll<HTMLElement>('[data-plot]').forEach((b) => b.addEventListener('click', () => onPlot(Number(b.dataset.plot), b)));
      plotsEl.querySelector('[data-buyplot]')?.addEventListener('click', () => {
        if (!buyPlot(g, w)) { audio.sfx('error'); return; }
        audio.sfx('dig');
        say('plot');
        save(); header(); renderPlots();
      });
    };
    /** Once a second: update timers; redraw only when a plant changes stage. */
    const tick = () => {
      const t = now();
      const cur = g.plots.map((p) => `${p.plantId}:${stage(p, t)}:${p.wateredAt !== null}`);
      if (cur.join('|') !== stages.join('|')) { renderPlots(); return; }
      g.plots.forEach((p, i) => {
        const el = plotsEl.querySelector(`[data-plot="${i}"] [data-left]`);
        if (el && p.plantId) el.textContent = timeLeft((readyAt(p) ?? t) - t);
      });
    };

    // ---------------------------------------------------------------- seed bag
    const renderSeeds = () => {
      const owned = Object.entries(g.seeds).filter(([, n]) => n > 0);
      if (selected && selected !== MYSTERY && !(g.seeds[selected] > 0)) selected = null;
      if (selected === MYSTERY && g.mystery <= 0) selected = null;
      seedsEl.innerHTML = `${g.mystery > 0 ? `<button class="gd-seed mystery ${selected === MYSTERY ? 'on' : ''}" data-seed="${MYSTERY}"><span>✨</span><b>Mystery</b><small>×${g.mystery}</small></button>` : ''}
        ${owned.map(([id, n]) => { const d = plantDef(id)!; return `<button class="gd-seed ${selected === id ? 'on' : ''}" data-seed="${id}"><span>${d.emoji}</span><b>${esc(d.name)}</b><small>×${n} · ${timeLeft(d.growMin * 60_000)}</small></button>`; }).join('')}
        <button class="gd-seed shop" data-shop><span>🛒</span><b>Seeds</b><small>buy more</small></button>`;
      seedsEl.querySelectorAll<HTMLElement>('[data-seed]').forEach((b) => b.addEventListener('click', () => {
        const id = b.dataset.seed!;
        selected = selected === id ? null : id;
        audio.sfx('click');
        if (selected === MYSTERY) say('seed', 'cute');
        hint(selected ? `Tap an empty plot to plant ${selected === MYSTERY ? 'the mystery seed ✨' : plantDef(selected)!.name}` : defaultHint());
        renderSeeds(); renderPlots();
      }));
      seedsEl.querySelector('[data-shop]')!.addEventListener('click', () => void openStall('seeds'));
    };
    const defaultHint = () => {
      const empty = g.plots.some((p) => !p.plantId);
      const ready = g.plots.some((p) => p.plantId && stage(p, now()) === 3);
      if (ready) return 'Tap a glowing plant to pick it ♡';
      if (empty && (g.mystery > 0 || Object.keys(g.seeds).length)) return 'Pick a seed from the bag, then tap an empty plot';
      if (empty) return 'Out of seeds: buy more at the stall (sell your harvest for coins)';
      return 'Plants keep growing while you’re away. Water them to speed them up 💧';
    };

    // ---------------------------------------------------------------- plot actions
    const onPlot = (i: number, btn: HTMLElement) => {
      if (busy) return;
      const p = g.plots[i];
      const t = now();
      if (!p.plantId) {
        if (!selected) { audio.sfx('error'); hint('Pick a seed from the bag first ↓'); seedsEl.classList.remove('flash'); void seedsEl.offsetWidth; seedsEl.classList.add('flash'); return; }
        const id = plant(g, i, selected, t);
        if (!id) { audio.sfx('error'); return; }
        audio.sfx('dig');
        setTimeout(() => audio.sfx('plop'), 160);
        say('plant');
        bumpStat('garden-planted');
        save(); renderSeeds(); renderPlots();
        hint(selected ? `Tap another empty plot to plant more` : defaultHint());
        return;
      }
      if (stage(p, t) === 3) { doHarvest(i, btn); return; }
      if (water(g, i, t)) {
        audio.sfx('water');
        say('water');
        btn.classList.add('splash');
        save();
        setTimeout(renderPlots, 500);
        return;
      }
      plantInfo(i);
    };

    const plantInfo = (i: number) => {
      const p = g.plots[i];
      const d = plantDef(p.plantId!)!;
      const known = d.kind !== 'special' || !!g.bloomed[d.id];
      const sp = d.kind === 'special' ? (d as SpecialDef) : null;
      modal(`<div class="pz-card gd-info">${plantSvg(p.plantId, stage(p, now()), 96)}
        <h3>${known ? `${d.emoji} ${esc(d.name)}` : '✨ A mystery plant'}</h3>
        <p>${sp && !known ? esc(sp.hint) : `Ready in <b>${timeLeft((readyAt(p) ?? now()) - now())}</b>${p.wateredAt !== null ? ' · watered 💧' : ''}`}</p>
        ${sp && !known ? `<p class="gd-soft">Ready in <b>${timeLeft((readyAt(p) ?? now()) - now())}</b></p>` : ''}
        <div class="pz-row"><button class="pz-btn ghost" data-dig>Dig up</button><button class="pz-btn" data-x>OK</button></div></div>`, (m, done) => {
        m.querySelector('[data-x]')!.addEventListener('click', done);
        m.querySelector('[data-dig]')!.addEventListener('click', () => {
          dig(g, i);
          audio.sfx('dig');
          toast(d.kind === 'special' ? 'The mystery seed is back in your bag ✨' : `${d.name} seed is back in your bag`, 'heart');
          save(); renderSeeds(); renderPlots(); done();
        });
      });
    };

    const doHarvest = (i: number, btn: HTMLElement) => {
      const h = harvest(g, w, i, now());
      if (!h) return;
      const d = plantDef(h.plantId)!;
      audio.sfx('harvest');
      bumpStat('garden-harvests');
      gainXp(4 + Math.round(h.xp / 3), 'garden');
      burstHearts(btn, Math.min(10, 3 + h.qty), d.emoji);
      const float = document.createElement('b');
      float.className = 'gd-float';
      float.textContent = h.toPizza ? `+${h.qty} ${d.emoji} → pizza pantry` : `+${h.qty} ${d.emoji}`;
      btn.appendChild(float);
      if (h.toPizza) toast(`+${h.qty} Premium ${d.name.toLowerCase()} for the pizza shop 🍕`, 'heart', 'good');
      if (!h.firstBloom) say('harvest', 'happy');
      afterChange();
      save();
      setTimeout(() => {
        renderPlots(); renderSeeds(); header();
        hint(defaultHint());
        const after = () => {
          if (h.seedDrop) { audio.sfx('secret'); toast('You found a mystery seed in the soil! ✨', 'sparkle', 'good'); say('seed', 'cute'); renderSeeds(); }
          if (h.levelAfter > h.levelBefore) levelUp(h);
        };
        if (h.firstBloom) void bloomCard(h.firstBloom).then(after); else after();
      }, 450);
    };

    const levelUp = (h: Harvest) => {
      audio.sfx('levelup');
      confetti(root);
      const opens = seedsForSale(g, pizzaUnlocked()).filter((p) => p.gardenLevel > (h.levelBefore) && p.gardenLevel <= h.levelAfter).map((p) => `${p.emoji} ${p.name}`);
      toast(`Garden level ${h.levelAfter}!${opens.length ? ` New seeds: ${opens.join(', ')}` : ''}`, 'heart', 'good');
      if (h.levelSeeds) setTimeout(() => { toast(`A mystery seed for reaching garden level ${h.levelAfter} ✨`, 'sparkle', 'good'); renderSeeds(); }, 900);
      header();
    };

    // ---------------------------------------------------------------- first bloom of a special plant
    const bloomCard = (sp: SpecialDef) => new Promise<void>((done) => {
      const r: BloomResult = bloomRewards(sp);
      audio.sfx('bloom');
      confetti(root);
      helper.act('cheer');
      const who = (sp2: 'her' | 'him') => ({ name: store.nameOf(sp2), img: sp2 === store.playAs() ? playerAvatar('happy') : partnerAvatar('cute') });
      let step = 0;
      const rewards = [
        ...r.entries.map((e) => `<li>💌 <b>${esc(e.title)}</b> <small>is waiting in your Journal</small></li>`),
        ...r.cosmetics.map((id) => `<li>👗 New outfit: <b>${esc(COSMETICS.find((c) => c.id === id)?.name ?? id)}</b> <small>(Wardrobe)</small></li>`),
        ...r.decor.map((id) => `<li>🎨 New garden decor: <b>${esc(GARDEN_DECOR.find((d) => d.id === id)?.name ?? id)}</b></li>`),
        ...(r.coins ? [`<li>🪙 <b>${r.coins}</b> coins tucked under the leaves</li>`] : []),
      ];
      modal('<div class="pz-card gd-bloom"></div>', (m, close2) => {
        const card = m.querySelector('.gd-bloom') as HTMLElement;
        const draw = () => {
          const ln = r.scene[step];
          const last = step >= r.scene.length;
          card.innerHTML = `<div class="gd-bloom-flower" style="--c:${sp.color}">${sp.emoji}</div>
            <h3>${esc(sp.name)} bloomed!</h3>
            ${last ? `<p class="gd-soft">${SPECIALS.findIndex((x) => x.id === sp.id) + 1} of ${SPECIALS.length} special flowers</p>
              ${rewards.length ? `<ul class="gd-rewards">${rewards.join('')}</ul>` : ''}`
              : ln.speaker === 'narrator' ? `<p class="gd-narr">${esc(store.fmtLiteral(ln.text))}</p>`
              : `<div class="gd-say"><img src="${who(ln.speaker).img}" alt=""><span><b>${esc(who(ln.speaker).name)}</b>${esc(store.fmtLiteral(ln.text))}</span></div>`}
            <div class="pz-row"><button class="pz-btn" data-next>${last ? 'Keep it forever ♡' : 'Next →'}</button></div>`;
          card.querySelector('[data-next]')!.addEventListener('click', () => {
            if (last) { close2(); done(); return; }
            step++;
            audio.sfx('click');
            draw();
          });
        };
        draw();
      }, true);
    });

    // ---------------------------------------------------------------- modal helper
    /** In-garden modal (never a browser dialog). `sticky` = Escape doesn't close it. */
    function modal(html: string, wire: (m: HTMLElement, done: () => void) => void, sticky = false) {
      const m = document.createElement('div');
      m.className = 'pz-modal gd-modal';
      if (sticky) m.dataset.sticky = '1';
      m.innerHTML = html;
      frame.appendChild(m);
      busy = true;
      const done = () => { m.remove(); busy = !!frame.querySelector('.pz-modal'); header(); };
      (m as HTMLElement & { _done?: () => void })._done = done;
      wire(m, done);
      return m;
    }

    // ---------------------------------------------------------------- stall: sell harvest, buy seeds
    const openStall = (tab: 'sell' | 'seeds' = 'sell') => new Promise<void>((res) => {
      let cur = tab;
      const pizzaOpen = pizzaUnlocked();
      if (pizzaOpen && !s.flags['garden-toppings-hint']) { s.flags['garden-toppings-hint'] = true; helper.say(store.fmt('We can grow our own pizza toppings now! Garden-fresh counts as Premium ♡'), 'cute'); }
      modal('<div class="pz-card gd-stall"></div>', (m, done) => {
        const card = m.querySelector('.gd-stall') as HTMLElement;
        const draw = () => {
          const basket = Object.entries(g.basket).filter(([, n]) => n > 0);
          const lvl = gardenLevel(g.xp);
          const forSale = seedsForSale(g, pizzaOpen);
          // Tease the next few seeds (topping seeds stay a surprise until the pizza shop opens).
          const locked = seedsForSaleLocked(lvl, pizzaOpen);
          card.innerHTML = `<div class="decor-head"><h3>🧺 Our little stall</h3>${coinsHtml(w.coins)}</div>
            <div class="pz-tabs decor-tabs"><button data-tab="sell" class="${cur === 'sell' ? 'on' : ''}">Sell harvest</button><button data-tab="seeds" class="${cur === 'seeds' ? 'on' : ''}">Buy seeds</button></div>
            ${cur === 'sell' ? (basket.length ? `<div class="gd-rows">${basket.map(([id, n]) => {
              const d = plantDef(id)!;
              return `<div class="gd-row"><span class="gd-em">${d.emoji}</span><span><b>${esc(d.name)}</b><small>×${n} · 🪙${d.sellPrice} each${d.kind === 'special' ? ' · special ✨' : ''}</small></span>
                <span class="gd-buy"><button class="pz-btn small ghost" data-sell="${id}" data-q="1">Sell 1</button><button class="pz-btn small" data-sell="${id}" data-q="${n}">All · 🪙${d.sellPrice * n}</button></span></div>`;
            }).join('')}</div>
              <div class="pz-row"><button class="pz-btn" data-sellall>Sell everything (keeps special flowers)</button></div>`
              : '<p class="gd-empty">Your basket is empty. Pick ripe plants in the garden, then sell them here for coins ♡</p>')
            : `<div class="gd-rows">${forSale.map((d) => `<div class="gd-row"><span class="gd-em">${d.emoji}</span>
                <span><b>${esc(d.name)}</b><small>${timeLeft(d.growMin * 60_000)} to grow · ${d.pizza ? 'for the pizza shop' : d.cooking ? `sells 🪙${d.sellPrice} · ${esc(d.cooking)}` : `sells 🪙${d.sellPrice}`} · have ${g.seeds[d.id] ?? 0}</small></span>
                <span class="gd-buy"><button class="pz-btn small" data-seed="${d.id}" data-q="1" ${w.coins >= d.seedPrice ? '' : 'disabled'}>🪙${d.seedPrice}</button><button class="pz-btn small ghost" data-seed="${d.id}" data-q="5" ${w.coins >= d.seedPrice * 5 ? '' : 'disabled'}>×5</button></span></div>`).join('')}
              ${locked.map((d) => `<div class="gd-row locked"><span class="gd-em">${d.emoji}</span><span><b>${esc(d.name)}</b><small>🔒 Garden Lv ${d.gardenLevel}</small></span></div>`).join('')}</div>`}
            <div class="pz-row"><button class="pz-btn ghost" data-x>Done</button></div>`;
          card.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => { cur = b.dataset.tab as 'sell' | 'seeds'; audio.sfx('click'); draw(); }));
          card.querySelectorAll<HTMLButtonElement>('[data-sell]').forEach((b) => b.addEventListener('click', () => {
            const got = sell(g, w, b.dataset.sell!, Number(b.dataset.q));
            if (!got) { audio.sfx('error'); return; }
            audio.sfx('register'); burstHearts(b, 5, '🪙'); if (Math.random() < 0.3) say('sell');
            save(); draw();
          }));
          card.querySelector('[data-sellall]')?.addEventListener('click', (e) => {
            const got = sellAll(g, w);
            if (!got) { audio.sfx('error'); return; }
            audio.sfx('register'); burstHearts(e.currentTarget as HTMLElement, 10, '🪙'); say('sell');
            toast(`Sold for 🪙${got}`, 'heart', 'good');
            save(); draw();
          });
          card.querySelectorAll<HTMLButtonElement>('[data-seed]').forEach((b) => b.addEventListener('click', () => {
            if (!buySeeds(g, w, b.dataset.seed!, Number(b.dataset.q), pizzaOpen)) { audio.sfx('error'); return; }
            audio.sfx('collect'); burstHearts(b, 4, '🌱');
            save(); draw(); renderSeeds();
          }));
          card.querySelector('[data-x]')!.addEventListener('click', () => { done(); res(); renderSeeds(); renderPlots(); hint(defaultHint()); });
        };
        draw();
      });
    });
    const seedsForSaleLocked = (lvl: number, pizzaOpen: boolean) => {
      const all = seedsForSale({ ...g, xp: 1e9 }, pizzaOpen);
      return all.filter((d) => d.gardenLevel > lvl).slice(0, 3);
    };

    // ---------------------------------------------------------------- bouquets
    const openBouquets = () => {
      let chosen: string[] = [];
      let wrap = WRAPS[0].id;
      modal('<div class="pz-card gd-bq"></div>', (m, done) => {
        const card = m.querySelector('.gd-bq') as HTMLElement;
        const draw = () => {
          const left = (id: string) => (g.basket[id] ?? 0) - chosen.filter((f) => f === id).length;
          const flowers = Object.keys(g.basket).filter((id) => isBouquetFlower(id) && g.basket[id] > 0);
          card.innerHTML = `<div class="decor-head"><h3>💐 Bouquets</h3>${coinsHtml(w.coins)}</div>
            ${g.bouquets.length ? `<div class="gd-bq-list">${g.bouquets.map((b) => `<div class="gd-bq-item">${bouquetSvg(b.flowers, b.wrap, 84)}
              <div class="gd-bq-acts"><button class="pz-btn small" data-gift="${b.id}">💝 Give to ${esc(store.partnerName())}</button>
              <button class="pz-btn small ghost" data-snap="${b.id}">📷 Photo</button><button class="pz-btn small ghost" data-sellb="${b.id}">🪙${bouquetValue(b)}</button></div></div>`).join('')}</div>` : ''}
            <h4 class="gd-sub">Tie a new bouquet <small>(${BOUQUET.min}–${BOUQUET.max} flowers)</small></h4>
            ${flowers.length ? `<div class="gd-pickrow">${flowers.map((id) => `<button class="gd-pick" data-add="${id}" ${left(id) > 0 && chosen.length < BOUQUET.max ? '' : 'disabled'}>${plantDef(id)!.emoji}<small>${left(id)}</small></button>`).join('')}</div>
              <div class="gd-bq-make"><div class="gd-bq-preview">${chosen.length ? bouquetSvg(chosen, wrap, 120) : '<span class="gd-soft">Tap flowers to add them</span>'}</div>
                <div><div class="gd-wraps">${WRAPS.map((x) => `<button class="gd-wrap ${x.id === wrap ? 'on' : ''}" data-wrap="${x.id}" title="${esc(x.name)}" style="background:${x.color}"></button>`).join('')}</div>
                ${chosen.length ? `<div class="gd-chosen">${chosen.map((f, i) => `<button data-rm="${i}" aria-label="Remove">${plantDef(f)!.emoji}</button>`).join('')}</div>` : ''}
                <button class="pz-btn" data-tie ${chosen.length >= BOUQUET.min ? '' : 'disabled'}>Tie bouquet (${chosen.length})</button></div></div>`
              : '<p class="gd-empty">No flowers in your basket yet. Grow daisies, tulips, roses… then come back ♡</p>'}
            <div class="pz-row"><button class="pz-btn ghost" data-x>Done</button></div>`;
          card.querySelectorAll<HTMLElement>('[data-add]').forEach((b) => b.addEventListener('click', () => { chosen.push(b.dataset.add!); audio.sfx('plop'); draw(); }));
          card.querySelectorAll<HTMLElement>('[data-rm]').forEach((b) => b.addEventListener('click', () => { chosen.splice(Number(b.dataset.rm), 1); audio.sfx('click'); draw(); }));
          card.querySelectorAll<HTMLElement>('[data-wrap]').forEach((b) => b.addEventListener('click', () => { wrap = b.dataset.wrap!; audio.sfx('click'); draw(); }));
          card.querySelector('[data-tie]')?.addEventListener('click', () => {
            const b = makeBouquet(g, chosen, wrap, now());
            if (!b) { audio.sfx('error'); toast(g.bouquets.length >= 12 ? 'Your arms are full! Give or sell a bouquet first.' : 'Not enough flowers for that', 'heart'); return; }
            chosen = [];
            audio.sfx('chime');
            say('bouquet', 'cute');
            bumpStat('garden-bouquets');
            save(); draw();
          });
          const find = (id: string) => g.bouquets.find((b) => b.id === id) as Bouquet;
          card.querySelectorAll<HTMLElement>('[data-gift]').forEach((btn) => btn.addEventListener('click', () => {
            const b = find(btn.dataset.gift!);
            const r = giftBouquet(g, b.id);
            if (!r) return;
            const n = b.flowers.length + b.flowers.filter((f) => plantDef(f)?.kind === 'special').length * 2;
            s.affection += 2 + n;
            bumpStat('gifts');
            gainXp(12 + n * 3, 'gift');
            notify({ type: 'gift' });
            audio.sfx('heart');
            burstHearts(btn, 12, '♥');
            helper.act('cheer');
            say('gift', 'cute');
            if (r.seed) setTimeout(() => { audio.sfx('secret'); helper.say(store.fmt('Wait, I have something for you too… a mystery seed ✨'), 'cute'); toast('A mystery seed from {him} ✨', 'sparkle', 'good'); renderSeeds(); }, 2200);
            save(); draw();
          }));
          card.querySelectorAll<HTMLElement>('[data-snap]').forEach((btn) => btn.addEventListener('click', () => {
            photoBouquet(g, find(btn.dataset.snap!), now());
            flash();
            toast('📷 Saved to your phone’s Gallery (Garden album)', 'heart', 'good');
            save();
          }));
          card.querySelectorAll<HTMLElement>('[data-sellb]').forEach((btn) => btn.addEventListener('click', () => {
            const v = sellBouquet(g, w, btn.dataset.sellb!);
            if (!v) return;
            audio.sfx('register'); burstHearts(btn, 6, '🪙'); say('sell');
            save(); draw();
          }));
          card.querySelector('[data-x]')!.addEventListener('click', () => { done(); renderSeeds(); });
        };
        draw();
      });
    };

    // ---------------------------------------------------------------- decorate
    const openDecor = () => {
      let tab: GardenDecorSlot = 'fence';
      modal('<div class="pz-card decor-card"></div>', (m, done) => {
        const card = m.querySelector('.decor-card') as HTMLElement;
        const draw = () => {
          card.innerHTML = `<div class="decor-head"><h3>🎨 Decorate our garden</h3>${coinsHtml(w.coins)}</div>
            <div class="pz-tabs decor-tabs">${GARDEN_DECOR_SLOTS.map((x) => `<button data-tab="${x.slot}" class="${x.slot === tab ? 'on' : ''}">${x.icon} ${x.label}</button>`).join('')}</div>
            <div class="decor-grid">${GARDEN_DECOR.filter((d) => d.slot === tab).map((d) => {
              const owned = g.decor.owned.includes(d.id);
              const using = g.decor.on[d.slot] === d.id;
              return `<div class="decor-item ${using ? 'using' : ''} ${d.special && !owned ? 'mystery' : ''}">
                <span class="decor-swatch" style="background:${d.special && !owned ? '#eee5f0' : d.swatch}">${d.special && !owned ? '✨' : d.emoji}</span>
                <b>${d.special && !owned ? '???' : esc(d.name)}</b>
                ${using ? '<em>In use ♡</em>' : owned ? `<button class="pz-btn small" data-use="${d.id}">Use</button>`
                  : d.special ? '<small>Bloom a special plant</small>'
                  : `<button class="pz-btn small" data-buy="${d.id}" ${w.coins >= d.price ? '' : 'disabled'}>🪙${d.price}</button>`}</div>`;
            }).join('')}</div>
            <div class="pz-row"><button class="pz-btn" data-x>Done</button></div>`;
          card.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab as GardenDecorSlot; audio.sfx('click'); draw(); }));
          card.querySelectorAll<HTMLElement>('[data-buy]').forEach((b) => b.addEventListener('click', () => {
            if (!buyGardenDecor(g, w, b.dataset.buy!)) { audio.sfx('error'); return; }
            audio.sfx('register'); say('decor'); save(); scenery(); draw();
          }));
          card.querySelectorAll<HTMLElement>('[data-use]').forEach((b) => b.addEventListener('click', () => {
            if (!useGardenDecor(g, b.dataset.use!)) return;
            audio.sfx('heart'); say('decor'); save(); scenery(); draw();
          }));
          card.querySelector('[data-x]')!.addEventListener('click', done);
        };
        draw();
      });
    };

    const flash = () => {
      const f = document.createElement('div');
      f.className = 'gd-flash';
      frame.appendChild(f);
      audio.sfx('click');
      setTimeout(() => f.remove(), 600);
    };

    // ---------------------------------------------------------------- wiring
    const onReady = (list: { plot: number; plantId: string }[]) => {
      if (!list.length) return;
      audio.sfx('chime');
      const sp = list.find((r) => plantDef(r.plantId)?.kind === 'special');
      helper.say(store.fmt(sp ? 'Something special is blooming… ✨' : line('ready')), 'cute');
      renderPlots();
      hint(defaultHint());
    };
    bus.on('garden:ready', onReady);
    const timer = window.setInterval(tick, 1000);

    root.querySelector('[data-stall]')!.addEventListener('click', () => { if (!busy) void openStall('sell'); });
    root.querySelector('[data-bouquet]')!.addEventListener('click', () => { if (!busy) openBouquets(); });
    root.querySelector('[data-decor]')!.addEventListener('click', () => { if (!busy) openDecor(); });
    root.querySelector('[data-photo]')!.addEventListener('click', () => {
      if (busy) return;
      photoGarden(g, now());
      flash();
      say('photo');
      toast('📷 Saved to your phone’s Gallery (Garden album)', 'heart', 'good');
      save();
    });

    const leave = () => {
      clearInterval(timer);
      bus.off('garden:ready', onReady);
      window.removeEventListener('keydown', onKey, true);
      open = false;
      setGardenOnScreen(false);
      close();
      resolve();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      e.preventDefault(); e.stopImmediatePropagation();
      const m = frame.querySelector<HTMLElement & { _done?: () => void }>('.pz-modal:last-of-type');
      if (m) { if (!m.dataset.sticky) m._done?.(); } else leave();
    };
    window.addEventListener('keydown', onKey, true);
    root.querySelector('.pz-exit')!.addEventListener('click', () => { if (!frame.querySelector('.gd-bloom')) leave(); });

    // ---------------------------------------------------------------- arrive
    const v = visitGarden(g, store.today());
    const lvSeeds = levelSeeds(g);
    header(); scenery(); renderSeeds(); renderPlots();
    hint(defaultHint());
    const readyNow = g.plots.filter((p) => p.plantId && stage(p, now()) === 3).length;
    g.plots.forEach((p) => { if (p.plantId && stage(p, now()) === 3) p.told = true; });
    if (v.seed) setTimeout(() => { audio.sfx('secret'); toast('{him} left a mystery seed by the gate for you ✨', 'sparkle', 'good'); helper.say(store.fmt('I found this by the gate this morning… for you ✨'), 'cute'); }, 700);
    else if (lvSeeds) setTimeout(() => toast(`${lvSeeds} mystery seed${lvSeeds > 1 ? 's' : ''} for your garden level ✨`, 'sparkle', 'good'), 700);
    else helper.say(store.fmt(readyNow ? `Welcome back! ${readyNow} ${readyNow === 1 ? 'plant is' : 'plants are'} ready ♡` : line('hello')));
    if (v.newDay) bumpStat('garden-days');
    save();
  });
}

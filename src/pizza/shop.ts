import { store } from '../core/store';
import { audio } from '../audio/audio';
import { esc } from '../ui/dom';
import { burstHearts } from '../ui/fx';
import { gainXp, setFlag, toast, afterChange } from '../systems/game';
import { CUSTOMERS, INGREDIENTS, RECIPES, TIER_LABEL, TIERS, type CustomerDef, type IngKind, type RecipeDef, type Tier } from './data';
import {
  CUSTOM_ID, CUSTOM_LEVEL, allRecipes, bakeScore, canMakeCount, consume, customWeight, doughScore, findRecipe, have, judgePizza,
  missingFor, nextCustomer, nextLevelXp, recipeUnlocked, settle, shopLevel, sliceScore, toppingAccuracy, UNLOCK_LEVEL,
  type PizzaBuild, type PizzaState, type Verdict,
} from './logic';
import { GRID, coverage, drawPizza, emptyLook, packLook, paint, unpackLook, type PizzaLook } from './draw';
import { Helper, coinsHtml, confetti, customerFace, overlay, playerAvatar, probeCustomers, stars } from './ui';
import { openMarket } from './market';
import { openCustomEditor } from './custom';
import { apronBadge, decorAttrs, decorScenery, openDecorate } from './decor';

/*
 * The pizza shop. The customer queue and the pizza on the counter are saved with the game, so she can leave
 * the shop (or close the app) and pick up where she was. Time inside the shop only passes while it is on screen.
 * Relaxed: customers never walk out; a long wait only trims the tip a little.
 */

interface Waiting { uid: number; customer: CustomerDef; recipeId: string; patience: number; left: number; saidWait?: boolean }
type Step = 'dough' | 'sauce' | 'cheese' | 'toppings' | 'bake' | 'slice' | 'box';
const STEPS: Step[] = ['dough', 'sauce', 'cheese', 'toppings', 'bake', 'slice', 'box'];
const STEP_LABEL: Record<Step, string> = { dough: 'Stretch the dough', sauce: 'Spread the sauce', cheese: 'Add the cheese', toppings: 'Place the toppings', bake: 'Bake', slice: 'Slice', box: 'Box & serve' };

interface Cook {
  w: Waiting;
  recipe: RecipeDef;
  step: Step;
  look: PizzaLook;
  build: PizzaBuild;
  active?: IngKind;
}

const session = { queue: [] as Waiting[], spawnIn: 3, cooking: null as Cook | null, uid: 1 };
/** The save the in-memory session was loaded from (switching save slots reloads it). */
let sessionOwner: PizzaState | null = null;

/** Load the saved queue and half-made pizza (once per save). */
function ensureSession(p: PizzaState) {
  if (sessionOwner === p) return;
  sessionOwner = p;
  Object.assign(session, { queue: [], spawnIn: 3, cooking: null, uid: 1 });
  const s = p.session;
  if (!s || !p.open) return;
  session.uid = Math.max(1, Number(s.uid) || 1);
  session.spawnIn = Number.isFinite(s.spawnIn) ? s.spawnIn : 3;
  for (const q of s.queue) {
    const customer = CUSTOMERS.find((c) => c.id === q.customerId);
    if (!customer || !findRecipe(p, q.recipeId) || session.queue.some((w) => w.customer === customer)) continue;
    const patience = Math.max(1, Number(q.patience) || customer.patience);
    session.queue.push({ uid: q.uid, customer, recipeId: q.recipeId, patience, left: Math.max(0, Math.min(patience, Number(q.left) || 0)) });
    session.uid = Math.max(session.uid, q.uid + 1);
  }
  const c = s.cooking;
  const w = c && session.queue.find((x) => x.uid === c.uid);
  const r = w && findRecipe(p, w.recipeId);
  if (c && w && r && STEPS.includes(c.step as Step) && c.build?.recipeId === r.id) {
    try {
      session.cooking = { w, recipe: r, step: c.step as Step, look: unpackLook(c.look), build: c.build, active: c.active };
    } catch { session.cooking = null; }
  }
}
/** Copy the live session into the save. */
function persist(p: PizzaState) {
  if (sessionOwner !== p) return;
  const c = session.cooking;
  p.session = session.queue.length || c ? {
    queue: session.queue.map((w) => ({ uid: w.uid, customerId: w.customer.id, recipeId: w.recipeId, patience: w.patience, left: w.left })),
    spawnIn: session.spawnIn,
    uid: session.uid,
    cooking: c ? { uid: c.w.uid, step: c.step, look: packLook(c.look), build: c.build, active: c.active } : null,
  } : null;
}
/** Save the shop session now (also used when the app is hidden or closed). */
export function saveShopSession() {
  if (!store.hasGame || sessionOwner !== store.state.pizza) return;
  persist(store.state.pizza);
  store.save();
}
let lifecycleHooked = false;
function hookLifecycle() {
  if (lifecycleHooked) return;
  lifecycleHooked = true;
  window.addEventListener('pagehide', saveShopSession);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveShopSession(); });
}

export const pizzaUnlocked = () => store.hasGame && (store.state.pizza.unlocked || store.state.level >= UNLOCK_LEVEL);
const today = () => store.today();
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const recipe = (id: string) => findRecipe(store.state.pizza, id) ?? RECIPES[0];

/** Open the shop screen. Resolves when she leaves. */
export function openPizzaShop(): Promise<void> {
  if (!pizzaUnlocked()) {
    toast(`The pizza shop opens at level ${UNLOCK_LEVEL} ♡`, 'heart');
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const p = store.state.pizza;
    ensureSession(p);
    hookLifecycle();
    const checkpoint = () => { persist(p); store.save(); };
    const { root, close } = overlay('pz-shop');
    root.innerHTML = `<div class="pz-frame shop-frame">
      <header class="pz-top"><h2>🍕 Our Pizza Shop</h2><span class="pz-level"></span><span class="pz-coin-slot"></span>
        <button class="pz-btn ghost" data-market>🧺 Market</button><button class="pz-exit" aria-label="Leave the shop">Leave ✕</button></header>
      <main class="pz-main"></main>
    </div>`;
    const frame = root.querySelector('.pz-frame') as HTMLElement;
    const main = root.querySelector('.pz-main') as HTMLElement;
    const helper = new Helper(frame);
    helper.apron(apronBadge(p));
    let raf = 0;
    let last = performance.now();
    let stopKitchen: (() => void) | null = null;

    const header = () => {
      const lvl = shopLevel(p.xp);
      const next = nextLevelXp(p.xp);
      (root.querySelector('.pz-coin-slot') as HTMLElement).innerHTML = coinsHtml(p.coins);
      (root.querySelector('.pz-level') as HTMLElement).innerHTML = `Shop Lv ${lvl}${next ? `<i class="pz-xp"><b style="width:${Math.min(100, (p.xp / next) * 100)}%"></b></i>` : ''}`;
    };

    // ---------------------------------------------------------------- counter
    const counter = () => {
      stopKitchen?.();
      stopKitchen = null;
      header();
      const menu = p.menu.filter((id) => findRecipe(p, id));
      const day = p.day.key === today() ? p.day : { served: 0, earned: 0, stars: 0, left: 0 };
      main.innerHTML = `<div class="shop-scene ${p.open ? 'is-open' : 'is-closed'}" ${decorAttrs(p)}>
        ${decorScenery(p)}
        <div class="shop-board"><h4>Today’s menu</h4>${menu.length ? menu.map((id) => {
          const r = recipe(id);
          return `<div class="board-item ${id === CUSTOM_ID ? 'mine' : ''}"><i style="background:${r.color}"></i>${id === CUSTOM_ID ? '✨ ' : ''}${esc(r.name)}<span>🪙${r.price}+</span></div>`;
        }).join('') : '<p>Pick a menu when you open.</p>'}</div>
        <div class="shop-sign-wrap"><button class="shop-sign ${p.open ? 'open' : 'closed'}" data-sign aria-label="Flip the sign">
          <span class="sign-string"></span><b>${p.open ? 'OPEN' : 'CLOSED'}</b><small>${p.open ? 'tap to close' : 'tap to open'}</small></button></div>
        <div class="shop-queue">${p.open ? (session.queue.length ? session.queue.map((w) => {
          const r = recipe(w.recipeId);
          const can = canMakeCount(p, r) > 0;
          const reg = p.regulars[w.customer.id];
          const frac = w.left / w.patience;
          return `<button class="cust ${frac <= 0 ? 'patient' : ''}" data-uid="${w.uid}">
            <span class="cust-bubble"><i style="background:${r.color}"></i>${w.recipeId === CUSTOM_ID ? '✨ ' : ''}${esc(r.name)}${can ? '' : '<em>out of stock</em>'}</span>
            ${customerFace(w.customer, frac > 0.5 ? 'happy' : 'neutral')}
            <b>${esc(w.customer.name)}</b>${reg ? `<small class="regular">regular ♡ ${reg.visits}</small>` : ''}
            <span class="patience" title="The longer they wait, the smaller the tip"><i style="width:${Math.max(0, frac * 100)}%"></i></span><small class="waiting-note">waiting patiently ♡</small></button>`;
        }).join('') : '<p class="shop-wait">Waiting for customers…</p>') : '<p class="shop-wait">The shop is closed. Flip the sign to open ♡</p>'}</div>
        <div class="shop-counter"><button class="pz-btn small decorate-btn" data-decor>🎨 Decorate</button></div>
        <div class="pz-me"><span class="pz-ava"><img alt="" src="${playerAvatar('happy')}"><span class="apron-slot">${apronBadge(p)}</span></span><b>${esc(store.playerName())}</b></div>
        <footer class="shop-day">Today: <b>${day.served}</b> served · <b>🪙${day.earned}</b> earned · ${day.served ? `<b>${(day.stars / day.served).toFixed(1)}★</b> avg` : '—'}${day.left ? ` · ${day.left} left` : ''}</footer>
      </div>`;
      main.querySelector('[data-sign]')!.addEventListener('click', () => (p.open ? closeShop() : planMenu()));
      main.querySelector('[data-decor]')!.addEventListener('click', () => {
        audio.sfx('click');
        void openDecorate(frame, p, helper, () => { helper.apron(apronBadge(p)); if (!session.cooking) counter(); header(); });
      });
      main.querySelectorAll<HTMLElement>('[data-uid]').forEach((b) => b.addEventListener('click', () => takeOrder(Number(b.dataset.uid))));
    };

    const planMenu = () => {
      const unlocked = () => allRecipes(p).filter((r) => recipeUnlocked(p, r));
      const sel = new Set(p.menu.filter((id) => unlocked().some((r) => r.id === id) && canMakeCount(p, recipe(id)) > 0));
      if (!sel.size) unlocked().filter((r) => canMakeCount(p, r) > 0).forEach((r) => sel.add(r.id));
      const modal = document.createElement('div');
      modal.className = 'pz-modal';
      const customOpen = shopLevel(p.xp) >= CUSTOM_LEVEL;
      const draw = () => {
        modal.innerHTML = `<div class="pz-card"><h3>Today’s menu</h3><p>Pick the pizzas you can make today. Customers only order from this list.</p>
          <div class="menu-list">${allRecipes(p).map((r) => {
            const open = recipeUnlocked(p, r);
            const n = canMakeCount(p, r);
            const miss = missingFor(p, r);
            const mine = r.id === CUSTOM_ID;
            return `<label class="menu-item ${open && n > 0 ? '' : 'off'} ${mine ? 'mine' : ''}"><input type="checkbox" data-r="${r.id}" ${sel.has(r.id) ? 'checked' : ''} ${open && n > 0 ? '' : 'disabled'}>
              <span class="menu-rank">${mine ? '✨' : r.rank}</span><span><b>${esc(r.name)}</b><small>${!open ? `🔒 Shop Lv ${r.shopLevel}` : n > 0 ? `${mine ? 'Your pizza of the day · ' : ''}Can make ${n} · 🪙${r.price}+` : `Missing: ${miss.map((k) => INGREDIENTS[k].emoji).join(' ')}`}</small></span></label>`;
          }).join('')}
          <div class="menu-custom ${customOpen ? '' : 'off'}">${customOpen
            ? `<span>✨</span><span><b>${p.custom ? 'Edit your pizza of the day' : 'Create your own pizza!'}</b><small>Choose the sauce, toppings, name and price.</small></span><button class="pz-btn small" data-custom>${p.custom ? 'Edit' : 'Create'}</button>`
            : `<span>🔒</span><span><b>Your own pizza of the day</b><small>Unlocks at Shop Lv ${CUSTOM_LEVEL}</small></span>`}</div></div>
          <div class="pz-row"><button class="pz-btn ghost" data-mk>🧺 Market</button><button class="pz-btn ghost" data-x>Cancel</button><button class="pz-btn" data-go ${sel.size ? '' : 'disabled'}>Open the shop</button></div></div>`;
        modal.querySelectorAll<HTMLInputElement>('[data-r]').forEach((c) => c.addEventListener('change', () => { c.checked ? sel.add(c.dataset.r!) : sel.delete(c.dataset.r!); draw(); }));
        modal.querySelector('[data-x]')!.addEventListener('click', () => modal.remove());
        modal.querySelector('[data-mk]')!.addEventListener('click', async () => { modal.remove(); await goMarket(); planMenu(); });
        modal.querySelector('[data-custom]')?.addEventListener('click', async () => {
          audio.sfx('click');
          const had = !!p.custom;
          const saved = await openCustomEditor(frame, p);
          if (saved) {
            if (!had && canMakeCount(p, recipe(CUSTOM_ID)) > 0) sel.add(CUSTOM_ID);
            helper.say('custom', 'love');
            audio.sfx('chime');
          } else if (!p.custom) sel.delete(CUSTOM_ID);
          draw();
        });
        modal.querySelector('[data-go]')!.addEventListener('click', () => {
          p.menu = allRecipes(p).filter((r) => sel.has(r.id)).map((r) => r.id);
          p.open = true;
          session.spawnIn = 2.5;
          if (p.day.key !== today()) p.day = { key: today(), served: 0, earned: 0, stars: 0, left: 0 };
          setFlag('pizza-opened');
          audio.sfx('bell');
          helper.say('open');
          modal.remove();
          checkpoint();
          counter();
        });
      };
      draw();
      frame.appendChild(modal);
    };

    const closeShop = () => {
      p.open = false;
      const n = session.queue.length;
      session.queue = [];
      session.cooking = null;
      audio.sfx('close');
      const d = p.day.key === today() ? p.day : { served: 0, earned: 0, stars: 0, left: 0 };
      helper.say(d.served ? `Good work today, chef ♡ ${d.served} pizza${d.served === 1 ? '' : 's'}!` : 'closed');
      if (n) toast(`${n} customer${n > 1 ? 's' : ''} will come back another time`, 'heart');
      checkpoint();
      counter();
    };

    const spawn = () => {
      const menu = p.menu.filter((id) => findRecipe(p, id));
      const next = nextCustomer(menu, session.queue.map((w) => w.customer.id), Math.random, (id) => (id === CUSTOM_ID && p.custom ? customWeight(p.custom) : 1));
      if (!next) return;
      const patience = next.customer.patience * (0.9 + Math.random() * 0.2);
      session.queue.push({ uid: session.uid++, customer: next.customer, recipeId: next.recipeId, patience, left: patience });
      audio.sfx('bell');
      helper.say(next.recipeId === CUSTOM_ID ? 'customOrder' : 'customer');
      checkpoint();
    };

    const takeOrder = (uid: number) => {
      const w = session.queue.find((x) => x.uid === uid);
      if (!w) return;
      const r = recipe(w.recipeId);
      if (canMakeCount(p, r) <= 0) {
        // Can't make it: apologise, they leave without a fuss.
        session.queue = session.queue.filter((x) => x !== w);
        toast(`${w.customer.name}: “Oh, no worries! Another time.”`, 'heart');
        helper.say('restock', 'sad');
        checkpoint();
        counter();
        return;
      }
      audio.sfx('click');
      toast(store.fmt(pick(w.customer.lines.order).replace('{pizza}', r.name)), 'heart');
      session.cooking = {
        w, recipe: r, step: 'dough', look: emptyLook(),
        build: { recipeId: r.id, tiers: {}, placed: {}, scores: { dough: 0, sauce: 0, cheese: 0, toppings: 0, bake: 0, slice: 0 } },
      };
      helper.act('carry');
      helper.say('dough');
      checkpoint();
      kitchen();
    };

    // ---------------------------------------------------------------- kitchen
    const kitchen = () => {
      const c = session.cooking!;
      header();
      main.innerHTML = `<div class="kit">
        <aside class="kit-ticket">
          <div class="ticket-who">${customerFace(c.w.customer, 'happy', 44)}<span><b>${esc(c.w.customer.name)}</b><small>wants</small></span></div>
          <h4>${esc(c.recipe.name)}</h4>
          <ol class="ticket-steps">${STEPS.map((s) => `<li data-s="${s}">${STEP_LABEL[s]}</li>`).join('')}</ol>
          <div class="ticket-tops">${c.recipe.toppings.length ? c.recipe.toppings.map((t) => `<span>${INGREDIENTS[t.kind].emoji} ${t.count}</span>`).join('') : '<span>No toppings, just cheese</span>'}</div>
          <button class="pz-btn ghost small" data-trash>🗑 Start over</button>
        </aside>
        <div class="kit-stage"><canvas></canvas><div class="kit-hint"></div><div class="kit-meter hidden"><i></i><b></b></div></div>
        <div class="kit-controls"></div>
      </div>`;
      const canvas = main.querySelector('canvas') as HTMLCanvasElement;
      const stage = main.querySelector('.kit-stage') as HTMLElement;
      const controls = main.querySelector('.kit-controls') as HTMLElement;
      const hint = main.querySelector('.kit-hint') as HTMLElement;
      const meter = main.querySelector('.kit-meter') as HTMLElement;
      let size = { w: 0, h: 0, R: 0, cx: 0, cy: 0 };
      const fit = () => {
        const dpr = Math.min(2, devicePixelRatio || 1);
        const w = stage.clientWidth, h = stage.clientHeight;
        canvas.width = Math.max(1, w * dpr); canvas.height = Math.max(1, h * dpr);
        canvas.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
        size = { w, h, R: Math.max(20, Math.min(w, h) * 0.4), cx: w / 2, cy: h / 2 };
      };
      const ro = new ResizeObserver(fit);
      ro.observe(stage);
      fit();
      let t = 0;
      let stretching = false, stretch = 0;
      let baking = false;
      let cutStart: [number, number] | null = null, cutNow: [number, number] | null = null;
      let painting = false;
      let sfxClock = 0;
      let lastSquish = 0;
      const squish = () => { const now = performance.now(); if (now - lastSquish > 120) { lastSquish = now; audio.sfx('squish'); } };

      const toPizza = (e: PointerEvent): [number, number] => {
        const r = canvas.getBoundingClientRect();
        const sx = size.w / r.width; // the frame may be scaled by the open animation
        return [((e.clientX - r.left) * sx - size.cx) / size.R, ((e.clientY - r.top) * sx - size.cy) / size.R];
      };
      const draw = () => {
        const g = canvas.getContext('2d')!;
        g.clearRect(0, 0, size.w, size.h);
        const look = c.step === 'dough' && stretching ? { ...c.look, dough: { size: stretch, tier: c.build.tiers.dough ?? 1 } } : c.look;
        if (c.step === 'bake' && baking) { // oven glow
          g.fillStyle = `rgba(255,140,60,${0.15 + 0.1 * Math.sin(t * 6)})`;
          g.fillRect(0, 0, size.w, size.h);
        }
        drawPizza(g, look, size.cx, size.cy, size.R, t);
        if (c.step === 'dough') { // target ring
          g.strokeStyle = 'rgba(232,87,125,.6)'; g.setLineDash([6, 6]); g.lineWidth = 2;
          g.beginPath(); g.arc(size.cx, size.cy, size.R * 0.93, 0, 7); g.stroke(); g.setLineDash([]);
        }
        if (cutStart && cutNow) {
          g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; g.setLineDash([8, 6]);
          g.beginPath(); g.moveTo(size.cx + cutStart[0] * size.R, size.cy + cutStart[1] * size.R); g.lineTo(size.cx + cutNow[0] * size.R, size.cy + cutNow[1] * size.R); g.stroke(); g.setLineDash([]);
        }
      };
      const frameLoop = (now: number) => {
        raf = requestAnimationFrame(frameLoop);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        t += dt;
        tick(dt);
        if (stretching) {
          stretch = Math.min(1.3, stretch + dt * 0.75);
          meterSet(stretch / 1.3, 0.93 / 1.3);
          if ((sfxClock -= dt) <= 0) { sfxClock = 0.38; audio.sfx('stretch'); }
        }
        if (baking) {
          if ((sfxClock -= dt) <= 0) { sfxClock = 1.3; audio.sfx('sizzle'); }
          c.look.bake = Math.min(1.08, c.look.bake + dt / 7);
          meterSet(Math.min(1, c.look.bake), 0.7);
          if (c.look.bake >= 1.08) finishBake();
        }
        draw();
      };
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frameLoop);

      const meterSet = (v: number, target: number) => {
        meter.classList.remove('hidden');
        (meter.querySelector('i') as HTMLElement).style.width = `${v * 100}%`;
        meter.style.setProperty('--target', `${target * 100}%`);
      };
      const setStep = (s: Step) => {
        c.step = s;
        main.querySelectorAll<HTMLElement>('[data-s]').forEach((li) => {
          const i = STEPS.indexOf(li.dataset.s as Step);
          li.classList.toggle('done', i < STEPS.indexOf(s));
          li.classList.toggle('now', li.dataset.s === s);
        });
        meter.classList.add('hidden');
        meter.classList.toggle('bake', s === 'bake');
        sfxClock = 0;
        controlsFor(s);
        checkpoint();
      };
      /** Pick a quality tier (uses one unit). If one was already picked for this step, continue with it. */
      const tierButtons = (kind: IngKind, onPick: (t: Tier) => void, label = 'Pick', existing?: Tier) => {
        if (existing) { onPick(existing); return; }
        controls.innerHTML = `<div class="kit-title">${label} ${INGREDIENTS[kind].emoji} <b>${esc(INGREDIENTS[kind].names[0].split(' ').slice(-1)[0])}</b></div>
          <div class="tier-pick">${TIERS.map((tier) => {
            const n = have(p, kind, tier);
            return `<button class="tier-btn t${tier}" data-t="${tier}" ${n > 0 ? '' : 'disabled'}><span class="sw" style="background:${INGREDIENTS[kind].colors[tier - 1]}"></span>
              <b>${esc(INGREDIENTS[kind].names[tier - 1])}</b><small>${TIER_LABEL[tier]} · ${n} left</small></button>`;
          }).join('')}</div>`;
        controls.querySelectorAll<HTMLButtonElement>('[data-t]').forEach((b) => b.addEventListener('click', () => {
          const tier = Number(b.dataset.t) as Tier;
          if (!consume(p, kind, tier)) return;
          c.build.tiers[kind] = tier;
          audio.sfx('click');
          onPick(tier);
          checkpoint();
        }));
      };
      const nextBtn = (label: string, enabled: boolean, go: () => void) => {
        const b = document.createElement('button');
        b.className = 'pz-btn next';
        b.textContent = label;
        b.disabled = !enabled;
        b.addEventListener('click', go);
        controls.appendChild(b);
        return b;
      };

      const controlsFor = (s: Step) => {
        hint.textContent = '';
        switch (s) {
          case 'dough':
            tierButtons('dough', (tier) => {
              c.look.dough = { size: 0.2, tier };
              stretch = 0.2;
              hint.textContent = 'Hold the button and let go when the dough reaches the dotted ring';
              controls.innerHTML = `<div class="kit-title">Stretch the dough</div><button class="pz-btn big hold" data-hold>Hold to stretch</button>`;
              const hold = controls.querySelector('[data-hold]') as HTMLElement;
              const start = (e: Event) => { e.preventDefault(); stretching = true; hold.classList.add('active'); };
              const end = () => {
                if (!stretching) return;
                stretching = false;
                c.look.dough = { size: stretch, tier };
                c.build.scores.dough = doughScore(stretch);
                const sc = c.build.scores.dough;
                hint.textContent = sc > 0.85 ? 'Perfect size!' : stretch < 0.93 ? 'A little small.' : 'A bit too big!';
                audio.sfx(sc > 0.85 ? 'success' : 'plop');
                setTimeout(() => setStep('sauce'), 650);
              };
              hold.addEventListener('pointerdown', start);
              hold.addEventListener('pointerup', end);
              hold.addEventListener('pointerleave', end);
              const keyHold = (e: KeyboardEvent) => { if (e.code === 'Space' && !e.repeat && c.step === 'dough') { if (e.type === 'keydown') start(e); else end(); } };
              window.addEventListener('keydown', keyHold);
              window.addEventListener('keyup', keyHold);
              cleanups.push(() => { window.removeEventListener('keydown', keyHold); window.removeEventListener('keyup', keyHold); });
            }, 'Pick your dough', c.look.dough && !c.build.scores.dough ? c.look.dough.tier : undefined);
            break;
          case 'sauce':
          case 'cheese': {
            const kind: IngKind = s === 'sauce' ? c.recipe.sauce : 'mozzarella';
            tierButtons(kind, (tier) => {
              const prior = s === 'sauce' ? c.look.sauce?.cells : c.look.cheese?.cells;
              const cells = prior ?? new Uint8Array(GRID * GRID);
              if (s === 'sauce') c.look.sauce = { kind: c.recipe.sauce, tier, cells }; else c.look.cheese = { tier, cells };
              hint.textContent = s === 'sauce' ? 'Drag over the pizza to spread the sauce' : 'Drag over the pizza to sprinkle cheese';
              controls.innerHTML = `<div class="kit-title">${s === 'sauce' ? 'Spread the sauce' : 'Add the cheese'} · <b class="cov">0%</b></div>`;
              const next = nextBtn('Next →', false, () => {
                const cv = coverage(cells, c.look.dough?.size ?? 0.93);
                const score = Math.max(0, Math.min(1, cv.covered / 0.88) - cv.spill * 0.8);
                if (s === 'sauce') c.build.scores.sauce = score; else c.build.scores.cheese = score;
                painting = false;
                setStep(s === 'sauce' ? 'cheese' : 'toppings');
              });
              const upd = () => {
                const cv = coverage(cells, c.look.dough?.size ?? 0.93);
                (controls.querySelector('.cov') as HTMLElement).textContent = `${Math.round(cv.covered * 100)}%${cv.spill > 0.05 ? ' · on the crust!' : ''}`;
                next.disabled = cv.covered < 0.3;
              };
              painting = true;
              paintTarget = { cells, upd };
              upd();
            }, s === 'sauce' ? 'Pick your sauce' : 'Pick your cheese', s === 'sauce' ? c.look.sauce?.tier : c.look.cheese?.tier);
            break;
          }
          case 'toppings': {
            if (!c.recipe.toppings.length) { c.build.scores.toppings = 1; setStep('bake'); return; }
            const renderTops = () => {
              const need = c.recipe.toppings;
              controls.innerHTML = `<div class="kit-title">Tap the pizza to place toppings</div>
                <div class="tops">${need.map((n) => {
                  const kind = n.kind;
                  const chosen = c.build.tiers[kind];
                  const placed = c.build.placed[kind] ?? 0;
                  return `<div class="top-chip ${c.active === kind ? 'on' : ''}" data-kind="${kind}">
                    <span>${INGREDIENTS[kind].emoji} <b>${placed}/${n.count}</b></span>
                    ${chosen ? `<small>${TIER_LABEL[chosen]}</small>` : `<span class="mini-tiers">${TIERS.map((tier) => `<button data-kind="${kind}" data-t="${tier}" ${have(p, kind, tier) > 0 ? '' : 'disabled'} title="${esc(INGREDIENTS[kind].names[tier - 1])}">${TIER_LABEL[tier][0]}<i>${have(p, kind, tier)}</i></button>`).join('')}</span>`}
                  </div>`;
                }).join('')}</div>
                <div class="pz-row"><button class="pz-btn ghost small" data-undo>↶ Undo</button></div>`;
              controls.querySelectorAll<HTMLElement>('.top-chip').forEach((chip) => chip.addEventListener('click', () => {
                const kind = chip.dataset.kind as IngKind;
                if (c.build.tiers[kind]) { c.active = kind; renderTops(); }
              }));
              controls.querySelectorAll<HTMLButtonElement>('.mini-tiers button').forEach((b) => b.addEventListener('click', (e) => {
                e.stopPropagation();
                const kind = b.dataset.kind as IngKind, tier = Number(b.dataset.t) as Tier;
                if (!consume(p, kind, tier)) return;
                c.build.tiers[kind] = tier;
                c.active = kind;
                audio.sfx('click');
                renderTops();
              }));
              controls.querySelector('[data-undo]')!.addEventListener('click', () => {
                const last = c.look.pieces.pop();
                if (last) c.build.placed[last.kind] = Math.max(0, (c.build.placed[last.kind] ?? 1) - 1);
                renderTops();
              });
              const allStarted = need.every((n) => (c.build.placed[n.kind] ?? 0) > 0);
              nextBtn('Into the oven →', allStarted, () => {
                c.build.scores.toppings = toppingAccuracy(c.recipe, c.build.placed) * 0.85 + spread(c.look.pieces) * 0.15;
                setStep('bake');
              });
              hint.textContent = c.active ? `Placing ${INGREDIENTS[c.active].emoji} · pick a quality for each topping first` : 'Pick a quality for a topping to start placing it';
            };
            renderTopsRef = renderTops;
            if (!c.active) c.active = c.recipe.toppings.find((n) => c.build.tiers[n.kind])?.kind;
            renderTops();
            break;
          }
          case 'bake':
            helper.act('oven');
            helper.say('bake');
            hint.textContent = 'Take it out when the needle is in the golden zone';
            controls.innerHTML = `<div class="kit-title">Bake</div>`;
            baking = true;
            meterSet(0, 0.7);
            nextBtn('Take it out!', true, finishBake).classList.add('big');
            break;
          case 'slice':
            hint.textContent = 'Drag across the pizza to cut. Aim through the middle! (4 cuts)';
            controls.innerHTML = `<div class="kit-title">Slice · <b class="cuts">0/4</b></div>`;
            nextBtn('Done slicing →', true, () => { c.build.scores.slice = sliceScore(c.look.cuts, 1); setStep('box'); });
            break;
          case 'box':
            hint.textContent = '';
            tierButtons('box', () => serve(), 'Pick a box');
            break;
        }
      };
      let paintTarget: { cells: Uint8Array; upd: () => void } | null = null;
      let renderTopsRef: (() => void) | null = null;
      const cleanups: (() => void)[] = [];

      const finishBake = () => {
        if (!baking) return;
        baking = false;
        c.build.scores.bake = bakeScore(c.look.bake);
        const b = c.look.bake;
        hint.textContent = b >= 1 ? 'Oops, a bit burnt…' : b < 0.62 ? 'A little pale.' : b > 0.78 ? 'Extra crispy!' : 'Golden and bubbly!';
        audio.sfx('ding');
        helper.act('idle');
        setTimeout(() => setStep('slice'), 600);
      };

      // Pointer handling on the pizza.
      canvas.addEventListener('pointerdown', (e) => {
        const [x, y] = toPizza(e);
        canvas.setPointerCapture(e.pointerId);
        if ((c.step === 'sauce' || c.step === 'cheese') && painting && paintTarget) {
          if (paint(paintTarget.cells, x, y)) { paintTarget.upd(); squish(); }
        } else if (c.step === 'toppings' && c.active && c.build.tiers[c.active]) {
          if (Math.hypot(x, y) > (c.look.dough?.size ?? 0.9) * 0.86) { hint.textContent = 'Keep the toppings on the pizza ♡'; return; }
          c.look.pieces.push({ kind: c.active, tier: c.build.tiers[c.active]!, x, y, rot: Math.random() * Math.PI });
          c.build.placed[c.active] = (c.build.placed[c.active] ?? 0) + 1;
          audio.sfx('plop');
          renderTopsRef?.();
        } else if (c.step === 'slice' && c.look.cuts.length < 4) {
          cutStart = [x, y]; cutNow = [x, y];
        }
      });
      canvas.addEventListener('pointermove', (e) => {
        const [x, y] = toPizza(e);
        if (e.buttons && (c.step === 'sauce' || c.step === 'cheese') && paintTarget) { if (paint(paintTarget.cells, x, y)) { paintTarget.upd(); squish(); } }
        if (cutStart) cutNow = [x, y];
      });
      canvas.addEventListener('pointerup', () => {
        persist(p);
        if (cutStart && cutNow && Math.hypot(cutNow[0] - cutStart[0], cutNow[1] - cutStart[1]) > 1) {
          // Extend the cut across the whole pizza.
          const [ax, ay] = cutStart, [bx, by] = cutNow;
          const len = Math.hypot(bx - ax, by - ay);
          const ux = (bx - ax) / len, uy = (by - ay) / len;
          const mx = (ax + bx) / 2, my = (ay + by) / 2;
          c.look.cuts.push({ a: [mx - ux * 1.2, my - uy * 1.2], b: [mx + ux * 1.2, my + uy * 1.2] });
          audio.sfx('chop');
          const el2 = controls.querySelector('.cuts');
          if (el2) el2.textContent = `${c.look.cuts.length}/4`;
          if (c.look.cuts.length >= 4) { c.build.scores.slice = sliceScore(c.look.cuts, 1); setTimeout(() => setStep('box'), 400); }
        }
        cutStart = cutNow = null;
      });

      const serve = () => {
        helper.act('box');
        helper.say('box');
        const waited = 1 - c.w.left / c.w.patience;
        const v = judgePizza(c.build, c.w.recipeId, c.w.customer, waited, c.recipe);
        settle(p, v, c.w.customer.id, today());
        session.queue = session.queue.filter((x) => x !== c.w);
        session.cooking = null;
        persist(p);
        audio.sfx('register');
        result(c, v);
      };

      main.querySelector('[data-trash]')!.addEventListener('click', async () => {
        if (!(await ask('Start this pizza over? Ingredients already used are lost.', 'Start over'))) return;
        session.cooking = { ...c, step: 'dough', look: emptyLook(), active: undefined, build: { recipeId: c.recipe.id, tiers: {}, placed: {}, scores: { dough: 0, sauce: 0, cheese: 0, toppings: 0, bake: 0, slice: 0 } } };
        checkpoint();
        kitchen();
      });

      stopKitchen = () => { ro.disconnect(); cleanups.forEach((f) => f()); cancelAnimationFrame(raf); raf = requestAnimationFrame(idleLoop); };
      setStep(c.step === 'dough' && c.build.scores.dough ? 'sauce' : c.step);
    };

    /** In-shop yes/no (never a browser dialog). */
    const ask = (text: string, ok: string) => new Promise<boolean>((res) => {
      const m = document.createElement('div');
      m.className = 'pz-modal';
      m.innerHTML = `<div class="pz-card"><p>${esc(text)}</p><div class="pz-row"><button class="pz-btn ghost" data-n>Cancel</button><button class="pz-btn" data-y>${esc(ok)}</button></div></div>`;
      frame.appendChild(m);
      m.querySelector('[data-n]')!.addEventListener('click', () => { m.remove(); res(false); });
      m.querySelector('[data-y]')!.addEventListener('click', () => { m.remove(); res(true); });
    });

    /** How evenly toppings are spread over the four quarters (0..1). */
    const spread = (pieces: { x: number; y: number }[]) => {
      if (pieces.length < 4) return 0.5;
      const q = [0, 0, 0, 0];
      for (const pc of pieces) q[(pc.x >= 0 ? 1 : 0) + (pc.y >= 0 ? 2 : 0)]++;
      const avg = pieces.length / 4;
      return Math.max(0, 1 - q.reduce((s, n) => s + Math.abs(n - avg), 0) / (pieces.length * 1.5));
    };

    const result = (c: Cook, v: Verdict) => {
      const cust = c.w.customer;
      const mood = v.stars >= 4 ? 'happy' : v.stars === 3 ? 'neutral' : 'sad';
      const line = v.correct ? pick(v.stars >= 4 ? cust.lines.happy : v.stars === 3 ? cust.lines.ok : cust.lines.sad) : 'This isn’t what I ordered…';
      const before = shopLevel(p.xp - v.xp);
      const after = shopLevel(p.xp);
      gainXp(v.stars * 3 + c.recipe.rank * 2, 'pizza');
      setFlag('pizza-served');
      if (v.stars === 5) setFlag('pizza-five');
      afterChange();
      const modal = document.createElement('div');
      modal.className = 'pz-modal';
      modal.innerHTML = `<div class="pz-card result">
        ${customerFace(cust, mood, 84)}
        <h3>${esc(cust.name)}</h3><p class="say">“${esc(line)}”</p>
        ${stars(v.stars)}
        <div class="pay"><span>Pizza <b>🪙${v.pay}</b></span>${v.tip ? `<span>Tip <b>🪙${v.tip}</b></span>` : ''}<span>Shop XP <b>+${v.xp}</b></span></div>
        ${after > before ? `<p class="lvlup">Shop level ${after}! ${unlockText(after)}</p>` : ''}
        <button class="pz-btn" data-ok>Next customer →</button></div>`;
      frame.appendChild(modal);
      if (v.stars === 5) { helper.act('cheer'); helper.say('five', 'laughing'); setTimeout(() => audio.sfx('chime'), 450); }
      else if (v.stars >= 3) { helper.say('good', 'happy'); }
      else { helper.act('comfort'); helper.say('low', 'sad'); }
      if (after > before) { confetti(root); audio.sfx('levelup'); }
      burstHearts(modal.querySelector('.pz-stars'), v.stars * 2, '★');
      modal.querySelector('[data-ok]')!.addEventListener('click', () => { modal.remove(); counter(); });
      store.save();
    };

    const unlockText = (lvl: number) => {
      const r = RECIPES.filter((x) => x.shopLevel === lvl).map((x) => x.name);
      const tiers = ([2, 3] as Tier[]).filter((t) => ({ 2: 2, 3: 4 } as Record<number, number>)[t] === lvl).map((t) => `${TIER_LABEL[t]} ingredients`);
      const all = [...r, ...tiers, ...(lvl === CUSTOM_LEVEL ? ['your own pizza of the day (when you open)'] : [])];
      return all.length ? `New: ${all.join(', ')} ✨` : '';
    };

    // ---------------------------------------------------------------- time passes only while the shop is on screen
    let lastRender = 0;
    const tick = (dt: number) => {
      if (!p.open) return;
      session.spawnIn -= dt;
      if (session.spawnIn <= 0) {
        session.spawnIn = 12 + Math.random() * 14;
        if (session.queue.length < 3) { spawn(); if (!session.cooking) counter(); }
      }
      // Relaxed: nobody walks out. The bar only shows how long they've waited (it trims the tip a little).
      for (const w of session.queue) {
        const mine = session.cooking?.w === w;
        w.left = Math.max(0, w.left - dt * (mine ? 0.35 : 1));
        if (w.left <= 0 && !w.saidWait) {
          w.saidWait = true;
          if (!session.cooking) helper.say('wait');
        }
      }
      // Refresh the waiting bars a few times a second.
      if (!session.cooking && performance.now() - lastRender > 400) {
        lastRender = performance.now();
        session.queue.forEach((w) => {
          const bar = main.querySelector<HTMLElement>(`[data-uid="${w.uid}"] .patience i`);
          if (bar) bar.style.width = `${Math.max(0, (w.left / w.patience) * 100)}%`;
          main.querySelector(`[data-uid="${w.uid}"]`)?.classList.toggle('patient', w.left <= 0);
        });
      }
    };
    const idleLoop = (now: number) => {
      raf = requestAnimationFrame(idleLoop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      tick(dt);
    };

    const goMarket = async () => {
      root.classList.add('hidden-behind');
      stopKitchen?.();
      cancelAnimationFrame(raf);
      await openMarket();
      root.classList.remove('hidden-behind');
      last = performance.now();
      if (session.cooking) kitchen(); else { counter(); raf = requestAnimationFrame(idleLoop); }
    };

    const leave = () => {
      cancelAnimationFrame(raf);
      stopKitchen?.();
      cancelAnimationFrame(raf);
      persist(p);
      window.removeEventListener('keydown', onKey, true);
      if (p.open) helper.say('away');
      close();
      resolve();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && !root.classList.contains('hidden-behind')) {
        e.preventDefault(); e.stopImmediatePropagation();
        const modal = frame.querySelector('.pz-modal');
        if (modal) modal.remove(); else leave();
      }
    };
    window.addEventListener('keydown', onKey, true);
    root.querySelector('.pz-exit')!.addEventListener('click', leave);
    root.querySelector('[data-market]')!.addEventListener('click', () => void goMarket());
    probeCustomers(() => { if (!session.cooking) counter(); });

    if (p.open) helper.say(session.queue.length ? 'Welcome back! They’re waiting ♡' : 'open');
    else helper.say('closed');
    if (session.cooking) kitchen(); else { counter(); raf = requestAnimationFrame(idleLoop); }
  });
}

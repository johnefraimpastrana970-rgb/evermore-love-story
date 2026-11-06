import './home.css';
import { store } from '../core/store';
import { bus } from '../core/events';
import { audio } from '../audio/audio';
import { el, esc, uiRoot } from '../ui/dom';
import { burstHearts } from '../ui/fx';
import { iconURL } from '../art/icons';
import { toast, afterChange, bumpStat } from '../systems/game';
import { LOCATIONS } from '../content/locations';
import { COLORS, FLOORS, FURNITURE_SLOTS, ITEMS, MAX_ITEMS_PER_ROOM, VIBES, WALLS, isHouseRoom, itemDef, type FurnitureSlot, type HouseRoom } from './data';
import { applyVibe, buy, owns, place, setColor, setFloor, setWall, spare, store as storeItem } from './logic';
import { itemPreview } from './draw';
import type { WallStyle } from '../art/paint';

/*
 * Decorating: a sheet at the bottom of the screen, so the room stays visible and every change shows right away.
 * Placed items can be dragged around the room while the sheet is open; tap one to select it.
 */

type Tab = 'vibe' | 'wall' | 'floor' | 'furniture' | 'items';
const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const tok = (n: number) => `<img src="${iconURL('coin', 32)}" alt="">${n}`;

function wallSwatch(s: WallStyle): string {
  const b = css(s.base), a = css(s.accent);
  const pat = s.pattern === 'stripes' ? `repeating-linear-gradient(90deg, ${b} 0 10px, ${a}55 10px 14px)`
    : s.pattern === 'dots' ? `radial-gradient(circle, ${a} 2px, transparent 3px) 0 0/12px 12px, ${b}`
    : s.pattern === 'hearts' ? `radial-gradient(circle, ${a} 3px, transparent 4px) 0 0/16px 16px, ${b}`
    : s.pattern === 'tiles' ? `linear-gradient(${a}55 1px, transparent 1px) 0 0/14px 14px, linear-gradient(90deg, ${a}55 1px, transparent 1px) 0 0/14px 14px, ${b}`
    : s.pattern === 'panel' ? `repeating-linear-gradient(90deg, ${b} 0 18px, ${a} 18px 20px)` : b;
  return pat;
}

let openNow = false;
export const isDecorating = () => openNow;

export function openDecorate(): Promise<void> {
  const room = store.state.location;
  if (!isHouseRoom(room)) { toast('You can decorate inside the house ♡', 'heart'); return Promise.resolve(); }
  if (openNow) return Promise.resolve();
  openNow = true;
  return new Promise((resolve) => {
    const s = store.state;
    const h = s.home;
    let tab: Tab = 'vibe';
    let selected: string | null = null;
    const root = el('div', 'hm-layer');
    root.innerHTML = `<div class="hm-sheet"><header><h3>🎨 Decorating: ${esc(LOCATIONS[room].name)}</h3><span class="hm-tok"></span>
      <span class="hm-pan"><button data-pan="-1" aria-label="Look left">◀</button><button data-pan="1" aria-label="Look right">▶</button></span>
      <button class="pz-btn small" data-done>Done ✓</button></header>
      <nav class="hm-tabs"></nav><div class="hm-body"></div></div>`;
    uiRoot().appendChild(root);
    store.block();
    bus.emit('home:edit', true);
    requestAnimationFrame(() => root.classList.add('in'));
    const body = root.querySelector('.hm-body') as HTMLElement;

    const changed = (look = true) => { store.save(); bus.emit(look ? 'home:changed' : 'home:items'); render(); };
    const tryBuy = (id: string, price: number, then: () => void) => {
      if (owns(h, id) && !itemDef(id)) { then(); return; }
      if (!buy(h, s, id)) { audio.sfx('error'); toast(`You need ${price} heart tokens`, 'heart'); return; }
      audio.sfx('register');
      bumpStat('decor-bought');
      then();
    };

    const render = () => {
      (root.querySelector('.hm-tok') as HTMLElement).innerHTML = `<span class="pz-coins ps-tokens">${tok(s.tokens)}</span>`;
      const tabs: [Tab, string][] = [['vibe', '✨ Vibes'], ['wall', '🧱 Walls'], ['floor', '🪵 Floor'], ...(FURNITURE_SLOTS.some((f) => f.rooms.includes(room as HouseRoom)) ? [['furniture', '🛋️ Colors'] as [Tab, string]] : []), ['items', '🐈 Items']];
      (root.querySelector('.hm-tabs') as HTMLElement).innerHTML = tabs.map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('');
      root.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab as Tab; audio.sfx('click'); render(); }));
      const L = h.rooms[room as HouseRoom];
      if (tab === 'vibe') {
        body.innerHTML = `<div class="hm-row">${VIBES.map((v) => {
          const mine = owns(h, v.id);
          return `<button class="hm-card" data-vibe="${v.id}"><span class="hm-emoji">${v.emoji}</span><b>${esc(v.name)}</b><small>${mine ? 'Apply' : tok(v.price)}</small></button>`;
        }).join('')}</div><p class="hm-hint">A vibe changes the walls, floor and colors of this room in one tap.</p>`;
        body.querySelectorAll<HTMLElement>('[data-vibe]').forEach((b) => b.addEventListener('click', () => {
          const v = VIBES.find((x) => x.id === b.dataset.vibe)!;
          tryBuy(v.id, v.price, () => { applyVibe(h, room as HouseRoom, v.id); audio.sfx('chime'); burstHearts(b, 8, '✦'); bumpStat('decor-vibes'); changed(); });
        }));
      } else if (tab === 'wall' || tab === 'floor') {
        const list = tab === 'wall' ? WALLS : FLOORS;
        body.innerHTML = `<div class="hm-row">${list.map((x) => {
          const cur = tab === 'wall' ? L.wall === x.id : L.floor === x.id;
          const bg = tab === 'wall' ? wallSwatch((x as typeof WALLS[number]).style) : `linear-gradient(${css((x as typeof FLOORS[number]).color)}, ${css((x as typeof FLOORS[number]).color)}cc)`;
          return `<button class="hm-card ${cur ? 'cur' : ''}" data-id="${x.id}"><span class="hm-sw" style="background:${bg}"></span><b>${esc(x.name)}</b><small>${cur ? 'In use ♡' : owns(h, x.id) ? 'Use' : tok(x.price)}</small></button>`;
        }).join('')}</div>`;
        body.querySelectorAll<HTMLElement>('[data-id]').forEach((b) => b.addEventListener('click', () => {
          const id = b.dataset.id!;
          const price = list.find((x) => x.id === id)!.price;
          tryBuy(id, price, () => { (tab === 'wall' ? setWall : setFloor)(h, room as HouseRoom, id); audio.sfx('heart'); changed(); });
        }));
      } else if (tab === 'furniture') {
        const slots = FURNITURE_SLOTS.filter((f) => f.rooms.includes(room as HouseRoom));
        body.innerHTML = slots.map((f) => `<div class="hm-slot"><b>${esc(f.label)}</b><div class="hm-chips">${COLORS.map((c) => {
          const cur = L[f.slot] === c.id;
          return `<button class="hm-chip ${cur ? 'cur' : ''} ${owns(h, c.id) ? '' : 'buy'}" data-slot="${f.slot}" data-id="${c.id}" title="${esc(c.name)}${owns(h, c.id) ? '' : ` · ${c.price} tokens`}"
            style="background:${c.color < 0 ? 'linear-gradient(135deg,#fff 45%,#e6d6e0 45%)' : css(c.color)}">${cur ? '✓' : owns(h, c.id) ? '' : '🔒'}</button>`;
        }).join('')}</div></div>`).join('') + '<p class="hm-hint">Colors you buy can be used on any furniture, in any room.</p>';
        body.querySelectorAll<HTMLElement>('[data-slot]').forEach((b) => b.addEventListener('click', () => {
          const id = b.dataset.id!;
          tryBuy(id, COLORS.find((c) => c.id === id)!.price, () => { setColor(h, room as HouseRoom, b.dataset.slot as FurnitureSlot, id); audio.sfx('heart'); changed(); });
        }));
      } else {
        const here = h.items.filter((i) => i.room === room).length;
        const sel = selected ? h.items.find((i) => i.id === selected) : undefined;
        body.innerHTML = `${sel ? `<div class="hm-selected"><img src="${itemPreview(sel.item)}" alt=""><span><b>${esc(itemDef(sel.item)!.name)}</b><small>Drag it around the room</small></span>
            <button class="pz-btn small ghost" data-putaway>Put away</button></div>` : `<p class="hm-hint">Tap an item in the room to select it, or drag it to move it. ${here}/${MAX_ITEMS_PER_ROOM} placed here.</p>`}
          <div class="hm-row">${ITEMS.map((it) => {
            const n = spare(h, it.id);
            return `<div class="hm-card item"><img src="${itemPreview(it.id)}" alt=""><b>${esc(it.name)}</b>
              <small>${it.use === 'bed' ? 'Pets nap here' : it.use === 'perch' ? 'Cats climb it' : it.use === 'toy' ? 'Pets play here' : 'Decoration'}</small>
              <span class="hm-btns">${n > 0 ? `<button class="pz-btn small" data-place="${it.id}" ${here >= MAX_ITEMS_PER_ROOM ? 'disabled' : ''}>Place (${n})</button>` : ''}
              <button class="pz-btn small ${n > 0 ? 'ghost' : ''}" data-buy="${it.id}">${tok(it.price)}</button></span></div>`;
          }).join('')}</div>`;
        body.querySelector('[data-putaway]')?.addEventListener('click', () => { storeItem(h, selected!); selected = null; audio.sfx('close'); changed(false); });
        body.querySelectorAll<HTMLElement>('[data-buy]').forEach((b) => b.addEventListener('click', () => {
          const it = itemDef(b.dataset.buy!)!;
          tryBuy(it.id, it.price, () => { burstHearts(b, 5); render(); });
        }));
        body.querySelectorAll<HTMLElement>('[data-place]').forEach((b) => b.addEventListener('click', () => {
          const loc = LOCATIONS[room];
          // Placed at her feet; the world moves it to the middle of the view (she may have panned).
          const p = place(h, room as HouseRoom, b.dataset.place!, Math.max(80, Math.min(loc.width - 80, s.x)), loc.floorTop + 40);
          if (!p) { audio.sfx('error'); return; }
          audio.sfx('plop');
          bumpStat('decor-placed');
          store.save();
          bus.emit('home:items', { placed: p });
          selected = p.id;
          render();
        }));
      }
    };
    const offSel = bus.on('home:select', (id: string | null) => { selected = id; if (tab === 'items') render(); else if (id) { tab = 'items'; render(); } });
    root.querySelectorAll<HTMLElement>('[data-pan]').forEach((b) => b.addEventListener('click', () => bus.emit('home:pan', Number(b.dataset.pan))));
    const leave = () => {
      openNow = false;
      offSel();
      window.removeEventListener('keydown', onKey, true);
      root.classList.remove('in');
      setTimeout(() => root.remove(), 250);
      bus.emit('home:edit', false);
      store.unblock();
      store.save();
      afterChange();
      resolve();
    };
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); leave(); } };
    window.addEventListener('keydown', onKey, true);
    root.querySelector('[data-done]')!.addEventListener('click', leave);
    render();
  });
}

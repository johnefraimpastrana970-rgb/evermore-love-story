import type { PanelId } from '../content/types';
import { store } from '../core/store';
import { bus } from '../core/events';
import { audio } from '../audio/audio';
import { el, esc, isTouch, uiRoot } from './dom';
import { iconURL } from '../art/icons';
import { xpToNext, titleFor } from '../systems/progression';
import { questDef, objectiveTarget } from '../systems/quests';
import { topOccasion } from '../systems/game';
import { openPanel } from './panels';
import { HER_AVATAR, HIS_AVATAR } from '../content/characters';
import { openPhone, unreadCount } from '../phone/phone';
import { PHONE_GLYPH } from '../phone/icons';
import { setHoldingHands, toggleHands } from '../systems/hands';
import { partnerAway } from '../work/work';
import { openDecorate } from '../home/decorate';
import { isHouseRoom } from '../home/data';

let hud: HTMLElement;
let promptEl: HTMLElement;
let handsEl: HTMLElement;
let decorEl: HTMLElement;

const HEART_PATH = 'M50 88 C20 68 6 50 6 32 C6 18 17 8 30 8 C39 8 46 13 50 21 C54 13 61 8 70 8 C83 8 94 18 94 32 C94 50 80 68 50 88 Z';

const BUTTONS: [PanelId, string, string, string][] = [
  ['character', 'ribbon', 'Our Story', 'C'],
  ['inventory', 'gift', 'Satchel', 'I'],
  ['quests', 'scroll', 'Quests', 'Q'],
  ['journal', 'book', 'Journal', 'J'],
  ['map', 'map', 'Map', 'M'],
  ['settings', 'key', 'Settings', 'O'],
];

const TIME_LABEL = { morning: '🌅 Morning', day: '☀️ Day', sunset: '🌇 Sunset', night: '🌙 Night' };

export function initHud() {
  hud = el('div', 'hud hidden');
  hud.innerHTML = `
    <div class="hud-left">
      <button class="hud-level" title="Our Story">
        <svg viewBox="0 0 100 96" class="lvl-heart">
          <path d="${HEART_PATH}" class="bg"/>
          <path d="${HEART_PATH}" class="fg" pathLength="100"/>
        </svg>
        <span class="lvl-num"></span>
      </button>
      <img class="hud-ava hidden" alt="">
      <div class="hud-who">
        <b class="hud-name"></b>
        <small class="hud-title"></small>
        <div class="hud-meta"><span class="hud-tokens"><img src="${iconURL('coin', 32)}" alt=""><b></b></span><span class="hud-time"></span></div>
      </div>
    </div>
    <button class="hud-quest hidden"></button>
    <div class="hud-occ hidden"></div>
    <nav class="hud-btns"><button data-phone title="Phone (P)"><img src="${PHONE_GLYPH}" alt=""><span>Phone</span><i class="badge hidden"></i></button>${BUTTONS.map(([id, ic, label, key]) =>
      `<button data-panel="${id}" title="${label} (${key})"><img src="${iconURL(ic, 64)}" alt=""><span>${label}</span></button>`).join('')}</nav>`;
  uiRoot().appendChild(hud);
  promptEl = el('button', 'prompt hidden');
  uiRoot().appendChild(promptEl);
  promptEl.addEventListener('click', () => { store.joy.action = true; });

  // Hold hands (her choice): on until she lets go.
  handsEl = el('button', `hands-btn ${isTouch() ? 'touch' : ''}`, '<span>🤝</span><small>Hold hands</small>');
  handsEl.setAttribute('aria-pressed', 'false');
  hud.appendChild(handsEl);
  handsEl.addEventListener('click', () => { audio.unlock(); toggleHands(); });
  bus.on('hands', (on: boolean) => {
    handsEl.classList.toggle('on', on);
    handsEl.setAttribute('aria-pressed', String(on));
    handsEl.querySelector('small')!.textContent = on ? 'Let go' : 'Hold hands';
    audio.sfx(on ? 'heart' : 'click');
  });
  // Decorate (inside the house).
  decorEl = el('button', `hud-decor ${isTouch() ? 'touch' : ''}`, '<span>🎨</span><small>Decorate</small>');
  hud.appendChild(decorEl);
  decorEl.addEventListener('click', () => { audio.unlock(); if (!store.blocked) void openDecorate(); });
  bus.on('settings', render);
  bus.on('work:leave', render);
  bus.on('work:home', render);

  hud.querySelectorAll<HTMLElement>('[data-panel]').forEach((b) =>
    b.addEventListener('click', () => { audio.unlock(); void openPanel(b.dataset.panel as PanelId); }));
  hud.querySelector('.hud-level')!.addEventListener('click', () => void openPanel('character'));
  hud.querySelector('.hud-quest')!.addEventListener('click', () => void openPanel('quests'));
  hud.querySelector('[data-phone]')!.addEventListener('click', () => { audio.unlock(); openPhone(); });
  bus.on('phone', render);
  bus.on('state', render);
  bus.on('time', render);
  bus.on('occasions', render);
  setInterval(() => { if (store.hasGame) render(); }, 30000);

  window.addEventListener('keydown', (e) => {
    if (!store.hasGame || store.blocked || hud.classList.contains('hidden')) return;
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    const map: Record<string, PanelId> = { KeyC: 'character', KeyI: 'inventory', KeyQ: 'quests', KeyJ: 'journal', KeyM: 'map', KeyO: 'settings', Escape: 'settings', Tab: 'inventory' };
    const p = map[e.code];
    if (p) { e.preventDefault(); void openPanel(p); }
    if (e.code === 'KeyH' && !handsEl.classList.contains('hidden')) { e.preventDefault(); toggleHands(); }
  });
}

export function showHud(on: boolean) {
  hud.classList.toggle('hidden', !on);
  if (!on) setPrompt(null);
  if (on) render();
}

export function setPrompt(label: string | null) {
  // The on-screen ♥ button pulses while something is in reach.
  document.querySelector('.joy-act')?.classList.toggle('near', !!label);
  if (!label) { promptEl.classList.add('hidden'); return; }
  promptEl.innerHTML = isTouch() ? `<span class="key">Tap</span>${esc(label)}` : `<span class="key">E</span>${esc(label)}`;
  promptEl.classList.remove('hidden');
}

/** Update a number and give it a little bounce when it changes. */
function bumpIfChanged(el: HTMLElement, value: string) {
  if (el.textContent === value) return;
  const had = el.textContent !== '';
  el.textContent = value;
  if (!had) return;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function render() {
  if (!store.hasGame) return;
  const s = store.state;
  const need = xpToNext(s.level);
  const pct = Math.max(0, Math.min(100, (s.xp / need) * 100));
  (hud.querySelector('.lvl-heart .fg') as SVGPathElement).style.strokeDasharray = `${pct} 100`;
  hud.querySelector('.hud-name')!.textContent = store.playerName();
  const ava = hud.querySelector('.hud-ava') as HTMLImageElement;
  const avaSrc = store.playAs() === 'him' ? HIS_AVATAR : HER_AVATAR;
  if (avaSrc && ava.getAttribute('src') !== avaSrc) ava.src = avaSrc;
  ava.classList.toggle('hidden', !avaSrc);
  hud.querySelector('.hud-title')!.textContent = titleFor(s.level);
  const tok = hud.querySelector('.hud-tokens b') as HTMLElement;
  const lvl = hud.querySelector('.lvl-num') as HTMLElement;
  bumpIfChanged(tok, String(s.tokens));
  bumpIfChanged(lvl, String(s.level));
  hud.querySelector('.hud-time')!.textContent = TIME_LABEL[store.timeOfDay()];
  decorEl.classList.toggle('hidden', !isHouseRoom(s.location));
  const follows = store.settings.companionMode === 'follow' && !partnerAway();
  handsEl.classList.toggle('hidden', !follows);
  if (!follows) setHoldingHands(false);
  const badge = hud.querySelector('[data-phone] .badge') as HTMLElement;
  const unread = unreadCount();
  badge.textContent = String(unread);
  badge.classList.toggle('hidden', !unread);

  const q = hud.querySelector('.hud-quest') as HTMLElement;
  const tid = s.quests.tracked;
  const def = tid ? questDef(s, tid) : undefined;
  const prog = tid ? s.quests.active[tid] : undefined;
  if (def && prog && store.settings.showHints) {
    const i = def.objectives.findIndex((o, k) => (prog.progress[k] ?? 0) < objectiveTarget(o));
    const o = def.objectives[Math.max(0, i)];
    const t = objectiveTarget(o);
    q.innerHTML = `<img src="${iconURL('scroll', 48)}" alt=""><div><b>${esc(def.title)}</b><span>${esc(store.fmt(o.label))}${t > 1 ? ` · ${Math.min(t, prog.progress[Math.max(0, i)] ?? 0)}/${t}` : ''}</span></div>`;
    q.classList.remove('hidden');
  } else q.classList.add('hidden');

  const occ = topOccasion();
  const oc = hud.querySelector('.hud-occ') as HTMLElement;
  if (occ?.theme.banner) {
    oc.innerHTML = `<span>✦ ${esc(occ.literal ? store.fmtLiteral(occ.theme.banner) : store.fmt(occ.theme.banner))} ✦</span>`;
    oc.classList.remove('hidden');
  } else oc.classList.add('hidden');
}

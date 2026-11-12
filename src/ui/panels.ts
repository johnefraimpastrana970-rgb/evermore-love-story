import type { Condition, PanelId, PersonalEntry, PersonalKind, CosmeticDef, Mood, LocationId } from '../content/types';
import { HER_PORTRAITS, HIS_PORTRAITS } from '../content/characters';
import { hasArt } from '../art/characters';
import { burstHearts, freshen } from './fx';

/** Gentle "no" wiggle for buttons that can't be used yet. */
function shake(el: HTMLElement) {
  el.classList.remove('nope');
  void el.offsetWidth;
  el.classList.add('nope');
}
import { store } from '../core/store';
import { bus } from '../core/events';
import { audio } from '../audio/audio';
import { el, esc, richText, uiRoot } from './dom';
import { iconImg, iconURL } from '../art/icons';
import { portraitURL } from '../art/characters';
import { lookFor } from '../art/textures';
import { ITEMS } from '../content/items';
import { PERSONAL } from '../content/personal';
import { ACHIEVEMENTS, SECRET_COUNT } from '../content/achievements';
import { openPizzaShop, pizzaUnlocked } from '../pizza/shop';
import { openMarket } from '../pizza/market';
import { openGarden } from '../garden/garden';
import { gardenUnlocked } from '../garden/unlock';
import { stage } from '../garden/logic';
import { openPetShop, petShopOpen } from '../pets/shop';
import { SHOP_LEVEL as PET_SHOP_LEVEL } from '../pets/logic';
import { townMapSvg } from './townmap';
import { UNLOCK_LEVEL } from '../pizza/logic';
import { COSMETICS } from '../content/cosmetics';
import { LOCATIONS, LOCATION_ORDER } from '../content/locations';
import { OCCASIONS } from '../content/occasions';
import { xpToNext, titleFor, affectionHearts } from '../systems/progression';
import { questDef, objectiveTarget } from '../systems/quests';
import {
  KIND_LABEL, giveGift, markRead, completeChallenge, cosmeticAvailable, buyCosmetic, equipCosmetic,
  currentOccasions, toast, afterChange,
} from '../systems/game';
import { SLOTS, slotInfo, exportSave, importSave, SlotId } from '../core/save';

let layer: HTMLElement;
let current: { id: PanelId; tab?: string; resolve: () => void; render: () => void } | null = null;

export function initPanels() {
  layer = el('div', 'modal-layer hidden');
  uiRoot().appendChild(layer);
  bus.on('state', () => current?.render());
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && current && !document.querySelector('.reader')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      closePanel();
    }
  });
}

export function panelOpen() {
  return current !== null;
}

const TITLES: Record<PanelId, string> = {
  character: 'Our Story', inventory: 'Satchel', quests: 'Quest Diary', journal: 'Journal', map: 'Evermore Map', settings: 'Settings',
};
const ICONS: Record<PanelId, string> = {
  character: 'ribbon', inventory: 'gift', quests: 'scroll', journal: 'book', map: 'map', settings: 'key',
};

export function openPanel(id: PanelId, tab?: string): Promise<void> {
  if (current) closePanel();
  return new Promise((resolve) => {
    store.block();
    audio.sfx('open');
    layer.classList.remove('hidden');
    layer.innerHTML = '';
    const sheet = el('div', `sheet sheet-${id}`);
    sheet.innerHTML = `
      <div class="tape tape-l"></div><div class="tape tape-r"></div>
      <header class="sheet-head">
        <img class="sheet-ico" src="${iconURL(ICONS[id], 64)}" alt="">
        <h2>${TITLES[id]}</h2>
        <nav class="sheet-nav">${(['character', 'inventory', 'quests', 'journal', 'map'] as PanelId[])
          .map((p) => `<button class="nav-btn ${p === id ? 'on' : ''}" data-nav="${p}" title="${TITLES[p]}"><img src="${iconURL(ICONS[p], 48)}" alt=""></button>`).join('')}</nav>
        <button class="sheet-close" aria-label="Close">✕</button>
      </header>
      <div class="sheet-body"></div>`;
    layer.appendChild(sheet);
    const body = sheet.querySelector('.sheet-body') as HTMLElement;
    const state = { id, tab, resolve, render: () => {} };
    state.render = () => {
      const scroll = body.querySelector('.scroll')?.scrollTop ?? 0;
      body.innerHTML = '';
      RENDER[id](body, state);
      const sc = body.querySelector('.scroll');
      if (sc) sc.scrollTop = scroll;
    };
    current = state;
    state.render();
    freshen(body);
    sheet.querySelector('.sheet-close')!.addEventListener('click', () => closePanel());
    sheet.querySelectorAll<HTMLElement>('[data-nav]').forEach((b) =>
      b.addEventListener('click', () => {
        const target = b.dataset.nav as PanelId;
        const res = state.resolve;
        closePanel(false);
        void openPanel(target).then(res);
      }),
    );
    layer.onclick = (e) => { if (e.target === layer) closePanel(); };
    requestAnimationFrame(() => layer.classList.add('in'));
  });
}

export function closePanel(resolve = true) {
  if (!current) return;
  const c = current;
  current = null;
  audio.sfx('close');
  layer.classList.remove('in');
  layer.classList.add('hidden');
  layer.innerHTML = '';
  store.unblock();
  store.save();
  if (resolve) c.resolve();
}

type PanelState = { id: PanelId; tab?: string; render: () => void };
const RENDER: Record<PanelId, (body: HTMLElement, st: PanelState) => void> = {
  character: renderCharacter,
  inventory: renderInventory,
  quests: renderQuests,
  journal: renderJournal,
  map: renderMap,
  settings: renderSettings,
};

function tabs(host: HTMLElement, st: PanelState, list: [string, string, number?][], def: string): string {
  const cur = st.tab && list.some(([k]) => k === st.tab) ? st.tab : def;
  const bar = el('div', 'tabs');
  for (const [k, label, badge] of list) {
    const b = el('button', `tab ${k === cur ? 'on' : ''}`, `${esc(label)}${badge ? `<i class="badge">${badge}</i>` : ''}`);
    b.addEventListener('click', () => {
      if (st.tab === k) return;
      st.tab = k;
      audio.sfx('click');
      st.render();
      const body = document.querySelector('.sheet-body') as HTMLElement | null;
      if (body) freshen(body);
    });
    bar.appendChild(b);
  }
  host.appendChild(bar);
  return cur;
}

function fmtTime(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

// ------------------------------------------------------------------ character
/** Who the story panel shows; starts on whoever is being played. */
let panelWho: 'her' | 'him' | null = null;
const panelMood: Record<'her' | 'him', Mood> = { her: 'happy', him: 'happy' };
function renderCharacter(body: HTMLElement, st: PanelState) {
  const s = store.state;
  const need = xpToNext(s.level);
  const hearts = affectionHearts(s.affection);
  const secrets = Object.keys(s.secrets).length;
  const left = el('div', 'char-left');
  const moods: Mood[] = ['natural', 'happy', 'cute', 'laughing', 'idle', 'pouty', 'irritated', 'sad', 'crying'];
  const who = panelWho ?? store.playAs();
  const other: 'her' | 'him' = who === 'her' ? 'him' : 'her';
  const table = who === 'her' ? HER_PORTRAITS : HIS_PORTRAITS;
  const artMoods = moods.filter((m) => hasArt(who, m));
  const otherArt = hasArt(other, 'happy');
  const frame = (w: 'her' | 'him', mood: Mood, cls: string) =>
    `<div class="pt-frame ${cls}"><img class="pt-her-art" src="${portraitURL(lookFor(w), mood)}" alt=""></div>`;
  left.innerHTML = `
    <div class="char-portraits ${artMoods.length ? 'with-art' : ''} who-${who}">
      ${artMoods.length ? frame(who, panelMood[who], 'main') : `<img class="pt-her" src="${portraitURL(lookFor(who), 'happy')}" alt="">`}
      ${otherArt ? frame(other, 'happy', 'side') : `<img class="pt-him" src="${portraitURL(lookFor(other), 'love')}" alt="">`}
    </div>
    <div class="who-switch">
      ${[store.playAs(), store.partner()].map((w) => `<button class="${who === w ? 'on' : ''}" data-who="${w}">${esc(store.nameOf(w))} ♡</button>`).join('')}
    </div>
    ${artMoods.length ? `<div class="mood-strip">${artMoods.map((m) =>
      `<button class="mood-btn ${m === panelMood[who] ? 'on' : ''}" data-mood="${m}" title="${m}"><img src="${table[m]?.replace('.webp', '-avatar.webp')}" alt="${m}"></button>`).join('')}</div>` : ''}
    <div class="char-name">${esc(store.playerName())} <span>&amp;</span> ${esc(store.partnerName())}</div>
    <div class="char-title">“${esc(titleFor(s.level))}”</div>
    <div class="lvl-row"><b>Level ${s.level}</b><div class="bar"><i style="width:${(s.xp / need) * 100}%"></i></div><small>${s.xp} / ${need} XP</small></div>
    <div class="aff-row" title="Affection ${s.affection}">${'<span class="h on">♥</span>'.repeat(Math.min(10, hearts))}${hearts > 10 ? `<small>+${hearts - 10}</small>` : ''}${'<span class="h">♥</span>'.repeat(Math.max(0, 5 - hearts))}<small>${s.affection % 20}/20 to next heart</small></div>
    <dl class="stats">
      <div><dt>Days together here</dt><dd>${s.daily.days}</dd></div>
      <div><dt>Current streak</dt><dd>${s.daily.streak} 🔥</dd></div>
      <div><dt>Charms collected</dt><dd>${s.stats['collected'] ?? 0}</dd></div>
      <div><dt>Secrets found</dt><dd>${secrets} / ${SECRET_COUNT}</dd></div>
      <div><dt>Achievements</dt><dd>${Object.keys(s.achievements).length} / ${ACHIEVEMENTS.length}</dd></div>
      <div><dt>Hugs shared</dt><dd>${s.stats['hugs'] ?? 0}</dd></div>
      <div><dt>Time in Evermore</dt><dd>${fmtTime(s.playSeconds)}</dd></div>
      <div><dt>Heart tokens</dt><dd>${iconImg('coin', 32, 'ico-sm')} ${s.tokens}</dd></div>
    </dl>`;
  left.querySelectorAll<HTMLElement>('.mood-btn').forEach((b) => b.addEventListener('click', () => {
    panelMood[who] = b.dataset.mood as Mood;
    audio.sfx('click');
    st.render();
  }));
  left.querySelectorAll<HTMLElement>('[data-who]').forEach((b) => b.addEventListener('click', () => {
    if (who === b.dataset.who) return;
    panelWho = b.dataset.who as 'her' | 'him';
    audio.sfx('click');
    st.render();
  }));
  const right = el('div', 'char-right');
  const slot = tabs(right, st, [['herHair', 'Her hair'], ['herOutfit', 'Her outfit'], ['herAccent', 'Ribbon'], ['hisHair', 'His hair'], ['hisOutfit', 'His outfit']], store.playAs() === 'him' ? 'hisOutfit' : 'herOutfit');
  const grid = el('div', 'swatches scroll');
  for (const c of COSMETICS.filter((x) => x.slot === slot)) grid.appendChild(swatch(c));
  right.appendChild(grid);
  right.appendChild(el('p', 'hint', 'New looks unlock as you level up — some can be bought with heart tokens.'));
  const wrap = el('div', 'char-wrap');
  wrap.append(left, right);
  body.appendChild(wrap);
}

function swatch(c: CosmeticDef): HTMLElement {
  const s = store.state;
  const status = cosmeticAvailable(c);
  const equipped = s.cosmetics.equipped[c.slot] === c.id;
  const color = '#' + c.color.toString(16).padStart(6, '0');
  const b = el('button', `swatch ${status} ${equipped ? 'eq' : ''}`);
  b.innerHTML = `<span class="chip" style="background:${color}"></span><span class="nm">${esc(c.name)}</span>
    <span class="st">${equipped ? 'Wearing' : status === 'owned' ? 'Wear' : status === 'buy' ? `${iconImg('coin', 24, 'ico-xs')} ${c.cost}` : c.garden ? '🌱 Garden' : `Lv ${c.unlockLevel}`}</span>`;
  b.addEventListener('click', () => {
    if (status === 'owned') {
      if (!equipped) burstHearts(b, 6, '✦');
      equipCosmetic(c.id); audio.sfx('success');
    } else if (status === 'buy') {
      if (s.tokens >= (c.cost ?? 0)) burstHearts(b, 10);
      if (buyCosmetic(c.id)) { equipCosmetic(c.id); audio.sfx('success'); toast(`Bought ${c.name}!`, 'ribbon', 'good'); }
      else { audio.sfx('error'); shake(b); toast('Not enough heart tokens yet', 'coin'); }
    } else { audio.sfx('error'); shake(b); }
  });
  return b;
}

// ------------------------------------------------------------------ inventory
let selectedItem: string | null = null;
function renderInventory(body: HTMLElement) {
  const s = store.state;
  const ids = Object.keys(s.inventory).filter((k) => s.inventory[k] > 0 && ITEMS[k]);
  const wrap = el('div', 'inv-wrap');
  const grid = el('div', 'inv-grid scroll');
  if (!ids.length) grid.innerHTML = '<p class="empty">Your satchel is empty. Collect floating charms around the house and school!</p>';
  if (selectedItem && !ids.includes(selectedItem)) selectedItem = null;
  selectedItem ??= ids[0] ?? null;
  for (const id of ids) {
    const it = ITEMS[id];
    const b = el('button', `inv-slot ${id === selectedItem ? 'on' : ''}`, `${iconImg(it.icon, 64)}<b>${s.inventory[id]}</b>`);
    b.title = it.name;
    b.addEventListener('click', () => { selectedItem = id; audio.sfx('click'); current?.render(); });
    grid.appendChild(b);
  }
  const det = el('div', 'inv-detail');
  if (selectedItem) {
    const it = ITEMS[selectedItem];
    det.innerHTML = `${iconImg(it.icon, 96, 'ico-lg')}<h3>${esc(it.name)}</h3><p>${esc(store.fmt(it.description))}</p>
      <p class="owned">You have <b>${s.inventory[selectedItem]}</b></p>`;
    if (it.giftable) {
      const g = el('button', 'btn btn-rose', `Give to ${esc(store.partnerName())} ♥`);
      g.addEventListener('click', () => {
        burstHearts(g, 10);
        if (giveGift(selectedItem!)) {
          audio.sfx('heart');
          toast(`${store.partnerName()} loved the ${it.name}!`, 'heart', 'good');
        }
      });
      det.appendChild(g);
    }
  } else det.innerHTML = '<p class="empty">Select an item.</p>';
  wrap.append(grid, det);
  body.appendChild(wrap);
}

export function openGiftPicker(): Promise<void> {
  selectedItem = Object.keys(store.state.inventory).find((k) => ITEMS[k]?.giftable && store.state.inventory[k] > 0) ?? null;
  if (!selectedItem) {
    toast('Nothing to give yet — collect charms, pick flowers or bake cookies first.', 'gift');
    return Promise.resolve();
  }
  return openPanel('inventory');
}

// ------------------------------------------------------------------ quests
function renderQuests(body: HTMLElement) {
  const s = store.state;
  const groups: [string, string[]][] = [['Story', []], ['Special Day', []], ['Daily', []], ['Weekly', []]];
  for (const id of Object.keys(s.quests.active)) {
    const q = questDef(s, id);
    if (!q) continue;
    const g = q.kind === 'story' ? 0 : q.kind === 'occasion' ? 1 : q.kind === 'daily' ? 2 : 3;
    groups[g][1].push(id);
  }
  const sc = el('div', 'quest-list scroll');
  const now = store.now();
  const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
  const left = Math.round((midnight.getTime() - now.getTime()) / 60000);
  for (const [name, ids] of groups) {
    if (!ids.length && name !== 'Daily') continue;
    sc.appendChild(el('h3', 'q-group', `${name}${name === 'Daily' ? ` <small>new quests in ${Math.floor(left / 60)}h ${left % 60}m</small>` : ''}`));
    if (!ids.length) sc.appendChild(el('p', 'empty', 'All done for today. You’re amazing.'));
    for (const id of ids) sc.appendChild(questCard(id));
  }
  const doneStory = Object.keys(s.quests.completed).filter((id) => questDef(s, id)?.kind === 'story');
  if (doneStory.length) {
    sc.appendChild(el('h3', 'q-group', 'Finished chapters'));
    sc.appendChild(el('p', 'done-list', doneStory.map((id) => `✓ ${esc(questDef(s, id)!.title)}`).join('<br>')));
  }
  body.appendChild(sc);
}

function questCard(id: string): HTMLElement {
  const s = store.state;
  const q = questDef(s, id)!;
  const p = s.quests.active[id];
  const tracked = s.quests.tracked === id;
  const card = el('div', `q-card ${tracked ? 'tracked' : ''} q-${q.kind}`);
  const objs = q.objectives.map((o, i) => {
    const t = objectiveTarget(o);
    const v = Math.min(t, p.progress[i] ?? 0);
    return `<li class="${v >= t ? 'done' : ''}"><span class="ck">${v >= t ? '✓' : ''}</span>${esc(store.fmt(o.label))}${t > 1 ? ` <small>${v}/${t}</small>` : ''}</li>`;
  }).join('');
  const rewards = q.rewards.map((r) =>
    r.type === 'xp' ? `<span class="rw">${r.amount} XP</span>` :
    r.type === 'tokens' ? `<span class="rw">${iconImg('coin', 24, 'ico-xs')}${r.amount}</span>` :
    r.type === 'item' ? `<span class="rw">${iconImg(ITEMS[r.id]?.icon ?? 'gift', 24, 'ico-xs')}${esc(ITEMS[r.id]?.name ?? r.id)}</span>` : '').join('');
  card.innerHTML = `<div class="q-top"><h4>${esc(q.title)}</h4><button class="pin" title="Track on screen">${tracked ? '📌' : '📍'}</button></div>
    <p>${esc(store.fmt(q.description))}</p><ul>${objs}</ul><div class="rws">${rewards}</div>`;
  card.querySelector('.pin')!.addEventListener('click', () => { s.quests.tracked = id; audio.sfx('click'); bus.emit('state'); });
  return card;
}

// ------------------------------------------------------------------ journal
const JOURNAL_TABS: [PersonalKind | 'ach' | 'secret', string][] = [
  ['letter', 'Letters'], ['message', 'Messages'], ['memory', 'Memories'], ['photo', 'Photos'], ['joke', 'Jokes'],
  ['date', 'Dates'], ['challenge', 'Challenges'], ['surprise', 'Surprises'], ['ach', 'Achievements'], ['secret', 'Secrets'],
];

export function describeCondition(c?: Condition): string {
  if (!c) return '';
  const parts: string[] = [];
  if (c.minLevel) parts.push(`Reach level ${c.minLevel}`);
  if (c.secret) parts.push('Find a hidden secret');
  if (c.occasion) parts.push('Appears on a special day');
  if (c.time) parts.push(`Visit at ${c.time.join(' / ')}`);
  if (c.questDone) parts.push('Finish a quest');
  if (c.minAffection) parts.push(`Reach ${c.minAffection} affection`);
  if (c.location) parts.push(`Visit the ${LOCATIONS[c.location].name.toLowerCase()}`);
  if (c.flag) parts.push('Keep playing…');
  return parts.join(' · ') || 'Keep playing…';
}

function renderJournal(body: HTMLElement, st: PanelState) {
  const s = store.state;
  const unread = (k: string) => PERSONAL.filter((p) => p.kind === k && s.unlocked[p.id] && !s.read[p.id]).length;
  const tab = tabs(body, st, JOURNAL_TABS.map(([k, l]) => [k, l, k === 'ach' || k === 'secret' ? 0 : unread(k)] as [string, string, number]), 'letter');
  const sc = el('div', `journal scroll j-${tab}`);
  if (tab === 'ach') {
    for (const a of ACHIEVEMENTS) {
      const got = !!s.achievements[a.id];
      if (a.hidden && !got) { sc.appendChild(el('div', 'ach locked', `${iconImg('key', 48)}<div><b>???</b><p>A hidden achievement.</p></div>`)); continue; }
      sc.appendChild(el('div', `ach ${got ? 'got' : 'locked'}`, `${iconImg(a.icon, 48)}<div><b>${esc(a.name)}</b><p>${esc(store.fmt(a.description))}</p></div>${got ? '<span class="ok">✓</span>' : ''}`));
    }
  } else if (tab === 'secret') {
    const total = SECRET_COUNT;
    const found = Object.keys(s.secrets);
    sc.appendChild(el('p', 'hint', `Found ${found.length} of ${total}. Secrets reveal a twinkle when you walk close to them.`));
    for (const loc of LOCATION_ORDER) {
      for (const h of LOCATIONS[loc].hotspots.filter((x) => x.action.kind === 'secret')) {
        const got = !!s.secrets[h.id];
        sc.appendChild(el('div', `ach ${got ? 'got' : 'locked'}`, `${iconImg('key', 48)}<div><b>${got ? esc(h.label.replace('…', '')) : '???'}</b><p>${LOCATIONS[loc].name}</p></div>${got ? '<span class="ok">✓</span>' : ''}`));
      }
    }
  } else {
    const entries = PERSONAL.filter((p) => p.kind === tab);
    if (!entries.length) sc.appendChild(el('p', 'empty', 'Nothing here yet.'));
    for (const e of entries) sc.appendChild(entryCard(e));
  }
  body.appendChild(sc);
}

function entryCard(e: PersonalEntry): HTMLElement {
  const s = store.state;
  const open = !!s.unlocked[e.id];
  const card = el('button', `entry ${open ? '' : 'locked'} ${e.placeholder ? 'is-tpl' : ''} ${s.read[e.id] ? 'read' : ''} k-${e.kind}`);
  if (!open) {
    card.innerHTML = `<div class="lock">🔒</div><div><b>Locked</b><p>${esc(describeCondition(e.unlock))}</p></div>`;
    card.disabled = true;
    return card;
  }
  const done = e.kind === 'challenge' && s.challengesDone[e.id];
  card.innerHTML = `${e.kind === 'photo' ? photoThumb(e) : iconImg(kindIcon(e.kind), 48)}
    <div><b>${richText(store.fmtLiteral(e.title))}</b>${e.date ? `<small>${richText(e.date)}</small>` : ''}
    ${!s.read[e.id] ? '<i class="new">new</i>' : ''}${done ? '<i class="done">done ✓</i>' : ''}</div>
    ${e.placeholder ? '<span class="tpl-ribbon">template</span>' : ''}`;
  card.addEventListener('click', () => void openReader(e));
  return card;
}

function kindIcon(k: PersonalKind) {
  return ({ letter: 'letter', message: 'note', memory: 'polaroid', photo: 'polaroid', joke: 'cookie', date: 'calendar', challenge: 'star', surprise: 'gift' } as const)[k];
}

function photoThumb(e: PersonalEntry) {
  if (e.image) return `<img class="thumb" src="${esc(e.image)}" alt="">`;
  return iconImg('polaroid', 48);
}

export function resolveImage(src?: string): Promise<string | null> {
  return Promise.resolve(src || null);
}

export function openReader(e: PersonalEntry): Promise<void> {
  return new Promise((resolve) => {
    markRead(e.id);
    audio.sfx('open');
    audio.duck(true);
    const r = el('div', 'reader');
    const isChallenge = e.kind === 'challenge';
    const done = !!store.state.challengesDone[e.id];
    r.innerHTML = `<div class="paper k-${e.kind}">
      <button class="sheet-close" aria-label="Close">✕</button>
      <div class="paper-kind">${KIND_LABEL[e.kind]}</div>
      <h2>${richText(store.fmtLiteral(e.title))}</h2>
      ${e.date ? `<div class="paper-date">${richText(e.date)}</div>` : ''}
      <div class="paper-img"></div>
      <div class="paper-body">${richText(store.fmtLiteral(e.body ?? ''))}</div>
      ${e.placeholder ? '<p class="tpl-note">This is a template. Fill it in <code>src/content/personal.ts</code> (see CONTENT_GUIDE.md).</p>' : ''}
      ${isChallenge ? `<button class="btn btn-rose ch-done" ${done ? 'disabled' : ''}>${done ? 'Completed ✓' : `We did it! (+${e.rewardXp ?? 100} XP)`}</button>` : ''}
      <div class="paper-sign">♥</div>
    </div>`;
    uiRoot().appendChild(r);
    requestAnimationFrame(() => r.classList.add('in'));
    void resolveImage(e.image).then((url) => {
      if (url) (r.querySelector('.paper-img') as HTMLElement).innerHTML = `<img src="${esc(url)}" alt="">`;
    });
    const close = () => {
      window.removeEventListener('keydown', onKey, true);
      audio.duck(false);
      audio.sfx('close');
      r.remove();
      afterChange();
      resolve();
    };
    const onKey = (ev: KeyboardEvent) => { if (ev.code === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); } };
    window.addEventListener('keydown', onKey, true);
    r.querySelector('.sheet-close')!.addEventListener('click', close);
    r.addEventListener('click', (ev) => { if (ev.target === r) close(); });
    r.querySelector('.ch-done')?.addEventListener('click', (ev) => {
      burstHearts(ev.currentTarget as HTMLElement, 14);
      completeChallenge(e);
      setTimeout(close, 450);
    });
  });
}

// ------------------------------------------------------------------ map
function renderMap(body: HTMLElement) {
  const s = store.state;
  const map = el('div', 'world-map');
  map.innerHTML = `<div class="tm-wrap">${townMapSvg({
    time: store.timeOfDay(), here: s.location, garden: gardenUnlocked(),
    gardenReady: s.garden.plots.filter((p) => p.plantId && stage(p, Date.now()) === 3).length,
    pizzaOpen: pizzaUnlocked(), pizzaLevel: UNLOCK_LEVEL, petOpen: petShopOpen(), petLevel: PET_SHOP_LEVEL, shopOpenNow: s.pizza.open,
  })}</div>`;
  const wrap = map.querySelector('.tm-wrap') as HTMLElement;
  const go = (to: LocationId) => { if (s.location === to) return; closePanel(); bus.emit('travel', { to }); };
  const locked = (spot: Element, what: string, lvl: number, icon: string) => {
    audio.sfx('error');
    spot.classList.remove('shake'); void (spot as HTMLElement).getBoundingClientRect(); spot.classList.add('shake');
    toast(`The ${what} opens when you reach level ${lvl} ${icon}`, 'heart');
  };
  // The house: a little card to pick a room.
  const rooms = () => {
    wrap.querySelector('.tm-rooms')?.remove();
    const card = el('div', 'tm-rooms', `<b>🏡 Home</b>${(['bedroom', 'livingroom', 'kitchen', 'bathroom'] as LocationId[]).map((id) => {
      const loc = LOCATIONS[id];
      return `<button data-room="${id}" class="${s.location === id ? 'here' : ''}">${iconImg(loc.icon, 40)}<span><b>${esc(loc.name)}</b><small>${s.location === id ? 'You are here ♡' : esc(loc.subtitle)}</small></span></button>`;
    }).join('')}<button class="tm-x" aria-label="Close">✕</button>`);
    wrap.appendChild(card);
    card.querySelectorAll<HTMLElement>('[data-room]').forEach((b) => b.addEventListener('click', () => { audio.sfx('click'); go(b.dataset.room as LocationId); }));
    card.querySelector('.tm-x')!.addEventListener('click', () => card.remove());
  };
  wrap.querySelectorAll<SVGGElement>('[data-spot]').forEach((spot) => {
    const act = () => {
      audio.unlock();
      switch (spot.dataset.spot) {
        case 'home': audio.sfx('click'); rooms(); break;
        case 'backyard': go('backyard'); break;
        case 'school': go('school'); break;
        case 'garden': closePanel(); void openGarden(); break;
        case 'pizza': if (!pizzaUnlocked()) locked(spot, 'Pizza Shop', UNLOCK_LEVEL, '🍕'); else { closePanel(); void openPizzaShop(); } break;
        case 'market': if (!pizzaUnlocked()) locked(spot, 'Market', UNLOCK_LEVEL, '🧺'); else { closePanel(); void openMarket(); } break;
        case 'petshop': if (!petShopOpen()) locked(spot, 'pet shop', PET_SHOP_LEVEL, '🐾'); else { closePanel(); void openPetShop(); } break;
      }
    };
    spot.addEventListener('click', (e) => { e.stopPropagation(); act(); });
    spot.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
  });
  body.appendChild(map);
}


// ------------------------------------------------------------------ settings
function renderSettings(body: HTMLElement, st: PanelState) {
  const set = store.settings;
  const tab = tabs(body, st, [['audio', 'Sound'], ['play', 'Gameplay'], ['days', 'Special Days'], ['save', 'Save']], 'audio');
  const sc = el('div', 'settings scroll');
  const row = (label: string, control: string, help = '') => `<label class="set-row"><span>${label}${help ? `<small>${help}</small>` : ''}</span>${control}</label>`;
  if (tab === 'audio') {
    sc.innerHTML = (['master', 'music', 'ambience', 'sfx'] as const).map((k) =>
      row(k === 'sfx' ? 'Effects' : k[0].toUpperCase() + k.slice(1), `<input type="range" min="0" max="1" step="0.05" value="${set[k]}" data-vol="${k}">`)).join('');
    sc.querySelectorAll<HTMLInputElement>('[data-vol]').forEach((i) => i.addEventListener('input', () => {
      store.updateSettings({ [i.dataset.vol!]: Number(i.value) } as any);
      audio.setVolumes(store.settings);
    }));
  } else if (tab === 'play') {
    sc.innerHTML = `
      ${row('Text speed', `<select data-k="textSpeed"><option value="25">Slow</option><option value="45">Normal</option><option value="80">Fast</option><option value="0">Instant</option></select>`)}
      ${row('Time of day', `<select data-k="time"><option value="real">Follow the real clock</option><option value="morning">Always morning</option><option value="day">Always day</option><option value="sunset">Always sunset</option><option value="night">Always night</option></select>`, 'You can also nap in the bed to change it.')}
      ${row(`${esc(store.partnerName())} should…`, `<select data-k="companionMode"><option value="follow">Follow you around</option><option value="stay">Wait in each room</option><option value="hidden">Be hidden</option></select>`)}
      ${row('Reduced motion', `<input type="checkbox" data-k="reducedMotion" ${set.reducedMotion ? 'checked' : ''}>`, 'Fewer particles and animations.')}
      ${row('Show hints', `<input type="checkbox" data-k="showHints" ${set.showHints ? 'checked' : ''}>`)}
      <h3>Names</h3>
      ${row('Her name', `<input type="text" maxlength="24" data-name="her" value="${esc(store.state.profile.herName)}">`)}
      ${row('His name', `<input type="text" maxlength="24" data-name="him" value="${esc(store.state.profile.hisName)}">`)}
      <div class="set-actions"><button class="btn" data-act="title">Return to title</button></div>`;
    (sc.querySelector('[data-k=textSpeed]') as HTMLSelectElement).value = String(set.textSpeed);
    (sc.querySelector('[data-k=time]') as HTMLSelectElement).value = set.timeMode === 'real' ? 'real' : set.manualTime;
    (sc.querySelector('[data-k=companionMode]') as HTMLSelectElement).value = set.companionMode;
    sc.querySelector('[data-k=textSpeed]')!.addEventListener('change', (e) => store.updateSettings({ textSpeed: Number((e.target as HTMLSelectElement).value) }));
    sc.querySelector('[data-k=time]')!.addEventListener('change', (e) => {
      const v = (e.target as HTMLSelectElement).value;
      store.updateSettings(v === 'real' ? { timeMode: 'real' } : { timeMode: 'manual', manualTime: v as any });
    });
    sc.querySelector('[data-k=companionMode]')!.addEventListener('change', (e) => store.updateSettings({ companionMode: (e.target as HTMLSelectElement).value as any }));
    sc.querySelector('[data-k=reducedMotion]')!.addEventListener('change', (e) => store.updateSettings({ reducedMotion: (e.target as HTMLInputElement).checked }));
    sc.querySelector('[data-k=showHints]')!.addEventListener('change', (e) => store.updateSettings({ showHints: (e.target as HTMLInputElement).checked }));
    sc.querySelectorAll<HTMLInputElement>('[data-name]').forEach((i) => i.addEventListener('change', () => {
      const v = i.value.trim().slice(0, 24);
      if (i.dataset.name === 'her') store.state.profile.herName = v; else store.state.profile.hisName = v;
      store.save();
      bus.emit('state');
    }));
    sc.querySelector('[data-act=title]')!.addEventListener('click', () => { closePanel(); bus.emit('to-title'); });
  } else if (tab === 'days') {
    const active = currentOccasions().map((o) => o.id);
    sc.innerHTML = `<p class="hint">Special days follow your device’s local calendar (${esc(store.now().toLocaleDateString(undefined, { dateStyle: 'long' }))}). Their room colors, decorations and music vary by day. Add personal dates in the Author tool.</p>
      ${OCCASIONS.map((o) => `<div class="occ-row ${active.includes(o.id) ? 'on' : ''}">
        <div><b>${richText(store.fmtLiteral(o.name))}</b><small>${o.placeholder ? 'personal date · add it in the Author tool' : o.rule.type === 'manual' ? 'manual-only · no calendar date' : o.enabled ? 'calendar date' : 'not scheduled'}${active.includes(o.id) ? ' · active today ✨' : ''}</small></div>
        <span>${active.includes(o.id) ? 'Today ✨' : ''}</span></div>`).join('')}`;
  } else if (tab === 'save') {
    sc.innerHTML = `<p class="hint">The game autosaves often. Use slots to keep a copy, or export a backup file.</p>
      ${SLOTS.map((slot) => {
        const info = slotInfo(slot);
        return `<div class="slot-row"><div><b>${slot === 'auto' ? 'Autosave' : 'Slot ' + slot.slice(-1)}</b>
          <small>${info ? `Level ${info.level} · ${esc(LOCATIONS[info.location as keyof typeof LOCATIONS]?.name ?? '')} · ${new Date(info.updatedAt).toLocaleString()}` : 'empty'}</small></div>
          ${slot !== 'auto' ? `<button class="btn" data-save="${slot}">Save here</button>` : ''}</div>`;
      }).join('')}
      <div class="set-actions">
        <button class="btn" data-act="export">Export backup</button>
        <button class="btn" data-act="import">Import backup</button>
        <input type="file" accept=".json,application/json" hidden data-file>
      </div>
      <h3>Danger zone</h3>
      <div class="set-actions"><button class="btn btn-danger" data-act="reset">Erase this story…</button></div>`;
    sc.querySelectorAll<HTMLElement>('[data-save]').forEach((b) => b.addEventListener('click', () => {
      burstHearts(b, 6);
      store.save(b.dataset.save as SlotId);
      toast('Saved ♥', 'heart', 'good');
      st.render();
    }));
    sc.querySelector('[data-act=export]')!.addEventListener('click', () => {
      const text = exportSave(store.state);
      const blob = new Blob([text], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `evermore-backup-${store.today()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      void navigator.clipboard?.writeText(text).catch(() => {});
      toast('Backup exported (also copied to clipboard)', 'scroll', 'good');
    });
    const file = sc.querySelector('[data-file]') as HTMLInputElement;
    sc.querySelector('[data-act=import]')!.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (!f) return;
      try {
        const s = importSave(await f.text());
        store.load(s, store.slot);
        store.save();
        closePanel();
        bus.emit('reload-world');
        toast('Backup restored!', 'heart', 'good');
      } catch (err) {
        console.error(err);
        toast('That file isn’t a valid Evermore backup.', 'key');
      }
    });
    sc.querySelector('[data-act=reset]')!.addEventListener('click', () => {
      if (!confirm('Erase this story and start over? Export a backup first if you might want it back.')) return;
      if (!confirm('Really erase? This cannot be undone.')) return;
      closePanel();
      bus.emit('reset-game');
    });
  }
  body.appendChild(sc);
}

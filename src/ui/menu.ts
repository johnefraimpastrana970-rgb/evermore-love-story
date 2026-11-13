import { Capacitor } from '@capacitor/core';
import { store } from '../core/store';
import { audio } from '../audio/audio';
import { el, esc, uiRoot } from './dom';
import { latestSlot, readSlot, SLOTS, slotInfo, SlotId } from '../core/save';
import { DEFAULT_NAMES, GAME_SUBTITLE, GAME_TITLE } from '../content/config';
import { LOCATIONS } from '../content/locations';
import { HER_AVATAR, HIS_AVATAR } from '../content/characters';
// Imported (not linked from public/) so every rebuilt cutout gets a new file name and is never served from cache.
import coupleArt from '../assets/art/title-couple.webp';

const AVATAR = { her: HER_AVATAR, him: HIS_AVATAR };

export type MenuResult = { kind: 'new'; her: string; him: string; playAs: 'her' | 'him' } | { kind: 'load'; slot: SlotId };

let menu: HTMLElement;

export function initMenu() {
  menu = el('div', 'title-menu hidden');
  uiRoot().appendChild(menu);
}

export function hideMenu() {
  menu.classList.add('hidden');
}

/** Shows the title menu, resolves when the player starts or loads a story. */
export function showMenu(): Promise<MenuResult> {
  return new Promise((resolve) => {
    menu.classList.remove('hidden');
    const home = () => {
      const latest = latestSlot();
      menu.innerHTML = `
        <div class="logo">
          <div class="logo-heart">♥</div>
          <h1>${esc(GAME_TITLE)}</h1>
          <p>${esc(GAME_SUBTITLE)}</p>
        </div>
        <div class="menu-btns">
          ${latest ? '<button class="mbtn primary" data-a="continue">Continue</button>' : ''}
          <button class="mbtn ${latest ? '' : 'primary'}" data-a="new">New Story</button>
          ${latest ? '<button class="mbtn" data-a="load">Load</button>' : ''}
          <button class="mbtn" data-a="about">About</button>
        </div>
        <div class="menu-vol"><span>♪</span><input type="range" min="0" max="1" step="0.05" value="${store.settings.master}" aria-label="Volume"></div>
        <div class="title-couple"><img src="${coupleArt}" alt="" decoding="async"></div>
        <div class="menu-foot">Made with love · no last level, no final page</div>`;
      menu.querySelector('[data-a=continue]')?.addEventListener('click', () => { click(); resolve({ kind: 'load', slot: latest! }); });
      menu.querySelector('[data-a=new]')!.addEventListener('click', () => { click(); newStory(); });
      menu.querySelector('[data-a=load]')?.addEventListener('click', () => { click(); load(); });
      menu.querySelector('[data-a=about]')!.addEventListener('click', () => { click(); about(); });
      const vol = menu.querySelector('.menu-vol input') as HTMLInputElement;
      vol.addEventListener('input', () => { store.updateSettings({ master: Number(vol.value) }); audio.setVolumes(store.settings); });
    };
    const click = () => { audio.unlock(); audio.playMusic('title'); audio.sfx('click'); };
    let playAs: 'her' | 'him' = 'her';
    const newStory = () => {
      const hasAuto = !!readSlot('auto');
      menu.innerHTML = `<div class="menu-card paper small">
        <h2>A new story begins…</h2>
        <p class="pick-q">Who are you playing as?</p>
        <div class="role-pick" role="radiogroup" aria-label="Play as">
          ${(['her', 'him'] as const).map((w) => `<button class="role-card ${w === playAs ? 'on' : ''}" data-role="${w}" role="radio" aria-checked="${w === playAs}">
            ${AVATAR[w] ? `<img src="${AVATAR[w]}" alt="">` : ''}<b>${w === 'her' ? 'Girlfriend' : 'Boyfriend'}</b><small>${w === 'her' ? 'He keeps you company' : 'She keeps you company'}</small></button>`).join('')}
        </div>
        <label>Her name<input data-her maxlength="24" placeholder="Her name" value="${esc(DEFAULT_NAMES.her)}"></label>
        <label>His name<input data-him maxlength="24" placeholder="His name" value="${esc(DEFAULT_NAMES.him)}"></label>
        ${hasAuto ? '<p class="warn">Starting a new story replaces the autosave. Saves in slots 1–3 are kept.</p>' : ''}
        <div class="row"><button class="btn" data-a="back">Back</button><button class="btn btn-rose" data-a="go">Begin ♥</button></div></div>`;
      const her = menu.querySelector('[data-her]') as HTMLInputElement;
      her.focus();
      menu.querySelectorAll<HTMLElement>('[data-role]').forEach((b) => b.addEventListener('click', () => {
        playAs = b.dataset.role as 'her' | 'him';
        audio.sfx('click');
        menu.querySelectorAll<HTMLElement>('[data-role]').forEach((x) => {
          x.classList.toggle('on', x === b);
          x.setAttribute('aria-checked', String(x === b));
        });
      }));
      menu.querySelector('[data-a=back]')!.addEventListener('click', () => { click(); home(); });
      const go = () => {
        click();
        resolve({ kind: 'new', her: her.value.trim(), him: (menu.querySelector('[data-him]') as HTMLInputElement).value.trim(), playAs });
      };
      menu.querySelector('[data-a=go]')!.addEventListener('click', go);
      menu.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }));
    };
    const load = () => {
      menu.innerHTML = `<div class="menu-card paper small"><h2>Load a story</h2>
        ${SLOTS.map((slot) => {
          const info = slotInfo(slot);
          return `<button class="slot-btn" data-slot="${slot}" ${info ? '' : 'disabled'}><b>${slot === 'auto' ? 'Autosave' : 'Slot ' + slot.slice(-1)}</b>
            <small>${info ? `${esc(info.playerName || (info.playAs === 'him' ? 'Him' : 'Her'))} · Level ${info.level} · ${esc(LOCATIONS[info.location as keyof typeof LOCATIONS]?.name ?? '')}<br>${new Date(info.updatedAt).toLocaleString()}` : 'empty'}</small></button>`;
        }).join('')}
        <div class="row"><button class="btn" data-a="back">Back</button></div></div>`;
      menu.querySelectorAll<HTMLElement>('[data-slot]').forEach((b) => b.addEventListener('click', () => { click(); resolve({ kind: 'load', slot: b.dataset.slot as SlotId }); }));
      menu.querySelector('[data-a=back]')!.addEventListener('click', () => { click(); home(); });
    };
    const about = () => {
      menu.innerHTML = `<div class="menu-card paper small"><h2>About Evermore</h2>
        <p>A cozy, endless little world made for one special person. Explore the house and school, collect charms, find secrets, play mini-games, and read letters that unlock over time.</p>
        <p><b>Controls</b><br>Move: WASD / arrows · click or tap the floor · on-screen joystick<br>Interact: E / Space / tap · Menus: C I Q J M · Esc for settings</p>
        ${Capacitor.isNativePlatform() ? '' : '<p><a class="btn btn-rose android-download" href="./downloads/evermore-android.apk" download>Download the Android app</a></p>'}
        <p>There is no final level and no ending — only more days together.</p>
        <div class="row"><button class="btn" data-a="back">Back</button></div></div>`;
      menu.querySelector('[data-a=back]')!.addEventListener('click', () => { click(); home(); });
    };
    home();
  });
}

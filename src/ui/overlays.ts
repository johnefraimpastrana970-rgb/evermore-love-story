import type { LocationDef } from '../content/types';
import { store } from '../core/store';
import { bus } from '../core/events';
import { audio } from '../audio/audio';
import { el, esc, richText, uiRoot, wait } from './dom';
import { titleFor } from '../systems/progression';
import type { SessionStart } from '../systems/game';
import { dailyMessage } from '../systems/game';
import { iconURL } from '../art/icons';
import { HER_PORTRAITS, HIS_PORTRAITS, HIS_AVATAR } from '../content/characters';

const portraitsOf = (who: 'her' | 'him') => (who === 'her' ? HER_PORTRAITS : HIS_PORTRAITS);

let card: HTMLElement;
let fader: HTMLElement;
const levelQueue: { level: number; rewards: string[] }[] = [];
let levelShowing = false;

export function initOverlays() {
  card = el('div', 'loc-card');
  fader = el('div', 'fader');
  uiRoot().append(card, fader);
  bus.on('levelup', (p) => { levelQueue.push(p); void pumpLevel(); });
  if (window.matchMedia('(orientation: portrait)').matches) checkRotate();
  window.addEventListener('resize', checkRotate);
}

let rotateEl: HTMLElement | null = null;
function checkRotate() {
  const portrait = window.innerHeight > window.innerWidth * 1.05 && window.innerWidth < 900;
  if (portrait && !rotateEl) {
    rotateEl = el('div', 'rotate-hint', '<div>📱↻</div><p>Turn your phone sideways for the best view</p>');
    uiRoot().appendChild(rotateEl);
  } else if (!portrait && rotateEl) {
    rotateEl.remove();
    rotateEl = null;
  }
}

export function locationCard(loc: LocationDef) {
  card.innerHTML = `<b>${esc(loc.name)}</b><span>${esc(loc.subtitle)}</span>`;
  card.classList.remove('show');
  void card.offsetWidth;
  card.classList.add('show');
}

/** Fade the screen out, optionally showing travel text. */
export async function fadeOut(text = '', ms = 380) {
  fader.innerHTML = text ? `<span>${esc(text)}</span>` : '';
  fader.classList.add('on');
  await wait(text ? ms + 500 : ms);
}
export function fadeIn() {
  fader.classList.remove('on');
}

async function pumpLevel() {
  if (levelShowing) return;
  const next = levelQueue.shift();
  if (!next) return;
  levelShowing = true;
  store.block();
  audio.sfx('levelup');
  const o = el('div', 'levelup');
  const confetti = Array.from({ length: 26 }, (_, i) =>
    `<i style="left:${(i * 37) % 100}%;animation-delay:${(i % 7) * 0.12}s;--h:${(i * 47) % 360}deg"></i>`).join('');
  o.innerHTML = `<div class="confetti">${confetti}</div><div class="lu-card">
    <div class="lu-heart"><span>${next.level}</span></div>
    <div class="lu-pair">
      ${portraitsOf(store.playAs()).laughing ? `<img class="lu-her" data-who="${store.playAs()}" src="${portraitsOf(store.playAs()).laughing!.replace('.webp', '-avatar.webp')}" alt="">` : ''}
      ${portraitsOf(store.partner()).happy ? `<img class="lu-her" data-who="${store.partner()}" src="${portraitsOf(store.partner()).happy!.replace('.webp', '-avatar.webp')}" alt="">` : ''}
    </div>
    <h2>Level up!</h2>
    <p class="lu-title">“${esc(titleFor(next.level))}”</p>
    <ul>${next.rewards.map((r) => `<li>✦ ${esc(r)}</li>`).join('')}</ul>
    <button class="btn btn-rose">Yay ♥</button></div>`;
  uiRoot().appendChild(o);
  requestAnimationFrame(() => o.classList.add('in'));
  await new Promise<void>((resolve) => {
    const done = () => { window.removeEventListener('keydown', key, true); resolve(); };
    const key = (e: KeyboardEvent) => { if (['Enter', 'Space', 'Escape', 'KeyE'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); done(); } };
    setTimeout(() => {
      o.querySelector('button')!.addEventListener('click', done);
      window.addEventListener('keydown', key, true);
    }, 500);
  });
  o.remove();
  store.unblock();
  levelShowing = false;
  void pumpLevel();
}

/** Daily welcome card. */
export function welcome(info: SessionStart): Promise<void> {
  if (!info.newDay) return Promise.resolve();
  return new Promise((resolve) => {
    store.block();
    const msg = dailyMessage();
    const s = store.state;
    const o = el('div', 'welcome');
    o.innerHTML = `<div class="paper small">
      ${portraitsOf(store.playAs()).happy ? `<img class="welcome-her" src="${portraitsOf(store.playAs()).happy!.replace('.webp', '-avatar.webp')}" alt="">` : ''}
      <div class="paper-kind">Day ${s.daily.days}</div>
      <h2>Welcome back, ${esc(store.playerName())}</h2>
      <p class="streak">${info.streak > 1 ? `🔥 ${info.streak} days in a row` : 'A brand new day together'}</p>
      <p class="gift"><img src="${iconURL('coin', 32)}" alt=""> +${info.loginTokens} heart tokens</p>
      ${msg ? `<div class="msg"><small class="msg-from">${HIS_AVATAR ? `<img src="${HIS_AVATAR}" alt="">` : ''}A message from ${esc(store.hisName())}</small><p>${richText(store.fmtLiteral(msg.body ?? msg.title))}</p></div>` : ''}
      <p class="new-q">New daily quests are waiting ✦</p>
      <button class="btn btn-rose">Let’s go ♥</button></div>`;
    uiRoot().appendChild(o);
    requestAnimationFrame(() => o.classList.add('in'));
    audio.sfx('quest');
    o.querySelector('button')!.addEventListener('click', () => {
      o.remove();
      store.unblock();
      resolve();
    });
  });
}

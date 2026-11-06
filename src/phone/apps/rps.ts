import { registerApp } from '../phone';
import { store } from '../../core/store';
import { audio } from '../../audio/audio';
import { esc } from '../../ui/dom';
import { HER_PORTRAITS, HIS_PORTRAITS } from '../../content/characters';
import type { Mood } from '../../content/types';
import { HANDS, RpsMatch, type Hand } from '../games/rps-logic';
import { gameReward } from './util';

const GLYPH: Record<Hand, string> = { rock: '✊', paper: '✋', scissors: '✌️' };
const NAME: Record<Hand, string> = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' };
// What the partner says (general banter, no memories).
const WIN_LINES = ['Hehe, got you!', 'Too easy ♡', 'I read your mind.'];
const LOSE_LINES = ['Hey! Rematch.', 'You cheated. Somehow.', 'Fine… that one’s yours.'];
const DRAW_LINES = ['Great minds…', 'Jinx!', 'Again!'];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

registerApp({
  id: 'rps',
  name: 'R·P·S',
  bare: true,
  open(ctx) {
    const face = (m: Mood) => {
      const t = store.partner() === 'him' ? HIS_PORTRAITS : HER_PORTRAITS;
      return (t[m] ?? t.natural ?? '').replace('.webp', '-avatar.webp');
    };
    let match = new RpsMatch(3);
    let busy = false;
    let timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));

    ctx.host.innerHTML = `<div class="game rps">
      <div class="game-top"><button class="app-back" data-back aria-label="Back">‹</button><b>Rock · Paper · Scissors</b></div>
      <div class="rps-them"><img class="rps-face" alt=""><div class="rps-say"></div></div>
      <div class="rps-arena"><span class="rps-hand them">✊</span><span class="rps-vs">vs</span><span class="rps-hand me">✊</span></div>
      <div class="rps-score"><span><small>${esc(store.partnerName())}</small><b data-them>0</b></span><span class="rps-to">first to 3</span><span><small>You</small><b data-me>0</b></span></div>
      <div class="rps-pick">${HANDS.map((h) => `<button data-h="${h}" aria-label="${NAME[h]}"><span>${GLYPH[h]}</span><small>${NAME[h]}</small></button>`).join('')}</div>
    </div>`;
    ctx.host.querySelector('[data-back]')!.addEventListener('click', () => ctx.go('home'));
    const faceEl = ctx.host.querySelector('.rps-face') as HTMLImageElement;
    const say = ctx.host.querySelector('.rps-say') as HTMLElement;
    const handMe = ctx.host.querySelector('.rps-hand.me') as HTMLElement;
    const handThem = ctx.host.querySelector('.rps-hand.them') as HTMLElement;
    const setFace = (m: Mood, line: string) => {
      faceEl.src = face(m);
      say.textContent = line;
      faceEl.classList.remove('react'); void faceEl.offsetWidth; faceEl.classList.add('react');
    };
    const score = () => {
      (ctx.host.querySelector('[data-me]') as HTMLElement).textContent = String(match.me);
      (ctx.host.querySelector('[data-them]') as HTMLElement).textContent = String(match.them);
    };
    setFace('happy', `Ready, ${store.playerName()}?`);

    const play = (h: Hand) => {
      if (busy) return;
      if (match.done) { match = new RpsMatch(3); score(); }
      busy = true;
      ctx.host.classList.add('shaking');
      handMe.textContent = handThem.textContent = '✊';
      const words = ['Rock…', 'Paper…', 'Scissors…'];
      words.forEach((w, i) => later(() => { say.textContent = w; audio.sfx('type'); }, i * 330));
      later(() => {
        ctx.host.classList.remove('shaking');
        const r = match.play(h);
        handMe.textContent = GLYPH[r.mine];
        handThem.textContent = GLYPH[r.theirs];
        handMe.classList.toggle('won', r.result === 1);
        handThem.classList.toggle('won', r.result === -1);
        score();
        if (r.result === 1) { audio.sfx('hit'); setFace('pouty', pick(LOSE_LINES)); }
        else if (r.result === -1) { audio.sfx('fail'); setFace('laughing', pick(WIN_LINES)); }
        else setFace('natural', pick(DRAW_LINES));
        if (match.done) {
          const won = match.me > match.them;
          later(() => {
            if (won) { audio.sfx('success'); setFace('cute', 'Okay okay, you win. Proud of you ♡'); }
            else setFace('laughing', 'Champion! …Wanna go again?');
            gameReward('rps', won ? 30 : 0, 10);
            store.state.phone.bests['rps-wins'] = (store.state.phone.bests['rps-wins'] ?? 0) + (won ? 1 : 0);
          }, 700);
        }
        busy = false;
      }, 1050);
    };
    ctx.host.querySelectorAll<HTMLElement>('[data-h]').forEach((b) => b.addEventListener('click', () => play(b.dataset.h as Hand)));
    const onKey = (e: KeyboardEvent) => {
      const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      if (i >= 0) { e.preventDefault(); play(HANDS[i]); }
    };
    window.addEventListener('keydown', onKey);
    return () => { timers.forEach(clearTimeout); timers = []; window.removeEventListener('keydown', onKey); };
  },
});

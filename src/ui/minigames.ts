import type { MinigameId, Mood } from '../content/types';
import { HER_PORTRAITS, HIS_PORTRAITS } from '../content/characters';
import { store } from '../core/store';
import { audio } from '../audio/audio';
import { el, esc, uiRoot } from './dom';
import { iconURL } from '../art/icons';
import { makeCanvas, paintLandscape, heartPath, starPath, glow } from '../art/paint';
import { minigameResult, isUnlocked } from '../systems/game';
import { PERSONAL } from '../content/personal';
import { CUSTOM_WORDS } from '../content/personal';
import { RECIPES, SCRAMBLE_WORDS } from '../content/config';
import { narrate } from './dialogue';
import { resolveImage } from './panels';
import { rng } from '../core/rng';
import { cookingProduce, useProduce } from '../garden/logic';

interface Shell {
  stage: HTMLElement;
  status: (html: string) => void;
  quit: Promise<null>;
}

const INFO: Record<MinigameId, { title: string; how: string; icon: string }> = {
  memory: { title: 'Keepsake Memory', how: 'Flip two cards at a time and find every matching pair.', icon: 'polaroid' },
  cooking: { title: 'Cooking Together', how: 'Press Space / tap “Now!” when the marker is inside the pink zone. Dead centre is perfect.', icon: 'pancake' },
  stars: { title: 'Stargazing', how: 'Connect the glowing stars in order (1 → 2 → 3…) to draw each constellation.', icon: 'star' },
  scramble: { title: 'Chalkboard Words', how: 'Unscramble the love word. Tap letters in order — or type them.', icon: 'book' },
  slider: { title: 'Photo Puzzle', how: 'Slide the tiles back into place. Tap a tile next to the gap, or use the arrow keys.', icon: 'polaroid' },
};

let running = false;

export async function runMinigame(id: MinigameId): Promise<void> {
  if (running) return;
  if (id === 'stars' && !['sunset', 'night'].includes(store.timeOfDay())) {
    await narrate('The sky is too bright for stars right now. Come back at sunset or night — or nap in the bed until then.');
    return;
  }
  running = true;
  store.block();
  audio.sfx('open');
  const info = INFO[id];
  const wrap = el('div', 'mg');
  wrap.innerHTML = `<div class="mg-card">
    <header><img src="${iconURL(info.icon, 64)}" alt=""><div><h2>${info.title}</h2><p>${esc(info.how)}</p></div>
    <button class="sheet-close" aria-label="Quit">✕</button></header>
    <div class="mg-status"></div><div class="mg-stage"></div></div>`;
  uiRoot().appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('in'));
  try {
    let again = true;
    while (again) {
      const stage = wrap.querySelector('.mg-stage') as HTMLElement;
      stage.innerHTML = '';
      let quitResolve!: (v: null) => void;
      const quit = new Promise<null>((r) => (quitResolve = r));
      const btn = wrap.querySelector('.sheet-close') as HTMLElement;
      btn.onclick = () => quitResolve(null);
      const onEsc = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.preventDefault(); quitResolve(null); } };
      window.addEventListener('keydown', onEsc);
      const shell: Shell = { stage, status: (h) => ((wrap.querySelector('.mg-status') as HTMLElement).innerHTML = h), quit };
      const score = await Promise.race([GAMES[id](shell), quit]);
      window.removeEventListener('keydown', onEsc);
      shell.status('');
      if (score === null) break;
      const res = minigameResult(id, score);
      audio.sfx(res.score >= 50 ? 'success' : 'fail');
      again = await showResult(stage, res);
    }
  } finally {
    wrap.remove();
    store.unblock();
    store.save();
    running = false;
  }
}

function showResult(stage: HTMLElement, r: { score: number; xp: number; tokens: number; isBest: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    const msg = r.score >= 95 ? 'Perfect! ♥' : r.score >= 75 ? 'Wonderful!' : r.score >= 50 ? 'Nicely done!' : 'Cute try!';
    const react = reaction(r.score);
    stage.innerHTML = `<div class="mg-result">
      ${react ? `<div class="mg-react"><img src="${react.img}" alt=""><span>${esc(react.line)}</span></div>` : ''}
      <div class="score-heart"><span>${r.score}</span></div>
      <h3>${msg}</h3>
      ${r.isBest ? '<p class="best">New personal best!</p>' : ''}
      <p>+${r.xp} XP · +${r.tokens} heart tokens</p>
      <div class="row"><button class="btn" data-a="again">Play again</button><button class="btn btn-rose" data-a="done">Done</button></div></div>`;
    stage.querySelector('[data-a=again]')!.addEventListener('click', () => resolve(true));
    stage.querySelector('[data-a=done]')!.addEventListener('click', () => resolve(false));
  });
}

/** Her reaction to a score, using her illustrated expressions. */
function reaction(score: number): { img: string; line: string } | null {
  const pick = (mood: Mood, lines: string[]) => {
    const img = (store.playAs() === 'him' ? HIS_PORTRAITS : HER_PORTRAITS)[mood];
    return img ? { img: img.replace('.webp', '-avatar.webp'), line: lines[Math.floor(Math.random() * lines.length)] } : null;
  };
  if (score >= 90) return pick('laughing', ['We’re SO good at this!', 'Hehe, too easy.', 'Did you see that?!']);
  if (score >= 70) return pick('happy', ['Yay! One more?', 'Teamwork!', 'I’m kind of amazing.']);
  if (score >= 50) return pick('cute', ['Not bad, right?', 'Pretty good for us!', 'I’ll do better next time ♥']);
  if (score >= 25) return pick('pouty', ['…I wasn’t even trying.', 'Again. Right now.', 'Hmph.']);
  return pick('irritated', ['This game is rigged.', 'Don’t say anything.', 'Who made this?!']);
}

async function userPhotos(): Promise<string[]> {
  const list = PERSONAL.filter((p) => p.kind === 'photo' && p.image && !p.placeholder && isUnlocked(p));
  const urls = await Promise.all(list.map((p) => resolveImage(p.image)));
  return urls.filter((u): u is string => !!u);
}

const GAMES: Record<MinigameId, (sh: Shell) => Promise<number | null>> = {
  // ------------------------------------------------------------------ memory
  async memory(sh) {
    const photos = await userPhotos();
    const icons = ['heart', 'petal', 'star', 'note', 'cookie', 'cocoa', 'bouquet', 'ribbon', 'letter', 'pancake'];
    const faces: string[] = [...photos.slice(0, 8)];
    for (const ic of icons) { if (faces.length >= 8) break; faces.push(iconURL(ic, 96)); }
    const r = rng(Date.now());
    const deck = r.shuffle([...faces, ...faces].map((f, i) => ({ f, i })));
    const grid = el('div', 'mem-grid');
    sh.stage.appendChild(grid);
    let moves = 0, found = 0;
    let open: HTMLElement[] = [];
    let lock = false;
    const upd = () => sh.status(`Moves: <b>${moves}</b> · Pairs: <b>${found}/8</b>`);
    upd();
    return new Promise((resolve) => {
      for (const card of deck) {
        const c = el('button', 'mem-card', `<div class="mem-inner"><div class="mem-back">♥</div><div class="mem-front"><img src="${card.f}" alt=""></div></div>`);
        c.dataset.f = card.f;
        c.addEventListener('click', () => {
          if (lock || c.classList.contains('flip')) return;
          c.classList.add('flip');
          audio.sfx('click');
          open.push(c);
          if (open.length === 2) {
            moves++;
            const [a, b] = open;
            if (a.dataset.f === b.dataset.f) {
              found++;
              audio.sfx('collect');
              a.classList.add('matched'); b.classList.add('matched');
              open = [];
              if (found === 8) setTimeout(() => resolve(Math.max(20, Math.min(100, 100 - Math.max(0, moves - 10) * 4))), 600);
            } else {
              lock = true;
              setTimeout(() => { a.classList.remove('flip'); b.classList.remove('flip'); open = []; lock = false; }, 750);
            }
            upd();
          }
        });
        grid.appendChild(c);
      }
    });
  },

  // ------------------------------------------------------------------ cooking
  async cooking(sh) {
    const recipe = RECIPES[Math.floor(Math.random() * RECIPES.length)];
    // Fresh garden produce for this recipe makes it extra special (+12, used up at the end).
    const fresh = store.state.garden.unlocked ? cookingProduce(store.state.garden, recipe.name) : null;
    const box = el('div', 'cook');
    box.innerHTML = `<h3 class="cook-recipe">${esc(recipe.name)}</h3>
      ${fresh ? `<p class="cook-fresh">${fresh.emoji} With ${esc(fresh.name.toLowerCase())} from our garden! <b>+12</b></p>` : ''}
      <div class="cook-pan"><img src="${iconURL('pancake', 128)}" alt=""></div>
      <div class="cook-step"></div>
      <div class="cook-bar"><div class="zone"><i></i></div><div class="marker"></div></div>
      <div class="cook-feedback"></div>
      <button class="btn btn-rose big cook-go">Now!</button>`;
    sh.stage.appendChild(box);
    const zone = box.querySelector('.zone') as HTMLElement;
    const marker = box.querySelector('.marker') as HTMLElement;
    const stepEl = box.querySelector('.cook-step') as HTMLElement;
    const fb = box.querySelector('.cook-feedback') as HTMLElement;
    const pan = box.querySelector('.cook-pan') as HTMLElement;
    const scores: number[] = [];
    for (let i = 0; i < recipe.steps.length; i++) {
      sh.status(`Step <b>${i + 1}</b> of ${recipe.steps.length}`);
      stepEl.textContent = recipe.steps[i];
      const zw = 0.22 - i * 0.015;
      const zx = 0.1 + Math.random() * (0.8 - zw);
      zone.style.left = zx * 100 + '%';
      zone.style.width = zw * 100 + '%';
      const speed = 0.55 + i * 0.12; // sweeps per second
      const hit = await new Promise<number>((resolve) => {
        const t0 = performance.now();
        let raf = 0;
        let pos = 0;
        const tick = (t: number) => {
          const ph = ((t - t0) / 1000) * speed;
          pos = Math.abs(((ph % 2) + 2) % 2 - 1); // ping-pong 0..1
          pos = 1 - pos;
          marker.style.left = pos * 100 + '%';
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        const press = (e?: Event) => {
          e?.preventDefault();
          cancelAnimationFrame(raf);
          window.removeEventListener('keydown', onKey);
          go.removeEventListener('click', press);
          const centre = zx + zw / 2;
          const d = Math.abs(pos - centre);
          resolve(d <= zw * 0.17 ? 100 : d <= zw / 2 ? 70 : d <= zw ? 35 : 10);
        };
        const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'Enter') press(e); };
        const go = box.querySelector('.cook-go') as HTMLElement;
        go.addEventListener('click', press);
        window.addEventListener('keydown', onKey);
        void sh.quit.then(() => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); });
      });
      scores.push(hit);
      fb.textContent = hit === 100 ? 'Perfect! ✨' : hit === 70 ? 'Good!' : hit === 35 ? 'Almost…' : 'Oops!';
      fb.className = `cook-feedback f${hit}`;
      audio.sfx(hit >= 70 ? 'hit' : 'fail');
      pan.classList.remove('bounce'); void pan.offsetWidth; pan.classList.add('bounce');
      await new Promise((r) => setTimeout(r, 650));
    }
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    if (fresh && useProduce(store.state.garden, fresh.id)) return Math.min(100, avg + 12);
    return avg;
  },

  // ------------------------------------------------------------------ stars
  async stars(sh) {
    const W = 800, H = 450;
    const [cv, ctx] = makeCanvas(W, H);
    cv.className = 'stars-canvas';
    sh.stage.appendChild(cv);
    const SHAPES: { name: string; pts: [number, number][] }[] = [
      { name: 'Heart', pts: [[0.5, 0.82], [0.3, 0.6], [0.24, 0.38], [0.33, 0.22], [0.45, 0.26], [0.5, 0.36], [0.55, 0.26], [0.67, 0.22], [0.76, 0.38], [0.7, 0.6], [0.5, 0.82]] },
      { name: 'Wishing Star', pts: [[0.5, 0.15], [0.58, 0.4], [0.82, 0.42], [0.62, 0.56], [0.7, 0.82], [0.5, 0.66], [0.3, 0.82], [0.38, 0.56], [0.18, 0.42], [0.42, 0.4], [0.5, 0.15]] },
      { name: 'Crescent Moon', pts: [[0.55, 0.15], [0.38, 0.25], [0.3, 0.48], [0.38, 0.7], [0.56, 0.82], [0.48, 0.64], [0.45, 0.48], [0.48, 0.32], [0.55, 0.15]] },
      { name: 'Infinity', pts: [[0.5, 0.5], [0.38, 0.32], [0.22, 0.36], [0.2, 0.6], [0.36, 0.68], [0.5, 0.5], [0.64, 0.32], [0.8, 0.38], [0.8, 0.62], [0.62, 0.68], [0.5, 0.5]] },
      { name: 'Paper Plane', pts: [[0.2, 0.55], [0.82, 0.22], [0.5, 0.78], [0.44, 0.58], [0.82, 0.22], [0.44, 0.58], [0.2, 0.55]] },
    ];
    const r = rng(Date.now());
    const chosen = r.shuffle(SHAPES).slice(0, 3);
    const bg = Array.from({ length: 140 }, () => [r.next() * W, r.next() * H, r.next() * 1.5 + 0.3] as const);
    let misses = 0;
    const t0 = performance.now();
    let raf = 0;
    try {
      for (let si = 0; si < chosen.length; si++) {
        const shape = chosen[si];
        // dedupe repeated points (closing the loop reuses the first star)
        const uniq: [number, number][] = [];
        const order: number[] = [];
        for (const p of shape.pts) {
          let idx = uniq.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.01);
          if (idx < 0) { uniq.push(p); idx = uniq.length - 1; }
          order.push(idx);
        }
        const stars = uniq.map(([x, y]) => [x * W, y * H] as [number, number]);
        let step = 1;
        sh.status(`Constellation <b>${si + 1}/3</b>: ${shape.name}`);
        const draw = (t: number) => {
          const g = ctx.createLinearGradient(0, 0, 0, H);
          g.addColorStop(0, '#0a1030'); g.addColorStop(1, '#2b2a6a');
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
          for (const [x, y, s] of bg) { ctx.fillStyle = `rgba(255,255,240,${0.4 + 0.3 * Math.sin(t / 600 + x)})`; ctx.fillRect(x, y, s, s); }
          ctx.strokeStyle = 'rgba(255,214,234,0.85)'; ctx.lineWidth = 3; ctx.shadowColor = '#ff9ac0'; ctx.shadowBlur = 12;
          ctx.beginPath();
          for (let i = 0; i < step; i++) { const [x, y] = stars[order[i]]; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
          ctx.stroke(); ctx.shadowBlur = 0;
          stars.forEach(([x, y], i) => {
            const nextIdx = order[step];
            const isNext = i === nextIdx;
            glow(ctx, x, y, isNext ? 30 + 6 * Math.sin(t / 200) : 18, isNext ? 0xffe08a : 0xffffff, 0.6);
            ctx.fillStyle = '#fffbe8'; starPath(ctx, x, y, isNext ? 9 : 6, 0.4); ctx.fill();
          });
          const nextI = order[step];
          if (nextI !== undefined && store.settings.showHints) {
            const [nx, ny] = stars[nextI];
            ctx.fillStyle = 'rgba(255,240,200,0.9)'; ctx.font = '600 16px Fredoka, sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(String(step + 1), nx, ny - 18);
          }
          raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);
        void sh.quit.then(() => cancelAnimationFrame(raf));
        await new Promise<void>((resolve) => {
          const onDown = (e: PointerEvent) => {
            const rect = cv.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * W, y = ((e.clientY - rect.top) / rect.height) * H;
            const [tx, ty] = stars[order[step]];
            if (Math.hypot(tx - x, ty - y) < 34) {
              step++;
              audio.sfx('hit');
              if (step >= order.length) { cv.removeEventListener('pointerdown', onDown); audio.sfx('secret'); setTimeout(resolve, 700); }
            } else { misses++; audio.sfx('error'); }
          };
          cv.addEventListener('pointerdown', onDown);
        });
        cancelAnimationFrame(raf);
      }
    } finally {
      cancelAnimationFrame(raf);
    }
    const secs = (performance.now() - t0) / 1000;
    void heartPath;
    return Math.max(20, Math.min(100, Math.round(100 - misses * 4 - Math.max(0, secs - 40) * 0.8)));
  },

  // ------------------------------------------------------------------ scramble
  async scramble(sh) {
    const pool = [...SCRAMBLE_WORDS, ...CUSTOM_WORDS.map((w) => w.toUpperCase().replace(/[^A-Z]/g, ''))].filter((w) => w.length >= 3 && w.length <= 10);
    const r = rng(Date.now());
    const words = r.shuffle(pool).slice(0, 5);
    let points = 0;
    const box = el('div', 'scr');
    sh.stage.appendChild(box);
    for (let wi = 0; wi < words.length; wi++) {
      const word = words[wi];
      let letters = r.shuffle(word.split(''));
      if (letters.join('') === word) letters = letters.reverse();
      let answer: number[] = [];
      let hints = 0;
      sh.status(`Word <b>${wi + 1}/5</b> · Score <b>${points}</b>`);
      const ok = await new Promise<boolean>((resolve) => {
        const render = () => {
          box.innerHTML = `<div class="scr-answer">${word.split('').map((_, i) => `<span class="slot">${answer[i] !== undefined ? letters[answer[i]] : ''}</span>`).join('')}</div>
            <div class="scr-tiles">${letters.map((l, i) => `<button class="tile" data-i="${i}" ${answer.includes(i) ? 'disabled' : ''}>${l}</button>`).join('')}</div>
            <div class="row"><button class="btn" data-a="back">⌫ Undo</button><button class="btn" data-a="hint">Hint</button><button class="btn" data-a="skip">Skip</button></div>`;
          box.querySelectorAll<HTMLElement>('.tile').forEach((t) => t.addEventListener('click', () => add(Number(t.dataset.i))));
          box.querySelector('[data-a=back]')!.addEventListener('click', back);
          box.querySelector('[data-a=hint]')!.addEventListener('click', hint);
          box.querySelector('[data-a=skip]')!.addEventListener('click', () => finish(false));
        };
        const add = (i: number) => {
          if (answer.includes(i)) return;
          answer.push(i);
          audio.sfx('click');
          render();
          if (answer.length === word.length) {
            const guess = answer.map((k) => letters[k]).join('');
            if (guess === word) finish(true);
            else { audio.sfx('error'); box.querySelector('.scr-answer')!.classList.add('shake'); setTimeout(() => { answer = []; render(); }, 500); }
          }
        };
        const back = () => { answer.pop(); render(); };
        const hint = () => {
          // Rebuild the answer so the first N letters are correct.
          hints++;
          const n = Math.min(word.length - 1, hints);
          const used = new Set<number>();
          answer = [];
          for (let k = 0; k < n; k++) {
            const idx = letters.findIndex((l, j) => l === word[k] && !used.has(j));
            used.add(idx);
            answer.push(idx);
          }
          render();
        };
        const onKey = (e: KeyboardEvent) => {
          if (e.code === 'Backspace') { e.preventDefault(); back(); return; }
          const ch = e.key.toUpperCase();
          if (/^[A-Z]$/.test(ch)) {
            const idx = letters.findIndex((l, j) => l === ch && !answer.includes(j));
            if (idx >= 0) add(idx);
          }
        };
        const finish = (solved: boolean) => {
          window.removeEventListener('keydown', onKey);
          if (solved) { points += Math.max(8, 20 - hints * 5); audio.sfx('success'); }
          box.innerHTML = `<div class="scr-reveal ${solved ? 'ok' : ''}">${word}</div>`;
          setTimeout(() => resolve(solved), 900);
        };
        window.addEventListener('keydown', onKey);
        void sh.quit.then(() => window.removeEventListener('keydown', onKey));
        render();
      });
      void ok;
    }
    return points;
  },

  // ------------------------------------------------------------------ slider
  async slider(sh) {
    const photos = await userPhotos();
    let src = photos[Math.floor(Math.random() * photos.length)];
    if (!src) {
      const [c, ctx] = makeCanvas(450, 450);
      paintLandscape(ctx, 0, 0, 450, 450, 'puzzle' + store.today());
      src = c.toDataURL();
    }
    const N = 3;
    const board = el('div', 'slide-board');
    sh.stage.appendChild(board);
    sh.stage.appendChild(el('div', 'slide-ref', `<img src="${src}" alt=""><small>Goal</small>`));
    // tiles[pos] = tile index; N*N-1 is the gap.
    let tiles = Array.from({ length: N * N }, (_, i) => i);
    let gap = N * N - 1;
    const neighbours = (p: number) => [p - N, p + N, p % N ? p - 1 : -1, (p + 1) % N ? p + 1 : -1].filter((q) => q >= 0 && q < N * N);
    let last = -1;
    for (let i = 0; i < 120; i++) {
      const opts = neighbours(gap).filter((q) => q !== last);
      const q = opts[Math.floor(Math.random() * opts.length)];
      [tiles[gap], tiles[q]] = [tiles[q], tiles[gap]];
      last = gap; gap = q;
    }
    if (tiles.every((t, i) => t === i)) { [tiles[0], tiles[1]] = [tiles[1], tiles[0]]; }
    let moves = 0;
    return new Promise((resolve) => {
      const render = () => {
        board.innerHTML = '';
        tiles.forEach((t, pos) => {
          const b = el('button', `slide-tile ${t === N * N - 1 ? 'gap' : ''}`);
          if (t !== N * N - 1) {
            b.style.backgroundImage = `url(${src})`;
            b.style.backgroundPosition = `${(t % N) * 50}% ${Math.floor(t / N) * 50}%`;
          }
          b.addEventListener('click', () => move(pos));
          board.appendChild(b);
        });
        sh.status(`Moves: <b>${moves}</b>`);
      };
      const move = (pos: number) => {
        if (!neighbours(gap).includes(pos)) return;
        [tiles[gap], tiles[pos]] = [tiles[pos], tiles[gap]];
        gap = pos;
        moves++;
        audio.sfx('click');
        render();
        if (tiles.every((t, i) => t === i)) {
          window.removeEventListener('keydown', onKey);
          board.classList.add('solved');
          setTimeout(() => resolve(Math.max(30, Math.min(100, Math.round(100 - Math.max(0, moves - 25) * 1.2)))), 900);
        }
      };
      const onKey = (e: KeyboardEvent) => {
        const map: Record<string, number> = { ArrowUp: gap + N, ArrowDown: gap - N, ArrowLeft: gap % N < N - 1 ? gap + 1 : -1, ArrowRight: gap % N ? gap - 1 : -1 };
        const t = map[e.code];
        if (t !== undefined) { e.preventDefault(); if (t >= 0 && t < N * N) move(t); }
      };
      window.addEventListener('keydown', onKey);
      render();
      // Clean up the key listener if the player quits.
      void sh.quit.then(() => window.removeEventListener('keydown', onKey));
    });
  },
};

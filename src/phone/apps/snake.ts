import { registerApp } from '../phone';
import { store } from '../../core/store';
import { audio } from '../../audio/audio';
import { DPAD_HTML, VEC, directionInput, fitCanvas, heart } from './input';
import { SnakeGame } from '../games/snake-logic';
import { gameReward } from './util';

const COLS = 14;

registerApp({
  id: 'snake',
  name: 'Snake',
  bare: true,
  open(ctx) {
    ctx.host.innerHTML = `<div class="game snake">
      <div class="game-top"><button class="app-back" data-back aria-label="Back">‹</button><b>Snake</b><span class="game-score">0</span><span class="game-best">Best ${store.state.phone.bests.snake ?? 0}</span></div>
      <div class="game-stage"><canvas></canvas><div class="game-over"></div></div>
      ${DPAD_HTML}</div>`;
    ctx.host.querySelector('[data-back]')!.addEventListener('click', () => ctx.go('home'));
    const canvas = ctx.host.querySelector('canvas') as HTMLCanvasElement;
    const stage = ctx.host.querySelector('.game-stage') as HTMLElement;
    const overlay = ctx.host.querySelector('.game-over') as HTMLElement;
    const scoreEl = ctx.host.querySelector('.game-score') as HTMLElement;
    let view = fitCanvas(canvas);
    // Board size from the stage; clamped so a not-yet-laid-out (0px) stage can't make an endless board.
    const rowsFor = (w: number, h: number) => (w > 0 && h > 0 ? Math.min(30, Math.max(8, Math.floor(h / (w / COLS)))) : 16);
    let cell = view.w / COLS;
    let rows = rowsFor(view.w, view.h);
    let game = new SnakeGame(COLS, rows);
    let running = false, raf = 0, acc = 0, last = 0, pulse = 0;

    const draw = () => {
      const { g, w, h } = view;
      cell = Math.min(w / COLS, h / rows);
      if (!(cell > 0)) return;
      const ox = (w - COLS * cell) / 2, oy = (h - rows * cell) / 2;
      g.clearRect(0, 0, w, h);
      for (let y = 0; y < rows; y++) for (let x = 0; x < COLS; x++) {
        g.fillStyle = (x + y) % 2 ? '#e9f8ee' : '#f3fcf6';
        g.fillRect(ox + x * cell, oy + y * cell, cell, cell);
      }
      const [fx, fy] = game.food;
      heart(g, ox + (fx + 0.5) * cell, oy + (fy + 0.55) * cell, cell * (0.9 + Math.sin(pulse * 6) * 0.08), game.golden ? '#f0b429' : '#ff5c8a');
      game.body.forEach(([x, y], i) => {
        const t = i / Math.max(1, game.body.length - 1);
        g.fillStyle = `hsl(${148 - t * 18}, ${55 - t * 10}%, ${44 + t * 14}%)`;
        const pad = i === 0 ? 0.5 : 1.5 + t * 2;
        g.beginPath();
        g.roundRect(ox + x * cell + pad, oy + y * cell + pad, cell - pad * 2, cell - pad * 2, cell * 0.35);
        g.fill();
      });
      // Eyes on the head, looking where it's going.
      const [hx, hy] = game.body[0], [dx, dy] = VEC[game.dir];
      for (const s of [-1, 1]) {
        const ex = ox + (hx + 0.5 + dx * 0.18 + (dy ? s * 0.2 : 0)) * cell, ey = oy + (hy + 0.5 + dy * 0.18 + (dx ? s * 0.2 : 0)) * cell;
        g.fillStyle = '#fff'; g.beginPath(); g.arc(ex, ey, cell * 0.13, 0, 7); g.fill();
        g.fillStyle = '#2b2b2b'; g.beginPath(); g.arc(ex + dx * 1.5, ey + dy * 1.5, cell * 0.07, 0, 7); g.fill();
      }
    };

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (t - (last || t)) / 1000);
      last = t;
      pulse += dt;
      if (running) {
        acc += dt;
        const stepT = 1 / game.speed;
        while (acc >= stepT && running) {
          acc -= stepT;
          const r = game.step();
          if (r === 'eat' || r === 'golden') { audio.sfx(r === 'golden' ? 'success' : 'collect'); scoreEl.textContent = String(game.score); }
          if (r === 'die' || game.over) end();
        }
      }
      draw();
    };

    const showOverlay = (html: string) => { overlay.innerHTML = html; overlay.classList.add('show'); };
    const start = () => {
      game = new SnakeGame(COLS, rows);
      scoreEl.textContent = '0';
      overlay.classList.remove('show');
      running = true;
      acc = 0;
    };
    const end = () => {
      running = false;
      audio.sfx('fail');
      const res = gameReward('snake', game.score, 3);
      (ctx.host.querySelector('.game-best') as HTMLElement).textContent = `Best ${res.best}`;
      showOverlay(`<b>${res.isBest && game.score > 0 ? 'New best! ♥' : 'Game over'}</b><span>${game.score} ${game.score === 1 ? 'heart' : 'hearts'}</span><button class="ph-btn" data-play>Play again</button>`);
      overlay.querySelector('[data-play]')!.addEventListener('click', start);
    };
    showOverlay(`<b>Snake</b><span>Eat the hearts, don’t bite your tail.<br>Swipe, use the pad or arrow keys.</span><button class="ph-btn" data-play>Play</button>`);
    overlay.querySelector('[data-play]')!.addEventListener('click', start);

    const stopInput = directionInput(ctx.host, stage, (d) => { if (running) game.turn(d); }, () => { if (!running && !overlay.querySelector('[data-play]')) start(); });
    const onResize = () => { view = fitCanvas(canvas); if (!running) { rows = rowsFor(view.w, view.h); game = new SnakeGame(COLS, rows); } };
    const ro = new ResizeObserver(onResize);
    ro.observe(stage);
    const onHide = () => { if (document.hidden && running) { running = false; showOverlay(`<b>Paused</b><button class="ph-btn" data-resume>Resume</button>`); overlay.querySelector('[data-resume]')!.addEventListener('click', () => { overlay.classList.remove('show'); running = true; last = 0; }); } };
    document.addEventListener('visibilitychange', onHide);
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); stopInput(); ro.disconnect(); document.removeEventListener('visibilitychange', onHide); };
  },
});

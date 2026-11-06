import { registerApp } from '../phone';
import { audio } from '../../audio/audio';
import { DPAD_HTML, VEC, directionInput, fitCanvas, heart } from './input';
import { MazeGame, type Cloud } from '../games/maze-logic';
import { gameReward } from './util';

registerApp({
  id: 'maze',
  name: 'Heart Maze',
  bare: true,
  open(ctx) {
    ctx.host.innerHTML = `<div class="game maze">
      <div class="game-top"><button class="app-back" data-back aria-label="Back">‹</button><b>Heart Maze</b><span class="game-lives"></span><span class="game-score">0</span></div>
      <div class="game-stage"><canvas></canvas><div class="game-over"></div></div>
      ${DPAD_HTML}</div>`;
    ctx.host.querySelector('[data-back]')!.addEventListener('click', () => ctx.go('home'));
    const canvas = ctx.host.querySelector('canvas') as HTMLCanvasElement;
    const stage = ctx.host.querySelector('.game-stage') as HTMLElement;
    const overlay = ctx.host.querySelector('.game-over') as HTMLElement;
    const scoreEl = ctx.host.querySelector('.game-score') as HTMLElement;
    const livesEl = ctx.host.querySelector('.game-lives') as HTMLElement;
    let view = fitCanvas(canvas);
    let game = new MazeGame();
    let running = false, raf = 0, last = 0, t = 0, flash = 0;

    // The walls never change: paint them once.
    let wallLayer: HTMLCanvasElement | null = null;
    const layout = () => {
      const cell = Math.max(1, Math.floor(Math.min(view.w / game.cols, view.h / game.rows)));
      return { cell, ox: (view.w - cell * game.cols) / 2, oy: (view.h - cell * game.rows) / 2 };
    };
    const paintWalls = () => {
      const { cell } = layout();
      const c = document.createElement('canvas');
      c.width = cell * game.cols * 2; c.height = cell * game.rows * 2;
      const g = c.getContext('2d')!;
      g.scale(2, 2);
      for (let y = 0; y < game.rows; y++) for (let x = 0; x < game.cols; x++) {
        if (!game.walls[y][x]) continue;
        g.fillStyle = '#b9a7f0';
        g.beginPath(); g.roundRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2, cell * 0.28); g.fill();
        g.fillStyle = 'rgba(255,255,255,.35)';
        g.beginPath(); g.roundRect(x * cell + 3, y * cell + 2.5, cell - 6, cell * 0.32, cell * 0.16); g.fill();
      }
      wallLayer = c;
    };

    const drawCloud = (g: CanvasRenderingContext2D, c: Cloud, x: number, y: number, s: number) => {
      const ending = game.power > 0 && game.power < 1.6 && Math.floor(t * 8) % 2 === 0;
      const wob = c.scared ? Math.sin(t * 14 + x) * s * 0.04 : 0;
      g.fillStyle = c.scared ? (ending ? '#ffffff' : '#dff3ff') : c.style === 'chase' ? '#7d7f96' : c.style === 'ahead' ? '#8f86a8' : '#9aa2b1';
      for (const [dx, dy, r] of [[-0.22, 0.08, 0.26], [0.22, 0.08, 0.26], [0, -0.12, 0.32], [0, 0.16, 0.26]]) {
        g.beginPath(); g.arc(x + dx * s + wob, y + dy * s, r * s, 0, 7); g.fill();
      }
      if (c.scared) {
        g.fillStyle = '#ff9ab8';
        g.beginPath(); g.arc(x - 0.2 * s, y + 0.1 * s, 0.07 * s, 0, 7); g.arc(x + 0.2 * s, y + 0.1 * s, 0.07 * s, 0, 7); g.fill();
        g.fillStyle = '#4a2a3e';
        g.beginPath(); g.arc(x - 0.1 * s, y - 0.04 * s, 0.04 * s, 0, 7); g.arc(x + 0.1 * s, y - 0.04 * s, 0.04 * s, 0, 7); g.fill();
      } else {
        const [dx, dy] = VEC[c.dir];
        g.fillStyle = '#fff';
        g.beginPath(); g.arc(x - 0.11 * s, y - 0.04 * s, 0.08 * s, 0, 7); g.arc(x + 0.11 * s, y - 0.04 * s, 0.08 * s, 0, 7); g.fill();
        g.fillStyle = '#2d2438';
        g.beginPath(); g.arc(x - 0.11 * s + dx * 2, y - 0.04 * s + dy * 2, 0.04 * s, 0, 7); g.arc(x + 0.11 * s + dx * 2, y - 0.04 * s + dy * 2, 0.04 * s, 0, 7); g.fill();
        g.strokeStyle = '#2d2438'; g.lineWidth = Math.max(1, s * 0.045); g.lineCap = 'round';
        g.beginPath(); g.moveTo(x - 0.2 * s, y - 0.2 * s); g.lineTo(x - 0.05 * s, y - 0.13 * s); g.moveTo(x + 0.2 * s, y - 0.2 * s); g.lineTo(x + 0.05 * s, y - 0.13 * s); g.stroke();
      }
    };

    const draw = () => {
      const { g, w, h } = view;
      const { cell, ox, oy } = layout();
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#fbf7ff';
      g.fillRect(ox, oy, cell * game.cols, cell * game.rows);
      if (wallLayer) g.drawImage(wallLayer, ox, oy, cell * game.cols, cell * game.rows);
      const cx = (x: number) => ox + (x + 0.5) * cell, cy = (y: number) => oy + (y + 0.5) * cell;
      g.fillStyle = '#f2b836';
      for (const k of game.sparkles) {
        const [x, y] = k.split(',').map(Number);
        const r = cell * 0.13;
        g.beginPath(); g.moveTo(cx(x), cy(y) - r); g.lineTo(cx(x) + r * 0.35, cy(y)); g.lineTo(cx(x), cy(y) + r); g.lineTo(cx(x) - r * 0.35, cy(y)); g.closePath(); g.fill();
      }
      for (const k of game.petals) {
        const [x, y] = k.split(',').map(Number);
        const s = cell * (0.34 + Math.sin(t * 5) * 0.05);
        g.save(); g.translate(cx(x), cy(y)); g.rotate(t);
        g.fillStyle = '#ff8fb0';
        for (let i = 0; i < 5; i++) { g.rotate((Math.PI * 2) / 5); g.beginPath(); g.ellipse(0, -s * 0.45, s * 0.22, s * 0.4, 0, 0, 7); g.fill(); }
        g.fillStyle = '#ffd36b'; g.beginPath(); g.arc(0, 0, s * 0.16, 0, 7); g.fill();
        g.restore();
      }
      for (const c of game.clouds) drawCloud(g, c, cx(c.x), cy(c.y), cell * 1.05);
      const p = game.player;
      const blink = flash > 0 && Math.floor(flash * 10) % 2 === 0;
      if (!blink) {
        const bounce = 1 + Math.sin(t * 12) * 0.05;
        heart(g, cx(p.x), cy(p.y) + cell * 0.05, cell * 0.95 * bounce, game.power > 0 ? '#ff3f7a' : '#ff5c8a');
        const [dx, dy] = VEC[p.dir];
        g.fillStyle = '#fff';
        g.beginPath(); g.arc(cx(p.x) - cell * 0.12 + dx * 2, cy(p.y) - cell * 0.06 + dy * 2, cell * 0.07, 0, 7); g.arc(cx(p.x) + cell * 0.12 + dx * 2, cy(p.y) - cell * 0.06 + dy * 2, cell * 0.07, 0, 7); g.fill();
      }
    };

    const hud = () => {
      scoreEl.textContent = String(game.score);
      livesEl.textContent = '♥'.repeat(Math.max(0, game.lives));
    };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      t += dt;
      if (flash > 0) flash -= dt;
      if (running) {
        for (const e of game.update(dt)) {
          if (e === 'sparkle') audio.sfx('type');
          if (e === 'petal') audio.sfx('heart');
          if (e === 'catch') audio.sfx('hit');
          if (e === 'hit') { audio.sfx('fail'); flash = 1.2; }
          if (e === 'clear') { audio.sfx('success'); banner(`Level ${game.level}`); }
          if (e === 'over') end();
        }
        hud();
      }
      draw();
    };
    const banner = (text: string) => {
      overlay.innerHTML = `<b>${text}</b>`;
      overlay.classList.add('show', 'brief');
      setTimeout(() => { if (running) overlay.classList.remove('show', 'brief'); }, 1300);
    };
    const showOverlay = (html: string, onPlay: () => void) => {
      overlay.classList.remove('brief');
      overlay.innerHTML = html;
      overlay.classList.add('show');
      overlay.querySelector('[data-play]')!.addEventListener('click', onPlay);
    };
    const start = () => {
      game = new MazeGame();
      overlay.classList.remove('show');
      running = true;
      hud();
      banner('Ready?');
    };
    const end = () => {
      running = false;
      const res = gameReward('maze', game.score, 150);
      showOverlay(`<b>${res.isBest && game.score > 0 ? 'New best! ♥' : 'Caught by a cloud!'}</b><span>${game.score} points · level ${game.level}<br>Best ${res.best}</span><button class="ph-btn" data-play>Play again</button>`, start);
    };
    showOverlay(`<b>Heart Maze</b><span>Collect every sparkle. Avoid the grumpy clouds.<br>Grab a petal and they get shy: catch them for bonus points!</span><button class="ph-btn" data-play>Play</button>`, start);
    hud();
    paintWalls();

    const stopInput = directionInput(ctx.host, stage, (d) => game.steer(d));
    const onResize = () => { view = fitCanvas(canvas); paintWalls(); };
    const ro = new ResizeObserver(onResize);
    ro.observe(stage);
    const onHide = () => {
      if (!document.hidden || !running) return;
      running = false;
      showOverlay(`<b>Paused</b><button class="ph-btn" data-play>Resume</button>`, () => { overlay.classList.remove('show'); running = true; last = 0; });
    };
    document.addEventListener('visibilitychange', onHide);
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); stopInput(); ro.disconnect(); document.removeEventListener('visibilitychange', onHide); };
  },
});

import { Dir, VEC } from '../games/dir';

export { VEC };
export type { Dir };

const KEYS: Record<string, Dir> = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};

export const DPAD_HTML = `<div class="dpad" aria-label="Direction pad">
  <button data-dir="up" aria-label="Up">▲</button><button data-dir="left" aria-label="Left">◀</button>
  <button data-dir="right" aria-label="Right">▶</button><button data-dir="down" aria-label="Down">▼</button></div>`;

/** Arrow keys / WASD, swipes on `surface` and the on-screen pad. Returns a cleanup function. */
export function directionInput(root: HTMLElement, surface: HTMLElement, onDir: (d: Dir) => void, onAction?: () => void): () => void {
  const key = (e: KeyboardEvent) => {
    const d = KEYS[e.code];
    if (d) { e.preventDefault(); e.stopPropagation(); onDir(d); }
    else if ((e.code === 'Space' || e.code === 'Enter') && onAction) { e.preventDefault(); e.stopPropagation(); onAction(); }
  };
  window.addEventListener('keydown', key, true);
  let sx = 0, sy = 0, swiped = false;
  const down = (e: PointerEvent) => { sx = e.clientX; sy = e.clientY; swiped = false; };
  const move = (e: PointerEvent) => {
    if (!e.buttons && e.pointerType === 'mouse') return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    onDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    sx = e.clientX; sy = e.clientY; swiped = true;
  };
  const up = () => { if (!swiped) onAction?.(); };
  surface.style.touchAction = 'none';
  surface.addEventListener('pointerdown', down);
  surface.addEventListener('pointermove', move);
  surface.addEventListener('pointerup', up);
  root.querySelectorAll<HTMLElement>('[data-dir]').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); onDir(b.dataset.dir as Dir); }));
  return () => window.removeEventListener('keydown', key, true);
}

/** Fit a canvas to its box at device pixel ratio; returns CSS size. */
export function fitCanvas(canvas: HTMLCanvasElement) {
  // clientWidth ignores CSS transforms (the app zooms open), unlike getBoundingClientRect.
  const r = { width: canvas.clientWidth, height: canvas.clientHeight };
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(r.width * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
  const g = canvas.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w: r.width, h: r.height, g };
}

export function heart(g: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  g.save();
  g.translate(x, y);
  g.scale(s / 20, s / 20);
  g.beginPath();
  g.moveTo(0, 7);
  g.bezierCurveTo(-10, 0, -10, -8, -5, -9);
  g.bezierCurveTo(-2, -9.6, 0, -7, 0, -5);
  g.bezierCurveTo(0, -7, 2, -9.6, 5, -9);
  g.bezierCurveTo(10, -8, 10, 0, 0, 7);
  g.fillStyle = color;
  g.fill();
  g.restore();
}

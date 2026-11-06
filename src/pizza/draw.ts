import { INGREDIENTS, type IngKind, type Tier } from './data';
import type { SavedLook } from './logic';

/** Paintable layer (sauce / cheese) as a grid over the pizza's bounding square. */
export const GRID = 28;

export interface Piece { kind: IngKind; tier: Tier; x: number; y: number; rot: number }
export interface PizzaLook {
  dough: { size: number; tier: Tier } | null;
  sauce: { kind: 'tomato' | 'cream'; tier: Tier; cells: Uint8Array } | null;
  cheese: { tier: Tier; cells: Uint8Array } | null;
  pieces: Piece[];
  bake: number;
  cuts: { a: [number, number]; b: [number, number] }[];
}

export const emptyLook = (): PizzaLook => ({ dough: null, sauce: null, cheese: null, pieces: [], bake: 0, cuts: [] });

/** Paint grid <-> compact string ("0"/"1" per cell) so a half-made pizza can be saved. */
export const packCells = (c: Uint8Array) => Array.from(c, (v) => (v ? '1' : '0')).join('');
export function unpackCells(s: unknown): Uint8Array {
  const c = new Uint8Array(GRID * GRID);
  if (typeof s === 'string') for (let i = 0; i < c.length && i < s.length; i++) c[i] = s[i] === '1' ? 1 : 0;
  return c;
}
export function packLook(l: PizzaLook): SavedLook {
  return {
    dough: l.dough && { ...l.dough },
    sauce: l.sauce && { kind: l.sauce.kind, tier: l.sauce.tier, cells: packCells(l.sauce.cells) },
    cheese: l.cheese && { tier: l.cheese.tier, cells: packCells(l.cheese.cells) },
    pieces: l.pieces.map((p) => ({ ...p })),
    bake: l.bake,
    cuts: l.cuts.map((c) => ({ a: [...c.a] as [number, number], b: [...c.b] as [number, number] })),
  };
}
export function unpackLook(s: SavedLook): PizzaLook {
  return {
    dough: s.dough ? { ...s.dough } : null,
    sauce: s.sauce ? { kind: s.sauce.kind, tier: s.sauce.tier, cells: unpackCells(s.sauce.cells) } : null,
    cheese: s.cheese ? { tier: s.cheese.tier, cells: unpackCells(s.cheese.cells) } : null,
    pieces: Array.isArray(s.pieces) ? s.pieces.filter((p) => p && INGREDIENTS[p.kind]).map((p) => ({ ...p })) : [],
    bake: Number(s.bake) || 0,
    cuts: Array.isArray(s.cuts) ? s.cuts.map((c) => ({ a: [...c.a] as [number, number], b: [...c.b] as [number, number] })) : [],
  };
}

/** Grid cell centre in pizza units (-1..1). */
export const cellXY = (i: number): [number, number] => [((i % GRID) + 0.5) / GRID * 2 - 1, (Math.floor(i / GRID) + 0.5) / GRID * 2 - 1];
const INNER = 0.86;

/** Paint cells around a point (pizza units). Returns how many new cells were painted. */
export function paint(cells: Uint8Array, x: number, y: number, brush = 0.16): number {
  let n = 0;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i]) continue;
    const [cx, cy] = cellXY(i);
    if (Math.hypot(cx - x, cy - y) <= brush) { cells[i] = 1; n++; }
  }
  return n;
}
/** Share of the inner pizza area covered (0..1), and how much spilled onto the crust. */
export function coverage(cells: Uint8Array, size = 0.93) {
  let inside = 0, painted = 0, spill = 0;
  for (let i = 0; i < cells.length; i++) {
    const [cx, cy] = cellXY(i);
    const d = Math.hypot(cx, cy);
    if (d <= INNER * size) { inside++; if (cells[i]) painted++; }
    else if (cells[i]) spill++;
  }
  return { covered: inside ? painted / inside : 0, spill: inside ? spill / inside : 0 };
}

function hexToRgb(h: string) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Blend two #rrggbb colours; returns #rrggbb so results can be blended again. */
function mix(a: string, b: string, t: number) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const k = Math.max(0, Math.min(1, t));
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('');
}

export function drawPizza(g: CanvasRenderingContext2D, look: PizzaLook, cx: number, cy: number, R: number, time = 0) {
  g.save();
  // Tray.
  g.fillStyle = '#c9ccd6';
  g.beginPath(); g.arc(cx, cy + 4, R * 1.08, 0, 7); g.fill();
  g.fillStyle = '#e4e6ee';
  g.beginPath(); g.arc(cx, cy, R * 1.08, 0, 7); g.fill();
  const d = look.dough;
  if (!d) { g.restore(); return; }
  const r = R * Math.min(1.25, d.size);
  const bake = look.bake;
  const doughC = INGREDIENTS.dough.colors[d.tier - 1];
  // Crust + base.
  g.fillStyle = mix(mix(doughC, '#c98a3e', bake * 0.85), '#5a3418', Math.max(0, bake - 0.85) * 4);
  g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  g.fillStyle = mix(doughC, '#e6b36a', bake * 0.4);
  g.beginPath(); g.arc(cx, cy, r * 0.88, 0, 7); g.fill();
  if (d.tier === 3) { // flour dusting on the sourdough rim
    g.fillStyle = 'rgba(255,255,255,.35)';
    for (let i = 0; i < 26; i++) { const a = i * 2.39; g.beginPath(); g.arc(cx + Math.cos(a) * r * 0.94, cy + Math.sin(a) * r * 0.94, 1.6, 0, 7); g.fill(); }
  }
  // Clip sauce and cheese to the dough.
  g.save();
  g.beginPath(); g.arc(cx, cy, r * 0.97, 0, 7); g.clip();
  const layer = (cells: Uint8Array, color: string, blob: number) => {
    g.fillStyle = color;
    for (let i = 0; i < cells.length; i++) {
      if (!cells[i]) continue;
      const [x, y] = cellXY(i);
      g.beginPath(); g.arc(cx + x * R, cy + y * R, (R / GRID) * blob, 0, 7); g.fill();
    }
  };
  if (look.sauce) layer(look.sauce.cells, mix(INGREDIENTS[look.sauce.kind].colors[look.sauce.tier - 1], '#7a2a12', bake * 0.25), 1.55);
  if (look.cheese) {
    const c = INGREDIENTS.mozzarella.colors[look.cheese.tier - 1];
    layer(look.cheese.cells, mix(c, '#f2c45a', bake * 0.55), 1.35);
    if (bake > 0.45) { // golden bubbles
      g.fillStyle = `rgba(214,140,40,${Math.min(0.55, (bake - 0.45) * 1.4)})`;
      for (let i = 0; i < look.cheese.cells.length; i++) {
        if (!look.cheese.cells[i] || (i * 37) % 11 !== 0) continue; // scattered, not in rows
        const [x, y] = cellXY(i);
        g.beginPath(); g.arc(cx + x * R + 2, cy + y * R + 1, R * 0.022, 0, 7); g.fill();
      }
    }
  }
  g.restore();
  // Toppings.
  for (const p of look.pieces) drawPiece(g, p, cx + p.x * R, cy + p.y * R, R * 0.085, bake, time);
  // Burnt haze.
  if (bake > 0.92) {
    g.fillStyle = `rgba(40,20,10,${Math.min(0.5, (bake - 0.92) * 5)})`;
    g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  }
  // Cuts.
  g.strokeStyle = 'rgba(255,248,235,.85)';
  g.lineWidth = 2.5;
  g.lineCap = 'round';
  for (const c of look.cuts) {
    g.beginPath(); g.moveTo(cx + c.a[0] * R, cy + c.a[1] * R); g.lineTo(cx + c.b[0] * R, cy + c.b[1] * R); g.stroke();
  }
  g.restore();
}

export function drawPiece(g: CanvasRenderingContext2D, p: Piece, x: number, y: number, s: number, bake = 0, time = 0) {
  const def = INGREDIENTS[p.kind];
  const col = mix(def.colors[p.tier - 1], '#3a1a0a', bake * 0.25);
  g.save();
  g.translate(x, y);
  g.rotate(p.rot);
  g.fillStyle = col;
  switch (def.piece) {
    case 'disc':
      g.beginPath(); g.arc(0, 0, s, 0, 7); g.fill();
      g.fillStyle = 'rgba(0,0,0,.18)';
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(Math.cos(i * 2.1) * s * 0.45, Math.sin(i * 2.1) * s * 0.45, s * 0.14, 0, 7); g.fill(); }
      if (p.tier === 3) { g.strokeStyle = 'rgba(60,10,5,.6)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, s * 0.92, 0, 7); g.stroke(); }
      break;
    case 'leaf':
      g.beginPath(); g.ellipse(0, 0, s * 1.1, s * 0.55, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-s, 0); g.lineTo(s, 0); g.stroke();
      break;
    case 'ring':
      g.strokeStyle = col; g.lineWidth = s * 0.35;
      g.beginPath(); g.ellipse(0, 0, s * 0.9, s * 0.65, 0, 0, 7); g.stroke();
      break;
    case 'olive':
      g.beginPath(); g.arc(0, 0, s * 0.62, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(0, 0, s * 0.24, 0, 7); g.fill();
      break;
    case 'chunk':
      g.beginPath(); g.roundRect(-s * 0.8, -s * 0.6, s * 1.6, s * 1.2, s * 0.3); g.fill();
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-s * 0.6, -s * 0.45, s * 0.9, s * 0.18);
      break;
    case 'cap':
      g.beginPath(); g.arc(0, -s * 0.1, s * 0.85, Math.PI, 0); g.fill();
      g.fillRect(-s * 0.25, -s * 0.1, s * 0.5, s * 0.75);
      break;
    case 'drop':
      g.globalAlpha = 0.75;
      g.beginPath(); g.ellipse(0, 0, s * 0.95, s * 0.6, 0, 0, 7); g.fill();
      g.globalAlpha = 1;
      break;
  }
  // Premium ingredients get a little glossy glint.
  if (p.tier === 3) {
    const tw = 0.5 + 0.5 * Math.sin(time * 4 + x);
    g.fillStyle = `rgba(255,255,255,${0.35 + tw * 0.4})`;
    g.beginPath(); g.arc(-s * 0.35, -s * 0.35, s * 0.18, 0, 7); g.fill();
  }
  g.restore();
}

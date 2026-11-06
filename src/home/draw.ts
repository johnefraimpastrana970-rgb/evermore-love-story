import { drawPlant, ellipse, fillRR, heartPath, hex, makeCanvas, vgrad, type Ctx } from '../art/paint';
import { itemDef } from './data';

/*
 * Placeable items, drawn in code. Each is drawn with its base (the floor contact) at the bottom-centre of its box.
 * `perchY` is how high a cat sits on it (cat tree), `bedY` where a pet curls up.
 */

export const ITEM_SPOTS: Record<string, { perchY?: number; bedY?: number }> = {
  'cat-tree': { perchY: 168 }, 'pet-bed': { bedY: 10 }, 'pet-bed-heart': { bedY: 12 }, beanbag: { bedY: 30 }, 'heart-pillow': { bedY: 14 },
};

function emojiItem(ctx: Ctx, w: number, h: number, emoji: string, size: number) {
  ellipse(ctx, w / 2, h - 6, w * 0.38, 7, 'rgba(60,30,40,0.18)');
  ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(emoji, w / 2, h - 2);
}

const DRAW: Record<string, (ctx: Ctx, w: number, h: number) => void> = {
  'cat-tree': (ctx, w, h) => {
    ellipse(ctx, w / 2, h - 6, 50, 9, 'rgba(60,30,40,0.2)');
    fillRR(ctx, w / 2 - 50, h - 20, 100, 18, 8, '#d9b48a');
    ctx.fillStyle = vgrad(ctx, 30, h, [[0, 0xe8cfa8], [1, 0xc9a478]]);
    ctx.fillRect(w / 2 - 9, 40, 18, h - 56);
    ctx.strokeStyle = 'rgba(140,100,60,0.35)'; ctx.lineWidth = 2;
    for (let y = 50; y < h - 24; y += 8) { ctx.beginPath(); ctx.moveTo(w / 2 - 9, y); ctx.lineTo(w / 2 + 9, y + 4); ctx.stroke(); }
    fillRR(ctx, w / 2 - 40, h - 110, 56, 14, 7, '#f4b6c8');
    fillRR(ctx, w / 2 - 46, 30, 92, 18, 9, '#f4b6c8');
    fillRR(ctx, w / 2 - 40, 22, 80, 12, 6, '#ffd6e0');
    ctx.strokeStyle = '#f0c050'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w / 2 + 30, 46); ctx.lineTo(w / 2 + 30, 82); ctx.stroke();
    ellipse(ctx, w / 2 + 30, 88, 7, 7, '#ff8fb0');
  },
  'pet-bed': (ctx, w, h) => {
    ellipse(ctx, w / 2, h - 6, w * 0.46, 8, 'rgba(60,30,40,0.18)');
    ellipse(ctx, w / 2, h - 16, w * 0.46, 18, hex(0x8ab8e8));
    ellipse(ctx, w / 2, h - 12, w * 0.36, 11, hex(0xdcecfb));
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(w / 2, h - 20, w * 0.43, 14, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  },
  'pet-bed-heart': (ctx, w, h) => {
    ellipse(ctx, w / 2, h - 6, w * 0.46, 8, 'rgba(60,30,40,0.18)');
    ctx.save(); ctx.translate(w / 2, h - 28); ctx.scale(1, 0.42);
    ctx.fillStyle = '#ff8fb0'; heartPath(ctx, 0, -36, 100); ctx.fill();
    ctx.fillStyle = '#ffd6e0'; heartPath(ctx, 0, -22, 70); ctx.fill();
    ctx.restore();
  },
  beanbag: (ctx, w, h) => {
    ellipse(ctx, w / 2, h - 6, w * 0.46, 9, 'rgba(60,30,40,0.18)');
    ctx.fillStyle = vgrad(ctx, h - 70, h, [[0, 0xffd28a], [1, 0xf0a850]]);
    ctx.beginPath(); ctx.moveTo(10, h - 8); ctx.quadraticCurveTo(4, h - 60, w / 2, h - 66); ctx.quadraticCurveTo(w - 4, h - 60, w - 10, h - 8); ctx.closePath(); ctx.fill();
    ellipse(ctx, w / 2, h - 34, 30, 12, 'rgba(255,255,255,0.25)');
  },
  'heart-pillow': (ctx, w, h) => {
    ellipse(ctx, w / 2, h - 5, w * 0.44, 7, 'rgba(60,30,40,0.18)');
    ctx.save(); ctx.translate(w / 2, h - 18); ctx.scale(1, 0.5);
    ctx.fillStyle = '#e8577d'; heartPath(ctx, 0, -30, 86); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; heartPath(ctx, -10, -20, 30); ctx.fill();
    ctx.restore();
  },
  'toy-box': (ctx, w, h) => {
    ellipse(ctx, w / 2, h - 5, w * 0.44, 7, 'rgba(60,30,40,0.18)');
    ellipse(ctx, w / 2 - 14, h - 50, 10, 10, '#e5413d'); ellipse(ctx, w / 2 + 12, h - 52, 9, 9, '#7fd1b9');
    ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.arc(w / 2 + 2, h - 56, 8, 0, Math.PI * 2); ctx.fill();
    fillRR(ctx, 6, h - 46, w - 12, 42, 10, vgrad(ctx, h - 46, h, [[0, 0xe8c08a], [1, 0xc89a62]]));
    ctx.strokeStyle = 'rgba(120,80,40,0.35)'; ctx.lineWidth = 2;
    for (let x = 14; x < w - 10; x += 10) { ctx.beginPath(); ctx.moveTo(x, h - 44); ctx.lineTo(x, h - 6); ctx.stroke(); }
  },
  monstera: (ctx, w, h) => { drawPlant(ctx, w / 2, h - 2, 1.0, 0xf2a6b8); },
  'floor-lamp': (ctx, w, h) => {
    ellipse(ctx, w / 2, h - 5, 22, 6, 'rgba(60,30,40,0.18)');
    fillRR(ctx, w / 2 - 5, 50, 10, h - 56, 4, '#fff6ea');
    ctx.fillStyle = vgrad(ctx, 4, 56, [[0, 0xff8f9f], [1, 0xe5413d]]);
    ctx.beginPath(); ctx.ellipse(w / 2, 52, 32, 40, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
    for (const [dx, dy, r] of [[-14, 32, 6], [8, 24, 5], [18, 42, 4], [-2, 44, 3.5]] as const) ellipse(ctx, w / 2 + dx, dy, r, r, '#ffffff');
  },
  bear: (ctx, w, h) => emojiItem(ctx, w, h, '🧸', 96),
  fishbowl: (ctx, w, h) => {
    ellipse(ctx, w / 2, h - 5, 26, 6, 'rgba(60,30,40,0.18)');
    fillRR(ctx, w / 2 - 16, h - 32, 32, 28, 4, '#c89a62');
    ctx.fillStyle = 'rgba(190,230,255,0.75)'; ctx.beginPath(); ctx.arc(w / 2, h - 58, 28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(120,190,240,0.5)'; ctx.beginPath(); ctx.arc(w / 2, h - 52, 24, 0.1, Math.PI - 0.1); ctx.fill();
    ctx.fillStyle = '#ff9a4a'; ctx.beginPath(); ctx.ellipse(w / 2 + 2, h - 54, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w / 2 - 6, h - 54); ctx.lineTo(w / 2 - 14, h - 60); ctx.lineTo(w / 2 - 14, h - 48); ctx.closePath(); ctx.fill();
    ellipse(ctx, w / 2 + 6, h - 56, 1.6, 1.6, '#2a2024');
  },
};

/** Build an item's canvas (once per item kind). */
export function buildItem(id: string): HTMLCanvasElement {
  const d = itemDef(id)!;
  const [c, ctx] = makeCanvas(d.w, d.h);
  (DRAW[id] ?? ((x, w, h) => emojiItem(x, w, h, d.emoji, Math.min(w, h) * 0.8)))(ctx, d.w, d.h);
  return c;
}
/** A small preview for the decorate menu. */
const previews = new Map<string, string>();
export function itemPreview(id: string): string {
  let u = previews.get(id);
  if (!u) { u = buildItem(id).toDataURL('image/png'); previews.set(id, u); }
  return u;
}

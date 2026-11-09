import { drawPlant, ellipse, fillRR, glow, heartPath, hex, makeCanvas, vgrad, type Ctx } from '../art/paint';
import { itemDef } from './data';

/*
 * Placeable items, drawn in code. Each is drawn with its base (the floor contact) at the bottom-centre of its box.
 * `perchY` is how high a cat sits on it (cat tree), `bedY` where a pet curls up.
 */

export const ITEM_SPOTS: Record<string, { perchY?: number; bedY?: number }> = {
  'cat-tree': { perchY: 168 }, 'pet-bed': { bedY: 10 }, 'pet-bed-heart': { bedY: 12 }, beanbag: { bedY: 30 }, 'heart-pillow': { bedY: 14 }, 'cushion-stack': { bedY: 24 },
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
  bookshelf: (ctx, w, h) => {
    const x = w / 2;
    ellipse(ctx, x, h - 5, w * 0.44, 8, 'rgba(60,30,40,0.2)');
    fillRR(ctx, 10, 8, w - 20, h - 16, 8, vgrad(ctx, 8, h, [[0, 0xc98e64], [1, 0x8c583d]]));
    fillRR(ctx, 18, 18, w - 36, h - 36, 4, '#f4dfc5');
    for (const y of [h * 0.38, h * 0.68]) {
      fillRR(ctx, 16, y, w - 32, 8, 3, '#9d6546');
      const colors = [0xe87d83, 0xf2c66d, 0x82b9a2, 0x879bd0, 0xb48ac7, 0xe7a075];
      let bx = 22;
      for (let i = 0; bx < w - 28; i++) {
        const bw = 10 + (i % 3) * 2;
        fillRR(ctx, bx, y - 28 - (i % 2) * 5, bw, 27 + (i % 2) * 5, 2, hex(colors[i % colors.length]));
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        ctx.fillRect(bx + 3, y - 22 - (i % 2) * 5, 1.5, 10);
        bx += bw + 3;
      }
    }
    fillRR(ctx, 7, h - 17, w - 14, 11, 4, '#744932');
  },
  'coffee-table': (ctx, w, h) => {
    const x = w / 2;
    ellipse(ctx, x, h - 5, w * 0.43, 7, 'rgba(60,30,40,0.2)');
    fillRR(ctx, 22, h - 48, 9, 43, 3, '#986343');
    fillRR(ctx, w - 31, h - 48, 9, 43, 3, '#986343');
    fillRR(ctx, 5, h - 57, w - 10, 19, 8, vgrad(ctx, h - 57, h - 38, [[0, 0xe8c08a], [1, 0xb87e53]]));
    ctx.strokeStyle = 'rgba(255,255,255,.38)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(16, h - 50); ctx.lineTo(w - 16, h - 50); ctx.stroke();
    fillRR(ctx, x - 19, h - 70, 38, 12, 4, '#f7e7d0');
    ellipse(ctx, x, h - 73, 16, 5, '#d78e98');
    ellipse(ctx, x, h - 74, 11, 3, '#fff0d9');
  },
  'side-table': (ctx, w, h) => {
    const x = w / 2;
    ellipse(ctx, x, h - 5, 27, 6, 'rgba(60,30,40,0.2)');
    fillRR(ctx, 17, h - 52, 7, 47, 3, '#986343');
    fillRR(ctx, w - 24, h - 52, 7, 47, 3, '#986343');
    fillRR(ctx, 5, h - 60, w - 10, 15, 5, '#d6a36f');
    fillRR(ctx, x - 17, h - 44, 34, 20, 3, '#c58a5d');
    fillRR(ctx, x - 2, h - 40, 4, 4, 2, '#f7d38a');
    fillRR(ctx, x - 4, h - 92, 8, 31, 3, '#f4dfc5');
    ctx.fillStyle = '#ff9cad';
    ctx.beginPath(); ctx.ellipse(x, h - 94, 24, 17, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
    for (const [dx, dy] of [[-12, -96], [1, -104], [13, -95]] as const) ellipse(ctx, x + dx, h + dy, 3, 3, '#fff2df');
  },
  vanity: (ctx, w, h) => {
    const x = w / 2;
    ellipse(ctx, x, h - 5, 48, 7, 'rgba(60,30,40,0.2)');
    fillRR(ctx, x - 36, 7, 72, 82, 30, '#b87584');
    fillRR(ctx, x - 29, 13, 58, 68, 25, '#c9e8ed');
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath(); ctx.moveTo(x - 16, 18); ctx.lineTo(x - 5, 18); ctx.lineTo(x - 22, 65); ctx.lineTo(x - 28, 65); ctx.closePath(); ctx.fill();
    fillRR(ctx, x - 5, 85, 10, 18, 3, '#c58b72');
    fillRR(ctx, 7, 103, w - 14, 18, 5, '#f2c5cf');
    fillRR(ctx, 15, 119, 8, h - 123, 3, '#b77b69');
    fillRR(ctx, w - 23, 119, 8, h - 123, 3, '#b77b69');
    fillRR(ctx, x - 31, 108, 62, 33, 5, '#f8d8dc');
    fillRR(ctx, x - 3, 120, 6, 5, 2, '#d49b65');
    fillRR(ctx, 5, 99, w - 10, 8, 4, '#fff0dc');
    for (const dx of [-38, 38]) {
      ellipse(ctx, x + dx, 95, 4, 4, '#ffd778');
      ellipse(ctx, x + dx, 95, 8, 8, '#ffd778');
    }
  },
  'flower-vase': (ctx, w, h) => {
    const x = w / 2;
    ellipse(ctx, x, h - 5, 24, 6, 'rgba(60,30,40,0.18)');
    ctx.strokeStyle = '#5c9b6b'; ctx.lineWidth = 3;
    for (const dx of [-13, 0, 13]) {
      ctx.beginPath(); ctx.moveTo(x, h - 35); ctx.quadraticCurveTo(x + dx, h - 61, x + dx, h - 77); ctx.stroke();
      const colors = ['#ff9bb5', '#ffd46f', '#b69be3'];
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        ellipse(ctx, x + dx + Math.cos(a) * 5, h - 78 + Math.sin(a) * 5, 4, 4, colors[(Math.abs(dx / 13) + i) % 3]);
      }
      ellipse(ctx, x + dx, h - 78, 3, 3, '#f5ba56');
    }
    ctx.fillStyle = vgrad(ctx, h - 37, h - 4, [[0, 0xffd5b0], [1, 0xd98987]]);
    ctx.beginPath(); ctx.moveTo(x - 9, h - 37); ctx.lineTo(x + 9, h - 37); ctx.lineTo(x + 17, h - 9); ctx.quadraticCurveTo(x, h, x - 17, h - 9); ctx.closePath(); ctx.fill();
    fillRR(ctx, x - 10, h - 42, 20, 7, 3, '#bf7880');
  },
  fireplace: (ctx, w, h) => {
    const x = w / 2;
    ellipse(ctx, x, h - 4, 58, 8, 'rgba(60,30,40,0.22)');
    fillRR(ctx, 7, 27, w - 14, h - 31, 12, vgrad(ctx, 27, h, [[0, 0xd99c78], [1, 0x985e54]]));
    fillRR(ctx, 0, 20, w, 18, 7, '#f3d9bd');
    fillRR(ctx, 16, h - 79, w - 32, 54, 18, '#583c46');
    glow(ctx, x, h - 49, 35, 0xff943e, 0.5);
    ctx.fillStyle = '#ff8b43';
    ctx.beginPath(); ctx.moveTo(x, h - 30); ctx.bezierCurveTo(x - 26, h - 44, x - 7, h - 56, x, h - 68); ctx.bezierCurveTo(x + 26, h - 49, x + 17, h - 40, x, h - 30); ctx.fill();
    ctx.fillStyle = '#ffe58e';
    ctx.beginPath(); ctx.moveTo(x, h - 32); ctx.bezierCurveTo(x - 12, h - 42, x - 2, h - 49, x + 1, h - 57); ctx.bezierCurveTo(x + 14, h - 45, x + 9, h - 38, x, h - 32); ctx.fill();
    for (const dx of [-48, 48]) {
      fillRR(ctx, x + dx - 11, 4, 22, 24, 10, '#ffdf9a');
      ellipse(ctx, x + dx, 15, 5, 5, '#f5a867');
    }
  },
  'record-player': (ctx, w, h) => {
    const x = w / 2;
    ellipse(ctx, x, h - 5, 34, 6, 'rgba(60,30,40,0.2)');
    fillRR(ctx, 5, h - 64, w - 10, 56, 9, vgrad(ctx, h - 64, h - 8, [[0, 0xe5b47c], [1, 0x9b6348]]));
    fillRR(ctx, 11, h - 59, w - 22, 46, 6, '#f4d8b7');
    ellipse(ctx, x - 3, h - 36, 18, 18, '#332c42');
    ellipse(ctx, x - 3, h - 36, 6, 6, '#d96c85');
    ellipse(ctx, x - 3, h - 36, 2, 2, '#f5d477');
    ctx.strokeStyle = '#765143'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 25, h - 54); ctx.lineTo(x + 13, h - 29); ctx.stroke();
    ellipse(ctx, x + 12, h - 28, 4, 4, '#765143');
    for (let i = 0; i < 3; i++) ellipse(ctx, 18 + i * 7, h - 53, 2, 2, '#e0787c');
  },
  'cushion-stack': (ctx, w, h) => {
    ellipse(ctx, w / 2, h - 5, 39, 7, 'rgba(60,30,40,0.18)');
    fillRR(ctx, 18, h - 45, w - 23, 34, 12, '#a7c7a0');
    fillRR(ctx, 5, h - 67, w - 28, 34, 12, '#e88da5');
    fillRR(ctx, 13, h - 62, w - 44, 23, 8, 'rgba(255,255,255,.24)');
    fillRR(ctx, 47, h - 60, 38, 26, 10, '#f2ca78');
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(w / 2, h - 63); ctx.lineTo(w / 2, h - 38); ctx.stroke();
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

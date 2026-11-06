import { Ctx, ellipse, fillRR, glow, heartPath, hex, makeCanvas, rr, shade, starPath, vgrad } from './paint';

/** Draws an icon into a square of size s with origin top-left. */
export function drawIcon(ctx: Ctx, key: string, s: number) {
  const c = s / 2;
  const u = s / 64; // unit
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (key) {
    case 'heart': {
      ctx.fillStyle = vgrad(ctx, 10 * u, 56 * u, [[0, 0xff8fb0], [1, 0xe0365e]]);
      heartPath(ctx, c, 12 * u, 44 * u); ctx.fill();
      ellipse(ctx, c - 10 * u, 24 * u, 5 * u, 7 * u, 'rgba(255,255,255,0.6)');
      break;
    }
    case 'petal': {
      ctx.translate(c, c); ctx.rotate(-0.5);
      ctx.beginPath();
      ctx.moveTo(0, -24 * u);
      ctx.bezierCurveTo(20 * u, -14 * u, 18 * u, 18 * u, 0, 24 * u);
      ctx.bezierCurveTo(-18 * u, 18 * u, -20 * u, -14 * u, 0, -24 * u);
      ctx.fillStyle = vgrad(ctx, -24 * u, 24 * u, [[0, 0xffd6e2], [1, 0xf58aaa]]); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2 * u;
      ctx.beginPath(); ctx.moveTo(0, -16 * u); ctx.lineTo(0, 16 * u); ctx.stroke();
      break;
    }
    case 'star': {
      ctx.fillStyle = vgrad(ctx, 6 * u, 58 * u, [[0, 0xfff3a0], [1, 0xf0b030]]);
      starPath(ctx, c, c + 2 * u, 26 * u, 0.48); ctx.fill();
      ctx.strokeStyle = '#fffbe0'; ctx.lineWidth = 2 * u; ctx.stroke();
      break;
    }
    case 'sparkle': {
      glow(ctx, c, c, 30 * u, 0xfff0ff, 0.7);
      ctx.fillStyle = '#ffffff';
      starPath(ctx, c, c, 26 * u, 0.18, 4); ctx.fill();
      ctx.fillStyle = '#ffd6f0';
      starPath(ctx, c + 16 * u, c - 16 * u, 8 * u, 0.2, 4); ctx.fill();
      break;
    }
    case 'note': {
      ctx.translate(c, c); ctx.rotate(-0.15);
      fillRR(ctx, -22 * u, -18 * u, 44 * u, 36 * u, 3 * u, '#fffbea');
      ctx.fillStyle = 'rgba(120,100,140,0.35)';
      for (let i = 0; i < 3; i++) ctx.fillRect(-15 * u, (-8 + i * 8) * u, 30 * u, 2 * u);
      ctx.fillStyle = '#ff7f9f'; heartPath(ctx, 12 * u, -16 * u, 12 * u); ctx.fill();
      break;
    }
    case 'letter': {
      fillRR(ctx, 8 * u, 16 * u, 48 * u, 34 * u, 4 * u, vgrad(ctx, 16 * u, 50 * u, [[0, 0xfff8f0], [1, 0xf0e0d0]]));
      ctx.strokeStyle = '#d8c0b0'; ctx.lineWidth = 2 * u;
      ctx.beginPath(); ctx.moveTo(9 * u, 18 * u); ctx.lineTo(c, 36 * u); ctx.lineTo(55 * u, 18 * u); ctx.stroke();
      ctx.fillStyle = '#e0365e'; heartPath(ctx, c, 28 * u, 14 * u); ctx.fill();
      break;
    }
    case 'cookie': {
      ellipse(ctx, c, c, 24 * u, 24 * u, vgrad(ctx, 8 * u, 56 * u, [[0, 0xe8b070], [1, 0xc88848]]));
      for (const [x, y] of [[-8, -8], [8, -4], [-4, 8], [10, 10], [0, -14]]) ellipse(ctx, c + x * u, c + y * u, 3.5 * u, 3 * u, '#5a3424');
      break;
    }
    case 'cocoa': {
      fillRR(ctx, 14 * u, 22 * u, 32 * u, 32 * u, 6 * u, vgrad(ctx, 22 * u, 54 * u, [[0, 0xffb3c8], [1, 0xe8809a]]));
      ctx.strokeStyle = '#e8809a'; ctx.lineWidth = 5 * u;
      ctx.beginPath(); ctx.arc(48 * u, 36 * u, 7 * u, -1.3, 1.3); ctx.stroke();
      ellipse(ctx, 30 * u, 24 * u, 15 * u, 4 * u, '#7a4a32');
      ctx.strokeStyle = 'rgba(200,180,180,0.8)'; ctx.lineWidth = 2.5 * u;
      for (const x of [24, 34]) { ctx.beginPath(); ctx.moveTo(x * u, 18 * u); ctx.bezierCurveTo((x - 5) * u, 12 * u, (x + 5) * u, 8 * u, x * u, 3 * u); ctx.stroke(); }
      break;
    }
    case 'bouquet': {
      ctx.beginPath(); ctx.moveTo(22 * u, 34 * u); ctx.lineTo(42 * u, 34 * u); ctx.lineTo(34 * u, 60 * u); ctx.lineTo(30 * u, 60 * u); ctx.closePath();
      ctx.fillStyle = '#f3e3c6'; ctx.fill();
      for (const [x, y, col] of [[22, 22, 0xff8fb0], [36, 18, 0xffd36a], [44, 28, 0xc8a0f0], [30, 30, 0xff6f7f], [16, 32, 0xffffff]] as [number, number, number][]) {
        for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2; ellipse(ctx, (x + Math.cos(a) * 5) * u, (y + Math.sin(a) * 5) * u, 4.5 * u, 4.5 * u, hex(col)); }
        ellipse(ctx, x * u, y * u, 3 * u, 3 * u, '#ffd050');
      }
      ctx.fillStyle = '#e0365e'; ctx.fillRect(26 * u, 40 * u, 12 * u, 4 * u);
      break;
    }
    case 'ribbon': {
      ctx.fillStyle = '#e0365e';
      ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(10 * u, 18 * u); ctx.lineTo(12 * u, 44 * u); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(54 * u, 18 * u); ctx.lineTo(52 * u, 44 * u); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(c - 3 * u, c); ctx.lineTo(22 * u, 58 * u); ctx.lineTo(28 * u, 58 * u); ctx.lineTo(c, c + 4 * u); ctx.lineTo(36 * u, 58 * u); ctx.lineTo(42 * u, 58 * u); ctx.lineTo(c + 3 * u, c); ctx.fill();
      ellipse(ctx, c, c, 6 * u, 6 * u, '#ff7f9f');
      break;
    }
    case 'polaroid': {
      ctx.translate(c, c); ctx.rotate(0.1);
      fillRR(ctx, -20 * u, -24 * u, 40 * u, 48 * u, 2 * u, '#fffdf8');
      ctx.fillStyle = vgrad(ctx, -20 * u, 12 * u, [[0, 0xffb3c8], [1, 0xa8d0f0]]);
      ctx.fillRect(-16 * u, -20 * u, 32 * u, 32 * u);
      ctx.fillStyle = '#ffffff'; heartPath(ctx, 0, -12 * u, 14 * u); ctx.fill();
      ctx.strokeStyle = '#e0d8d0'; ctx.lineWidth = 1.5 * u; ctx.strokeRect(-20 * u, -24 * u, 40 * u, 48 * u);
      break;
    }
    case 'pancake': {
      ellipse(ctx, c, 50 * u, 26 * u, 6 * u, '#ffffff');
      for (let i = 0; i < 3; i++) ellipse(ctx, c, (44 - i * 8) * u, 22 * u, 7 * u, hex(shade(0xe8b070, -i * 0.05)));
      ctx.fillStyle = '#a0522d'; ctx.beginPath(); ctx.ellipse(c, 26 * u, 18 * u, 5 * u, 0, 0, Math.PI * 2); ctx.fill();
      fillRR(ctx, c - 6 * u, 16 * u, 12 * u, 8 * u, 2 * u, '#fff3a0');
      break;
    }
    case 'coin': {
      ellipse(ctx, c, c, 24 * u, 24 * u, vgrad(ctx, 8 * u, 56 * u, [[0, 0xffe08a], [1, 0xe0a030]]));
      ellipse(ctx, c, c, 18 * u, 18 * u, '#f8c850');
      ctx.fillStyle = '#ffffff'; heartPath(ctx, c, 22 * u, 20 * u); ctx.fill();
      break;
    }
    case 'scroll': {
      fillRR(ctx, 14 * u, 12 * u, 36 * u, 42 * u, 3 * u, '#fff3dc');
      ellipse(ctx, 14 * u, 14 * u, 5 * u, 5 * u, '#e8c890'); ellipse(ctx, 50 * u, 52 * u, 5 * u, 5 * u, '#e8c890');
      ctx.fillStyle = 'rgba(120,90,80,0.5)'; for (let i = 0; i < 4; i++) ctx.fillRect(20 * u, (22 + i * 7) * u, 24 * u, 2.5 * u);
      ctx.fillStyle = '#e0365e'; heartPath(ctx, 40 * u, 40 * u, 10 * u); ctx.fill();
      break;
    }
    case 'key': {
      ellipse(ctx, 22 * u, 22 * u, 13 * u, 13 * u, '#f0c050');
      ellipse(ctx, 22 * u, 22 * u, 5 * u, 5 * u, '#fff8e8');
      ctx.strokeStyle = '#f0c050'; ctx.lineWidth = 7 * u;
      ctx.beginPath(); ctx.moveTo(30 * u, 30 * u); ctx.lineTo(52 * u, 52 * u); ctx.moveTo(44 * u, 44 * u); ctx.lineTo(50 * u, 38 * u); ctx.moveTo(50 * u, 50 * u); ctx.lineTo(56 * u, 44 * u); ctx.stroke();
      break;
    }
    case 'map': {
      ctx.beginPath(); ctx.moveTo(8 * u, 14 * u); ctx.lineTo(24 * u, 8 * u); ctx.lineTo(40 * u, 14 * u); ctx.lineTo(56 * u, 8 * u); ctx.lineTo(56 * u, 50 * u); ctx.lineTo(40 * u, 56 * u); ctx.lineTo(24 * u, 50 * u); ctx.lineTo(8 * u, 56 * u); ctx.closePath();
      ctx.fillStyle = '#fff3dc'; ctx.fill(); ctx.strokeStyle = '#d8b890'; ctx.lineWidth = 2 * u; ctx.stroke();
      ctx.setLineDash([3 * u, 3 * u]); ctx.strokeStyle = '#e0365e';
      ctx.beginPath(); ctx.moveTo(14 * u, 46 * u); ctx.quadraticCurveTo(30 * u, 20 * u, 44 * u, 28 * u); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#e0365e'; heartPath(ctx, 46 * u, 18 * u, 12 * u); ctx.fill();
      break;
    }
    case 'book': {
      fillRR(ctx, 12 * u, 10 * u, 40 * u, 46 * u, 4 * u, vgrad(ctx, 10 * u, 56 * u, [[0, 0xa58ad6], [1, 0x7a5ab0]]));
      ctx.fillStyle = '#fff8ee'; ctx.fillRect(16 * u, 50 * u, 36 * u, 5 * u);
      ctx.fillStyle = '#ffd6e2'; heartPath(ctx, 32 * u, 22 * u, 16 * u); ctx.fill();
      break;
    }
    case 'calendar': {
      fillRR(ctx, 10 * u, 14 * u, 44 * u, 42 * u, 5 * u, '#fffdf8');
      fillRR(ctx, 10 * u, 14 * u, 44 * u, 12 * u, 5 * u, '#e0365e');
      ctx.fillStyle = '#d8c8c0'; for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) ctx.fillRect((15 + k * 10) * u, (31 + r * 8) * u, 6 * u, 5 * u);
      ctx.fillStyle = '#e0365e'; heartPath(ctx, 40 * u, 37 * u, 10 * u); ctx.fill();
      break;
    }
    case 'moon': {
      ellipse(ctx, c, c, 22 * u, 22 * u, '#fff3c0');
      ctx.globalCompositeOperation = 'destination-out';
      ellipse(ctx, c + 12 * u, c - 8 * u, 18 * u, 18 * u, '#000');
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#fff3c0'; starPath(ctx, 48 * u, 44 * u, 5 * u); ctx.fill();
      break;
    }
    case 'gift': {
      fillRR(ctx, 12 * u, 26 * u, 40 * u, 30 * u, 3 * u, '#ff8fb0');
      fillRR(ctx, 9 * u, 18 * u, 46 * u, 10 * u, 3 * u, '#ffb3c8');
      ctx.fillStyle = '#ffd36a'; ctx.fillRect(29 * u, 18 * u, 6 * u, 38 * u);
      ellipse(ctx, 25 * u, 15 * u, 7 * u, 5 * u, '#ffd36a'); ellipse(ctx, 39 * u, 15 * u, 7 * u, 5 * u, '#ffd36a');
      break;
    }
    case 'ring': {
      ctx.strokeStyle = '#f0c050'; ctx.lineWidth = 6 * u;
      ctx.beginPath(); ctx.arc(c, 38 * u, 16 * u, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#d0f0ff'; ctx.beginPath(); ctx.moveTo(c, 28 * u); ctx.lineTo(22 * u, 18 * u); ctx.lineTo(26 * u, 10 * u); ctx.lineTo(38 * u, 10 * u); ctx.lineTo(42 * u, 18 * u); ctx.closePath(); ctx.fill();
      break;
    }
    case 'bed': {
      fillRR(ctx, 8 * u, 30 * u, 48 * u, 16 * u, 4 * u, '#c9b2ec');
      fillRR(ctx, 8 * u, 18 * u, 8 * u, 34 * u, 3 * u, '#f6f0ea');
      fillRR(ctx, 16 * u, 24 * u, 14 * u, 8 * u, 4 * u, '#ffffff');
      break;
    }
    case 'sofa': {
      fillRR(ctx, 10 * u, 20 * u, 44 * u, 18 * u, 6 * u, '#8aa6d6');
      fillRR(ctx, 6 * u, 32 * u, 52 * u, 16 * u, 5 * u, '#7a96c6');
      ctx.fillStyle = '#3a2a32'; ctx.fillRect(10 * u, 48 * u, 4 * u, 6 * u); ctx.fillRect(50 * u, 48 * u, 4 * u, 6 * u);
      break;
    }
    case 'cup': drawIcon(ctx, 'cocoa', s); break;
    case 'tree': {
      ctx.fillStyle = '#8a5a48'; ctx.fillRect(28 * u, 34 * u, 8 * u, 24 * u);
      for (const [x, y] of [[22, 26], [42, 26], [32, 16], [32, 30]]) ellipse(ctx, x * u, y * u, 13 * u, 11 * u, '#f7b8cc');
      break;
    }
    default: {
      ctx.fillStyle = '#ff8fb0'; heartPath(ctx, c, 12 * u, 40 * u); ctx.fill();
    }
  }
  ctx.restore();
}

const cache = new Map<string, string>();
export function iconURL(key: string, size = 64): string {
  const k = `${key}@${size}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const [cv, ctx] = makeCanvas(size, size);
  drawIcon(ctx, key, size);
  const url = cv.toDataURL('image/png');
  cache.set(k, url);
  return url;
}

export function iconCanvas(key: string, size = 64): HTMLCanvasElement {
  const [cv, ctx] = makeCanvas(size, size);
  drawIcon(ctx, key, size);
  return cv;
}

export function iconImg(key: string, size = 64, cls = 'ico'): string {
  return `<img class="${cls}" src="${iconURL(key, size)}" alt="" draggable="false">`;
}
void rr;

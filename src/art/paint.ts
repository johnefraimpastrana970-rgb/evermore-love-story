import type { TimeOfDay } from '../content/types';
import { rng } from '../core/rng';

export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

export function hex(n: number, a = 1): string {
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}

/** Lighten (amt>0) or darken (amt<0) a colour, amt in -1..1. */
export function shade(n: number, amt: number): number {
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt;
  } else {
    r *= 1 + amt; g *= 1 + amt; b *= 1 + amt;
  }
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function fillRR(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient) {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function vgrad(ctx: Ctx, y0: number, y1: number, stops: [number, number][], alpha = 1): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [t, c] of stops) g.addColorStop(t, hex(c, alpha));
  return g;
}

export function hgrad(ctx: Ctx, x0: number, x1: number, stops: [number, number][]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  for (const [t, c] of stops) g.addColorStop(t, hex(c));
  return g;
}

export function glow(ctx: Ctx, x: number, y: number, r: number, color: number, alpha = 0.5) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hex(color, alpha));
  g.addColorStop(1, hex(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function floorShadow(ctx: Ctx, x: number, y: number, w: number, alpha = 0.18) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, w / 2);
  g.addColorStop(0, `rgba(40,20,30,${alpha})`);
  g.addColorStop(1, 'rgba(40,20,30,0)');
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.18);
  ctx.translate(-x, -y);
  ctx.fillStyle = g;
  ctx.fillRect(x - w / 2, y - w / 2, w, w);
  ctx.restore();
}

export function heartPath(ctx: Ctx, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
  ctx.closePath();
}

export function starPath(ctx: Ctx, x: number, y: number, r: number, inner = 0.45, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ------------------------------------------------------------------- sky

export const SKY: Record<TimeOfDay, [number, number][]> = {
  morning: [[0, 0x8fbbe8], [0.6, 0xf6d3c8], [1, 0xffe1b8]],
  day: [[0, 0x4f9be6], [0.7, 0x9ed2f7], [1, 0xd4eefc]],
  sunset: [[0, 0x40387a], [0.45, 0xc0608a], [0.75, 0xff9468], [1, 0xffcf86]],
  night: [[0, 0x0a1030], [0.6, 0x1c2658], [1, 0x34407a]],
};

/** Ambient colour per time, used for room lighting overlays. */
export const AMBIENT: Record<TimeOfDay, { tint: number; alpha: number }> = {
  morning: { tint: 0xffe6d0, alpha: 0.12 },
  day: { tint: 0xffffff, alpha: 0 },
  sunset: { tint: 0xff9a70, alpha: 0.24 },
  night: { tint: 0x2a2c78, alpha: 0.72 },
};

export function drawSky(ctx: Ctx, x: number, y: number, w: number, h: number, time: TimeOfDay, seed = 'sky', bodies = true) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = vgrad(ctx, y, y + h, SKY[time]);
  ctx.fillRect(x, y, w, h);
  const r = rng(seed);
  if (time === 'night') {
    for (let i = 0; i < (w * h) / 900; i++) {
      const sx = x + r.next() * w, sy = y + r.next() * h * 0.85;
      const s = r.next() * 1.6 + 0.4;
      ctx.fillStyle = `rgba(255,255,240,${0.4 + r.next() * 0.6})`;
      ctx.fillRect(sx, sy, s, s);
    }
    if (bodies) {
      const mx = x + w * 0.72, my = y + h * 0.25, mr = Math.min(w, h) * 0.09 + 6;
      glow(ctx, mx, my, mr * 4, 0xfff6d8, 0.25);
      ellipse(ctx, mx, my, mr, mr, '#fff6dc');
      ellipse(ctx, mx + mr * 0.4, my - mr * 0.2, mr * 0.85, mr * 0.85, hex(0x1c2658, 0.0));
    }
  } else {
    // Clouds.
    const cloud = time === 'sunset' ? 0xffb8a8 : time === 'morning' ? 0xfff0ec : 0xffffff;
    for (let i = 0; i < Math.max(2, w / 160); i++) {
      const cx = x + r.next() * w, cy = y + h * (0.15 + r.next() * 0.45), cw = 40 + r.next() * 80;
      ctx.globalAlpha = 0.55 + r.next() * 0.3;
      for (let j = 0; j < 4; j++) ellipse(ctx, cx + (j - 1.5) * cw * 0.35, cy + (j % 2) * 4, cw * 0.4, cw * 0.22, hex(cloud));
      ctx.globalAlpha = 1;
    }
    if (bodies && (time === 'morning' || time === 'sunset')) {
      const sx = x + w * (time === 'morning' ? 0.25 : 0.7), sy = y + h * 0.82;
      glow(ctx, sx, sy, Math.min(w, h) * 0.6, time === 'morning' ? 0xffe8b0 : 0xffb070, 0.6);
      ellipse(ctx, sx, sy, 18, 18, time === 'morning' ? '#fff3cf' : '#ffd08a');
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------- room parts

export interface WallStyle {
  base: number;
  accent: number;
  pattern: 'stripes' | 'dots' | 'plain' | 'hearts' | 'tiles' | 'panel';
  wainscot?: number;
}

export function drawWall(ctx: Ctx, w: number, floorY: number, st: WallStyle) {
  ctx.fillStyle = vgrad(ctx, 0, floorY, [[0, shade(st.base, -0.06)], [1, shade(st.base, 0.06)]]);
  ctx.fillRect(0, 0, w, floorY);
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = hex(st.accent);
  if (st.pattern === 'stripes') {
    for (let x = 0; x < w; x += 46) ctx.fillRect(x, 0, 18, floorY);
  } else if (st.pattern === 'dots') {
    for (let y = 30; y < floorY; y += 44) for (let x = (y / 44) % 2 ? 22 : 0; x < w; x += 44) ellipse(ctx, x, y, 3.5, 3.5, hex(st.accent));
  } else if (st.pattern === 'hearts') {
    for (let y = 30; y < floorY - 40; y += 70) for (let x = (y / 70) % 2 ? 35 : 0; x < w; x += 70) { heartPath(ctx, x, y, 12); ctx.fill(); }
  } else if (st.pattern === 'tiles') {
    ctx.globalAlpha = 0.25;
    for (let y = 0; y < floorY; y += 34) {
      ctx.fillRect(0, y, w, 2);
      for (let x = (y / 34) % 2 ? 0 : 24; x < w; x += 48) ctx.fillRect(x, y, 2, 34);
    }
  } else if (st.pattern === 'panel') {
    for (let x = 0; x < w; x += 160) ctx.fillRect(x, 0, 3, floorY);
  }
  ctx.restore();
  // Crown moulding
  ctx.fillStyle = hex(shade(st.base, 0.35));
  ctx.fillRect(0, 0, w, 14);
  ctx.fillStyle = hex(shade(st.base, -0.15), 0.5);
  ctx.fillRect(0, 14, w, 3);
  if (st.wainscot !== undefined) {
    const wy = floorY - 130;
    ctx.fillStyle = vgrad(ctx, wy, floorY, [[0, shade(st.wainscot, 0.08)], [1, shade(st.wainscot, -0.05)]]);
    ctx.fillRect(0, wy, w, 130);
    ctx.fillStyle = hex(shade(st.wainscot, 0.3));
    ctx.fillRect(0, wy - 8, w, 10);
    ctx.fillStyle = hex(shade(st.wainscot, -0.2), 0.35);
    for (let x = 20; x < w; x += 120) {
      rr(ctx, x, wy + 18, 96, 90, 6);
      ctx.strokeStyle = hex(shade(st.wainscot, -0.18), 0.6);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  // Baseboard
  ctx.fillStyle = hex(0xf6efe6);
  ctx.fillRect(0, floorY - 16, w, 16);
  ctx.fillStyle = 'rgba(80,50,50,0.15)';
  ctx.fillRect(0, floorY - 2, w, 2);
}

export function drawFloor(ctx: Ctx, w: number, y0: number, h: number, kind: 'wood' | 'tile' | 'carpet' | 'grass' | 'school', color: number) {
  ctx.fillStyle = vgrad(ctx, y0, y0 + h, [[0, shade(color, -0.12)], [1, shade(color, 0.06)]]);
  ctx.fillRect(0, y0, w, h);
  const r = rng('floor' + kind + w);
  if (kind === 'wood') {
    for (let y = y0; y < y0 + h; y += 0) {
      const ph = 14 + (y - y0) * 0.12;
      ctx.fillStyle = 'rgba(60,30,20,0.18)';
      ctx.fillRect(0, y, w, 1.5);
      let x = r.next() * 200;
      while (x < w) {
        ctx.fillRect(x, y, 1.5, ph);
        x += 140 + r.next() * 160;
      }
      ctx.fillStyle = `rgba(255,240,220,${0.04 + r.next() * 0.05})`;
      ctx.fillRect(0, y + 2, w, ph * 0.3);
      y += ph;
    }
  } else if (kind === 'tile' || kind === 'school') {
    const size = kind === 'school' ? 70 : 56;
    for (let y = y0, row = 0; y < y0 + h; row++) {
      const th = 16 + (y - y0) * 0.14;
      for (let x = 0, col = 0; x < w; x += size, col++) {
        if ((row + col) % 2 === 0) {
          ctx.fillStyle = kind === 'school' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.18)';
          ctx.fillRect(x, y, size, th);
        }
      }
      ctx.fillStyle = 'rgba(60,40,40,0.12)';
      ctx.fillRect(0, y, w, 1);
      y += th;
    }
  } else if (kind === 'carpet') {
    for (let i = 0; i < w * h / 60; i++) {
      ctx.fillStyle = `rgba(255,255,255,${r.next() * 0.05})`;
      ctx.fillRect(r.next() * w, y0 + r.next() * h, 2, 2);
    }
  } else if (kind === 'grass') {
    for (let i = 0; i < w * h / 25; i++) {
      const gx = r.next() * w, gy = y0 + r.next() * h;
      const depth = (gy - y0) / h;
      ctx.strokeStyle = hex(shade(color, -0.25 + r.next() * 0.4), 0.5);
      ctx.lineWidth = 1 + depth;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + (r.next() - 0.5) * 6, gy - 4 - depth * 8);
      ctx.stroke();
    }
  }
  // Soft shadow along the wall line.
  ctx.fillStyle = vgrad(ctx, y0, y0 + 40, [[0, 0x40202a]], 0.0);
  const g = ctx.createLinearGradient(0, y0, 0, y0 + 40);
  g.addColorStop(0, 'rgba(60,30,40,0.25)');
  g.addColorStop(1, 'rgba(60,30,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, w, 40);
}

export function drawWindow(
  ctx: Ctx, x: number, y: number, w: number, h: number, time: TimeOfDay,
  opts: { frame?: number; curtain?: number; seed?: string; view?: (ctx: Ctx) => void; cols?: number; rows?: number } = {},
) {
  const frame = opts.frame ?? 0xfbf6ef;
  // light spill on wall
  if (time !== 'night') glow(ctx, x + w / 2, y + h / 2, Math.max(w, h) * 0.9, 0xfff4dc, 0.25);
  ctx.save();
  rr(ctx, x, y, w, h, 6);
  ctx.clip();
  drawSky(ctx, x, y, w, h, time, opts.seed ?? `win${x}`);
  opts.view?.(ctx);
  // glass sheen
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.7);
  ctx.lineTo(x + w * 0.5, y);
  ctx.lineTo(x + w * 0.65, y);
  ctx.lineTo(x, y + h * 0.95);
  ctx.fill();
  ctx.restore();
  // Frame
  ctx.strokeStyle = hex(frame);
  ctx.lineWidth = 10;
  rr(ctx, x, y, w, h, 6);
  ctx.stroke();
  ctx.lineWidth = 6;
  const cols = opts.cols ?? 2, rows = opts.rows ?? 2;
  ctx.beginPath();
  for (let i = 1; i < cols; i++) { ctx.moveTo(x + (w * i) / cols, y); ctx.lineTo(x + (w * i) / cols, y + h); }
  for (let i = 1; i < rows; i++) { ctx.moveTo(x, y + (h * i) / rows); ctx.lineTo(x + w, y + (h * i) / rows); }
  ctx.stroke();
  // sill
  fillRR(ctx, x - 16, y + h + 2, w + 32, 14, 4, hex(shade(frame, -0.04)));
  ctx.fillStyle = 'rgba(60,30,40,0.15)';
  ctx.fillRect(x - 14, y + h + 16, w + 28, 5);
  if (opts.curtain !== undefined) drawCurtains(ctx, x, y, w, h, opts.curtain);
}

export function drawCurtains(ctx: Ctx, x: number, y: number, w: number, h: number, color: number) {
  // rod
  fillRR(ctx, x - 40, y - 26, w + 80, 8, 4, '#b48a5a');
  ellipse(ctx, x - 42, y - 22, 8, 8, '#c89a64');
  ellipse(ctx, x + w + 42, y - 22, 8, 8, '#c89a64');
  for (const side of [0, 1]) {
    const cx = side === 0 ? x - 34 : x + w + 34;
    const dir = side === 0 ? 1 : -1;
    const cw = w * 0.32;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, y - 22);
    ctx.lineTo(cx + dir * cw, y - 22);
    ctx.quadraticCurveTo(cx + dir * cw * 0.45, y + h * 0.45, cx + dir * cw * 0.65, y + h + 40);
    ctx.lineTo(cx - dir * 6, y + h + 40);
    ctx.closePath();
    const g = ctx.createLinearGradient(cx, 0, cx + dir * cw, 0);
    for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, hex(shade(color, i % 2 ? -0.12 : 0.1)));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    // tie-back
    fillRR(ctx, cx + dir * cw * 0.25 - 14, y + h * 0.48, 28, 8, 4, hex(shade(color, -0.3)));
  }
}

export function drawPlant(ctx: Ctx, x: number, baseY: number, scale = 1, pot = 0xd98c6a) {
  const s = scale;
  const r = rng('plant' + x);
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (r.next() - 0.5) * 2.2;
    const len = (50 + r.next() * 40) * s;
    const ex = x + Math.cos(a) * len, ey = baseY - 50 * s + Math.sin(a) * len;
    ctx.strokeStyle = '#4c8a55';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(x, baseY - 46 * s);
    ctx.quadraticCurveTo(x + (ex - x) * 0.3, ey + 20 * s, ex, ey);
    ctx.stroke();
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(a + Math.PI / 2);
    ellipse(ctx, 0, 0, 9 * s, 20 * s, i % 2 ? '#5fae6a' : '#4f9a5c');
    ctx.restore();
  }
  ctx.beginPath();
  ctx.moveTo(x - 26 * s, baseY - 50 * s);
  ctx.lineTo(x + 26 * s, baseY - 50 * s);
  ctx.lineTo(x + 20 * s, baseY);
  ctx.lineTo(x - 20 * s, baseY);
  ctx.closePath();
  ctx.fillStyle = vgrad(ctx, baseY - 50 * s, baseY, [[0, shade(pot, 0.1)], [1, shade(pot, -0.15)]]);
  ctx.fill();
  fillRR(ctx, x - 29 * s, baseY - 56 * s, 58 * s, 10 * s, 3, hex(shade(pot, 0.15)));
}

export function drawBooks(ctx: Ctx, x: number, y: number, w: number, h: number, seed: string) {
  const r = rng(seed);
  let bx = x;
  const colors = [0xd46a7e, 0x6a8fd4, 0xe8b65a, 0x7bc49a, 0xa98ad6, 0xf0a0b8, 0x8a6a5a, 0xf3e3c6];
  while (bx < x + w - 6) {
    const bw = 8 + r.next() * 10;
    const bh = h * (0.7 + r.next() * 0.3);
    const lean = r.next() < 0.1;
    const c = r.pick(colors);
    ctx.save();
    if (lean) {
      ctx.translate(bx, y + h);
      ctx.rotate(-0.25);
      ctx.translate(-bx, -(y + h));
    }
    fillRR(ctx, bx, y + h - bh, bw, bh, 2, vgrad(ctx, y, y + h, [[0, shade(c, 0.1)], [1, shade(c, -0.1)]]));
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(bx + 1, y + h - bh + 6, bw - 2, 2);
    ctx.restore();
    bx += bw + 1 + (lean ? 10 : 0);
  }
}

export function drawFrame(ctx: Ctx, x: number, y: number, w: number, h: number, frame: number, art: (ctx: Ctx, x: number, y: number, w: number, h: number) => void) {
  ctx.fillStyle = 'rgba(60,30,40,0.18)';
  ctx.fillRect(x + 5, y + 6, w, h);
  fillRR(ctx, x, y, w, h, 3, hex(frame));
  fillRR(ctx, x + 6, y + 6, w - 12, h - 12, 2, hex(shade(frame, -0.2)));
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 9, y + 9, w - 18, h - 18);
  ctx.clip();
  art(ctx, x + 9, y + 9, w - 18, h - 18);
  ctx.restore();
}

/** A small painted landscape used inside frames & as the default puzzle picture. */
export function paintLandscape(ctx: Ctx, x: number, y: number, w: number, h: number, seed = 'land') {
  drawSky(ctx, x, y, w, h * 0.7, 'sunset', seed);
  ctx.fillStyle = vgrad(ctx, y + h * 0.55, y + h, [[0, 0x6a4f8a], [1, 0x3b2e5a]]);
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.7);
  ctx.quadraticCurveTo(x + w * 0.3, y + h * 0.5, x + w * 0.55, y + h * 0.68);
  ctx.quadraticCurveTo(x + w * 0.8, y + h * 0.55, x + w, y + h * 0.66);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.fill();
  ctx.fillStyle = vgrad(ctx, y + h * 0.75, y + h, [[0, 0xe07a9a], [1, 0x9a4a7a]]);
  ctx.fillRect(x, y + h * 0.8, w, h * 0.2);
  ctx.fillStyle = '#ffe0ea';
  heartPath(ctx, x + w * 0.5, y + h * 0.25, Math.min(w, h) * 0.22);
  ctx.globalAlpha = 0.8;
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function drawDoor(ctx: Ctx, x: number, y: number, w: number, h: number, color: number, opts: { glass?: boolean; arch?: boolean; open?: boolean } = {}) {
  ctx.fillStyle = hex(0xf6efe6);
  fillRR(ctx, x - 10, y - 10, w + 20, h + 10, 6, '#f6efe6');
  if (opts.arch) {
    // Open archway showing a hint of the next room.
    ctx.fillStyle = vgrad(ctx, y, y + h, [[0, 0xf2d6c0], [1, 0xd8b49a]]);
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(80,40,40,0.18)';
    ctx.fillRect(x, y, 14, h);
    ctx.fillRect(x, y, w, 10);
    return;
  }
  ctx.fillStyle = vgrad(ctx, y, y + h, [[0, shade(color, 0.08)], [1, shade(color, -0.1)]]);
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = hex(shade(color, -0.2));
  ctx.lineWidth = 3;
  if (opts.glass) {
    fillRR(ctx, x + 16, y + 18, w - 32, h * 0.38, 4, 'rgba(200,230,255,0.75)');
    ctx.strokeRect(x + 16, y + 18, w - 32, h * 0.38);
  } else {
    ctx.strokeRect(x + 14, y + 18, w - 28, h * 0.38);
  }
  ctx.strokeRect(x + 14, y + h * 0.5, w - 28, h * 0.42);
  ellipse(ctx, x + w - 18, y + h * 0.52, 6, 6, '#e8c070');
  ellipse(ctx, x + w - 19, y + h * 0.515, 2.5, 2.5, '#fff3c8');
}

export function drawRug(ctx: Ctx, cx: number, cy: number, rw: number, rh: number, color: number, accent: number) {
  ellipse(ctx, cx, cy, rw, rh, hex(shade(color, -0.1)));
  ellipse(ctx, cx, cy, rw * 0.92, rh * 0.86, hex(color));
  ctx.strokeStyle = hex(accent, 0.7);
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rw * 0.75, rh * 0.68, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawStringLights(ctx: Ctx, x0: number, x1: number, y: number, sag: number, lit: boolean, seed = 'lights') {
  ctx.strokeStyle = 'rgba(70,50,50,0.6)';
  ctx.lineWidth = 1.5;
  const segs = Math.max(2, Math.round((x1 - x0) / 160));
  const r = rng(seed);
  const colors = [0xffd27a, 0xff9ab8, 0xa8e0ff, 0xc8ffb0];
  for (let s = 0; s < segs; s++) {
    const a = x0 + ((x1 - x0) * s) / segs, b = x0 + ((x1 - x0) * (s + 1)) / segs;
    ctx.beginPath();
    ctx.moveTo(a, y);
    ctx.quadraticCurveTo((a + b) / 2, y + sag * 2, b, y);
    ctx.stroke();
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      const px = a + (b - a) * t;
      const py = y + 2 * sag * 2 * t * (1 - t) * 1;
      const c = r.pick(colors);
      if (lit) glow(ctx, px, py + 6, 22, c, 0.45);
      ellipse(ctx, px, py + 6, 4, 6, lit ? hex(shade(c, 0.4)) : hex(shade(c, -0.3)));
    }
  }
}

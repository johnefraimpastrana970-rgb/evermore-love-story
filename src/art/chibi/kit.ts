import { hex, mix, shade, type Ctx } from '../paint';
import { DEFAULT_STYLE, type OutfitStyle } from './spec';

// Older Android WebViews lack CanvasRenderingContext2D.roundRect (Chrome < 99): add a simple one.
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (this: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r?: number | DOMPointInit | Iterable<number | DOMPointInit>) {
    const rad = Math.min(typeof r === 'number' ? r : 0, Math.abs(w) / 2, Math.abs(h) / 2);
    this.moveTo(x + rad, y);
    this.arcTo(x + w, y, x + w, y + h, rad);
    this.arcTo(x + w, y + h, x, y + h, rad);
    this.arcTo(x, y + h, x, y, rad);
    this.arcTo(x, y, x + w, y, rad);
    this.closePath();
  };
}

/** What a character is wearing (from the equipped cosmetics). */
export interface Look {
  who: 'her' | 'him';
  hair: number;
  outfit: number;
  accent: number;
  style?: OutfitStyle | 'tee' | 'dress' | 'raglan';
  /** Her hair accessory. */
  acc?: 'bow' | 'crown';
}

/**
 * Colour tokens for one character: every shade the rig paints with is derived here, in one place, from the
 * equipped colours (the canvas equivalent of CSS custom properties).
 */
export interface Palette {
  her: boolean;
  style: OutfitStyle;
  skin: number; skinLight: number; skinShade: number; skinDeep: number;
  blush: string;
  lip: number; mouth: number; tongue: number;
  lash: number; brow: number; iris: number;
  hair: number; hairHi: number; hairLo: number; hairLine: number;
  outfit: number; outfitHi: number; outfitLo: number; outfitLine: number;
  accent: number; accentLo: number;
  /** Soft warm line colour used for outlines (never pure black: keeps the hand-drawn feel). */
  ink: string;
}

export function palette(look: Look): Palette {
  const her = look.who === 'her';
  const skin = her ? 0xffe3d2 : 0xf3cdb0;
  const hair = look.hair;
  const style = (look.style ?? DEFAULT_STYLE[look.who]) as OutfitStyle;
  const lightHair = brightness(hair) > 0.55;
  return {
    her, style,
    skin, skinLight: shade(skin, 0.35), skinShade: her ? 0xf5c3b0 : 0xe2ab8c, skinDeep: her ? 0xd9907e : 0xc27f62,
    blush: her ? '255,120,150' : '240,120,120',
    lip: her ? 0xb34f60 : 0xa45a5a, mouth: 0x7d2c3c, tongue: 0xf2879a,
    lash: lightHair ? 0x4a3036 : mix(shade(hair, -0.55), 0x2a1418, 0.5),
    brow: lightHair ? shade(hair, -0.35) : shade(hair, -0.1),
    iris: her ? 0x6a4030 : 0x4e3a36,
    hair, hairHi: shade(hair, lightHair ? 0.35 : 0.42), hairLo: shade(hair, -0.3), hairLine: shade(hair, lightHair ? -0.3 : -0.55),
    outfit: look.outfit, outfitHi: shade(look.outfit, 0.14), outfitLo: shade(look.outfit, -0.16), outfitLine: shade(look.outfit, -0.45),
    accent: look.accent, accentLo: shade(look.accent, -0.3),
    ink: 'rgba(110,60,70,0.55)',
  };
}

export function brightness(n: number) {
  return ((n >> 16 & 255) * 0.299 + (n >> 8 & 255) * 0.587 + (n & 255) * 0.114) / 255;
}

/** Fill the current path, then outline it with a soft line a little darker than the fill. */
export function ink(ctx: Ctx, fill: string | CanvasGradient, line: string | number, width = 1.2) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = typeof line === 'number' ? hex(line, 0.75) : line;
  ctx.stroke();
}

/** A soft stroke (folds, strands, creases). */
export function line(ctx: Ctx, color: string, width: number, draw: () => void) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  draw();
  ctx.stroke();
  ctx.restore();
}

/** Vertical gradient between two colours. */
export function vg(ctx: Ctx, y0: number, y1: number, top: number, bottom: number, mid?: number) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, hex(top));
  if (mid !== undefined) g.addColorStop(0.5, hex(mid));
  g.addColorStop(1, hex(bottom));
  return g;
}

/** Horizontal gradient: light on the left (the key light), shaded on the right edge. */
export function hg(ctx: Ctx, x0: number, x1: number, light: number, base: number, dark: number) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, hex(base));
  g.addColorStop(0.3, hex(light));
  g.addColorStop(0.75, hex(base));
  g.addColorStop(1, hex(dark));
  return g;
}

/** A hair lock: a tapered, slightly curved shape from a root (two points) down to a tip. */
export function lock(ctx: Ctx, ax: number, ay: number, bx: number, by: number, tx: number, ty: number, bulge = 4) {
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const nx = tx - mx, ny = ty - my;
  const len = Math.hypot(nx, ny) || 1;
  const px = -ny / len * bulge, py = nx / len * bulge;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo((ax + tx) / 2 + px, (ay + ty) / 2 + py, tx, ty);
  ctx.quadraticCurveTo((bx + tx) / 2 + px * 0.6, (by + ty) / 2 + py * 0.6, bx, by);
  ctx.closePath();
}

/** Four-point sparkle. */
export function sparkle(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.18, y - r * 0.18, x + r, y);
  ctx.quadraticCurveTo(x + r * 0.18, y + r * 0.18, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.18, y + r * 0.18, x - r, y);
  ctx.quadraticCurveTo(x - r * 0.18, y - r * 0.18, x, y - r);
  ctx.fillStyle = color;
  ctx.fill();
}

/** Teardrop pointing up, its round end at (x, y). */
export function drop(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r * 2.2);
  ctx.bezierCurveTo(x + r * 0.4, y - r * 1.2, x + r, y - r * 0.6, x + r, y);
  ctx.arc(x, y, r, 0, Math.PI);
  ctx.bezierCurveTo(x - r, y - r * 0.6, x - r * 0.4, y - r * 1.2, x, y - r * 2.2);
  ctx.closePath();
}

export { hex, shade, mix };

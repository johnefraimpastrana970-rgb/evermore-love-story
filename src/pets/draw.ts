import { ellipse, hex, makeCanvas, rr, shade, type Ctx } from '../art/paint';
import type { BreedDef } from './data';

/*
 * Chibi cats and dogs, drawn in code from the breed data (side view, facing right; the sprite is mirrored to face left).
 * One small sheet per breed: idle ×4, blink, walk ×6, sit ×2, sleep ×2, eat ×2, happy ×2.
 */

export const PET_W = 112;
export const PET_H = 92;
const IDLE = 4, WALK = 6;
export const PET_FRAMES = (() => {
  let i = 0;
  const run = (n: number) => Array.from({ length: n }, () => i++);
  return { idle: run(IDLE), blink: run(1)[0], walk: run(WALK), sit: run(2), sleep: run(2), eat: run(2), happy: run(2), get total() { return i; } };
})();

type Mode = 'stand' | 'sit' | 'sleep' | 'eat';
interface PetPose { mode: Mode; leg?: number; bob?: number; tail?: number; eyes?: 'open' | 'closed' | 'happy'; tongue?: boolean }

const FOOT = PET_H - 6;

function ear(ctx: Ctx, b: BreedDef, x: number, y: number, side: number, inner: boolean) {
  const c = b.pattern === 'points' ? b.patch : b.coat;
  ctx.fillStyle = hex(c);
  ctx.beginPath();
  if (b.ears === 'floppy') {
    ctx.ellipse(x + side * 3, y + 10, 6.5, 12, side * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = hex(b.pattern === 'spots' || b.pattern === 'solid' ? shade(b.ear, 0) : c);
    ctx.fill();
    return;
  }
  const h = b.ears === 'round' ? 10 : 14;
  ctx.moveTo(x - 7, y + 4); ctx.quadraticCurveTo(x + side * 1, y - h - 2, x + 3 + side * 2, y - h); ctx.quadraticCurveTo(x + 8, y - 2, x + 8, y + 5); ctx.closePath();
  ctx.fill();
  if (inner) {
    ctx.fillStyle = hex(b.ear);
    ctx.beginPath(); ctx.moveTo(x - 3, y + 3); ctx.quadraticCurveTo(x + side, y - h + 4, x + 3 + side * 2, y - h + 5); ctx.quadraticCurveTo(x + 5, y, x + 5, y + 4); ctx.closePath(); ctx.fill();
  }
}

function tail(ctx: Ctx, b: BreedDef, x: number, y: number, wag: number, mode: Mode) {
  const c = b.pattern === 'points' || b.pattern === 'tuxedo' && b.species === 'cat' ? b.patch : b.coat;
  ctx.strokeStyle = hex(c); ctx.fillStyle = hex(c); ctx.lineCap = 'round';
  if (mode === 'sleep') {
    ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.quadraticCurveTo(x + 10, y + 22, x + 46, y + 20); ctx.stroke();
    return;
  }
  if (b.tail === 'stub') { ellipse(ctx, x - 2, y - 2 + wag, 6, 5, hex(c)); return; }
  if (b.tail === 'curl') {
    ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(x - 2, y - 12 + wag * 0.3, 9, Math.PI * 0.5, Math.PI * 2.1); ctx.stroke();
    ellipse(ctx, x + 6, y - 10, 4, 4, hex(b.belly));
    return;
  }
  if (b.tail === 'fluffy') {
    for (let i = 0; i < 4; i++) ellipse(ctx, x - 6 - i * 2 + wag * (i / 4), y - 6 - i * 7, 9 - i, 8 - i * 0.6, hex(shade(c, i * 0.03)));
    return;
  }
  ctx.lineWidth = b.species === 'dog' ? 6 : 6.5;
  ctx.beginPath(); ctx.moveTo(x + 4, y); ctx.bezierCurveTo(x - 14, y - 2, x - 16 + wag, y - 24, x - 6 + wag * 1.6, y - 34); ctx.stroke();
  if (b.pattern === 'tabby') {
    ctx.strokeStyle = hex(b.patch); ctx.lineWidth = 2.4;
    for (const t of [0.35, 0.6, 0.85]) { const yy = y - 34 * t; ctx.beginPath(); ctx.moveTo(x - 12 + wag * t - 4, yy); ctx.lineTo(x - 12 + wag * t + 4, yy - 1); ctx.stroke(); }
  }
}

/** One pet in one pose, feet on the bottom of a PET_W×PET_H box, facing right. */
export function drawPet(ctx: Ctx, b: BreedDef, p: PetPose) {
  const dog = b.species === 'dog';
  const bob = p.bob ?? 0;
  const leg = p.leg ?? 0;
  const wag = p.tail ?? 0;
  ctx.save();
  // Scale around the feet so every breed stands on the same floor line.
  ctx.translate(PET_W / 2, FOOT);
  ctx.scale(b.size, b.size);
  ctx.translate(-PET_W / 2, -FOOT);
  const coat = hex(b.coat), belly = hex(b.belly), dark = hex(shade(b.coat, -0.18));
  const mode = p.mode;
  // Body geometry per pose.
  const bx = mode === 'sit' ? 50 : 50, by = mode === 'sit' ? 58 + bob : mode === 'sleep' ? 72 : 60 + bob;
  const hx = mode === 'sit' ? 64 : mode === 'sleep' ? 76 : mode === 'eat' ? 80 : 78;
  const hy = mode === 'sit' ? 32 + bob : mode === 'sleep' ? 68 : mode === 'eat' ? 62 : 42 + bob;

  tail(ctx, b, mode === 'sit' ? 38 : 26, mode === 'sit' ? 76 : by - 6, wag, mode);

  // Back legs (behind body).
  if (mode === 'stand' || mode === 'eat') {
    const legs: [number, number][] = [[33, -leg], [43, leg], [62, leg], [70, -leg]];
    legs.forEach(([lx, ph], i) => {
      const far = i === 1 || i === 2;
      const sw = ph * 4, lift = Math.max(0, ph) * 3;
      ctx.fillStyle = far ? dark : (b.pattern === 'tuxedo' || b.pattern === 'points' ? hex(b.pattern === 'points' ? b.patch : b.belly) : coat);
      rr(ctx, lx - 4 + sw, by + 4, 8.5, FOOT - by - 4 - lift, 4); ctx.fill();
      ellipse(ctx, lx + sw + 0.5, FOOT - lift - 1, 5, 3, far ? dark : b.pattern === 'tuxedo' ? belly : coat);
    });
  }

  // Body.
  ctx.fillStyle = coat;
  ctx.beginPath();
  if (mode === 'sit') ctx.ellipse(bx, by, 19, 24, -0.15, 0, Math.PI * 2);
  else if (mode === 'sleep') ctx.ellipse(bx, by, 32, 15, 0, 0, Math.PI * 2);
  else ctx.ellipse(bx, by, dog ? 27 : 25, dog ? 17 : 15, 0, 0, Math.PI * 2);
  ctx.fill();
  if (b.fluffy) {
    ctx.fillStyle = coat;
    const rx = mode === 'sit' ? 19 : mode === 'sleep' ? 32 : 26, ry = mode === 'sit' ? 24 : mode === 'sleep' ? 15 : 16;
    for (let a = 0; a < Math.PI * 2; a += 0.55) ellipse(ctx, bx + Math.cos(a) * rx * 0.95, by + Math.sin(a) * ry * 0.95, 5.5, 5, coat);
  }
  // Belly / chest.
  ellipse(ctx, mode === 'sit' ? bx + 6 : bx + 8, mode === 'sit' ? by + 4 : by + 6, mode === 'sit' ? 10 : 15, mode === 'sit' ? 15 : 8, belly);
  // Coat patterns.
  ctx.save();
  ctx.beginPath();
  if (mode === 'sit') ctx.ellipse(bx, by, 19, 24, -0.15, 0, Math.PI * 2); else ctx.ellipse(bx, by, mode === 'sleep' ? 32 : 26, mode === 'sleep' ? 15 : 16, 0, 0, Math.PI * 2);
  ctx.clip();
  if (b.pattern === 'tabby') { ctx.strokeStyle = hex(b.patch); ctx.lineWidth = 3; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(bx + i * 9 - 3, by - 18); ctx.quadraticCurveTo(bx + i * 9 + 2, by - 6, bx + i * 9 - 2, by + 2); ctx.stroke(); } }
  if (b.pattern === 'calico') { ellipse(ctx, bx - 10, by - 7, 11, 8, hex(b.patch)); ellipse(ctx, bx + 12, by - 10, 8, 6, '#3a3440'); }
  if (b.pattern === 'spots') for (const [sx, sy, r] of [[-12, -6, 4], [2, -10, 3], [12, -4, 3.5], [-4, 2, 2.5], [-18, 2, 3]] as const) ellipse(ctx, bx + sx, by + sy, r, r * 0.9, hex(b.patch));
  if (b.pattern === 'tuxedo' && b.species === 'dog') ellipse(ctx, bx + 2, by + 9, 22, 8, belly);
  ctx.restore();

  // Front legs in sit / sleep (in front of the body).
  if (mode === 'sit') {
    for (const lx of [58, 66]) { ctx.fillStyle = b.pattern === 'tuxedo' ? belly : b.pattern === 'points' ? hex(b.patch) : coat; rr(ctx, lx - 4, by + 4, 8.5, FOOT - by - 4, 4); ctx.fill(); }
    ellipse(ctx, 60, FOOT - 1, 6, 3, b.pattern === 'tuxedo' ? belly : coat); ellipse(ctx, 68, FOOT - 1, 6, 3, b.pattern === 'tuxedo' ? belly : coat);
  }
  if (mode === 'sleep') { ellipse(ctx, 86, FOOT - 3, 9, 4.5, b.pattern === 'tuxedo' ? belly : coat); }

  // Head.
  const headR = dog ? 17.5 : 17;
  ear(ctx, b, hx - 10, hy - headR + 6, -1, true);
  ctx.fillStyle = b.pattern === 'points' ? hex(shade(b.coat, -0.05)) : coat;
  ctx.beginPath(); ctx.ellipse(hx, hy, headR + 1, headR, 0, 0, Math.PI * 2); ctx.fill();
  if (b.fluffy) for (let a = Math.PI * 0.6; a < Math.PI * 2.4; a += 0.5) ellipse(ctx, hx + Math.cos(a) * headR, hy + Math.sin(a) * headR, 4.5, 4.5, coat);
  ear(ctx, b, hx + 6, hy - headR + 5, 1, true);
  if (b.pattern === 'points') ellipse(ctx, hx + 7, hy + 5, 11, 9, hex(b.patch));
  if (b.pattern === 'tabby') { ctx.strokeStyle = hex(b.patch); ctx.lineWidth = 2.2; for (const dx of [-4, 1, 6]) { ctx.beginPath(); ctx.moveTo(hx + dx, hy - headR + 3); ctx.lineTo(hx + dx + 1, hy - headR + 9); ctx.stroke(); } }
  if (b.pattern === 'calico') ellipse(ctx, hx - 7, hy - 7, 8, 7, hex(b.patch));
  if (b.pattern === 'tuxedo') ellipse(ctx, hx + 8, hy + 7, 9, 7, belly);
  // Muzzle.
  if (dog) ellipse(ctx, hx + 13, hy + 6, 9.5, 7.5, b.pattern === 'solid' || b.pattern === 'spots' ? belly : belly);
  else ellipse(ctx, hx + 10, hy + 6, 7, 5, b.pattern === 'points' ? hex(b.patch) : belly);
  // Face.
  const eyes = p.eyes ?? 'open';
  const ex1 = hx + 3, ex2 = hx + 13, ey = hy - 1;
  ctx.strokeStyle = '#2a2024'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  for (const ex of [ex1, ex2]) {
    if (eyes === 'closed') { ctx.beginPath(); ctx.arc(ex, ey - 1, 3.6, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
    else if (eyes === 'happy') { ctx.beginPath(); ctx.arc(ex, ey + 2, 3.6, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
    else {
      ellipse(ctx, ex, ey, 3.6, 4.4, dog ? '#2a2024' : hex(b.eye));
      if (!dog) ellipse(ctx, ex, ey, 1.6, 3.6, '#2a2024');
      ellipse(ctx, ex - 1.1, ey - 1.6, 1.3, 1.3, '#ffffff');
    }
  }
  ellipse(ctx, hx + 2, hy + 8, 3.5, 2, 'rgba(255,120,150,0.45)');
  ellipse(ctx, hx + 15, hy + 8, 3, 2, 'rgba(255,120,150,0.45)');
  const nx = dog ? hx + 20 : hx + 15, ny = hy + 3;
  ellipse(ctx, nx, ny, dog ? 3.6 : 2.2, dog ? 2.6 : 1.6, dog ? '#2a2024' : '#e88a9a');
  ctx.strokeStyle = '#7a4a4a'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(nx - 4, ny + 4); ctx.quadraticCurveTo(nx - 2, ny + 6.5, nx, ny + 4); ctx.quadraticCurveTo(nx + 2, ny + 6.5, nx + 4, ny + 4); ctx.stroke();
  if (p.tongue) ellipse(ctx, nx - 0.5, ny + 8, 2.6, 3.2, '#ff7f9f');
  if (!dog) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1; for (const dy of [-1, 2]) { ctx.beginPath(); ctx.moveTo(nx + 2, ny + dy); ctx.lineTo(nx + 11, ny + dy - 1); ctx.stroke(); } }
  ctx.restore();
}

/** The whole sheet for a breed. */
export function buildPetSheet(b: BreedDef): HTMLCanvasElement {
  const poses: PetPose[] = [];
  for (let k = 0; k < IDLE; k++) { const t = (k / IDLE) * Math.PI * 2; poses.push({ mode: 'stand', bob: Math.sin(t) * 0.8, tail: Math.sin(t) * 4 }); }
  poses.push({ mode: 'stand', eyes: 'closed', tail: 2 });
  for (let k = 0; k < WALK; k++) { const t = (k / WALK) * Math.PI * 2; poses.push({ mode: 'stand', leg: Math.sin(t), bob: -Math.abs(Math.cos(t)) * 1.6, tail: Math.sin(t * 2) * 5 }); }
  for (let k = 0; k < 2; k++) poses.push({ mode: 'sit', bob: k ? 0.8 : 0, tail: k ? 3 : -3, eyes: k ? 'open' : 'open' });
  for (let k = 0; k < 2; k++) poses.push({ mode: 'sleep', eyes: 'closed', bob: k });
  for (let k = 0; k < 2; k++) poses.push({ mode: 'eat', eyes: 'closed', bob: k ? 1.5 : 0, tail: k ? 6 : -6 });
  for (let k = 0; k < 2; k++) poses.push({ mode: 'sit', eyes: 'happy', bob: k ? -2.5 : 0, tail: k ? 8 : -8, tongue: b.species === 'dog' });
  const [c, ctx] = makeCanvas(PET_W * poses.length, PET_H);
  poses.forEach((p, i) => { ctx.save(); ctx.translate(i * PET_W, 0); drawPet(ctx, b, p); ctx.restore(); });
  return c;
}

const ROOM_BG: Record<string, [string, string]> = {
  bedroom: ['#fde6ef', '#e8c9b4'], livingroom: ['#f4ecdf', '#c49a72'], kitchen: ['#fff4e2', '#e6d6c2'],
  bathroom: ['#e7f7f5', '#addbd7'], comfortroom: ['#f9e9ef', '#e9cad4'], backyard: ['#bfe8ff', '#8fd17a'],
};
/** A pet photo for the Gallery, redrawn from what was saved (pets + room). */
export function petPhotoUrl(ph: { room: string; pets: { breed: BreedDef; name: string; pose: string }[] }): string {
  const W = 320, H = 260;
  const [c, ctx] = makeCanvas(W, H);
  const [wall, floor] = ROOM_BG[ph.room] ?? ROOM_BG.livingroom;
  ctx.fillStyle = wall; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = floor; ctx.fillRect(0, H * 0.68, W, H * 0.32);
  const n = ph.pets.length;
  const sc = n > 1 ? 1.5 : 1.85;
  ph.pets.forEach((p, i) => {
    ctx.save();
    // A sitting pet's body is centred around x≈58 of its frame; keep it in the middle so square thumbnails don't crop it.
    ctx.translate((W / (n + 1)) * (i + 1) - 58 * sc, H * 0.84 - PET_H * sc);
    ctx.scale(sc, sc);
    drawPet(ctx, p.breed, p.pose === 'happy' ? { mode: 'sit', eyes: 'happy', tongue: p.breed.species === 'dog' } : p.pose === 'sleep' ? { mode: 'sleep', eyes: 'closed' } : { mode: 'sit' });
    ctx.restore();
  });
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(0, H - 34, W, 34);
  ctx.fillStyle = '#4a2a3e'; ctx.font = '600 18px Fredoka, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(ph.pets.map((p) => p.name).join(' & ') + ' ♡', W / 2, H - 11);
  return c.toDataURL('image/png');
}

/** A single portrait (sitting, happy) as a data URL for cards, the shop and photos. */
const portraits = new Map<string, string>();
export function petPortrait(b: BreedDef, pose: 'sit' | 'happy' | 'sleep' = 'sit'): string {
  const key = `${b.id}-${pose}`;
  const hit = portraits.get(key);
  if (hit) return hit;
  const [c, ctx] = makeCanvas(PET_W, PET_H);
  drawPet(ctx, b, pose === 'happy' ? { mode: 'sit', eyes: 'happy', tongue: b.species === 'dog' } : pose === 'sleep' ? { mode: 'sleep', eyes: 'closed' } : { mode: 'sit' });
  const url = c.toDataURL('image/png');
  portraits.set(key, url);
  return url;
}

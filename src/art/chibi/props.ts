/*
 * Things the chibis hold during activities: a frying pan and spatula, a book, a watering can, a picked flower, a
 * bouquet. Drawn by the body layer in front of the torso and hair, at the hand positions the arms ended up at,
 * then the fingers are drawn over the handles so the hands look like they grip them.
 */
import { ellipse, heartPath, type Ctx } from '../paint';
import { drop, hex, ink, line, mix, shade, sparkle, vg, type Palette } from './kit';

export type Prop =
  /** Frying pan in the left hand, spatula in the right. `toss` lifts the pancake (px), `spin` turns it. */
  | { kind: 'pan'; toss?: number; spin?: number }
  /** Open book held in both hands; `page` 0..1 turns a page over. */
  | { kind: 'book'; page?: number }
  /** Watering can in the right hand; `k` 0..1 is the phase of the falling drops. */
  | { kind: 'can'; k: number }
  | { kind: 'flower' }
  | { kind: 'bouquet' }
  /** A phone held in both hands, screen toward the face; `glow` 0..1 cycles what's on the screen. */
  | { kind: 'phone'; glow: number };

export type Point = [number, number];
export interface Hands { L: Point; R: Point }

export function drawProp(ctx: Ctx, P: Palette, prop: Prop, hands: Hands) {
  switch (prop.kind) {
    case 'pan': return pan(ctx, P, hands, prop.toss ?? 0, prop.spin ?? 0);
    case 'book': return book(ctx, P, hands, prop.page ?? 0);
    case 'can': return can(ctx, P, hands.R, prop.k);
    case 'flower': return flower(ctx, P, hands.R);
    case 'bouquet': return bouquet(ctx, P, hands);
    case 'phone': return phone(ctx, P, hands, prop.glow);
  }
}

function phone(ctx: Ctx, P: Palette, { L, R }: Hands, glow: number) {
  const cx = (L[0] + R[0]) / 2, y = Math.min(L[1], R[1]) - 7;
  const c = P.her ? mix(P.accent, 0xffffff, 0.2) : 0x4a5a78;
  // the back of the case (we see it from the front) with a little camera, tipped toward the face
  ctx.beginPath(); ctx.roundRect(cx - 7, y - 6, 14, 20, 3);
  ink(ctx, vg(ctx, y - 6, y + 14, shade(c, 0.08), shade(c, -0.14)), shade(c, -0.5), 1.1);
  ellipse(ctx, cx - 3.4, y - 2.4, 1.6, 1.6, '#2a2a34');
  if (P.her) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; heartPath(ctx, cx + 1, y + 4, 6); ctx.fill(); }
  // the screen's glow on the chin side: light that comes and goes as things scroll by
  ctx.fillStyle = `rgba(190,225,255,${0.18 + 0.12 * Math.sin(glow * Math.PI * 2)})`;
  ctx.beginPath(); ctx.ellipse(cx, y - 9, 9, 3.4, 0, 0, Math.PI * 2); ctx.fill();
  grip(ctx, P, L, -1);
  grip(ctx, P, R, 1);
}

/** Fingers wrapped over whatever the hand holds. */
function grip(ctx: Ctx, P: Palette, [x, y]: Point, side: number) {
  ctx.beginPath();
  ctx.ellipse(x + side * 0.6, y, 3.9, 3.3, 0, 0, Math.PI * 2);
  ink(ctx, vg(ctx, y - 3, y + 3, P.skinLight, P.skin), 'rgba(170,95,90,0.6)', 1);
  line(ctx, 'rgba(170,95,90,0.45)', 0.8, () => { ctx.moveTo(x - 1.2, y - 2); ctx.lineTo(x - 1.2, y + 2); ctx.moveTo(x + 1.4, y - 2); ctx.lineTo(x + 1.4, y + 2); });
}

function pan(ctx: Ctx, P: Palette, { L, R }: Hands, toss: number, spin: number) {
  const cx = L[0] + 21, cy = L[1] - 3;
  // handle, from the hand to the rim
  ctx.beginPath(); ctx.roundRect(L[0] - 5, L[1] - 2.4, 14, 4.8, 2.4);
  ink(ctx, vg(ctx, L[1] - 3, L[1] + 3, 0x9a6440, 0x6a3e24), '#4a2a18', 1);
  // pan: the body, the rim, the dark inside
  ellipse(ctx, cx, cy + 3, 14, 5.6, '#2a2a34');
  ctx.beginPath(); ctx.ellipse(cx, cy, 15, 5.4, 0, 0, Math.PI * 2);
  ink(ctx, vg(ctx, cy - 5, cy + 5, 0x6a6a78, 0x3e3e4a), '#1e1e26', 1.1);
  ellipse(ctx, cx, cy + 0.6, 12.4, 3.9, '#34343e');
  ellipse(ctx, cx - 6, cy - 1.6, 3, 0.8, 'rgba(255,255,255,0.25)');
  // the pancake: in the pan, or in the air turning over
  const py = cy + 0.2 - toss;
  const thin = Math.max(0.9, Math.abs(Math.cos(spin)) * 3.2);
  ctx.beginPath(); ctx.ellipse(cx + toss * 0.08, py, 9, thin, 0, 0, Math.PI * 2);
  ink(ctx, Math.cos(spin) >= 0 ? '#f0bf72' : '#e4a456', '#b8783a', 1);
  if (thin > 2) ellipse(ctx, cx - 2 + toss * 0.08, py - 0.6, 3, 1, 'rgba(255,240,190,0.85)');
  if (!toss) {
    // a little steam
    line(ctx, 'rgba(255,255,255,0.6)', 1.2, () => {
      for (const dx of [-5, 3]) { ctx.moveTo(cx + dx, cy - 5); ctx.quadraticCurveTo(cx + dx - 3, cy - 9, cx + dx, cy - 12); ctx.quadraticCurveTo(cx + dx + 3, cy - 15, cx + dx, cy - 18); }
    });
  }
  grip(ctx, P, L, -1);
  // spatula: in the pan while stirring, held up while tossing
  const [bx, by] = toss ? [R[0] + 5, R[1] + 13] : [cx + 4, cy - 0.5];
  line(ctx, '#8a5a36', 3.2, () => { ctx.moveTo(R[0] - 3, R[1] - 5); ctx.lineTo(bx, by); });
  line(ctx, '#c98a5a', 2, () => { ctx.moveTo(R[0] - 3, R[1] - 5); ctx.lineTo(bx, by); });
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(Math.atan2(by - R[1], bx - R[0]) - Math.PI / 2);
  ctx.beginPath(); ctx.roundRect(-3.6, -1, 7.2, 7, 2);
  ink(ctx, '#f2ece2', 'rgba(120,100,90,0.8)', 1);
  ctx.restore();
  grip(ctx, P, R, 1);
}

function book(ctx: Ctx, P: Palette, { L, R }: Hands, page: number) {
  const cx = (L[0] + R[0]) / 2, by = Math.max(L[1], R[1]) + 2, top = by - 24;
  const c = P.her ? mix(P.accent, 0xffffff, 0.1) : 0x6f8fc0;
  // page edges peeking over the top (the book is tipped toward the reader)
  ctx.beginPath();
  ctx.moveTo(cx - 20, top + 2);
  ctx.quadraticCurveTo(cx - 10, top - 3, cx, top + 3);
  ctx.quadraticCurveTo(cx + 10, top - 3, cx + 20, top + 2);
  ctx.lineTo(cx + 20, top + 6);
  ctx.lineTo(cx - 20, top + 6);
  ctx.closePath();
  ink(ctx, '#fffaf0', 'rgba(160,140,120,0.8)', 1);
  // the two covers, in a shallow V around the spine
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx, top + 4);
    ctx.lineTo(cx + s * 20, top + 2);
    ctx.lineTo(cx + s * 19, by - 1);
    ctx.lineTo(cx, by + 2);
    ctx.closePath();
    ink(ctx, vg(ctx, top, by, shade(c, s < 0 ? 0.1 : 0.02), shade(c, s < 0 ? -0.08 : -0.18)), shade(c, -0.45), 1.1);
  }
  line(ctx, hex(shade(c, -0.4)), 1.6, () => { ctx.moveTo(cx, top + 4); ctx.lineTo(cx, by + 2); });
  // a heart on the front, title lines on the back
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  heartPath(ctx, cx + 10, top + 8, 9);
  ctx.fill();
  line(ctx, 'rgba(255,255,255,0.55)', 1.2, () => { ctx.moveTo(cx - 15, top + 9); ctx.lineTo(cx - 5, top + 10); ctx.moveTo(cx - 14, top + 13); ctx.lineTo(cx - 7, top + 14); });
  if (page > 0) {
    // a page turning over, seen rising above the book
    const tipX = cx + (1 - 2 * page) * 17, tipY = top - Math.sin(page * Math.PI) * 13 + 2;
    ctx.beginPath();
    ctx.moveTo(cx, top + 3);
    ctx.quadraticCurveTo((cx + tipX) / 2, tipY - 4, tipX, tipY);
    ctx.lineTo(tipX, tipY + 4);
    ctx.quadraticCurveTo((cx + tipX) / 2, tipY + 1, cx, top + 6);
    ctx.closePath();
    ink(ctx, '#fffdf6', 'rgba(160,140,120,0.85)', 1);
  }
  grip(ctx, P, L, -1);
  grip(ctx, P, R, 1);
}

function can(ctx: Ctx, P: Palette, [hx, hy]: Point, k: number) {
  const c = P.her ? 0x9fd8c4 : 0x8ab4d8;
  const tilt = 0.3;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(tilt);
  // spout first (behind the body)
  ctx.beginPath();
  ctx.moveTo(14, 10); ctx.lineTo(28, -1); ctx.lineTo(30, 1.5); ctx.lineTo(16, 15); ctx.closePath();
  ink(ctx, hex(shade(c, -0.08)), shade(c, -0.45), 1);
  ctx.beginPath(); ctx.ellipse(30, 0, 2.6, 4.2, -0.8, 0, Math.PI * 2);
  ink(ctx, hex(shade(c, 0.1)), shade(c, -0.45), 1);
  // body
  ctx.beginPath(); ctx.roundRect(-6, 4, 22, 17, 5);
  ink(ctx, vg(ctx, 4, 21, shade(c, 0.12), shade(c, -0.12)), shade(c, -0.45), 1.1);
  ellipse(ctx, -1, 9, 2.4, 4.5, 'rgba(255,255,255,0.4)');
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  heartPath(ctx, 6, 9, 7);
  ctx.fill();
  // handle over the top, where the hand holds it
  line(ctx, hex(shade(c, -0.25)), 3, () => { ctx.moveTo(-4, 6); ctx.quadraticCurveTo(-3, -4, 5, -2); ctx.quadraticCurveTo(12, -1, 12, 5); });
  ctx.restore();
  // Drops falling from the rose to the ground.
  const tx = hx + 30 * Math.cos(tilt), ty = hy + 30 * Math.sin(tilt);
  ctx.fillStyle = 'rgba(130,195,255,0.85)';
  for (let i = 0; i < 6; i++) {
    const t = (i / 6 + k) % 1;
    const x = tx + 3 + t * 9 + (i % 2) * 3, y = ty + 4 + t * (208 - ty);
    drop(ctx, x, y, 1.5);
    ctx.fill();
  }
  line(ctx, 'rgba(160,210,255,0.4)', 1.2, () => { ctx.moveTo(tx + 2, ty + 3); ctx.quadraticCurveTo(tx + 6, ty + 20, tx + 9, ty + 40); });
  grip(ctx, P, [hx, hy], 1);
}

function bloom(ctx: Ctx, x: number, y: number, r: number, petal: number) {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75, r * 0.62, r * 0.62, 0, 0, Math.PI * 2);
    ink(ctx, hex(petal), shade(petal, -0.35), 0.8);
  }
  ellipse(ctx, x, y, r * 0.42, r * 0.42, '#ffd55a');
}

function flower(ctx: Ctx, P: Palette, [hx, hy]: Point) {
  line(ctx, '#5aa44e', 1.8, () => { ctx.moveTo(hx, hy + 9); ctx.quadraticCurveTo(hx + 2, hy, hx + 1, hy - 11); });
  ellipse(ctx, hx + 4, hy - 3, 3.2, 1.5, '#7cc46a');
  bloom(ctx, hx + 1, hy - 14, 4, P.her ? mix(P.accent, 0xffffff, 0.2) : 0xf4a3bb);
  grip(ctx, P, [hx, hy], 1);
}

function bouquet(ctx: Ctx, P: Palette, { L, R }: Hands) {
  const cx = (L[0] + R[0]) / 2, y = (L[1] + R[1]) / 2;
  // stems and leaves
  for (const [dx, a] of [[-9, -0.5], [9, 0.5], [-3, -0.2], [4, 0.25]] as [number, number][]) {
    ctx.beginPath(); ctx.ellipse(cx + dx, y - 12, 2.6, 5.5, a, 0, Math.PI * 2);
    ink(ctx, '#7cc46a', '#4a8a3e', 0.8);
  }
  // blooms
  bloom(ctx, cx - 7, y - 16, 4.4, 0xf7b6c8);
  bloom(ctx, cx + 7, y - 17, 4.4, 0xfff4f0);
  bloom(ctx, cx, y - 21, 4.8, mix(P.accent, 0xffffff, 0.1));
  bloom(ctx, cx - 11, y - 9, 3.4, 0xffe08a);
  bloom(ctx, cx + 11, y - 10, 3.4, 0xc9b6f2);
  sparkle(ctx, cx + 14, y - 22, 2.4, 'rgba(255,255,255,0.9)');
  // paper wrap
  ctx.beginPath();
  ctx.moveTo(cx - 14, y - 9);
  ctx.quadraticCurveTo(cx - 7, y - 4, cx, y - 7);
  ctx.quadraticCurveTo(cx + 7, y - 4, cx + 14, y - 9);
  ctx.lineTo(cx + 3, y + 14);
  ctx.lineTo(cx - 3, y + 14);
  ctx.closePath();
  ink(ctx, vg(ctx, y - 9, y + 14, 0xfff6ec, 0xf0dcc8), 'rgba(170,140,120,0.8)', 1);
  ctx.beginPath(); ctx.roundRect(cx - 7, y + 1, 14, 4, 2);
  ink(ctx, hex(P.accent), shade(P.accent, -0.35), 0.9);
  grip(ctx, P, L, -1);
  grip(ctx, P, R, 1);
}

/*
 * The body layer: back hair, legs and feet, clothing, arms and hands, shoulder hair, neck. The head is a separate
 * layer (head.ts) placed on the neck pivot, so nothing here draws a face.
 * Coordinates are frame px (FRAME_W × FRAME_H); the feet rest at FLOOR, the hips at HIP_Y.
 */
import { ellipse, type Ctx } from '../paint';
import { reach, type OutfitStyle } from './spec';
import { hex, hg, ink, line, mix, palette, shade, sparkle, vg, type Look, type Palette } from './kit';
import { drawProp, type Hands, type Point, type Prop } from './props';

const CX = 60;
export const HIP_Y = 172;
const FLOOR = 219;
const SHOULDER_Y = 103;
const UPPER = 27;
const FORE = 27;

export interface BodyPose {
  /** -1..1 leg swing. */
  phase?: number;
  /** Upper-body offset (negative = up); feet stay planted. */
  bob?: number;
  /** Hair trailing offset in px. */
  sway?: number;
  /** -1..1 arm swing. */
  arm?: number;
  /** Foot lift (negative = up). */
  liftL?: number;
  liftR?: number;
  /** Fixed arm angles (radians) replacing the swing: 0 = hanging, + = reaching outward. */
  armL?: number;
  armR?: number;
  /** Upper-body lean around the hips (running). */
  lean?: number;
  /** Leg swing in px (walk 5, run 8). */
  stride?: number;
  /** Running: elbows bent, pumping. */
  run?: boolean;
  sit?: boolean;
  /** Eating: 1 = food held at the chest, 2 = hand raised to the mouth (the head layer draws the bite). */
  eat?: 0 | 1 | 2;
  /** Where a hand goes (frame px, before bob and lean). Near the body the forearm comes toward us (foreshortened). */
  handL?: Point;
  handR?: Point;
  /** Point with this hand's index finger (-1 = left, the side away from where they face). */
  point?: -1 | 1;
  /** Something held in the hands (activities). */
  prop?: Prop;
}

// ------------------------------------------------------------------ outfit table

interface Sleeve { len: number; w: number; color: number; cuff?: number; puff?: boolean; paw?: boolean; rolled?: boolean; sheer?: boolean; stripes?: boolean }
interface Bottom { kind: 'pants' | 'bare' | 'tights'; color: number; legTop: number; cuff?: number; socks?: number; pattern?: 'plaid' | 'stars' | 'stripes' }
type Shoe = 'slipper' | 'maryjane' | 'boot' | 'loafer' | 'heel' | 'sneaker' | 'dress' | 'slide';
interface Outfit { sleeve: Sleeve; bottom: Bottom; shoe: Shoe; shoulder: number }

const RAGLAN_SLEEVE = 0xd9d0dc;
const PINK_PLAID = 0xf2b8c8;

function outfitOf(P: Palette): Outfit {
  const o = P.outfit;
  switch (P.style) {
    case 'tee': return { shoulder: 21, sleeve: { len: 22, w: 16, color: shade(o, 0.04) }, bottom: { kind: 'pants', color: PINK_PLAID, legTop: 158, cuff: shade(PINK_PLAID, -0.08), pattern: 'plaid' }, shoe: 'slipper' };
    case 'pajama': return { shoulder: 20, sleeve: { len: 50, w: 13, color: o, cuff: P.accent }, bottom: { kind: 'pants', color: o, legTop: 154, cuff: P.accent, pattern: P.her ? 'stars' : 'stripes' }, shoe: P.her ? 'slipper' : 'slide' };
    case 'sweater': return P.her
      ? { shoulder: 21, sleeve: { len: 57, w: 14.5, color: o, paw: true, cuff: shade(o, -0.08) }, bottom: { kind: 'tights', color: 0x3c3448, legTop: 165 }, shoe: 'boot' }
      : { shoulder: 22, sleeve: { len: 51, w: 14.5, color: o, cuff: shade(o, -0.1) }, bottom: { kind: 'pants', color: 0x34364a, legTop: 166 }, shoe: 'boot' };
    case 'cardigan': return { shoulder: 20, sleeve: { len: 51, w: 13.5, color: o, cuff: shade(o, -0.12) }, bottom: { kind: 'bare', color: P.skin, legTop: 168, socks: 0xfaf6f2 }, shoe: 'loafer' };
    case 'gown': return { shoulder: 18, sleeve: { len: 13, w: 15, color: shade(o, 0.25), puff: true, sheer: true }, bottom: { kind: 'bare', color: P.skin, legTop: 172 }, shoe: 'heel' };
    case 'raglan': return { shoulder: 22, sleeve: { len: 51, w: 14.5, color: RAGLAN_SLEEVE, cuff: o }, bottom: { kind: 'pants', color: 0x3a3a4a, legTop: 166, cuff: 0x30303e }, shoe: 'sneaker' };
    case 'hoodie': return { shoulder: 22, sleeve: { len: 51, w: 14.5, color: o, cuff: shade(o, -0.15) }, bottom: { kind: 'pants', color: 0x3a3a4a, legTop: 166, cuff: 0x30303e }, shoe: 'sneaker' };
    case 'shirt': return { shoulder: 22, sleeve: { len: 29, w: 13.5, color: o, rolled: true }, bottom: { kind: 'pants', color: 0xc9b28c, legTop: 164 }, shoe: 'sneaker' };
    case 'formal': return { shoulder: 22, sleeve: { len: 52, w: 13, color: 0xf6f6fa, cuff: 0xffffff }, bottom: { kind: 'pants', color: 0x2a2a38, legTop: 164 }, shoe: 'dress' };
    default: // her dress
      return { shoulder: 19, sleeve: { len: 13, w: 15, color: shade(o, 0.06), puff: true }, bottom: { kind: 'bare', color: P.skin, legTop: 168, socks: 0xfdfbf8 }, shoe: 'maryjane' };
  }
}

// ------------------------------------------------------------------ entry

export function drawBody(ctx: Ctx, look: Look, pose: BodyPose = {}) {
  const P = palette(look);
  const O = outfitOf(P);
  const up = pose.bob ?? 0;
  const phase = pose.phase ?? 0;
  const sway = pose.sway ?? phase * 2;
  const lean = pose.lean ?? 0;
  const upper = () => {
    ctx.translate(0, up);
    if (lean) { ctx.translate(CX, HIP_Y); ctx.rotate(lean); ctx.translate(-CX, -HIP_Y); }
  };

  ctx.save();
  if (P.her) { ctx.save(); upper(); backHair(ctx, P, sway); ctx.restore(); }
  legs(ctx, P, O, pose, up, phase);
  ctx.save();
  upper();
  neck(ctx, P);
  torso(ctx, P, O, pose, phase);
  // A raised (pointing) arm goes over her hair; otherwise the hair falls over the arms.
  if (P.her && pose.point) shoulderHair(ctx, P, sway);
  const hands = arms(ctx, P, O, pose);
  if (P.her && !pose.point) shoulderHair(ctx, P, sway);
  if (pose.prop) drawProp(ctx, P, pose.prop, hands);
  ctx.restore();
  ctx.restore();
}

// ------------------------------------------------------------------ hair

function backHair(ctx: Ctx, P: Palette, s: number) {
  ctx.beginPath();
  ctx.moveTo(CX - 38, 58);
  ctx.bezierCurveTo(CX - 50 - s * 0.3, 96, CX - 44 - s * 0.6, 140, CX - 37 - s, 172);
  const tips: [number, number, number, number][] = [
    [-35, 182, -29, 184], [-25, 176, -19, 181], [-12, 187, -6, 179], [1, 187, 8, 181], [15, 187, 21, 179], [29, 185, 37, 172],
  ];
  for (const [qx, qy, x, y] of tips) ctx.quadraticCurveTo(CX + qx - s, qy, CX + x - s, y);
  ctx.bezierCurveTo(CX + 44 - s * 0.6, 140, CX + 50 - s * 0.3, 96, CX + 38, 58);
  ctx.closePath();
  ink(ctx, vg(ctx, 58, 186, P.hair, shade(P.hairLo, -0.05)), hex(P.hairLine, 0.6), 1.1);
  line(ctx, hex(P.hairLine, 0.35), 1, () => {
    for (const x of [-40, -33, 33, 40]) { ctx.moveTo(CX + x, 100); ctx.quadraticCurveTo(CX + x * 1.08 - s * 0.6, 140, CX + x * 0.95 - s, 174); }
  });
  line(ctx, hex(P.hairHi, 0.3), 1.4, () => { ctx.moveTo(CX - 44, 104); ctx.quadraticCurveTo(CX - 47 - s * 0.4, 128, CX - 44 - s * 0.7, 150); });
}

/** Long locks over her shoulders; they start under the head layer's side locks and continue them. */
function shoulderHair(ctx: Ctx, P: Palette, s: number) {
  for (const side of [-1, 1]) {
    const sw = s;
    // Falls over the shoulder and curves in onto the chest, leaving the arm free below.
    ctx.beginPath();
    ctx.moveTo(CX + side * 27, 72);
    ctx.quadraticCurveTo(CX + side * 41, 82, CX + side * 38 - sw * 0.2, 104);
    ctx.quadraticCurveTo(CX + side * 33 - sw * 0.6, 124, CX + side * 21 - sw, 150);
    ctx.quadraticCurveTo(CX + side * 21 - sw * 0.5, 128, CX + side * 22, 110);
    ctx.quadraticCurveTo(CX + side * 22, 90, CX + side * 27, 72);
    ctx.closePath();
    ink(ctx, vg(ctx, 96, 150, P.hair, P.hairLo), hex(P.hairLine, 0.65), 1.1);
    line(ctx, hex(P.hairLine, 0.4), 1, () => { ctx.moveTo(CX + side * 30, 104); ctx.quadraticCurveTo(CX + side * 28 - sw * 0.5, 124, CX + side * 23 - sw, 144); });
    line(ctx, hex(P.hairHi, 0.35), 1.3, () => { ctx.moveTo(CX + side * 34, 104); ctx.quadraticCurveTo(CX + side * 32 - sw * 0.4, 116, CX + side * 29 - sw * 0.6, 126); });
  }
}

function neck(ctx: Ctx, P: Palette) {
  ctx.beginPath();
  ctx.roundRect(CX - 5.5, 84, 11, 18, 3);
  ctx.fillStyle = vg(ctx, 84, 102, P.skinDeep, P.skin, P.skinShade);
  ctx.fill();
}

// ------------------------------------------------------------------ legs & feet

function legShape(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w0: number, w1: number) {
  ctx.beginPath();
  ctx.moveTo(x0 - w0 / 2, y0);
  ctx.lineTo(x0 + w0 / 2, y0);
  ctx.quadraticCurveTo(x0 + w0 / 2 + 0.6, (y0 + y1) / 2, x1 + w1 / 2, y1);
  ctx.arc(x1, y1, w1 / 2, 0, Math.PI);
  ctx.quadraticCurveTo(x0 - w0 / 2 - 0.6, (y0 + y1) / 2, x0 - w0 / 2, y0);
  ctx.closePath();
}

function legs(ctx: Ctx, P: Palette, O: Outfit, pose: BodyPose, up: number, phase: number) {
  const B = O.bottom;
  const stride = pose.stride ?? 5;
  const pants = B.kind === 'pants';
  const w0 = pants ? (P.her ? 13 : 14.5) : 10.5;
  const w1 = pants ? (P.her ? 12 : 12) : 7.5;
  for (const side of [-1, 1] as const) {
    const given = side < 0 ? pose.liftL : pose.liftR;
    const lift = pose.sit ? 0 : given ?? (phase !== 0 && Math.sign(phase) === side ? -3 : 0);
    const hx = CX + side * (pants ? 8.5 : 8);
    const fx = hx + side * phase * stride * (pose.sit ? 0 : 1);
    const top = (pose.sit ? Math.min(B.legTop, HIP_Y - 8) : B.legTop) + up;
    const fill = (y0: number, y1: number) => B.kind === 'bare' ? hg(ctx, fx - 6, fx + 6, P.skinLight, P.skin, P.skinShade) : vg(ctx, y0, y1, shade(B.color, 0.06), shade(B.color, -0.1));
    const edge = B.kind === 'bare' ? 'rgba(170,95,90,0.5)' : shade(B.color, -0.4);
    let ankleY: number, ax: number, floor: number;
    let shin: () => void;
    if (pose.sit) {
      // Seated, facing us: the thigh comes toward the viewer (a round knee), the shin hangs down.
      const knee = HIP_Y + 6 + up;
      ankleY = HIP_Y + 35;
      ax = hx + side * 2.5;
      floor = ankleY + 7;
      shin = () => legShape(ctx, hx + side * 1.5, knee, ax, ankleY, w0 - 1, w1);
      shin();
      ink(ctx, fill(knee, ankleY), edge, 1.1);
      ctx.beginPath();
      ctx.roundRect(hx - w0 / 2 - 0.5, top, w0 + 1, knee - top + 2, 4);
      ink(ctx, fill(top, knee + 6), edge, 1.1);
      ctx.beginPath();
      ctx.ellipse(hx + side * 1, knee - 1, w0 / 2 + 1, 8, 0, 0, Math.PI * 2);
      ink(ctx, fill(knee - 9, knee + 7), edge, 1.1);
    } else {
      ankleY = FLOOR - 7 + lift;
      ax = fx;
      floor = FLOOR + lift;
      shin = () => legShape(ctx, hx, top, ax, ankleY, w0, w1);
      shin();
      ink(ctx, fill(top, ankleY), edge, 1.1);
    }
    // Patterns, socks, cuffs.
    if (B.pattern || B.socks) {
      ctx.save();
      shin();
      ctx.clip();
      if (B.pattern === 'plaid') {
        line(ctx, 'rgba(255,255,255,0.55)', 1.2, () => { for (let y = top + 5; y < ankleY + 6; y += 8) { ctx.moveTo(hx - 12, y); ctx.lineTo(hx + 12, y); } ctx.moveTo(hx + side * 1.5, top); ctx.lineTo(ax + side * 1.5, ankleY + 4); });
        line(ctx, hex(shade(B.color, -0.22), 0.6), 0.9, () => { for (let y = top + 9; y < ankleY + 6; y += 8) { ctx.moveTo(hx - 12, y); ctx.lineTo(hx + 12, y); } ctx.moveTo(hx - side * 3.5, top); ctx.lineTo(ax - side * 3, ankleY + 4); });
      } else if (B.pattern === 'stars') {
        for (let y = top + 8, k = 0; y < ankleY; y += 11, k++) sparkle(ctx, hx + (k % 2 ? 2.5 : -2.5) + (ax - hx) * ((y - top) / (ankleY - top)), y, 2, 'rgba(255,255,255,0.85)');
      } else if (B.pattern === 'stripes') {
        line(ctx, 'rgba(255,255,255,0.45)', 1.2, () => { for (let d = -6; d <= 6; d += 4) { ctx.moveTo(hx + d, top); ctx.lineTo(ax + d, ankleY + 5); } });
      }
      if (B.socks) {
        const sy = pose.sit ? ankleY - 16 : ankleY - 20;
        ctx.fillStyle = hex(B.socks);
        ctx.fillRect(hx - 12, sy, 24, ankleY - sy + 8);
        line(ctx, hex(shade(B.socks, -0.15)), 1, () => { ctx.moveTo(hx - 12, sy + 2.2); ctx.lineTo(hx + 12, sy + 2.2); });
      }
      ctx.restore();
    }
    if (pants && B.cuff !== undefined) {
      ctx.beginPath();
      ctx.roundRect(ax - w1 / 2 - 0.8, ankleY - 4, w1 + 1.6, 5.5, 2.5);
      ink(ctx, hex(B.cuff), shade(B.cuff, -0.35), 1);
    }
    shoe(ctx, P, O.shoe, ax, floor, side);
  }
}

function shoe(ctx: Ctx, P: Palette, kind: Shoe, x: number, f: number, side: number) {
  const body = (rx: number, ry: number, y: number, fill: string | CanvasGradient, lineC: string | number) => {
    ctx.beginPath(); ctx.ellipse(x + side * 0.5, y, rx, ry, 0, 0, Math.PI * 2); ink(ctx, fill, lineC, 1.1);
  };
  switch (kind) {
    case 'slipper': {
      body(8.6, 5, f - 4.5, vg(ctx, f - 10, f, 0xffffff, 0xf1e6ec), 'rgba(170,140,160,0.7)');
      line(ctx, 'rgba(255,255,255,0.9)', 1.6, () => ctx.ellipse(x + side * 0.5, f - 6, 6, 2.6, 0, Math.PI * 1.1, Math.PI * 1.9));
      ellipse(ctx, x + side * 0.5, f - 8.5, 3, 2.6, hex(P.accent));
      ellipse(ctx, x + side * 0.5 - 0.8, f - 9.2, 1, 0.8, 'rgba(255,255,255,0.7)');
      break;
    }
    case 'maryjane':
      body(7.6, 4.6, f - 4, vg(ctx, f - 9, f, 0x6a4246, 0x3e262a), '#2a171a');
      line(ctx, '#2a171a', 1.6, () => { ctx.moveTo(x - 5, f - 7.5); ctx.lineTo(x + 5, f - 7.5); });
      ellipse(ctx, x - side * 2, f - 5.4, 2, 1, 'rgba(255,255,255,0.45)');
      break;
    case 'loafer':
      body(7.8, 4.6, f - 4, vg(ctx, f - 9, f, 0x9a6a4a, 0x6a4430), '#4a2e20');
      line(ctx, '#4a2e20', 1.2, () => { ctx.moveTo(x - 4, f - 6); ctx.quadraticCurveTo(x, f - 4.5, x + 4, f - 6); });
      break;
    case 'boot':
      ctx.beginPath(); ctx.roundRect(x - 6.2, f - 17, 12.4, 15, 4);
      ink(ctx, vg(ctx, f - 17, f, 0x9a6448, 0x6a4030), '#4a2a1e', 1.1);
      body(8, 4.4, f - 3.6, vg(ctx, f - 8, f, 0x8a5840, 0x5a3424), '#4a2a1e');
      ctx.beginPath(); ctx.roundRect(x - 7, f - 19, 14, 5, 2.5);
      ink(ctx, '#fbf2e4', 'rgba(170,140,120,0.8)', 1);
      break;
    case 'heel':
      body(6.6, 4, f - 3.6, vg(ctx, f - 8, f, shade(P.accent, 0.4), P.accent), shade(P.accent, -0.4));
      ellipse(ctx, x, f - 5, 1.6, 1.2, 'rgba(255,255,255,0.8)');
      break;
    case 'sneaker':
      body(9, 5.2, f - 4.4, vg(ctx, f - 10, f, 0xffffff, 0xe6e6ee), 'rgba(120,120,140,0.8)');
      ctx.fillStyle = '#c9c9d4';
      ctx.fillRect(x - 8.6 + side * 0.5, f - 2.4, 17.2, 1.6);
      line(ctx, 'rgba(120,120,140,0.8)', 1, () => { for (const dy of [7.4, 5.6]) { ctx.moveTo(x - 2.6, f - dy); ctx.lineTo(x + 2.6, f - dy); } });
      line(ctx, hex(P.outfit, 0.9), 1.4, () => { ctx.moveTo(x + side * 4, f - 7); ctx.quadraticCurveTo(x + side * 7, f - 4.5, x + side * 8, f - 3); });
      break;
    case 'dress':
      body(8.4, 4.6, f - 4, vg(ctx, f - 9, f, 0x3e3a48, 0x1e1a24), '#141018');
      ellipse(ctx, x - side * 2.4, f - 5.6, 2.6, 1.1, 'rgba(255,255,255,0.4)');
      break;
    case 'slide':
      body(8.8, 4.6, f - 3.6, vg(ctx, f - 8, f, 0x56566a, 0x3a3a4a), '#24242e');
      ctx.beginPath(); ctx.roundRect(x - 7, f - 9, 14, 4.5, 2);
      ink(ctx, hex(P.outfit), shade(P.outfit, -0.4), 1);
      break;
  }
}

// ------------------------------------------------------------------ torso

function torsoPath(ctx: Ctx, top: number, sh: number, waist: number, waistY: number, hem: number, hemY: number, neckW = 8, neckDip = 5) {
  ctx.beginPath();
  ctx.moveTo(CX - sh, top + 1);
  ctx.lineTo(CX - neckW, top);
  ctx.quadraticCurveTo(CX, top + neckDip, CX + neckW, top);
  ctx.lineTo(CX + sh, top + 1);
  ctx.quadraticCurveTo(CX + waist + 3, waistY - 8, CX + waist, waistY);
  ctx.quadraticCurveTo(CX + waist + 1, (waistY + hemY) / 2, CX + hem, hemY);
  ctx.quadraticCurveTo(CX, hemY + 4, CX - hem, hemY);
  ctx.quadraticCurveTo(CX - waist - 1, (waistY + hemY) / 2, CX - waist, waistY);
  ctx.quadraticCurveTo(CX - waist - 3, waistY - 8, CX - sh, top + 1);
  ctx.closePath();
}

function cloth(ctx: Ctx, base: number, x0 = CX - 30, x1 = CX + 30) {
  return hg(ctx, x0, x1, shade(base, 0.12), base, shade(base, -0.16));
}

function torso(ctx: Ctx, P: Palette, O: Outfit, pose: BodyPose, phase: number) {
  const o = P.outfit;
  const lineC = shade(o, -0.42);
  switch (P.style) {
    case 'tee': {
      torsoPath(ctx, 97, 20, 25, 128, 25, 163, 8.5, 5);
      ink(ctx, cloth(ctx, o), lineC, 1.2);
      line(ctx, hex(shade(o, -0.2), 0.5), 1.1, () => {
        ctx.moveTo(CX - 18, 138); ctx.quadraticCurveTo(CX - 15, 150, CX - 12, 160);
        ctx.moveTo(CX + 19, 131); ctx.quadraticCurveTo(CX + 17, 142, CX + 14, 151);
        ctx.moveTo(CX + 6, 160); ctx.quadraticCurveTo(CX + 9, 163, CX + 13, 163);
      });
      line(ctx, hex(shade(o, -0.12)), 2.6, () => { ctx.moveTo(CX - 8.5, 97.5); ctx.quadraticCurveTo(CX, 104, CX + 8.5, 97.5); });
      catPrint(ctx, CX + 1, 132, P.accent);
      return;
    }
    case 'pajama': return pajamaTop(ctx, P, P.her ? 20 : 22, P.her ? 158 : 166);
    case 'sweater': {
      if (P.her) {
        skirt(ctx, P, 0x8a5a4a, 146, pose.sit ? 178 : 177, 22, 28, phase, 'pleat');
        torsoPath(ctx, 98, 21, 22, 126, 24, 150, 9, 3);
      } else torsoPath(ctx, 97, 22, 24, 128, 24, 168, 9, 4);
      ink(ctx, cloth(ctx, o), lineC, 1.2);
      const hemY = P.her ? 150 : 168;
      ctx.beginPath(); ctx.roundRect(CX - 24, hemY - 7, 48, 8, 3.5);
      ink(ctx, hex(shade(o, -0.08)), lineC, 1);
      line(ctx, hex(shade(o, -0.22), 0.6), 0.9, () => { for (let x = CX - 21; x <= CX + 21; x += 3.5) { ctx.moveTo(x, hemY - 6); ctx.lineTo(x, hemY); } });
      if (P.her) {
        // Turtleneck and a cable knit down the front.
        ctx.beginPath(); ctx.roundRect(CX - 10.5, 87, 21, 13, 5);
        ink(ctx, hex(shade(o, 0.05)), lineC, 1.1);
        line(ctx, hex(shade(o, -0.2), 0.6), 0.9, () => { for (let x = CX - 8; x <= CX + 8; x += 3.2) { ctx.moveTo(x, 89); ctx.lineTo(x, 98); } });
        line(ctx, hex(shade(o, -0.2), 0.55), 1.4, () => {
          for (let y = 104; y < hemY - 10; y += 9) {
            ctx.moveTo(CX - 3, y); ctx.bezierCurveTo(CX + 4, y + 2, CX + 4, y + 7, CX - 3, y + 9);
            ctx.moveTo(CX + 3, y); ctx.bezierCurveTo(CX - 4, y + 2, CX - 4, y + 7, CX + 3, y + 9);
          }
        });
        line(ctx, hex(shade(o, -0.15), 0.4), 1, () => { for (const x of [-13, -9, 9, 13]) { ctx.moveTo(CX + x, 104); ctx.lineTo(CX + x * 1.08, hemY - 8); } });
      } else {
        // Shirt collar peeking out of a crew neck.
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(CX, 103); ctx.lineTo(CX + s * 9, 96); ctx.lineTo(CX + s * 4, 106); ctx.closePath(); ink(ctx, '#fbfbfd', 'rgba(140,140,160,0.8)', 1); }
        ctx.beginPath(); ctx.ellipse(CX, 98, 11.5, 5, 0, 0, Math.PI); ctx.lineWidth = 3.4; ctx.strokeStyle = hex(shade(o, -0.1)); ctx.stroke();
        line(ctx, hex(shade(o, -0.15), 0.35), 1, () => { for (let x = CX - 18; x <= CX + 18; x += 6) { ctx.moveTo(x, 108); ctx.lineTo(x, 160); } });
      }
      return;
    }
    case 'cardigan': {
      const navy = mix(o, 0x2f3e66, 0.65);
      skirt(ctx, P, navy, 146, pose.sit ? 178 : 176, 18, 28, phase, 'pleat');
      torsoPath(ctx, 98, 18, 16, 128, 19, 150, 7, 4);
      ink(ctx, cloth(ctx, 0xfdf8f6), 'rgba(160,140,150,0.8)', 1.1);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(CX + s * 20, 98);
        ctx.lineTo(CX + s * 7, 97);
        ctx.quadraticCurveTo(CX + s * 4, 122, CX + s * 4, 151);
        ctx.lineTo(CX + s * 24, 152);
        ctx.quadraticCurveTo(CX + s * 25, 124, CX + s * 20, 98);
        ctx.closePath();
        ink(ctx, cloth(ctx, o), lineC, 1.2);
        ctx.beginPath(); ctx.roundRect(CX + (s < 0 ? -24 : 4), 146, 20, 6, 2.5);
        ink(ctx, hex(shade(o, -0.1)), lineC, 0.9);
        ctx.beginPath(); ctx.roundRect(CX + s * 15 - 4.5, 128, 9, 8, 2);
        ink(ctx, hex(shade(o, 0.05)), lineC, 0.9);
      }
      for (const y of [114, 126, 138]) { ellipse(ctx, CX - 5.5, y, 1.6, 1.6, hex(shade(o, -0.35))); ellipse(ctx, CX - 5.9, y - 0.4, 0.6, 0.6, 'rgba(255,255,255,0.7)'); }
      smallBow(ctx, CX, 101, P.accent);
      return;
    }
    case 'gown': {
      gownSkirt(ctx, P, pose, phase);
      ctx.beginPath(); ctx.roundRect(CX - 15, 93, 30, 14, 5);
      ctx.fillStyle = vg(ctx, 93, 107, P.skin, P.skinShade);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(CX - 16, 102);
      ctx.quadraticCurveTo(CX - 8, 96, CX, 103);
      ctx.quadraticCurveTo(CX + 8, 96, CX + 16, 102);
      ctx.lineTo(CX + 14, 131);
      ctx.lineTo(CX - 14, 131);
      ctx.closePath();
      ink(ctx, cloth(ctx, o), lineC, 1.2);
      for (const [x, y] of [[-8, 110], [6, 116], [-3, 123], [9, 106]]) sparkle(ctx, CX + x, y, 1.6, 'rgba(255,240,200,0.9)');
      ctx.beginPath(); ctx.roundRect(CX - 15, 127, 30, 6, 2.5);
      ink(ctx, hex(P.accent), P.accentLo, 1);
      smallBow(ctx, CX + 9, 130, P.accent);
      line(ctx, 'rgba(255,255,255,0.8)', 1.6, () => { ctx.moveTo(CX - 6, 92.5); ctx.quadraticCurveTo(CX, 97, CX + 6, 92.5); });
      ellipse(ctx, CX, 97.5, 1.8, 1.8, '#fff6fa');
      return;
    }
    case 'raglan':
    case 'hoodie': return hoodie(ctx, P, P.style === 'raglan');
    case 'shirt': return shirt(ctx, P);
    case 'formal': return formal(ctx, P);
    default: return dress(ctx, P, pose, phase);
  }
}

function dress(ctx: Ctx, P: Palette, pose: BodyPose, phase: number) {
  const o = P.outfit, lineC = shade(o, -0.42);
  skirt(ctx, P, o, 129, pose.sit ? 182 : 179, 15, 33, phase, 'gore');
  // bodice
  ctx.beginPath();
  ctx.moveTo(CX - 18, 99);
  ctx.quadraticCurveTo(CX, 101, CX + 18, 99);
  ctx.quadraticCurveTo(CX + 17, 118, CX + 15, 133);
  ctx.lineTo(CX - 15, 133);
  ctx.quadraticCurveTo(CX - 17, 118, CX - 18, 99);
  ctx.closePath();
  ink(ctx, cloth(ctx, o), lineC, 1.2);
  line(ctx, hex(shade(o, -0.2), 0.45), 1, () => { ctx.moveTo(CX - 9, 112); ctx.quadraticCurveTo(CX - 8, 122, CX - 9, 130); ctx.moveTo(CX + 9, 112); ctx.quadraticCurveTo(CX + 8, 122, CX + 9, 130); });
  for (const y of [113, 122]) ellipse(ctx, CX, y, 1.5, 1.5, '#fffaf6');
  // Peter Pan collar
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(CX, 99.5);
    ctx.quadraticCurveTo(CX + s * 5, 108, CX + s * 12, 104.5);
    ctx.quadraticCurveTo(CX + s * 15, 99, CX + s * 9, 97);
    ctx.closePath();
    ink(ctx, '#fffaf6', 'rgba(170,140,150,0.85)', 1);
  }
  // sash and bow
  ctx.beginPath(); ctx.roundRect(CX - 16, 128.5, 32, 6, 2.5);
  ink(ctx, hex(P.accent), P.accentLo, 1);
  smallBow(ctx, CX, 131.5, P.accent);
}

/** A skirt from the waist down to the hem; pleats or gores; the hem sways a little with the step. */
function skirt(ctx: Ctx, P: Palette, color: number, waistY: number, hemY: number, waistW: number, hemW: number, phase: number, kind: 'pleat' | 'gore') {
  const sw = phase * 1.5;
  ctx.beginPath();
  ctx.moveTo(CX - waistW, waistY);
  ctx.lineTo(CX + waistW, waistY);
  ctx.quadraticCurveTo(CX + waistW + (hemW - waistW) * 0.4, (waistY + hemY) / 2, CX + hemW + sw, hemY - 2);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const x0 = CX + hemW + sw - ((i + 0.5) / n) * (hemW * 2), x1 = CX + hemW + sw - ((i + 1) / n) * (hemW * 2);
    ctx.quadraticCurveTo(x0, hemY + 3, x1, hemY - (i === n - 1 ? 2 : 0));
  }
  ctx.quadraticCurveTo(CX - waistW - (hemW - waistW) * 0.4, (waistY + hemY) / 2, CX - waistW, waistY);
  ctx.closePath();
  ink(ctx, vg(ctx, waistY, hemY, shade(color, 0.08), shade(color, -0.12)), shade(color, -0.45), 1.2);
  ctx.save();
  ctx.clip();
  for (let k = -2; k <= 2; k++) {
    const xt = CX + k * (waistW / 2.6), xb = CX + k * (hemW / 2.6) + sw;
    if (kind === 'gore') {
      ctx.beginPath(); ctx.moveTo(xt, waistY); ctx.lineTo(xb + 3, hemY + 4); ctx.lineTo(xb + 7, hemY + 4); ctx.closePath();
      ctx.fillStyle = hex(shade(color, 0.12), 0.6); ctx.fill();
    }
    line(ctx, hex(shade(color, -0.3), 0.5), 1, () => { ctx.moveTo(xt, waistY + 2); ctx.lineTo(xb, hemY + 3); });
  }
  if (kind === 'pleat' && P.style === 'sweater') {
    line(ctx, 'rgba(255,230,200,0.3)', 1, () => { for (let y = waistY + 7; y < hemY; y += 8) { ctx.moveTo(CX - 40, y); ctx.lineTo(CX + 40, y); } });
  }
  ctx.restore();
  if (kind === 'gore') {
    // lace trim along the hem
    line(ctx, 'rgba(255,252,248,0.95)', 1.4, () => {
      for (let i = 0; i < 9; i++) { const x = CX - hemW + sw + (i / 8) * hemW * 2; ctx.moveTo(x - 3.6, hemY - 0.5); ctx.quadraticCurveTo(x, hemY + 3.4, x + 3.6, hemY - 0.5); }
    });
  }
}

function gownSkirt(ctx: Ctx, P: Palette, pose: BodyPose, phase: number) {
  const o = P.outfit;
  const hemY = pose.sit ? 196 : 212, sw = phase * 2;
  ctx.beginPath();
  ctx.moveTo(CX - 14, 130);
  ctx.lineTo(CX + 14, 130);
  ctx.bezierCurveTo(CX + 22, 150, CX + 36, 180, CX + 39 + sw, hemY);
  ctx.quadraticCurveTo(CX, hemY + 6, CX - 39 + sw, hemY);
  ctx.bezierCurveTo(CX - 36, 180, CX - 22, 150, CX - 14, 130);
  ctx.closePath();
  ink(ctx, vg(ctx, 130, hemY, shade(o, 0.1), shade(o, -0.15)), shade(o, -0.45), 1.2);
  // Tulle overlay with a scalloped edge.
  ctx.beginPath();
  ctx.moveTo(CX - 14, 132);
  ctx.lineTo(CX + 14, 132);
  ctx.bezierCurveTo(CX + 20, 150, CX + 31, 172, CX + 34 + sw, hemY - 12);
  for (let i = 0; i < 7; i++) { const x0 = CX + 34 + sw - ((i + 0.5) / 7) * 68, x1 = CX + 34 + sw - ((i + 1) / 7) * 68; ctx.quadraticCurveTo(x0, hemY - 6, x1, hemY - 12); }
  ctx.bezierCurveTo(CX - 31, 172, CX - 20, 150, CX - 14, 132);
  ctx.closePath();
  ctx.fillStyle = hex(shade(o, 0.45), 0.35);
  ctx.fill();
  line(ctx, hex(shade(o, -0.3), 0.45), 1, () => { for (const k of [-2, -1, 0, 1, 2]) { ctx.moveTo(CX + k * 5, 134); ctx.quadraticCurveTo(CX + k * 10, 170, CX + k * 15 + sw, hemY + 2); } });
  const stars: [number, number][] = [[-18, 160], [12, 150], [-6, 178], [22, 184], [-26, 196], [4, 200], [28, 204], [-12, 206]];
  for (const [x, y] of stars) if (y < hemY - 2) sparkle(ctx, CX + x + sw * ((y - 130) / 80), y, 2, 'rgba(255,244,210,0.95)');
}

function pajamaTop(ctx: Ctx, P: Palette, sh: number, hemY: number) {
  const o = P.outfit, lineC = shade(o, -0.42), pipe = P.her ? P.accent : 0xffffff;
  torsoPath(ctx, 97, sh, sh + 2, 128, sh + 3, hemY, 8, 6);
  ink(ctx, cloth(ctx, o), lineC, 1.2);
  ctx.save();
  torsoPath(ctx, 97, sh, sh + 2, 128, sh + 3, hemY, 8, 6);
  ctx.clip();
  if (P.her) {
    const dots: [number, number][] = [[-12, 112], [10, 120], [-4, 132], [14, 140], [-15, 148], [4, 152], [-8, 124]];
    for (const [x, y] of dots) sparkle(ctx, CX + x, y, 2.2, 'rgba(255,255,255,0.85)');
  } else {
    line(ctx, 'rgba(255,255,255,0.4)', 1.4, () => { for (let x = CX - 24; x <= CX + 24; x += 5) { ctx.moveTo(x, 96); ctx.lineTo(x, hemY + 6); } });
  }
  ctx.restore();
  line(ctx, hex(lineC, 0.5), 1, () => { ctx.moveTo(CX + 1, 108); ctx.lineTo(CX + 1, hemY + 2); });
  for (let y = 113; y < hemY - 4; y += 12) { ctx.beginPath(); ctx.arc(CX + 3.5, y, 1.7, 0, Math.PI * 2); ink(ctx, '#ffffff', 'rgba(120,110,130,0.7)', 0.8); }
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(CX + s * 1, 101);
    ctx.lineTo(CX + s * 9, 96);
    ctx.lineTo(CX + s * 14, 103);
    ctx.lineTo(CX + s * 5, 111);
    ctx.closePath();
    ink(ctx, hex(shade(o, 0.12)), pipe, 1.4);
  }
  ctx.beginPath(); ctx.roundRect(CX - (P.her ? 17 : 19), 116, 9, 9, 2);
  ink(ctx, hex(shade(o, 0.06)), pipe, 1.2);
}

function hoodie(ctx: Ctx, P: Palette, raglan: boolean) {
  const o = P.outfit, lineC = shade(o, -0.45);
  torsoPath(ctx, 97, 22, 24, 128, 24, 168, 10, 4);
  ink(ctx, cloth(ctx, o), lineC, 1.2);
  if (raglan) {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(CX + s * 23, 106);
      ctx.quadraticCurveTo(CX + s * 23, 97, CX + s * 13, 96.5);
      ctx.lineTo(CX + s * 23, 122);
      ctx.closePath();
      ink(ctx, hex(RAGLAN_SLEEVE), shade(RAGLAN_SLEEVE, -0.35), 1);
    }
  }
  // ribbed hem
  ctx.beginPath(); ctx.roundRect(CX - 24.5, 162, 49, 8, 3.5);
  ink(ctx, hex(shade(o, -0.12)), lineC, 1);
  line(ctx, hex(shade(o, -0.3), 0.6), 0.9, () => { for (let x = CX - 22; x <= CX + 22; x += 3.5) { ctx.moveTo(x, 163.5); ctx.lineTo(x, 169); } });
  // kangaroo pocket
  ctx.beginPath();
  ctx.moveTo(CX - 15, 160); ctx.lineTo(CX - 12, 141); ctx.lineTo(CX + 12, 141); ctx.lineTo(CX + 15, 160); ctx.closePath();
  ink(ctx, hex(shade(o, 0.06)), lineC, 1.1);
  line(ctx, hex(lineC, 0.6), 1, () => { ctx.moveTo(CX - 12, 143); ctx.quadraticCurveTo(CX - 15, 150, CX - 14.5, 158); ctx.moveTo(CX + 12, 143); ctx.quadraticCurveTo(CX + 15, 150, CX + 14.5, 158); });
  // hood bunched around the neck
  ctx.beginPath();
  ctx.moveTo(CX - 19, 95);
  ctx.quadraticCurveTo(CX, 117, CX + 19, 95);
  ctx.quadraticCurveTo(CX + 12, 99, CX + 9, 99);
  ctx.quadraticCurveTo(CX, 108, CX - 9, 99);
  ctx.quadraticCurveTo(CX - 12, 99, CX - 19, 95);
  ctx.closePath();
  ink(ctx, hex(shade(o, 0.14)), lineC, 1.1);
  // drawstrings
  line(ctx, 'rgba(25,20,28,0.95)', 1.6, () => { ctx.moveTo(CX - 5, 105); ctx.quadraticCurveTo(CX - 6.5, 116, CX - 6, 128); ctx.moveTo(CX + 5, 105); ctx.quadraticCurveTo(CX + 6.5, 116, CX + 6, 128); });
  line(ctx, raglan ? '#f2eef4' : hex(shade(o, 0.5)), 1.6, () => { ctx.moveTo(CX - 5, 105); ctx.quadraticCurveTo(CX - 6.5, 116, CX - 6, 128); ctx.moveTo(CX + 5, 105); ctx.quadraticCurveTo(CX + 6.5, 116, CX + 6, 128); });
  ellipse(ctx, CX - 6, 129.5, 1.5, 2.2, '#c8c8d0');
  ellipse(ctx, CX + 6, 129.5, 1.5, 2.2, '#c8c8d0');
}

function shirt(ctx: Ctx, P: Palette) {
  const o = P.outfit, lineC = shade(o, -0.4);
  torsoPath(ctx, 97, 22, 23, 128, 24, 166, 8, 6);
  ink(ctx, cloth(ctx, o), lineC, 1.2);
  line(ctx, hex(lineC, 0.4), 1, () => { ctx.moveTo(CX - 16, 140); ctx.quadraticCurveTo(CX - 12, 150, CX - 14, 162); ctx.moveTo(CX + 18, 128); ctx.quadraticCurveTo(CX + 13, 140, CX + 15, 150); });
  line(ctx, hex(lineC, 0.55), 1, () => { ctx.moveTo(CX + 1, 104); ctx.lineTo(CX + 1, 168); });
  for (let y = 110; y < 164; y += 12) { ctx.beginPath(); ctx.arc(CX + 3.2, y, 1.4, 0, Math.PI * 2); ink(ctx, '#f8f8fa', 'rgba(120,120,140,0.8)', 0.8); }
  ctx.beginPath(); ctx.roundRect(CX - 17, 114, 9, 10, 1.5);
  ink(ctx, hex(shade(o, 0.04)), lineC, 1);
  collar(ctx, o, lineC);
}

function collar(ctx: Ctx, o: number, lineC: number) {
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(CX + s * 1, 101);
    ctx.lineTo(CX + s * 10, 94.5);
    ctx.lineTo(CX + s * 12, 98);
    ctx.lineTo(CX + s * 6, 108);
    ctx.closePath();
    ink(ctx, hex(shade(o, 0.08)), lineC, 1.1);
  }
}

function formal(ctx: Ctx, P: Palette) {
  const white = 0xf6f6fa, vest = P.outfit, lineC = shade(vest, -0.45);
  torsoPath(ctx, 97, 22, 23, 128, 24, 166, 8, 6);
  ink(ctx, cloth(ctx, white), 'rgba(130,130,150,0.8)', 1.2);
  // tie
  ctx.beginPath(); ctx.moveTo(CX - 3, 101); ctx.lineTo(CX + 3, 101); ctx.lineTo(CX + 2, 105); ctx.lineTo(CX - 2, 105); ctx.closePath();
  ink(ctx, '#8a2238', '#5a1424', 1);
  ctx.beginPath(); ctx.moveTo(CX - 2, 105); ctx.lineTo(CX + 2, 105); ctx.lineTo(CX + 3.6, 128); ctx.lineTo(CX, 132); ctx.lineTo(CX - 3.6, 128); ctx.closePath();
  ink(ctx, vg(ctx, 105, 132, 0xa83048, 0x7a1c30), '#5a1424', 1);
  // waistcoat
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(CX + s * 15, 99);
    ctx.lineTo(CX + s * 4, 104);
    ctx.lineTo(CX + s * 0.5, 134);
    ctx.lineTo(CX + s * 0.5, 158);
    ctx.lineTo(CX + s * 10, 164);
    ctx.lineTo(CX + s * 24, 160);
    ctx.quadraticCurveTo(CX + s * 24, 126, CX + s * 21, 100);
    ctx.closePath();
    ink(ctx, cloth(ctx, vest), lineC, 1.2);
  }
  for (const y of [138, 147, 156]) ellipse(ctx, CX - 3, y, 1.5, 1.5, hex(shade(vest, 0.4)));
  ctx.beginPath(); ctx.roundRect(CX + 8, 120, 10, 2.2, 1); ctx.fillStyle = hex(lineC, 0.7); ctx.fill();
  collar(ctx, white, 0x9a9aaa);
}

function catPrint(ctx: Ctx, x: number, y: number, bow: number) {
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 2); ctx.lineTo(x - 7, y - 9); ctx.lineTo(x - 3, y - 5);
  ctx.lineTo(x + 3, y - 5); ctx.lineTo(x + 7, y - 9); ctx.lineTo(x + 8, y - 2);
  ctx.quadraticCurveTo(x + 9, y + 6, x, y + 6);
  ctx.quadraticCurveTo(x - 9, y + 6, x - 8, y - 2);
  ctx.closePath();
  ink(ctx, '#ffffff', 'rgba(120,90,100,0.75)', 1);
  ellipse(ctx, x - 3.5, y, 1.1, 1.3, '#3a2a2a');
  ellipse(ctx, x + 3.5, y, 1.1, 1.3, '#3a2a2a');
  line(ctx, 'rgba(90,60,70,0.7)', 0.8, () => { ctx.moveTo(x - 1.2, y + 2.4); ctx.quadraticCurveTo(x, y + 3.4, x + 1.2, y + 2.4); });
  ellipse(ctx, x - 6, y + 2, 1.6, 1, 'rgba(255,140,160,0.7)');
  ellipse(ctx, x + 6, y + 2, 1.6, 1, 'rgba(255,140,160,0.7)');
  smallBow(ctx, x + 6, y - 6.5, bow, 0.7);
}

function smallBow(ctx: Ctx, x: number, y: number, c: number, k = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(s * 3, -5, s * 8, -4.5, s * 7, 0); ctx.bezierCurveTo(s * 8, 4.5, s * 3, 5, 0, 0);
    ink(ctx, hex(c), shade(c, -0.4), 0.9);
  }
  ellipse(ctx, 0, 0, 1.8, 2.2, hex(shade(c, -0.12)));
  ctx.restore();
}

// ------------------------------------------------------------------ arms & hands

/** Draws both arms; returns where the hands ended up (frame px, in the upper body's space). */
function arms(ctx: Ctx, P: Palette, O: Outfit, pose: BodyPose): Hands {
  const swingAmt = pose.arm ?? pose.phase ?? 0;
  const out: Hands = { L: [0, 0], R: [0, 0] };
  for (const side of [-1, 1] as const) {
    const sx = CX + side * O.shoulder, sy = SHOULDER_Y;
    const fixed = side < 0 ? pose.armL : pose.armR;
    const target = side < 0 ? pose.handL : pose.handR;
    let upperA: number, elbow = 0, food = false, fore = FORE;
    if (pose.eat && side > 0) {
      const [u, e] = pose.eat === 2 ? reach(sx, sy, CX + 6, 101, UPPER, FORE + 3, side) : reach(sx, sy, CX + 8, 120, UPPER, FORE + 3, side);
      upperA = u; elbow = e; food = pose.eat === 1;
    } else if (target) {
      const [tx, ty] = target;
      if (Math.hypot(tx - sx, ty - sy) > 44) {
        // Far: a real reach (watering, picking, pointing).
        [upperA, elbow] = reach(sx, sy, tx, ty, UPPER, FORE + 2, side);
      } else {
        // Close to the body: elbow stays down at the side and the forearm comes toward us, so it looks shorter.
        upperA = -side * 0.1;
        const ex = sx - UPPER * Math.sin(upperA), ey = sy + UPPER * Math.cos(upperA);
        const fx = tx - ex, fy = ty - ey;
        fore = Math.max(6, Math.hypot(fx, fy) - 2);
        elbow = Math.atan2(-fx, fy) - upperA || 0.001;
      }
    } else if (fixed !== undefined) {
      upperA = -side * fixed;
    } else if (pose.run) {
      // Elbows out, fists pumping: the forward hand comes up toward the chest, the back hand drops by the hip.
      const fwd = side * swingAmt;
      const [u, e] = reach(sx, sy, CX + side * (23 - fwd * 5), 148 - fwd * 9, UPPER, FORE + 3, side);
      upperA = u; elbow = e;
    } else {
      // Arms hang just clear of the body; the swing moves the forward hand a little inward, never across.
      const fwd = side * swingAmt;
      upperA = -side * (0.1 - 0.09 * fwd);
    }
    const pointing = pose.point === side;
    arm(ctx, P, O.sleeve, side, sx, sy, upperA, elbow, food, fore, pointing);
    // Where the hand is drawn (the same chain as arm()).
    if (elbow === 0) out[side < 0 ? 'L' : 'R'] = [sx - 57 * Math.sin(upperA), sy + 57 * Math.cos(upperA)];
    else {
      const ex = sx - UPPER * Math.sin(upperA), ey = sy + UPPER * Math.cos(upperA);
      out[side < 0 ? 'L' : 'R'] = [ex - (fore + 2) * Math.sin(upperA + elbow), ey + (fore + 2) * Math.cos(upperA + elbow)];
    }
  }
  return out;
}

function arm(ctx: Ctx, P: Palette, S: Sleeve, side: -1 | 1, sx: number, sy: number, upperA: number, elbow: number, food: boolean, fore = FORE, pointing = false) {
  const skinFill = hg(ctx, -6, 6, P.skinLight, P.skin, P.skinShade);
  const skinLine = 'rgba(170,95,90,0.5)';
  const sleeveFill = (len: number) => S.sheer ? hex(S.color, 0.75) : vg(ctx, -3, len, shade(S.color, 0.08), shade(S.color, -0.1));
  const sleeveLine = shade(S.color, -0.42);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(upperA);
  if (elbow === 0) {
    const handY = 57;
    // forearm
    ctx.beginPath(); ctx.roundRect(-4.6, Math.min(S.len - 4, 40), 9.2, handY - Math.min(S.len - 4, 40), 4.6);
    ink(ctx, skinFill, skinLine, 1);
    if (pointing) pointHand(ctx, P, handY);
    else if (!S.paw) hand(ctx, P, side, 0, handY);
    sleeveSeg(ctx, S, 0, Math.min(S.len, 56), sleeveFill, sleeveLine);
    if (S.paw && !pointing) { hand(ctx, P, side, 0, handY + 1); pawCuff(ctx, S, handY - 4); }
  } else {
    // upper arm
    if (S.len >= UPPER) sleeveSeg(ctx, S, 0, UPPER + 3, sleeveFill, sleeveLine, true);
    else {
      ctx.beginPath(); ctx.roundRect(-4.8, 0, 9.6, UPPER + 3, 4.8); ink(ctx, skinFill, skinLine, 1);
      sleeveSeg(ctx, S, 0, S.len, sleeveFill, sleeveLine);
    }
    ctx.translate(0, UPPER);
    ctx.rotate(elbow);
    const rest = S.len - UPPER;
    ellipse(ctx, 0, -1, S.len >= UPPER ? S.w / 2 : 4.8, 4, S.len >= UPPER ? hex(S.color) : hex(P.skin)); // elbow joint
    ctx.beginPath(); ctx.roundRect(-4.5, -3, 9, fore + 3, 4.5); ink(ctx, skinFill, skinLine, 1);
    if (food) heldFood(ctx, upperA + elbow);
    if (pointing) pointHand(ctx, P, fore + 2);
    else hand(ctx, P, side, 0, fore + 2);
    // A foreshortened forearm shows less sleeve, so the hand stays visible.
    const sl = Math.min(rest, fore) - (fore < FORE ? 4 : 0);
    if (rest > 0 && sl > 2) {
      sleeveSeg(ctx, S, -4, sl, sleeveFill, sleeveLine);
      if (S.paw && fore >= FORE) pawCuff(ctx, S, fore - 3);
    }
  }
  ctx.restore();
}

function sleeveSeg(ctx: Ctx, S: Sleeve, y0: number, len: number, fill: (len: number) => string | CanvasGradient, lineC: number, noCuff = false) {
  if (S.puff) {
    ctx.beginPath();
    ctx.ellipse(0, y0 + 6, S.w / 2 + 1, 10, 0, 0, Math.PI * 2);
    ink(ctx, fill(16), lineC, 1.1);
    line(ctx, hex(lineC, 0.5), 1, () => { ctx.moveTo(-4, y0 + 13); ctx.quadraticCurveTo(-2, y0 + 8, -3, y0 + 1); ctx.moveTo(3, y0 + 14); ctx.quadraticCurveTo(4, y0 + 8, 2, y0 + 1); });
    line(ctx, 'rgba(255,255,255,0.85)', 1.6, () => { ctx.moveTo(-S.w / 2, y0 + 14); ctx.quadraticCurveTo(0, y0 + 17.5, S.w / 2, y0 + 14); });
    return;
  }
  ctx.beginPath();
  ctx.moveTo(-S.w / 2 + 0.5, y0 - 3);
  ctx.lineTo(S.w / 2 - 0.5, y0 - 3);
  ctx.quadraticCurveTo(S.w / 2 + 0.6, y0 + len / 2, S.w / 2, y0 + len);
  ctx.lineTo(-S.w / 2, y0 + len);
  ctx.quadraticCurveTo(-S.w / 2 - 0.6, y0 + len / 2, -S.w / 2 + 0.5, y0 - 3);
  ctx.closePath();
  ink(ctx, fill(len), lineC, 1.1);
  if (S.stripes) line(ctx, 'rgba(255,255,255,0.4)', 1.2, () => { for (let x = -S.w / 2 + 2.5; x < S.w / 2; x += 4.5) { ctx.moveTo(x, y0 - 2); ctx.lineTo(x, y0 + len); } });
  line(ctx, hex(lineC, 0.4), 1, () => { ctx.moveTo(-S.w / 2 + 2.5, y0 + len * 0.45); ctx.quadraticCurveTo(0, y0 + len * 0.55, S.w / 2 - 2, y0 + len * 0.42); });
  if (noCuff) return;
  if (S.rolled) {
    ctx.beginPath(); ctx.roundRect(-S.w / 2 - 0.8, y0 + len - 6, S.w + 1.6, 7, 3);
    ink(ctx, hex(shade(S.color, 0.06)), lineC, 1);
    line(ctx, hex(lineC, 0.5), 0.9, () => { ctx.moveTo(-S.w / 2, y0 + len - 2.5); ctx.lineTo(S.w / 2, y0 + len - 2.5); });
  } else if (S.cuff !== undefined && !S.paw) {
    ctx.beginPath(); ctx.roundRect(-S.w / 2 + 0.4, y0 + len - 6, S.w - 0.8, 6.5, 3);
    ink(ctx, hex(S.cuff), shade(S.cuff, -0.4), 1);
  }
}

/** Sweater sleeve pulled over the back of the hand ("sweater paws"). */
function pawCuff(ctx: Ctx, S: Sleeve, y: number) {
  ctx.beginPath();
  ctx.roundRect(-S.w / 2 + 0.5, y - 2, S.w - 1, 8, 3.5);
  ink(ctx, hex(S.cuff ?? S.color), shade(S.color, -0.4), 1);
  line(ctx, hex(shade(S.color, -0.25), 0.6), 0.9, () => { for (let x = -S.w / 2 + 3; x < S.w / 2 - 1; x += 3) { ctx.moveTo(x, y - 1); ctx.lineTo(x, y + 5); } });
}

function hand(ctx: Ctx, P: Palette, side: number, x: number, y: number) {
  const fill = hg(ctx, x - 6, x + 6, P.skinLight, P.skin, P.skinShade);
  const lineC = 'rgba(170,95,90,0.55)';
  ctx.beginPath();
  ctx.ellipse(x - side * 3.8, y - 1.5, 2.4, 3.6, side * 0.45, 0, Math.PI * 2);
  ink(ctx, fill, lineC, 1);
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 4);
  ctx.quadraticCurveTo(x - 5.6, y + 4, x - 1.5, y + 6.2);
  ctx.quadraticCurveTo(x + 4.5, y + 6.4, x + 5.2, y + 1);
  ctx.quadraticCurveTo(x + 5, y - 4.6, x, y - 5);
  ctx.quadraticCurveTo(x - 4.2, y - 5, x - 5, y - 4);
  ctx.closePath();
  ink(ctx, fill, lineC, 1);
  line(ctx, 'rgba(170,95,90,0.4)', 0.8, () => { ctx.moveTo(x - 1, y + 2.2); ctx.lineTo(x - 1.2, y + 5.4); ctx.moveTo(x + 2, y + 1.8); ctx.lineTo(x + 2.2, y + 5); });
}

/** A loose fist with the index finger out along the arm (pointing at something). */
function pointHand(ctx: Ctx, P: Palette, y: number) {
  const fill = hg(ctx, -6, 6, P.skinLight, P.skin, P.skinShade);
  const lineC = 'rgba(170,95,90,0.55)';
  ctx.beginPath(); ctx.roundRect(-1.6, y + 1, 3.4, 10, 1.7);
  ink(ctx, fill, lineC, 1);
  ctx.beginPath(); ctx.ellipse(0, y, 4.6, 4.4, 0, 0, Math.PI * 2);
  ink(ctx, fill, lineC, 1);
  line(ctx, 'rgba(170,95,90,0.4)', 0.8, () => { ctx.moveTo(-3, y + 1); ctx.lineTo(1, y + 2.4); });
}

/** A sandwich held upright in the hand (the arm's rotation is undone so it stays level). */
function heldFood(ctx: Ctx, rot: number) {
  ctx.save();
  ctx.translate(0, FORE + 1);
  ctx.rotate(-rot);
  ctx.translate(-1, -8);
  ctx.beginPath(); ctx.moveTo(-8, 5); ctx.lineTo(8, 5); ctx.lineTo(0, -8); ctx.closePath();
  ink(ctx, '#f6e2b4', '#c9965a', 1.3);
  line(ctx, '#7cc46a', 1.8, () => { ctx.moveTo(-6.5, 2.6); ctx.quadraticCurveTo(-3, 1.2, 0, 2.4); ctx.quadraticCurveTo(3, 3.8, 6.5, 2.6); });
  line(ctx, '#ec6a5a', 1.3, () => { ctx.moveTo(-5.5, 4); ctx.lineTo(5.5, 4); });
  ctx.restore();
}

export type { OutfitStyle };

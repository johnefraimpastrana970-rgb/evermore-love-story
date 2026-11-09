/*
 * The head layer: hair cap, head, ears, face (eyes, brows, nose, mouth, blush), effects, glasses, front hair and
 * accessories. Drawn in frame coordinates (see spec.ts); the head sheet crops it to HEAD_TOP..HEAD_BOTTOM.
 */
import { ellipse, type Ctx } from '../paint';
import { FACE_SPEC, type EyeKind, type Face, type FaceSpec, type MouthKind } from './spec';
import { drop, hex, ink, line, lock, palette, shade, sparkle, vg, type Look, type Palette } from './kit';

const CX = 60;

export interface HeadOpts {
  blink?: boolean;
  /** The face's animated alternate frame (see FaceSpec.alt). */
  alt?: boolean;
}

interface EyeGeo { y: number; rx: number; ry: number; gap: number }
const eyeGeo = (P: Palette): EyeGeo => (P.her ? { y: 69, rx: 8.2, ry: 10, gap: 14 } : { y: 70, rx: 7.4, ry: 8.8, gap: 13.5 });

export function drawHead(ctx: Ctx, look: Look, face: Face, opts: HeadOpts = {}) {
  const P = palette(look);
  const spec = FACE_SPEC[face];
  let eye: EyeKind = spec.eye;
  let mouth: MouthKind = spec.mouth;
  if (opts.alt && spec.alt) { eye = spec.alt.eye ?? eye; mouth = spec.alt.mouth ?? mouth; }
  if (opts.blink && eye === 'open') eye = 'calm';
  const g = eyeGeo(P);
  const extra = new Set(spec.extra ?? []);

  ctx.save();
  backCap(ctx, P);
  ears(ctx, P);
  if (extra.has('puff')) puff(ctx, P);
  faceShape(ctx, P);
  bangShadow(ctx, P);
  blush(ctx, P, spec.blush, extra.has('hatch'));
  for (const side of [-1, 1] as const) {
    const ex = CX + side * g.gap + (P.her ? 0 : 0.5);
    drawEye(ctx, P, eye, ex, g.y, side, g, spec);
    if (eye === 'open' && extra.has('tearGlint')) tearGlint(ctx, ex, g, side);
  }
  nose(ctx, P);
  drawMouth(ctx, P, mouth, CX + 1, 87);
  if (P.her) ellipse(ctx, CX - 9.5, 83.5, 1.1, 1.1, '#4a2a30'); // her beauty mark
  if (extra.has('tears')) tears(ctx, g, !!opts.alt);
  if (extra.has('bubble')) bubble(ctx, !!opts.alt);
  if (face === 'eating' && opts.alt) food(ctx, P);
  if (P.her) glassesRect(ctx, g); else glassesRound(ctx, g);
  if (P.her) herFront(ctx, P); else hisFront(ctx, P);
  if (P.her) (look.acc === 'crown' ? crown : bow)(ctx, P);
  brows(ctx, P, g, spec.brow);
  if (extra.has('anger')) anger(ctx);
  if (extra.has('sweat')) sweat(ctx);
  if (extra.has('sparkle')) { sparkle(ctx, CX + 40, 34, 4.2, '#ffd86a'); sparkle(ctx, CX - 41, 50, 2.8, '#ffe9a8'); }
  ctx.restore();
}

// ------------------------------------------------------------------ head & skin

function facePath(ctx: Ctx) {
  ctx.beginPath();
  ctx.moveTo(CX + 34, 58);
  ctx.ellipse(CX, 58, 34, 36, 0, 0, Math.PI, true);
  ctx.bezierCurveTo(CX - 35, 78, CX - 29, 90, CX - 15, 95.5);
  ctx.quadraticCurveTo(CX, 100.5, CX + 15, 95.5);
  ctx.bezierCurveTo(CX + 29, 90, CX + 35, 78, CX + 34, 58);
  ctx.closePath();
}

function faceShape(ctx: Ctx, P: Palette) {
  facePath(ctx);
  const g = ctx.createRadialGradient(CX - 7, 66, 3, CX, 68, 46);
  g.addColorStop(0, hex(P.skinLight));
  g.addColorStop(0.45, hex(P.skin));
  g.addColorStop(1, hex(P.skinShade));
  ctx.fillStyle = g;
  ctx.fill();
  // Soft jaw line.
  line(ctx, 'rgba(170,95,90,0.5)', 1.3, () => {
    ctx.moveTo(CX - 34.5, 70);
    ctx.bezierCurveTo(CX - 33, 84, CX - 28, 90, CX - 15, 95.5);
    ctx.quadraticCurveTo(CX, 100.5, CX + 15, 95.5);
    ctx.bezierCurveTo(CX + 28, 90, CX + 33, 84, CX + 34.5, 70);
  });
}

function ears(ctx: Ctx, P: Palette) {
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(CX + side * 34, 72, 4.8, 7, side * 0.15, 0, Math.PI * 2);
    ink(ctx, hex(P.skin), 'rgba(170,95,90,0.5)', 1.1);
    ellipse(ctx, CX + side * 34.6, 72.5, 2.2, 4, hex(P.skinShade));
  }
}

/** Puffed-out cheek (pouting, chewing). */
function puff(ctx: Ctx, P: Palette) {
  ctx.beginPath();
  ctx.ellipse(CX + 29, 84, 8, 9, -0.2, 0, Math.PI * 2);
  ink(ctx, hex(P.skin), 'rgba(170,95,90,0.5)', 1.2);
}

/** The bangs cast a soft shadow on the forehead. */
function bangShadow(ctx: Ctx, P: Palette) {
  ctx.save();
  facePath(ctx);
  ctx.clip();
  ctx.translate(0.6, 3.6);
  if (P.her) herFrontPath(ctx); else hisFrontPath(ctx);
  ctx.fillStyle = hex(P.skinDeep, 0.28);
  ctx.fill();
  ctx.restore();
}

function blush(ctx: Ctx, P: Palette, a: number, hatch: boolean) {
  for (const side of [-1, 1]) {
    const x = CX + side * 21, y = 81.5;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.55);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
    g.addColorStop(0, `rgba(${P.blush},${a * 0.75})`);
    g.addColorStop(1, `rgba(${P.blush},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(-10, -10, 20, 20);
    ctx.restore();
    if (hatch) {
      line(ctx, 'rgba(225,85,120,0.65)', 1.05, () => {
        for (let i = 0; i < 3; i++) { ctx.moveTo(x - 4.5 + i * 3.4, y + 2.4); ctx.lineTo(x - 2.4 + i * 3.4, y - 2.4); }
      });
    }
  }
}

function nose(ctx: Ctx, P: Palette) {
  line(ctx, hex(P.skinDeep, 0.75), 1.15, () => { ctx.moveTo(CX + 0.6, 76.5); ctx.quadraticCurveTo(CX + 2.6, 79, CX + 0.4, 80); });
  ellipse(ctx, CX - 0.4, 76.6, 0.9, 0.9, 'rgba(255,255,255,0.7)');
}

// ------------------------------------------------------------------ eyes

function drawEye(ctx: Ctx, P: Palette, kind: EyeKind, ex: number, ey: number, side: -1 | 1, g: EyeGeo, spec: FaceSpec) {
  const lashC = hex(P.lash);
  const lw = P.her ? 2.7 : 2.4;
  if (kind === 'smile') {
    line(ctx, lashC, lw, () => ctx.arc(ex, ey + 4.5, g.rx * 0.92, Math.PI * 1.16, Math.PI * 1.84));
    if (P.her) line(ctx, lashC, 1.6, () => { const a = side > 0 ? Math.PI * 1.84 : Math.PI * 1.16; const x = ex + Math.cos(a) * g.rx * 0.92, y = ey + 4.5 + Math.sin(a) * g.rx * 0.92; ctx.moveTo(x, y); ctx.lineTo(x + side * 3, y - 1.2); });
    return;
  }
  if (kind === 'calm') {
    line(ctx, lashC, lw, () => ctx.arc(ex, ey - 2, g.rx * 0.92, Math.PI * 0.14, Math.PI * 0.86));
    if (P.her) line(ctx, lashC, 1.3, () => {
      const a = side > 0 ? Math.PI * 0.14 : Math.PI * 0.86;
      const x = ex + Math.cos(a) * g.rx * 0.92, y = ey - 2 + Math.sin(a) * g.rx * 0.92;
      ctx.moveTo(x, y); ctx.lineTo(x + side * 2.6, y + 2.4);
      ctx.moveTo(x - side * 2.5, y + 1.8); ctx.lineTo(x - side * 3.4, y + 4.4);
    });
    return;
  }
  if (kind === 'squeeze') {
    line(ctx, lashC, lw, () => {
      ctx.moveTo(ex + side * 5.5, ey - 5);
      ctx.quadraticCurveTo(ex - side * 1, ey - 1.5, ex - side * 4.5, ey + 0.5);
      ctx.quadraticCurveTo(ex - side * 0.5, ey + 2.5, ex + side * 5, ey + 5);
    });
    return;
  }

  // Open eye: white, iris, pupil, glow, highlights, then the lid and lashes.
  const { rx, ry } = g;
  const lid = spec.lid ?? 0, tilt = spec.lidTilt ?? 0;
  const lookX = spec.lookX ?? 0, lookY = spec.lookY ?? 0;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = vg(ctx, ey - ry, ey + ry, 0xe9dde6, 0xffffff);
  ctx.fill();
  ctx.clip();
  const sh = ctx.createLinearGradient(0, ey - ry, 0, ey - ry + 5);
  sh.addColorStop(0, hex(P.lash, 0.35));
  sh.addColorStop(1, hex(P.lash, 0));
  ctx.fillStyle = sh;
  ctx.fillRect(ex - rx, ey - ry, rx * 2, 6);
  const ix = ex + lookX, iy = ey + 1 + lookY, irx = rx * 0.84, iry = ry * 0.88;
  ctx.beginPath();
  ctx.ellipse(ix, iy, irx, iry, 0, 0, Math.PI * 2);
  const ig = ctx.createLinearGradient(0, iy - iry, 0, iy + iry);
  ig.addColorStop(0, hex(shade(P.iris, -0.55)));
  ig.addColorStop(0.5, hex(P.iris));
  ig.addColorStop(1, hex(shade(P.iris, 0.5)));
  ctx.fillStyle = ig;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = hex(shade(P.iris, -0.65), 0.9);
  ctx.stroke();
  const pupil = spec.pupil ?? 1;
  ellipse(ctx, ix, iy + 0.6, irx * 0.46 * pupil, iry * 0.5 * pupil, hex(shade(P.iris, -0.75)));
  const gy = iy + iry * 0.6;
  const glow = ctx.createRadialGradient(ix, gy, 0, ix, gy, irx);
  glow.addColorStop(0, hex(shade(P.iris, 0.75), 0.8));
  glow.addColorStop(1, hex(shade(P.iris, 0.75), 0));
  ctx.fillStyle = glow;
  ctx.fillRect(ix - irx, gy - irx, irx * 2, irx * 2);
  ellipse(ctx, ix - irx * 0.4, iy - iry * 0.42, P.her ? 2.8 : 2.4, P.her ? 3.5 : 3, '#ffffff');
  ellipse(ctx, ix + irx * 0.42, iy + iry * 0.4, 1.3, 1.3, 'rgba(255,255,255,0.9)');
  if (spec.sparkle) sparkle(ctx, ix + irx * 0.3, iy - iry * 0.5, 2.6, '#ffffff');
  // Upper lid.
  let yL = ey - ry, yR = ey - ry;
  if (lid > 0) {
    const base = ey - ry + lid * 2 * ry * 0.92;
    const yOuter = base + tilt * 3, yInner = base - tilt * 3;
    yL = side < 0 ? yOuter : yInner;
    yR = side < 0 ? yInner : yOuter;
    ctx.beginPath();
    ctx.moveTo(ex - rx - 2, ey - ry - 2);
    ctx.lineTo(ex + rx + 2, ey - ry - 2);
    ctx.lineTo(ex + rx + 2, yR);
    ctx.quadraticCurveTo(ex, (yL + yR) / 2 - 1.5, ex - rx - 2, yL);
    ctx.closePath();
    ctx.fillStyle = vg(ctx, ey - ry, Math.max(yL, yR), P.skin, P.skinShade);
    ctx.fill();
  }
  ctx.restore();
  // Lashes.
  if (lid > 0) {
    line(ctx, lashC, lw + 0.2, () => { ctx.moveTo(ex - rx * 0.98, yL + 1); ctx.quadraticCurveTo(ex, (yL + yR) / 2 - 1.5, ex + rx * 0.98, yR + 1); });
  } else {
    line(ctx, lashC, lw, () => ctx.ellipse(ex, ey, rx + 0.3, ry + 0.3, 0, Math.PI * 1.05, Math.PI * 1.95));
    // Thicker toward the outer corner.
    line(ctx, lashC, lw + 1, () => side < 0
      ? ctx.ellipse(ex, ey, rx + 0.3, ry + 0.3, 0, Math.PI * 1.04, Math.PI * 1.36)
      : ctx.ellipse(ex, ey, rx + 0.3, ry + 0.3, 0, Math.PI * 1.64, Math.PI * 1.96));
    if (P.her) line(ctx, hex(P.lash, 0.3), 0.9, () => ctx.ellipse(ex, ey - 1, rx + 1.6, ry + 2.4, 0, Math.PI * 1.22, Math.PI * 1.78)); // crease
  }
  const oy = lid > 0 ? (side < 0 ? yL : yR) + 1 : ey - ry * 0.35;
  const ox = ex + side * rx * (lid > 0 ? 0.98 : 0.97);
  if (P.her) {
    line(ctx, lashC, 1.9, () => { ctx.moveTo(ox, oy); ctx.quadraticCurveTo(ox + side * 2, oy - 1, ox + side * 3.6, oy - 3.4); });
    line(ctx, lashC, 1.3, () => { ctx.moveTo(ox - side * 1.2, oy - 2.4); ctx.lineTo(ox + side * 1.6, oy - 5.4); });
  }
  // Lower lashes, toward the outer corner.
  line(ctx, hex(P.lash, 0.55), 1.1, () => side < 0
    ? ctx.ellipse(ex, ey, rx, ry, 0, Math.PI * 0.68, Math.PI * 0.9)
    : ctx.ellipse(ex, ey, rx, ry, 0, Math.PI * 0.1, Math.PI * 0.32));
}

function brows(ctx: Ctx, P: Palette, g: EyeGeo, [inner, outer]: [number, number]) {
  const by = g.y - g.ry - (P.her ? 5.5 : 5);
  for (const side of [-1, 1]) {
    const ex = CX + side * g.gap;
    const ix = ex - side * 5.5, ox = ex + side * 6.5;
    const iy = by + inner, oy = by + outer;
    line(ctx, hex(P.brow, 0.9), P.her ? 2 : 2.7, () => {
      ctx.moveTo(ix, iy);
      ctx.quadraticCurveTo(ex, Math.min(iy, oy) - 2, ox, oy);
    });
  }
}

// ------------------------------------------------------------------ mouth

function drawMouth(ctx: Ctx, P: Palette, kind: MouthKind, mx: number, my: number) {
  const lip = hex(P.lip);
  const open = (w: number, top: number, depth: number, wobble = false, teeth = false) => {
    ctx.beginPath();
    ctx.moveTo(mx - w, my + top);
    if (wobble) { ctx.quadraticCurveTo(mx - w / 2, my + top - 3, mx, my + top - 0.5); ctx.quadraticCurveTo(mx + w / 2, my + top - 3, mx + w, my + top); }
    else ctx.quadraticCurveTo(mx, my + top + 1.2, mx + w, my + top);
    ctx.quadraticCurveTo(mx + w * 0.85, my + top + depth, mx, my + top + depth);
    ctx.quadraticCurveTo(mx - w * 0.85, my + top + depth, mx - w, my + top);
    ctx.closePath();
    ctx.save();
    ink(ctx, hex(P.mouth), hex(shade(P.mouth, -0.3)), 1.1);
    ctx.clip();
    ellipse(ctx, mx, my + top + depth - 0.5, w * 0.62, depth * 0.38, hex(P.tongue));
    if (teeth) { ctx.fillStyle = '#fffafa'; ctx.fillRect(mx - w, my + top - 1, w * 2, 2.2); }
    ctx.restore();
  };
  switch (kind) {
    case 'soft': line(ctx, lip, 1.6, () => { ctx.moveTo(mx - 3.6, my); ctx.quadraticCurveTo(mx, my + 2.8, mx + 3.6, my); }); break;
    case 'smile': line(ctx, lip, 1.8, () => { ctx.moveTo(mx - 5.5, my - 1.2); ctx.quadraticCurveTo(mx, my + 4.6, mx + 5.5, my - 1.2); }); break;
    case 'open': open(5.8, -1.5, 8, false, true); break;
    case 'laugh': open(7.4, -2.5, 10.5, false, true); break;
    case 'frown': line(ctx, lip, 1.7, () => { ctx.moveTo(mx - 4.2, my + 2); ctx.quadraticCurveTo(mx, my - 2.2, mx + 4.2, my + 2); }); break;
    case 'wail': open(6.2, 0, 8.5, true); break;
    case 'flat': line(ctx, lip, 1.7, () => { ctx.moveTo(mx - 4.8, my + 1.2); ctx.lineTo(mx + 3.6, my - 0.2); ctx.quadraticCurveTo(mx + 5, my - 0.2, mx + 5.6, my + 1.4); }); break;
    case 'pout':
      ctx.beginPath();
      ctx.ellipse(mx + 1.5, my + 1, 2.8, 2.3, 0, 0, Math.PI * 2);
      ink(ctx, hex(shade(P.lip, 0.35)), lip, 1.2);
      line(ctx, lip, 1, () => { ctx.moveTo(mx + 0.2, my + 1); ctx.lineTo(mx + 2.8, my + 1); });
      break;
    case 'o': ctx.beginPath(); ctx.ellipse(mx, my + 2, 3.4, 4.4, 0, 0, Math.PI * 2); ink(ctx, hex(P.mouth), hex(shade(P.mouth, -0.3)), 1); ellipse(ctx, mx, my + 4.4, 2, 1.4, hex(P.tongue)); break;
    case 'small-o': ctx.beginPath(); ctx.ellipse(mx, my + 1.5, 2.2, 2.6, 0, 0, Math.PI * 2); ink(ctx, hex(P.mouth), hex(shade(P.mouth, -0.3)), 1); break;
    case 'cat': line(ctx, lip, 1.6, () => { ctx.moveTo(mx - 6, my - 1); ctx.quadraticCurveTo(mx - 3, my + 3.6, mx, my); ctx.quadraticCurveTo(mx + 3, my + 3.6, mx + 6, my - 1); }); break;
    case 'wobble': line(ctx, lip, 1.5, () => { ctx.moveTo(mx - 4.4, my + 1); ctx.quadraticCurveTo(mx - 2.2, my - 1.4, mx, my + 1); ctx.quadraticCurveTo(mx + 2.2, my + 3.2, mx + 4.4, my + 1); }); break;
    case 'chew': line(ctx, lip, 1.6, () => { ctx.moveTo(mx - 3, my + 0.5); ctx.quadraticCurveTo(mx + 1, my + 2.6, mx + 4.4, my - 0.4); }); break;
    case 'sleep': ctx.beginPath(); ctx.ellipse(mx, my + 1.4, 2, 1.6, 0, 0, Math.PI * 2); ink(ctx, hex(P.mouth), hex(shade(P.mouth, -0.3)), 0.9); break;
  }
}

// ------------------------------------------------------------------ effects

function tears(ctx: Ctx, g: EyeGeo, alt: boolean) {
  for (const side of [-1, 1]) {
    const ex = CX + side * g.gap;
    const x0 = ex + side * 1.5, y0 = g.y + 3.5;
    const x1 = ex + side * 4, y1 = 95;
    ellipse(ctx, ex, g.y + 4.2, 5.6, 1.8, 'rgba(170,220,255,0.85)');
    line(ctx, 'rgba(140,200,255,0.85)', 3.4, () => { ctx.moveTo(x0, y0); ctx.bezierCurveTo(x0 + side * 0.5, y0 + 9, x1 - side * 1.5, y1 - 10, x1, y1); });
    line(ctx, 'rgba(255,255,255,0.7)', 1, () => { ctx.moveTo(x0 - side * 0.6, y0 + 3); ctx.bezierCurveTo(x0, y0 + 9, x1 - side * 2, y1 - 10, x1 - side * 0.8, y1 - 3); });
    drop(ctx, x1 + side * 0.5, alt ? 102 : 97.5, 2.5);
    ctx.fillStyle = 'rgba(160,215,255,0.95)';
    ctx.fill();
    ellipse(ctx, x1 - 0.5, (alt ? 102 : 97.5) - 0.8, 0.8, 1, 'rgba(255,255,255,0.9)');
  }
}

function tearGlint(ctx: Ctx, ex: number, g: EyeGeo, side: number) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(ex, g.y, g.rx, g.ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ellipse(ctx, ex, g.y + g.ry * 0.62, g.rx * 0.8, g.ry * 0.26, 'rgba(195,232,255,0.6)');
  ctx.restore();
  drop(ctx, ex + side * (g.rx - 0.5), g.y + g.ry + 2.2, 1.5);
  ctx.fillStyle = 'rgba(165,215,255,0.95)';
  ctx.fill();
}

function anger(ctx: Ctx) {
  const x = CX + 31, y = 27;
  for (const [w, c] of [[4.4, '#ffffff'], [2.2, '#e8476d']] as const) {
    for (let q = 0; q < 4; q++) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((q * Math.PI) / 2);
      line(ctx, c, w, () => { ctx.moveTo(1.6, 6); ctx.quadraticCurveTo(1.6, 1.6, 6, 1.6); });
      ctx.restore();
    }
  }
}

function sweat(ctx: Ctx) {
  drop(ctx, CX - 37, 52, 3.2);
  ctx.fillStyle = 'rgba(175,222,255,0.95)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(90,150,200,0.8)';
  ctx.stroke();
  ellipse(ctx, CX - 38, 51, 0.9, 1.3, '#ffffff');
}

function bubble(ctx: Ctx, big: boolean) {
  const r = big ? 6.5 : 3.6, x = CX + 6 + r * 0.7, y = 80 - r * 0.3;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ink(ctx, 'rgba(205,235,255,0.55)', 'rgba(120,180,220,0.85)', 1);
  ellipse(ctx, x - r * 0.35, y - r * 0.35, r * 0.25, r * 0.2, 'rgba(255,255,255,0.9)');
}

/** A sandwich at her lips, held in her fingers (the bite frame while eating). */
function food(ctx: Ctx, P: Palette) {
  ctx.save();
  ctx.translate(CX + 6, 94);
  ctx.rotate(-0.25);
  ctx.beginPath(); ctx.moveTo(-9, 6); ctx.lineTo(9, 6); ctx.lineTo(1, -8); ctx.closePath();
  ink(ctx, '#f6e2b4', '#c9965a', 1.4);
  line(ctx, '#7cc46a', 2, () => { ctx.moveTo(-7.5, 3.2); ctx.quadraticCurveTo(-4, 1.6, 0, 3); ctx.quadraticCurveTo(4, 4.4, 7.5, 3); });
  line(ctx, '#ec6a5a', 1.4, () => { ctx.moveTo(-6, 4.6); ctx.lineTo(6, 4.6); });
  ctx.restore();
  for (const [x, y] of [[CX + 1, 101], [CX + 6.5, 101.5], [CX + 11.5, 100]]) {
    ctx.beginPath(); ctx.ellipse(x, y, 3, 3.6, 0, 0, Math.PI * 2);
    ink(ctx, hex(P.skin), 'rgba(170,95,90,0.55)', 1);
  }
}

// ------------------------------------------------------------------ glasses

function glassesRect(ctx: Ctx, g: EyeGeo) {
  ctx.save();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(150,152,176,0.95)';
  for (const side of [-1, 1]) {
    const ex = CX + side * g.gap;
    ctx.beginPath();
    ctx.roundRect(ex - 11, g.y - 10, 22, 19.5, 4.5);
    ctx.fillStyle = 'rgba(225,238,255,0.08)';
    ctx.fill();
    ctx.stroke();
    line(ctx, 'rgba(255,255,255,0.6)', 1.1, () => { ctx.moveTo(ex + 3, g.y + 5); ctx.lineTo(ex + 8, g.y - 5); ctx.moveTo(ex + 6.5, g.y + 6); ctx.lineTo(ex + 9, g.y + 1); });
  }
  ctx.beginPath();
  ctx.moveTo(CX - g.gap + 11, g.y - 4); ctx.quadraticCurveTo(CX, g.y - 7.5, CX + g.gap - 11, g.y - 4);
  ctx.moveTo(CX - g.gap - 11, g.y - 6); ctx.lineTo(CX - 34, g.y - 7);
  ctx.moveTo(CX + g.gap + 11, g.y - 6); ctx.lineTo(CX + 34, g.y - 7);
  ctx.stroke();
  ctx.restore();
}

function glassesRound(ctx: Ctx, g: EyeGeo) {
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(165,170,188,0.97)';
  for (const side of [-1, 1]) {
    const ex = CX + side * g.gap + 0.5;
    ctx.beginPath();
    ctx.ellipse(ex, g.y, 10.6, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(225,238,255,0.08)';
    ctx.fill();
    ctx.stroke();
    line(ctx, 'rgba(255,255,255,0.65)', 1.1, () => ctx.arc(ex, g.y, 7.4, Math.PI * 1.62, Math.PI * 1.92));
  }
  ctx.beginPath();
  ctx.moveTo(CX - g.gap + 11, g.y - 2.5); ctx.quadraticCurveTo(CX + 0.5, g.y - 6, CX + g.gap - 10, g.y - 2.5);
  ctx.moveTo(CX - g.gap - 10, g.y - 2); ctx.lineTo(CX - 34, g.y - 4);
  ctx.moveTo(CX + g.gap + 11, g.y - 2); ctx.lineTo(CX + 34, g.y - 4);
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ hair

function backCap(ctx: Ctx, P: Palette) {
  ctx.beginPath();
  if (P.her) {
    ctx.moveTo(CX - 43, 106);
    ctx.bezierCurveTo(CX - 52, 70, CX - 47, 13, CX, 12);
    ctx.bezierCurveTo(CX + 47, 13, CX + 52, 70, CX + 43, 106);
    ctx.closePath();
  } else {
    ctx.ellipse(CX, 52, 41, 37, 0, 0, Math.PI * 2);
  }
  ctx.fillStyle = vg(ctx, 10, 106, P.hair, shade(P.hairLo, -0.1));
  ctx.fill();
}

/** Her long centre-parted hair: crown and curtain bangs, with face-framing side locks. */
function herFrontPath(ctx: Ctx) {
  ctx.beginPath();
  ctx.moveTo(CX - 39, 100);
  ctx.bezierCurveTo(CX - 48, 62, CX - 45, 14, CX + 1, 13);
  ctx.bezierCurveTo(CX + 46, 14, CX + 48, 62, CX + 39, 100);
  // right side lock: outer edge down to the tip, inner edge back up to the temple
  ctx.quadraticCurveTo(CX + 35, 105, CX + 30, 104);
  ctx.quadraticCurveTo(CX + 29, 86, CX + 27, 74);
  ctx.quadraticCurveTo(CX + 26, 63, CX + 28, 57);
  // right curtain bangs, lock tips toward the part
  ctx.quadraticCurveTo(CX + 23, 58, CX + 21, 59);
  ctx.quadraticCurveTo(CX + 19, 51, CX + 16, 46);
  ctx.quadraticCurveTo(CX + 13, 51, CX + 10, 53);
  ctx.quadraticCurveTo(CX + 9, 43, CX + 3, 27);
  // left curtain bangs
  ctx.quadraticCurveTo(CX - 1, 40, CX - 8, 51);
  ctx.quadraticCurveTo(CX - 10, 47, CX - 13, 44);
  ctx.quadraticCurveTo(CX - 16, 53, CX - 21, 58);
  ctx.quadraticCurveTo(CX - 23, 53, CX - 25, 50);
  ctx.quadraticCurveTo(CX - 27, 56, CX - 29, 60);
  // left side lock
  ctx.quadraticCurveTo(CX - 27, 68, CX - 28, 76);
  ctx.quadraticCurveTo(CX - 29, 88, CX - 30, 104);
  ctx.quadraticCurveTo(CX - 35, 105, CX - 39, 100);
  ctx.closePath();
}

function herFront(ctx: Ctx, P: Palette) {
  herFrontPath(ctx);
  const fill = vg(ctx, 12, 104, shade(P.hair, 0.12), P.hairLo, P.hair);
  ink(ctx, fill, hex(P.hairLine, 0.7), 1.2);
  ctx.save();
  herFrontPath(ctx);
  ctx.clip();
  // Shine: a broken "angel ring" across the crown.
  ctx.setLineDash([9, 4, 5, 4]);
  line(ctx, hex(P.hairHi, 0.32), 3.2, () => ctx.ellipse(CX + 1, 47, 34, 25, 0, Math.PI * 1.2, Math.PI * 1.8));
  ctx.setLineDash([]);
  // Strands following the flow from the part.
  line(ctx, hex(P.hairLine, 0.45), 1, () => {
    ctx.moveTo(CX + 3, 22); ctx.quadraticCurveTo(CX + 14, 32, CX + 17, 45);
    ctx.moveTo(CX + 4, 20); ctx.quadraticCurveTo(CX + 26, 30, CX + 31, 62);
    ctx.moveTo(CX + 33, 66); ctx.quadraticCurveTo(CX + 35, 84, CX + 35, 100);
    ctx.moveTo(CX + 1, 22); ctx.quadraticCurveTo(CX - 8, 32, CX - 13, 43);
    ctx.moveTo(CX, 20); ctx.quadraticCurveTo(CX - 24, 30, CX - 31, 62);
    ctx.moveTo(CX - 34, 66); ctx.quadraticCurveTo(CX - 36, 84, CX - 36, 100);
  });
  line(ctx, hex(P.hairHi, 0.45), 1.2, () => {
    ctx.moveTo(CX - 18, 24); ctx.quadraticCurveTo(CX - 26, 30, CX - 30, 40);
    ctx.moveTo(CX + 20, 24); ctx.quadraticCurveTo(CX + 27, 30, CX + 30, 38);
  });
  ctx.restore();
  // Ahoge: one little strand that won't lie flat.
  lock(ctx, CX - 1, 15, CX + 4, 15, CX + 10, 2, 3.5);
  ink(ctx, hex(P.hair), hex(P.hairLine, 0.7), 1);
}

/** His fluffy, slightly messy hair with a soft fringe falling over the glasses. */
function hisFrontPath(ctx: Ctx) {
  ctx.beginPath();
  ctx.moveTo(CX - 40, 68);
  // fluffy crown: rounded clumps along the top
  const bumps: [number, number, number, number][] = [
    [-46, 40, -44, 28], [-40, 14, -26, 14], [-20, 2, -4, 9], [8, 1, 18, 10], [32, 6, 38, 20], [48, 30, 42, 44],
  ];
  for (const [qx, qy, x, y] of bumps) ctx.quadraticCurveTo(CX + qx, qy, CX + x, y);
  ctx.quadraticCurveTo(CX + 44, 56, CX + 40, 68);
  // right sideburn lock
  ctx.quadraticCurveTo(CX + 36, 74, CX + 32, 81);
  ctx.quadraticCurveTo(CX + 30, 68, CX + 28, 57);
  // fringe: soft pointed locks over the forehead
  const tips: [number, number, number, number][] = [
    [24, 61, 20, 50], [12, 64, 6, 50], [0, 63, -6, 49], [-13, 62, -19, 50], [-26, 60, -29, 57],
  ];
  for (const [tx, ty, nx, ny] of tips) {
    ctx.quadraticCurveTo(CX + tx + 2, ty - 4, CX + tx, ty);
    ctx.quadraticCurveTo(CX + tx - 1, ty - 8, CX + nx, ny);
  }
  // left sideburn
  ctx.quadraticCurveTo(CX - 31, 68, CX - 33, 81);
  ctx.quadraticCurveTo(CX - 37, 74, CX - 40, 68);
  ctx.closePath();
}

function hisFront(ctx: Ctx, P: Palette) {
  hisFrontPath(ctx);
  ink(ctx, vg(ctx, 0, 82, shade(P.hair, 0.16), P.hairLo, P.hair), hex(P.hairLine, 0.7), 1.2);
  ctx.save();
  hisFrontPath(ctx);
  ctx.clip();
  ctx.setLineDash([8, 4, 4, 4]);
  line(ctx, hex(P.hairHi, 0.3), 3, () => ctx.ellipse(CX - 2, 40, 33, 22, 0, Math.PI * 1.2, Math.PI * 1.78));
  ctx.setLineDash([]);
  line(ctx, hex(P.hairLine, 0.5), 1, () => {
    ctx.moveTo(CX - 6, 16); ctx.quadraticCurveTo(CX - 4, 36, CX, 58);
    ctx.moveTo(CX + 10, 16); ctx.quadraticCurveTo(CX + 14, 38, CX + 11, 60);
    ctx.moveTo(CX - 20, 20); ctx.quadraticCurveTo(CX - 18, 40, CX - 13, 58);
    ctx.moveTo(CX + 26, 20); ctx.quadraticCurveTo(CX + 28, 40, CX + 23, 58);
    ctx.moveTo(CX - 34, 36); ctx.quadraticCurveTo(CX - 34, 54, CX - 33, 76);
    ctx.moveTo(CX + 36, 36); ctx.quadraticCurveTo(CX + 35, 54, CX + 32, 76);
  });
  ctx.restore();
  // A couple of short flyaway wisps.
  lock(ctx, CX - 20, 9, CX - 15, 7, CX - 25, 0, 2.5);
  ink(ctx, hex(P.hair), hex(P.hairLine, 0.7), 0.9);
  lock(ctx, CX + 7, 4, CX + 12, 5, CX + 17, -3, -2.5);
  ink(ctx, hex(P.hair), hex(P.hairLine, 0.7), 0.9);
}

function bow(ctx: Ctx, P: Palette) {
  ctx.save();
  ctx.translate(CX + 31, 30);
  ctx.rotate(0.45);
  const fill = vg(ctx, -9, 9, shade(P.accent, 0.2), P.accentLo);
  for (const s of [-1, 1]) {
    // tail
    ctx.beginPath(); ctx.moveTo(s * 1, 2); ctx.lineTo(s * 6, 13); ctx.lineTo(s * 3, 14.5); ctx.lineTo(s * 0.5, 4); ctx.closePath();
    ink(ctx, hex(P.accentLo), P.accentLo, 1);
    // loop
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(s * 4, -10, s * 15, -9, s * 13, 0); ctx.bezierCurveTo(s * 15, 9, s * 4, 9, 0, 0);
    ink(ctx, fill, shade(P.accentLo, -0.2), 1.1);
    line(ctx, hex(P.accentLo, 0.6), 1, () => { ctx.moveTo(s * 3, -1); ctx.quadraticCurveTo(s * 8, -4, s * 11, -1); });
    ellipse(ctx, s * 7, -4, 2, 1.2, 'rgba(255,255,255,0.45)');
  }
  ctx.beginPath(); ctx.roundRect(-2.8, -3.4, 5.6, 6.8, 2);
  ink(ctx, hex(shade(P.accent, 0.05)), shade(P.accentLo, -0.2), 1);
  ctx.restore();
}

function crown(ctx: Ctx, P: Palette) {
  const at = (t: number): [number, number] => { const x = CX + t * 38; return [x, 20 + t * t * 15]; };
  line(ctx, '#6f9a4a', 2.2, () => { for (let i = 0; i <= 16; i++) { const [x, y] = at(-1 + i / 8); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } });
  for (let i = 0; i < 6; i++) { const [x, y] = at(-0.9 + i * 0.36 + 0.18); ctx.beginPath(); ctx.ellipse(x, y + 2, 3.4, 1.6, 0.5, 0, Math.PI * 2); ctx.fillStyle = '#86b85a'; ctx.fill(); }
  for (let i = 0; i < 7; i++) {
    const [x, y] = at(-0.9 + i * 0.3);
    const c = i % 2 ? 0xfff0f4 : P.accent;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2.4, 1.8, a, 0, Math.PI * 2);
      ink(ctx, hex(c), shade(c, -0.35), 0.7);
    }
    ellipse(ctx, x, y, 1.5, 1.5, '#ffd25a');
  }
}

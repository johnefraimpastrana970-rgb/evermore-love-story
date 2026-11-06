import type { Mood } from '../content/types';
import { CHIBI_MOOD, HER_PORTRAITS, HIS_PORTRAITS } from '../content/characters';
import { Ctx, ellipse, hex, shade, vgrad, heartPath, makeCanvas, rr } from './paint';

export const FRAME_W = 120;
export const FRAME_H = 232;
export const IDLE_N = 12;
export const WALK_N = 8;
/** Frame layout of a sprite sheet: idle 0..11, blink 12, walk 13..20. */
export const FRAMES = {
  idle: Array.from({ length: IDLE_N }, (_, i) => i),
  blink: IDLE_N,
  walk: Array.from({ length: WALK_N }, (_, i) => IDLE_N + 1 + i),
  total: IDLE_N + 1 + WALK_N,
};

export interface Look {
  who: 'her' | 'him';
  hair: number;
  outfit: number;
  accent: number;
  style?: 'dress' | 'tee' | 'raglan';
}

type ChibiMood = (typeof CHIBI_MOOD)[Mood];

interface Pose {
  blink?: boolean;
  phase?: number; // -1..1 leg swing
  bob?: number;   // upper-body offset (negative = up); feet stay planted
  sway?: number;  // hair trailing offset in px
  arm?: number;   // -1..1 arm swing
  liftL?: number; // foot lift (negative = up)
  liftR?: number;
  mood?: Mood;
}

const SKIN = 0xffe3d2;
const SKIN_SHADE = 0xf5c8b4;
const SKIN_HIM = 0xf3cdb0;       // his slightly warmer tone (from his art)
const SKIN_HIM_SHADE = 0xe3b292;
const SLEEVE_RAGLAN = 0xd9d0dc;  // his hoodie's pale grey sleeves
const PANTS = 0xf2b8c8; // her pink plaid pyjama pants

function eye(ctx: Ctx, x: number, y: number, look: Look, mood: ChibiMood, blink: boolean, mirror: boolean) {
  const lash = shade(look.hair, -0.5);
  if (blink || mood === 'happy') {
    ctx.strokeStyle = hex(lash);
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (mood === 'happy') ctx.arc(x, y + 3, 6, Math.PI * 1.15, Math.PI * 1.85);
    else ctx.arc(x, y - 1, 6, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    return;
  }
  if (mood === 'sleepy' || mood === 'sad') {
    ctx.strokeStyle = hex(lash);
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(x - 6, y + 1); ctx.lineTo(x + 6, y + 1); ctx.stroke();
    ellipse(ctx, x, y + 3.5, 5, 2.5, hex(0x5a3a32));
    if (mood === 'sad') {
      // worried brows
      ctx.beginPath(); ctx.moveTo(x - 6, y - 8 + (x > 60 ? -2 : 2)); ctx.lineTo(x + 6, y - 8 + (x > 60 ? 2 : -2)); ctx.stroke();
    }
    return;
  }
  const tall = look.who === 'her' ? 9.5 : 8;
  const sc = mood === 'surprised' ? 1.12 : 1;
  const iris = look.who === 'her' ? 0x5a3a32 : 0x4a3a3a;
  const lookX = mood === 'shy' ? (mirror ? 2 : -2) : 1.2;
  ellipse(ctx, x, y, 6.8 * sc, tall * sc, '#ffffff');
  ellipse(ctx, x + lookX, y + 1, 5.4 * sc, (tall - 1.2) * sc, vgrad(ctx, y - tall, y + tall, [[0, shade(iris, -0.35)], [1, shade(iris, 0.35)]]));
  ellipse(ctx, x + lookX, y + 1.5, 2.6 * sc, 3.6 * sc, hex(shade(iris, -0.6)));
  if (mood === 'love') {
    ctx.fillStyle = '#ff7fa0';
    heartPath(ctx, x + lookX, y - 3, 7);
    ctx.fill();
  } else {
    ellipse(ctx, x + lookX - 2, y - 3, 2.2, 2.8, '#ffffff');
    ellipse(ctx, x + lookX + 2, y + 3.5, 1, 1, 'rgba(255,255,255,0.8)');
  }
  ctx.strokeStyle = hex(lash);
  ctx.lineWidth = look.who === 'her' ? 3 : 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(x, y, 7.2 * sc, tall * sc, 0, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  if (look.who === 'her') {
    ctx.beginPath(); ctx.moveTo(x + (mirror ? -6.5 : 6.5), y - tall * 0.55); ctx.lineTo(x + (mirror ? -9.5 : 9.5), y - tall * 0.9); ctx.stroke();
  }
}

/** Her clear rectangular glasses. */
function glasses(ctx: Ctx, cx: number, y: number) {
  ctx.save();
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = 'rgba(165,170,190,0.9)';
  ctx.fillStyle = 'rgba(225,238,255,0.07)';
  for (const ex of [cx - 12, cx + 13]) {
    rr(ctx, ex - 9.5, y - 7, 19, 13, 3);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - 2, y - 3); ctx.quadraticCurveTo(cx + 0.5, y - 6, cx + 3, y - 3);
  ctx.moveTo(cx - 22, y - 4); ctx.lineTo(cx - 31, y - 6);
  ctx.moveTo(cx + 23, y - 4); ctx.lineTo(cx + 32, y - 6);
  ctx.stroke();
  // lens glint
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(cx - 18, y + 3); ctx.lineTo(cx - 13, y - 5); ctx.moveTo(cx + 7, y + 3); ctx.lineTo(cx + 12, y - 5); ctx.stroke();
  ctx.restore();
}

/** His thin round silver glasses. */
function glassesRound(ctx: Ctx, cx: number, y: number) {
  ctx.save();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(170,175,190,0.95)';
  ctx.fillStyle = 'rgba(225,238,255,0.08)';
  for (const ex of [cx - 12, cx + 13]) {
    ctx.beginPath(); ctx.ellipse(ex, y, 9.5, 8.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - 2.5, y - 2); ctx.quadraticCurveTo(cx + 0.5, y - 5, cx + 3.5, y - 2);
  ctx.moveTo(cx - 21.5, y - 2); ctx.lineTo(cx - 31, y - 4);
  ctx.moveTo(cx + 22.5, y - 2); ctx.lineTo(cx + 32, y - 4);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.arc(cx - 12, y, 6, Math.PI * 1.1, Math.PI * 1.4); ctx.arc(cx + 13, y, 6, Math.PI * 1.1, Math.PI * 1.4); ctx.stroke();
  ctx.restore();
}

/** Tiny cat face print with a bow, like on her favourite tee. */
function catPrint(ctx: Ctx, x: number, y: number, bow: number) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(120,90,100,0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 2); ctx.lineTo(x - 7, y - 9); ctx.lineTo(x - 3, y - 5);
  ctx.lineTo(x + 3, y - 5); ctx.lineTo(x + 7, y - 9); ctx.lineTo(x + 8, y - 2);
  ctx.quadraticCurveTo(x + 9, y + 6, x, y + 6);
  ctx.quadraticCurveTo(x - 9, y + 6, x - 8, y - 2);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ellipse(ctx, x - 3.5, y, 1.1, 1.1, '#3a2a2a');
  ellipse(ctx, x + 3.5, y, 1.1, 1.1, '#3a2a2a');
  ellipse(ctx, x - 6, y + 2, 1.6, 1, 'rgba(255,140,160,0.7)');
  ellipse(ctx, x + 6, y + 2, 1.6, 1, 'rgba(255,140,160,0.7)');
  ctx.fillStyle = hex(bow);
  ctx.beginPath(); ctx.moveTo(x + 6, y + 9); ctx.lineTo(x + 2, y + 6.5); ctx.lineTo(x + 2, y + 11.5); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 6, y + 9); ctx.lineTo(x + 10, y + 6.5); ctx.lineTo(x + 10, y + 11.5); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/** Draws a character with feet at the bottom-centre of a FRAME_W×FRAME_H box. */
export function drawCharacter(ctx: Ctx, look: Look, pose: Pose = {}) {
  const her = look.who === 'her';
  const tee = her && look.style === 'tee';
  const phase = pose.phase ?? 0;
  const bob = pose.bob ?? 0;
  const mood: ChibiMood = CHIBI_MOOD[pose.mood ?? 'neutral'] ?? 'neutral';
  const cx = FRAME_W / 2;
  const hairC = look.hair;
  const out = look.outfit;
  const up = bob;
  const sway = pose.sway ?? phase * 2;
  const armSwing = pose.arm ?? phase;
  ctx.save();

  // Back hair – long and a little wavy for her; the ends trail behind the motion.
  if (her) {
    ctx.save();
    ctx.translate(0, up);
    ctx.beginPath();
    ctx.moveTo(cx - 36, 58);
    ctx.bezierCurveTo(cx - 50 - sway * 0.3, 100, cx - 40 - sway * 0.7, 140, cx - 38 - sway, 172 + sway * 0.3);
    ctx.quadraticCurveTo(cx - 20 - sway, 182, cx - sway, 176);
    ctx.quadraticCurveTo(cx + 20 - sway, 182, cx + 38 - sway, 172 - sway * 0.3);
    ctx.bezierCurveTo(cx + 40 - sway * 0.7, 140, cx + 50 - sway * 0.3, 100, cx + 36, 58);
    ctx.closePath();
    ctx.fillStyle = vgrad(ctx, 40, 182, [[0, shade(hairC, 0.08)], [1, shade(hairC, -0.15)]]);
    ctx.fill();
    ctx.restore();
  }

  // Legs – hips move with the upper body, feet stay on the floor.
  const legY = tee ? 160 : 172;
  for (const side of [-1, 1]) {
    const sw = side * phase * 5;
    const given = side < 0 ? pose.liftL : pose.liftR;
    const lift = given ?? (phase !== 0 && Math.sign(phase) === side ? -3 : 0);
    const lx = cx + side * 8 + sw - 4;
    if (tee) {
      // Pink plaid pyjama pants.
      ctx.fillStyle = hex(PANTS);
      rr(ctx, lx - 2, legY - 4 + up, 13, 54 + lift - up, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < 4; k++) { ctx.moveTo(lx - 2, legY + 6 + k * 11 + up * (1 - k / 4)); ctx.lineTo(lx + 11, legY + 6 + k * 11 + up * (1 - k / 4)); }
      ctx.moveTo(lx + 4.5, legY - 2 + up); ctx.lineTo(lx + 4.5, legY + 48 + lift);
      ctx.stroke();
      ctx.fillStyle = hex(SKIN);
      ctx.fillRect(lx + 1, legY + 48 + lift, 7, 3);
      ctx.fillStyle = '#f7f1f4';
      rr(ctx, lx - 2, legY + 50 + lift, 14, 8, 4); // soft slippers
      ctx.fill();
    } else {
      ctx.fillStyle = hex(her ? SKIN : 0x3a3a54);
      rr(ctx, lx, legY - 4 + up, 9, 46 + lift - up, 4);
      ctx.fill();
      if (her) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(lx, legY + 20 + lift, 9, 18);
      }
      ctx.fillStyle = hex(her ? shade(out, -0.45) : 0x5a4a44);
      rr(ctx, lx - 2, legY + 36 + lift, 14, 10, 5);
      ctx.fill();
    }
  }

  // Arms (everything from here on moves with the upper body)
  ctx.translate(0, up);
  const skin = her ? SKIN : SKIN_HIM;
  const raglan = !her && look.style === 'raglan';
  for (const side of [-1, 1]) {
    const swing = -side * armSwing * 6;
    ctx.save();
    ctx.translate(cx + side * (tee ? 24 : her ? 20 : 23), 104);
    ctx.rotate((side * 0.12) + swing * 0.03);
    if (raglan) {
      // Long pale-grey hoodie sleeve with a dark cuff, just the hand showing.
      ctx.fillStyle = vgrad(ctx, 0, 54, [[0, shade(SLEEVE_RAGLAN, 0.06)], [1, shade(SLEEVE_RAGLAN, -0.08)]]);
      rr(ctx, -7, -2, 14, 52, 7);
      ctx.fill();
      ctx.fillStyle = hex(out);
      rr(ctx, -7, 44, 14, 8, 4);
      ctx.fill();
      ellipse(ctx, 0, 57, 6, 6, hex(skin));
    } else {
      ctx.fillStyle = hex(her ? shade(out, 0.05) : out);
      rr(ctx, tee ? -8 : -6, 0, tee ? 16 : 12, tee ? 22 : 26, 6); // loose short sleeve for the tee
      ctx.fill();
      ctx.fillStyle = hex(skin);
      rr(ctx, -5, tee ? 18 : 22, 10, tee ? 36 : 34, 5);
      ctx.fill();
      ellipse(ctx, 0, 58, 6, 6, hex(skin));
    }
    ctx.restore();
  }

  // Body
  if (tee) {
    // Oversized tee that falls past the hips.
    ctx.beginPath();
    ctx.moveTo(cx - 20, 98);
    ctx.lineTo(cx + 20, 98);
    ctx.quadraticCurveTo(cx + 27, 130, cx + 25, 164);
    ctx.quadraticCurveTo(cx, 170, cx - 25, 164);
    ctx.quadraticCurveTo(cx - 27, 130, cx - 20, 98);
    ctx.closePath();
    ctx.fillStyle = vgrad(ctx, 98, 168, [[0, shade(out, 0.06)], [1, shade(out, -0.07)]]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,110,130,0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 8, 99); ctx.quadraticCurveTo(cx, 106, cx + 8, 99);
    ctx.strokeStyle = 'rgba(150,110,130,0.5)'; ctx.stroke();
    catPrint(ctx, cx + 1, 134, look.accent);
  } else if (her) {
    ctx.beginPath();
    ctx.moveTo(cx - 16, 98);
    ctx.lineTo(cx + 16, 98);
    ctx.quadraticCurveTo(cx + 22, 140, cx + 32, 176);
    ctx.quadraticCurveTo(cx, 184, cx - 32, 176);
    ctx.quadraticCurveTo(cx - 22, 140, cx - 16, 98);
    ctx.closePath();
    ctx.fillStyle = vgrad(ctx, 98, 182, [[0, shade(out, 0.12)], [1, shade(out, -0.12)]]);
    ctx.fill();
    ctx.strokeStyle = hex(shade(out, -0.22), 0.6);
    ctx.lineWidth = 1.5;
    for (const px of [-14, -4, 6, 16]) { ctx.beginPath(); ctx.moveTo(cx + px * 0.6, 140); ctx.lineTo(cx + px * 1.1, 178); ctx.stroke(); }
    ctx.fillStyle = hex(look.accent);
    ctx.fillRect(cx - 19, 134, 38, 6);
    ctx.beginPath(); ctx.moveTo(cx - 15, 98); ctx.lineTo(cx, 116); ctx.lineTo(cx + 15, 98); ctx.closePath();
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.fillStyle = hex(look.accent);
    heartPath(ctx, cx, 108, 9); ctx.fill();
  } else {
    ctx.fillStyle = vgrad(ctx, 96, 176, [[0, shade(out, 0.1)], [1, shade(out, -0.15)]]);
    rr(ctx, cx - 22, 96, 44, 80, 12);
    ctx.fill();
    if (raglan) {
      // Pale raglan panels over the shoulders, like his hoodie.
      ctx.fillStyle = hex(SLEEVE_RAGLAN);
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + side * 22, 104);
        ctx.quadraticCurveTo(cx + side * 22, 96, cx + side * 14, 96);
        ctx.lineTo(cx + side * 22, 120);
        ctx.closePath();
        ctx.fill();
      }
      // Hood bunched around the neck.
      ctx.fillStyle = hex(shade(out, 0.12));
      ctx.beginPath();
      ctx.moveTo(cx - 17, 94); ctx.quadraticCurveTo(cx, 116, cx + 17, 94);
      ctx.quadraticCurveTo(cx + 14, 104, cx, 108); ctx.quadraticCurveTo(cx - 14, 104, cx - 17, 94);
      ctx.fill();
      // Drawstrings with metal tips.
      ctx.strokeStyle = 'rgba(25,20,28,0.95)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(cx - 5, 104); ctx.lineTo(cx - 6, 128); ctx.moveTo(cx + 5, 104); ctx.lineTo(cx + 6, 128); ctx.stroke();
      ellipse(ctx, cx - 6, 129, 1.5, 2, '#c8c8d0'); ellipse(ctx, cx + 6, 129, 1.5, 2, '#c8c8d0');
      ctx.fillStyle = hex(shade(out, 0.08));
      rr(ctx, cx - 14, 142, 28, 15, 6); ctx.fill(); // front pocket
    } else {
      ctx.fillStyle = hex(shade(out, -0.2));
      rr(ctx, cx - 14, 140, 28, 16, 6); ctx.fill();
      ctx.strokeStyle = hex(shade(out, 0.35)); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - 5, 100); ctx.lineTo(cx - 6, 124); ctx.moveTo(cx + 5, 100); ctx.lineTo(cx + 6, 124); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 14, 96); ctx.quadraticCurveTo(cx, 108, cx + 14, 96); ctx.fillStyle = hex(shade(out, -0.3)); ctx.fill();
    }
  }

  // Front hair strands over the shoulders (her).
  if (her) {
    ctx.fillStyle = vgrad(ctx, 60, 170, [[0, shade(hairC, 0.05)], [1, shade(hairC, -0.1)]]);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * 30, 64);
      ctx.bezierCurveTo(cx + side * 40 - sway * 0.3, 100, cx + side * 30 - sway * 0.7, 130, cx + side * 26 - sway, 160);
      ctx.quadraticCurveTo(cx + side * 21, 140, cx + side * 22, 104);
      ctx.quadraticCurveTo(cx + side * 22, 82, cx + side * 24, 66);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Neck & head
  ctx.fillStyle = hex(her ? SKIN_SHADE : SKIN_HIM_SHADE);
  ctx.fillRect(cx - 5, 88, 10, 12);
  const headY = 60;
  ellipse(ctx, cx, headY, 33, 34, hex(skin));
  ellipse(ctx, cx, headY + 12, 28, 22, hex(skin));
  const mirror = false;
  eye(ctx, cx - 12, headY + 8, look, mood, !!pose.blink, mirror);
  eye(ctx, cx + 13, headY + 8, look, mood, !!pose.blink, mirror);
  const blushA = mood === 'shy' || mood === 'love' ? 0.65 : 0.35;
  ellipse(ctx, cx - 19, headY + 20, 6.5, 3.5, `rgba(255,130,160,${blushA})`);
  ellipse(ctx, cx + 20, headY + 20, 6.5, 3.5, `rgba(255,130,160,${blushA})`);
  if (her) {
    glasses(ctx, cx, headY + 8);
    ellipse(ctx, cx - 9, headY + 22, 1.2, 1.2, '#3a2228'); // beauty mark
  } else if (raglan) {
    glassesRound(ctx, cx, headY + 8);
  }
  ctx.strokeStyle = '#a0505a';
  ctx.fillStyle = '#c0606e';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  const my = headY + 24;
  if (mood === 'surprised') { ellipse(ctx, cx + 1, my + 1, 3, 4, '#a0505a'); }
  else if (mood === 'happy' || mood === 'love') { ctx.moveTo(cx - 5, my - 1); ctx.quadraticCurveTo(cx + 1, my + 7, cx + 6, my - 1); ctx.closePath(); ctx.fill(); }
  else if (mood === 'shy') { ctx.moveTo(cx - 4, my); ctx.quadraticCurveTo(cx - 1, my - 2, cx + 1, my); ctx.quadraticCurveTo(cx + 3, my + 2, cx + 5, my); ctx.stroke(); }
  else if (mood === 'sad') { ctx.moveTo(cx - 4, my + 2); ctx.quadraticCurveTo(cx + 1, my - 2, cx + 5, my + 2); ctx.stroke(); }
  else if (mood === 'sleepy') { ellipse(ctx, cx + 1, my + 1, 2.5, 2, '#a0505a'); }
  else { ctx.moveTo(cx - 4, my); ctx.quadraticCurveTo(cx + 1, my + 4, cx + 5, my); ctx.stroke(); }

  // Front hair / bangs
  const hairGrad = vgrad(ctx, 20, 80, [[0, shade(hairC, 0.18)], [1, shade(hairC, -0.08)]]);
  ctx.fillStyle = hairGrad;
  ctx.beginPath();
  if (her) {
    // Centre-parted long hair framing the face (like her drawings).
    ctx.moveTo(cx - 37, 78);
    ctx.quadraticCurveTo(cx - 42, 20, cx, 21);
    ctx.quadraticCurveTo(cx + 42, 20, cx + 37, 78);
    ctx.quadraticCurveTo(cx + 30, 52, cx + 18, 38);
    ctx.quadraticCurveTo(cx + 8, 30, cx + 1, 27);
    ctx.quadraticCurveTo(cx - 8, 32, cx - 18, 40);
    ctx.quadraticCurveTo(cx - 30, 54, cx - 37, 78);
    ctx.closePath();
    ctx.fill();
    // Small hair clip in her accent colour.
    ctx.fillStyle = hex(look.accent);
    ctx.save(); ctx.translate(cx + 25, 36); ctx.rotate(0.5);
    rr(ctx, -7, -2.5, 14, 5, 2.5); ctx.fill();
    ctx.restore();
  } else if (raglan) {
    // Rounded hair cap (no spikes); fluffy clumps and fringe are added below.
    ctx.moveTo(cx - 36, 70);
    ctx.quadraticCurveTo(cx - 42, 22, cx, 21);
    ctx.quadraticCurveTo(cx + 43, 22, cx + 37, 70);
    ctx.quadraticCurveTo(cx + 30, 46, cx, 40);
    ctx.quadraticCurveTo(cx - 30, 46, cx - 36, 70);
    ctx.closePath();
    ctx.fill();
  }
  if (!her) {
    ctx.beginPath();
  }
  if (!her && !raglan) {
    ctx.moveTo(cx - 35, 66);
    ctx.quadraticCurveTo(cx - 40, 20, cx, 20);
    ctx.quadraticCurveTo(cx + 42, 20, cx + 36, 66);
    ctx.lineTo(cx + 28, 50);
    ctx.lineTo(cx + 24, 58);
    ctx.lineTo(cx + 14, 42);
    ctx.lineTo(cx + 8, 54);
    ctx.lineTo(cx - 2, 40);
    ctx.lineTo(cx - 10, 54);
    ctx.lineTo(cx - 18, 44);
    ctx.lineTo(cx - 26, 58);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 2, 22); ctx.quadraticCurveTo(cx + 10, 8, cx + 18, 12); ctx.quadraticCurveTo(cx + 8, 14, cx + 8, 24); ctx.fill();
  }
  if (!her && raglan) {
    {
      // Soft, fluffy volume on top: overlapping rounded clumps (not spikes), like his drawings.
      const clumps: [number, number, number, number][] = [
        [-26, 30, 14, 11], [-12, 22, 15, 12], [4, 20, 16, 12], [20, 24, 14, 11], [31, 36, 10, 10], [-33, 40, 9, 10],
      ];
      for (const [x, y, rx, ry] of clumps) ellipse(ctx, cx + x, y, rx, ry, hairGrad);
      // A few short, curved wisps for the messy look.
      ctx.strokeStyle = hex(shade(hairC, 0.05));
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      const wisps: [number, number, number, number, number, number][] = [
        [-18, 14, -24, 6, -30, 8], [2, 10, 4, 2, 12, 2], [20, 14, 28, 8, 32, 12], [-34, 30, -42, 26, -44, 32],
      ];
      for (const [x0, y0, qx, qy, x1, y1] of wisps) {
        ctx.beginPath(); ctx.moveTo(cx + x0, y0); ctx.quadraticCurveTo(cx + qx, qy, cx + x1, y1); ctx.stroke();
      }
      // Soft fringe falling over the forehead and glasses line.
      ctx.fillStyle = hairGrad;
      ctx.beginPath();
      ctx.moveTo(cx - 28, 40);
      ctx.quadraticCurveTo(cx - 18, 58, cx - 8, 50);
      ctx.quadraticCurveTo(cx - 2, 60, cx + 6, 50);
      ctx.quadraticCurveTo(cx + 16, 58, cx + 26, 44);
      ctx.lineTo(cx + 22, 34); ctx.lineTo(cx - 24, 32);
      ctx.closePath();
      ctx.fill();
      // Side hair over the ears.
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + side * 33, 46); ctx.quadraticCurveTo(cx + side * 37, 64, cx + side * 31, 74);
        ctx.lineTo(cx + side * 27, 56); ctx.closePath(); ctx.fill();
      }
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx - 6, 44, 20, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
  ctx.restore();
}

/** Builds all animation frames from continuous sine curves so motion loops smoothly. */
export function buildSpriteSheet(look: Look): HTMLCanvasElement {
  const poses: Pose[] = [];
  // Idle: slow breathing – shoulders rise ~1.5px, hair drifts a little, arms barely move.
  for (let k = 0; k < IDLE_N; k++) {
    const t = (k / IDLE_N) * Math.PI * 2;
    poses.push({ bob: -0.8 - 0.8 * Math.sin(t), sway: Math.sin(t - 1.2) * 1.4, arm: Math.sin(t) * 0.12, phase: 0, liftL: 0, liftR: 0 });
  }
  // Blink, at the same breath position as idle frame 3.
  poses.push({ ...poses[3], blink: true });
  // Walk: legs swing on a sine; the body is highest when the legs pass each other;
  // the leg moving forward lifts off the floor; hair lags behind the step.
  for (let k = 0; k < WALK_N; k++) {
    const t = (k / WALK_N) * Math.PI * 2;
    const s = Math.sin(t), co = Math.cos(t);
    poses.push({
      phase: s,
      bob: -2.6 * (1 - Math.abs(s)),
      liftR: -Math.max(0, co) * 5,
      liftL: -Math.max(0, -co) * 5,
      arm: s,
      sway: 2.2 + Math.sin(t * 2 - 0.9) * 1.2, // trails behind while walking forward
    });
  }
  const [c, ctx] = makeCanvas(FRAME_W * poses.length, FRAME_H);
  poses.forEach((p, i) => {
    ctx.save();
    ctx.translate(i * FRAME_W, 0);
    drawCharacter(ctx, look, p);
    ctx.restore();
  });
  return c;
}

/** True when this character/mood is shown with illustrated art instead of the chibi. */
export function hasArt(who: 'her' | 'him', mood: Mood): boolean {
  return !!(who === 'her' ? HER_PORTRAITS : HIS_PORTRAITS)[mood];
}

const portraitCache = new Map<string, string>();
export function portraitURL(look: Look, mood: Mood): string {
  const art = (look.who === 'her' ? HER_PORTRAITS : HIS_PORTRAITS)[mood];
  if (art) return art;
  const key = `${look.who}-${look.hair}-${look.outfit}-${look.accent}-${look.style}-${mood}`;
  const hit = portraitCache.get(key);
  if (hit) return hit;
  const [c, ctx] = makeCanvas(300, 330);
  ctx.translate(150 - FRAME_W / 2 * 2.6, 10);
  ctx.scale(2.6, 2.6);
  drawCharacter(ctx, look, { mood });
  const url = c.toDataURL('image/png');
  portraitCache.set(key, url);
  return url;
}

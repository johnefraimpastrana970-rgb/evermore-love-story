import type { Mood } from '../content/types';
import { HER_PORTRAITS, HIS_PORTRAITS } from '../content/characters';
import { makeCanvas, type Ctx } from './paint';
import { drawBody, type BodyPose } from './chibi/body';
import { drawHead } from './chibi/head';
import type { Look } from './chibi/kit';
import {
  anchorFor, FRAME_H, FRAME_W, HEAD_BOTTOM, HEAD_RES, HEAD_TOP, MOOD_FACE, NECK,
  type Face, type HeadAnchor,
} from './chibi/spec';

export { FRAME_H, FRAME_W };
export type { Look };

/*
 * Character sprites are built from the layered chibi rig (src/art/chibi):
 *  - a BODY sheet per outfit: idle, walk, run, sit and eat frames (no face)
 *  - a HEAD sheet per face: [eyes open, blink, alternate] (see HeadRig in scenes/heads.ts)
 * Every body frame records a head anchor, so the head follows breathing, steps and leans exactly.
 */

export const IDLE_N = 12;
export const WALK_N = 8;
export const RUN_N = 8;
export const SIT_N = 6;
export const EAT_N = 6;
/** Frame layout of a body sheet. */
export const FRAMES = (() => {
  let i = 0;
  const run = (n: number) => Array.from({ length: n }, () => i++);
  return { idle: run(IDLE_N), walk: run(WALK_N), run: run(RUN_N), sit: run(SIT_N), eat: run(EAT_N), total: i };
})();
/** Sheets are grids, so they stay well under the 4096 px texture limit of older phones. */
export const SHEET_COLS = 10;

export interface Pose extends BodyPose {
  /** Face for composite drawings (portraits); in the world the head rig owns the face. */
  face?: Face;
  blink?: boolean;
}

export interface Sheet { canvas: HTMLCanvasElement; anchors: HeadAnchor[]; cols: number; w: number }

function idlePose(k: number, n: number): BodyPose {
  const t = (k / n) * Math.PI * 2;
  return { bob: -0.8 - 0.8 * Math.sin(t), sway: Math.sin(t - 1.2) * 1.4, arm: Math.sin(t) * 0.12, phase: 0, liftL: 0, liftR: 0 };
}
function walkPose(k: number): BodyPose {
  const t = (k / WALK_N) * Math.PI * 2;
  const s = Math.sin(t), co = Math.cos(t);
  return { phase: s, bob: -2.6 * (1 - Math.abs(s)), liftR: -Math.max(0, co) * 5, liftL: -Math.max(0, -co) * 5, arm: s, sway: 2.2 + Math.sin(t * 2 - 0.9) * 1.2 };
}
function runPose(k: number): BodyPose {
  const t = (k / RUN_N) * Math.PI * 2;
  const s = Math.sin(t), co = Math.cos(t);
  return {
    phase: s, stride: 8.5, run: true, lean: 0.07,
    bob: -4.4 * (1 - Math.abs(s)) - 0.6, liftR: -Math.max(0, co) * 9, liftL: -Math.max(0, -co) * 9,
    arm: s, sway: 4.5 + Math.sin(t * 2 - 0.9) * 1.6,
  };
}

/** Draws the poses into a grid and records each frame's head anchor. */
function sheet(look: Look, poses: BodyPose[], w = FRAME_W, cols = SHEET_COLS): Sheet {
  const rows = Math.ceil(poses.length / cols);
  const [canvas, ctx] = makeCanvas(w * cols, FRAME_H * rows);
  const pad = (w - FRAME_W) / 2;
  poses.forEach((p, i) => {
    ctx.save();
    ctx.translate((i % cols) * w + pad, Math.floor(i / cols) * FRAME_H);
    ctx.beginPath(); ctx.rect(-pad, 0, w, FRAME_H); ctx.clip();
    drawBody(ctx, look, p);
    ctx.restore();
  });
  return { canvas, anchors: poses.map((p) => anchorFor(p.bob ?? 0, p.lean ?? 0, 172, p.eat === 2)), cols, w };
}

export function buildSpriteSheet(look: Look): Sheet {
  const poses: BodyPose[] = [];
  for (let k = 0; k < IDLE_N; k++) poses.push(idlePose(k, IDLE_N));
  for (let k = 0; k < WALK_N; k++) poses.push(walkPose(k));
  for (let k = 0; k < RUN_N; k++) poses.push(runPose(k));
  for (let k = 0; k < SIT_N; k++) poses.push({ ...idlePose(k, SIT_N), sit: true, arm: 0.05 });
  // Eating: hold, hold, raise to the mouth (bite, bite), lower.
  ([1, 1, 2, 2, 2, 1] as const).forEach((eat, k) => poses.push({ ...idlePose(k, EAT_N), eat }));
  return sheet(look, poses);
}

// ------------------------------------------------------------------ couple poses (built only when first used)

/** How far apart (in frame pixels) the two stand when holding hands / hugging, and the arm angles that make it work. */
export const COUPLE = {
  /** Holding hands: hands meet halfway between two people this far apart. */
  holdGap: 84,
  holdArm: 0.4,
  /** Side hug: close together, the inner arm around the other's waist. */
  hugGap: 70,
  hugArm: 1.15,
  hugReach: 0.55,
};
const HOLD_IDLE_N = 6;
const HUG_N = 4;
/** Frame layout of the couple sheet. "R" = the held/hugging arm is the sprite's right arm (+x), "L" = left. */
export const COUPLE_FRAMES = (() => {
  let i = 0;
  const run = (n: number) => Array.from({ length: n }, () => i++);
  return {
    holdR: { walk: run(WALK_N), idle: run(HOLD_IDLE_N) },
    holdL: { walk: run(WALK_N), idle: run(HOLD_IDLE_N) },
    hugReach: run(1)[0],
    hug: run(HUG_N),
    get total() { return i; },
  };
})();
export const COUPLE_COLS = 11;
/** Couple frames are wider so an outstretched arm never gets clipped; the body stays centred. */
export const COUPLE_W = FRAME_W + 56;

/** Holding hands and hugging, as a separate grid sheet (keeps the everyday sheet small on older phones). */
export function buildCoupleSheet(look: Look): Sheet {
  const poses: BodyPose[] = [];
  const held = (side: 'L' | 'R', p: BodyPose): BodyPose => ({ ...p, [side === 'R' ? 'armR' : 'armL']: COUPLE.holdArm });
  for (const side of ['R', 'L'] as const) {
    for (let k = 0; k < WALK_N; k++) poses.push(held(side, walkPose(k)));
    for (let k = 0; k < HOLD_IDLE_N; k++) poses.push(held(side, idlePose(k, HOLD_IDLE_N)));
  }
  // Hug: reach in, then hold, breathing slowly together (the faces are set by the couple director).
  poses.push({ ...idlePose(0, HUG_N), armR: COUPLE.hugReach });
  for (let k = 0; k < HUG_N; k++) poses.push({ ...idlePose(k, HUG_N), armR: COUPLE.hugArm, sway: 1.5 });
  return sheet(look, poses, COUPLE_W, COUPLE_COLS);
}

// ------------------------------------------------------------------ heads

export const HEAD_W = FRAME_W;
export const HEAD_H = HEAD_BOTTOM - HEAD_TOP;
/** Head sprite origin: the neck pivot inside the head texture. */
export const HEAD_ORIGIN = { x: NECK.x / HEAD_W, y: (NECK.y - HEAD_TOP) / HEAD_H };
export const HEAD_FRAMES = { open: 0, blink: 1, alt: 2, total: 3 };

/** One face as three frames (eyes open, blink, alternate), drawn at HEAD_RES for crisp eyes. */
export function buildHeadSheet(look: Look, face: Face): HTMLCanvasElement {
  const R = HEAD_RES;
  const [c, ctx] = makeCanvas(HEAD_W * R * HEAD_FRAMES.total, HEAD_H * R);
  for (let i = 0; i < HEAD_FRAMES.total; i++) {
    ctx.save();
    ctx.translate(i * HEAD_W * R, 0);
    ctx.beginPath(); ctx.rect(0, 0, HEAD_W * R, HEAD_H * R); ctx.clip();
    ctx.scale(R, R);
    ctx.translate(0, -HEAD_TOP);
    drawHead(ctx, look, face, { blink: i === HEAD_FRAMES.blink, alt: i === HEAD_FRAMES.alt });
    ctx.restore();
  }
  return c;
}

/** Body plus head, as one picture (portraits, previews). Feet at the bottom-centre of a FRAME_W×FRAME_H box. */
export function drawCharacter(ctx: Ctx, look: Look, pose: Pose = {}) {
  drawBody(ctx, look, pose);
  const a = anchorFor(pose.bob ?? 0, pose.lean ?? 0, 172, pose.eat === 2);
  ctx.save();
  ctx.translate(NECK.x + a.x, FRAME_H + a.y);
  ctx.rotate(a.rot);
  ctx.translate(-NECK.x, -NECK.y);
  drawHead(ctx, look, pose.face ?? 'idle', { blink: pose.blink, alt: a.bite });
  ctx.restore();
}

/** True when this character/mood is shown with illustrated art instead of the chibi. */
export function hasArt(who: 'her' | 'him', mood: Mood): boolean {
  return !!(who === 'her' ? HER_PORTRAITS : HIS_PORTRAITS)[mood];
}

const portraitCache = new Map<string, string>();
export function portraitURL(look: Look, mood: Mood): string {
  const art = (look.who === 'her' ? HER_PORTRAITS : HIS_PORTRAITS)[mood];
  if (art) return art;
  const key = `${look.who}-${look.hair}-${look.outfit}-${look.accent}-${look.style}-${look.acc}-${mood}`;
  const hit = portraitCache.get(key);
  if (hit) return hit;
  const [c, ctx] = makeCanvas(300, 330);
  ctx.translate(150 - FRAME_W / 2 * 2.6, 10);
  ctx.scale(2.6, 2.6);
  drawCharacter(ctx, look, { face: MOOD_FACE[mood] ?? 'idle' });
  const url = c.toDataURL('image/png');
  portraitCache.set(key, url);
  return url;
}

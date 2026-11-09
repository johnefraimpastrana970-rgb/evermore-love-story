/*
 * The chibi rig's data, kept free of canvas code so it can be tested and reused.
 *
 * A character is drawn as two layers:
 *  - the BODY sheet (shadow is separate): back hair, legs, feet, clothing, arms, hands, shoulder hair, neck
 *  - the HEAD layer, one small texture per face: back hair cap, head, ears, eyes, brows, nose, mouth, blush,
 *    effects (tears, anger mark, …), glasses, front hair and hair accessories
 * The head follows the body frame by frame through anchors, so a face can change (or the head can nod, tilt or
 * shake) without rebuilding or replacing the whole character.
 */
import type { Mood } from '../../content/types';

// ------------------------------------------------------------------ outfits

/** Her outfits: home (tee), dress, sleep (pajama), seasonal (sweater), outdoor (cardigan), special occasion (gown). */
export const HER_STYLES = ['tee', 'dress', 'pajama', 'sweater', 'cardigan', 'gown'] as const;
/** His outfits: home (raglan / hoodie), shirt, sleep (pajama), seasonal (sweater), special occasion (formal). */
export const HIS_STYLES = ['raglan', 'hoodie', 'shirt', 'pajama', 'sweater', 'formal'] as const;
export type HerStyle = (typeof HER_STYLES)[number];
export type HisStyle = (typeof HIS_STYLES)[number];
export type OutfitStyle = HerStyle | HisStyle;

export const DEFAULT_STYLE = { her: 'dress', him: 'hoodie' } as const;

// ------------------------------------------------------------------ faces

/** The twelve facial states, plus ones used by activities (eating, asleep, reading/cooking, stargazing). */
export const FACES = [
  'idle', 'happy', 'smiling', 'laughing', 'sad', 'crying', 'irritated', 'pouting', 'surprised', 'sleepy', 'blushing', 'shy',
  'eating', 'asleep', 'reading', 'starry',
] as const;
export type Face = (typeof FACES)[number];

/** Story moods (dialogue lines, portraits) → the face the chibi makes. */
export const MOOD_FACE: Record<Mood, Face> = {
  neutral: 'idle', natural: 'smiling', idle: 'idle',
  happy: 'happy', laughing: 'laughing', love: 'blushing', cute: 'blushing',
  shy: 'shy', pouty: 'pouting', irritated: 'irritated',
  surprised: 'surprised', sleepy: 'sleepy', sad: 'sad', crying: 'crying',
};

export type EyeKind = 'open' | 'smile' | 'calm' | 'squeeze';
export type MouthKind =
  | 'soft' | 'smile' | 'open' | 'laugh' | 'frown' | 'wail' | 'flat' | 'pout' | 'o' | 'small-o' | 'cat' | 'wobble' | 'chew' | 'sleep';
export type FaceExtra = 'tears' | 'tearGlint' | 'anger' | 'sweat' | 'sparkle' | 'bubble' | 'puff' | 'hatch';

export interface FaceSpec {
  eye: EyeKind;
  /** Upper-lid drop over an open eye, 0..1. */
  lid?: number;
  /** Lid slant: + droops toward the outer corner (sad), − toward the nose (cross). */
  lidTilt?: number;
  /** Pupil size multiplier. */
  pupil?: number;
  /** Gaze offset in px. */
  lookX?: number;
  lookY?: number;
  /** Starry highlight in the eyes. */
  sparkle?: boolean;
  /** Brow offsets [inner, outer] in px (negative = raised). */
  brow: [number, number];
  mouth: MouthKind;
  /** Cheek blush strength 0..1. */
  blush: number;
  extra?: FaceExtra[];
  /** Frame 2 of the head sheet: a different eye/mouth used for animated faces (laughing, crying, yawning…). */
  alt?: { eye?: EyeKind; mouth?: MouthKind };
}

export const FACE_SPEC: Record<Face, FaceSpec> = {
  idle:      { eye: 'open', brow: [0, 0], mouth: 'soft', blush: 0.32 },
  smiling:   { eye: 'open', lid: 0.12, brow: [-0.5, 0], mouth: 'smile', blush: 0.42 },
  happy:     { eye: 'smile', brow: [-1.5, -0.5], mouth: 'open', blush: 0.5, extra: ['sparkle'] },
  laughing:  { eye: 'squeeze', brow: [-2, 0], mouth: 'laugh', blush: 0.6, alt: { mouth: 'open' } },
  sad:       { eye: 'open', lid: 0.22, lidTilt: 1, lookY: 1.5, brow: [-3, 1.5], mouth: 'frown', blush: 0.2, extra: ['tearGlint'] },
  crying:    { eye: 'squeeze', brow: [-3.5, 2], mouth: 'wail', blush: 0.55, extra: ['tears'], alt: { mouth: 'frown' } },
  irritated: { eye: 'open', lid: 0.38, lidTilt: -1, pupil: 0.85, lookX: 1.6, brow: [3, -1.5], mouth: 'flat', blush: 0.25, extra: ['anger'] },
  pouting:   { eye: 'open', lid: 0.18, lidTilt: -0.4, lookX: -1.4, brow: [2, -0.5], mouth: 'pout', blush: 0.6, extra: ['puff'] },
  surprised: { eye: 'open', pupil: 0.62, brow: [-4.5, -3.5], mouth: 'o', blush: 0.3, extra: ['sweat'] },
  sleepy:    { eye: 'open', lid: 0.58, brow: [-0.5, 1], mouth: 'small-o', blush: 0.3, alt: { eye: 'squeeze', mouth: 'o' } },
  blushing:  { eye: 'open', lid: 0.1, sparkle: true, lookX: 1.2, brow: [-1.5, 0], mouth: 'cat', blush: 1, extra: ['hatch'] },
  shy:       { eye: 'open', lid: 0.2, lookX: -2, lookY: 1.5, brow: [-2.5, 0.5], mouth: 'wobble', blush: 0.85, extra: ['hatch', 'sweat'] },
  eating:    { eye: 'smile', brow: [-1, 0], mouth: 'chew', blush: 0.55, extra: ['puff'], alt: { mouth: 'small-o' } },
  asleep:    { eye: 'calm', brow: [0, 1], mouth: 'sleep', blush: 0.4, extra: ['bubble'], alt: { mouth: 'sleep' } },
  /** Eyes down on what's in her hands (a book, the pan), a small content smile. */
  reading:   { eye: 'open', lid: 0.46, lookY: 2.4, brow: [-0.8, 0.2], mouth: 'smile', blush: 0.4 },
  /** Looking up at the sky, wide-eyed, stars in the eyes. */
  starry:    { eye: 'open', pupil: 1.1, lookX: 1, lookY: -2.4, sparkle: true, brow: [-2.5, -1.5], mouth: 'open', blush: 0.55, extra: ['sparkle'] },
};

/** Faces whose eyes are open, so they blink. */
export const blinks = (f: Face) => FACE_SPEC[f].eye === 'open';

// ------------------------------------------------------------------ head motion

/**
 * Procedural head motion per face, sampled each frame by the head rig: an offset (px, in sprite space) and a tilt
 * (radians, + leans toward where the character faces). `t` is seconds since the face appeared.
 */
export function headMotion(face: Face, t: number): { x: number; y: number; rot: number } {
  const s = Math.sin, settle = Math.exp(-t * 5);
  switch (face) {
    case 'laughing': return { x: 0, y: -Math.abs(s(t * 13)) * 2.4, rot: s(t * 6.5) * 0.05 };
    case 'happy': return { x: 0, y: -3 * settle * Math.abs(s(t * 10)) - 0.5, rot: 0.04 + s(t * 2) * 0.015 };
    case 'smiling': return { x: 0, y: 0, rot: 0.035 + s(t * 1.6) * 0.015 };
    case 'sad': return { x: 0, y: 2, rot: -0.03 + s(t * 0.9) * 0.01 };
    case 'crying': return { x: 0, y: 2 + Math.abs(s(t * 9)) * 1.2, rot: s(t * 18) * 0.012 };
    case 'irritated': return { x: -1, y: 0, rot: -0.09 + s(t * 23) * 0.025 * settle };
    case 'pouting': return { x: 0, y: 1, rot: -0.07 + s(t * 1.3) * 0.012 };
    case 'surprised': return { x: 0, y: -4 * settle, rot: s(t * 30) * 0.03 * settle };
    case 'sleepy': return { x: 0, y: 2 + Math.max(0, s(t * 0.9)) * 2.5, rot: s(t * 0.45) * 0.06 };
    case 'blushing': return { x: 0, y: 1, rot: 0.07 + s(t * 1.4) * 0.015 };
    case 'shy': return { x: 0, y: 2.5, rot: -0.1 + s(t * 1.2) * 0.012 };
    case 'eating': return { x: 0, y: Math.abs(s(t * 7)) * 0.8, rot: 0.02 };
    case 'asleep': return { x: 0, y: 4, rot: 0.12 + s(t * 0.8) * 0.02 };
    case 'reading': return { x: 0, y: 2, rot: 0.05 + s(t * 0.6) * 0.02 };
    case 'starry': return { x: 0, y: -1.5, rot: -0.05 + s(t * 0.8) * 0.025 };
    default: return { x: 0, y: 0, rot: s(t * 0.7) * 0.018 };
  }
}

/** How a face animates between head frames 0 (base) and 2 (alt). Returns true when the alt frame shows. */
export function altFrame(face: Face, t: number): boolean {
  switch (face) {
    case 'laughing': return Math.floor(t / 0.16) % 2 === 1;
    case 'crying': return Math.floor(t / 0.42) % 2 === 1;
    case 'eating': return false; // the bite frame follows the body's eat animation (anchor.bite)
    case 'asleep': return Math.floor(t / 1.3) % 2 === 1;
    case 'sleepy': { const c = t % 7; return c > 0.6 && c < 2; } // a yawn soon after, then now and then
    default: return false;
  }
}

// ------------------------------------------------------------------ geometry shared by body and head

/** Sprite frame, in px. Feet rest near the bottom, hips at HIP_Y. */
export const FRAME_W = 120;
export const FRAME_H = 232;
/** Neck pivot where the head sits on the body (frame coordinates). */
export const NECK = { x: 60, y: 94 };
/** The head texture covers frame y HEAD_TOP..HEAD_BOTTOM across the full frame width. */
export const HEAD_TOP = -10;
export const HEAD_BOTTOM = 106;
/** Head textures are drawn at this resolution multiple and shown scaled down (crisper eyes and lashes). */
export const HEAD_RES = 1.5;

/** Where the head goes for one body frame, relative to the sprite origin (bottom-centre), in frame px. */
export interface HeadAnchor { x: number; y: number; rot: number; bite?: boolean }

/** Anchor for a body pose: the upper body moves by `bob` and leans by `lean` around the hips. */
export function anchorFor(bob: number, lean = 0, hipY = 172, bite = false): HeadAnchor {
  const up = NECK.y + bob;
  const r = hipY - up;
  return { x: Math.sin(lean) * r, y: hipY - Math.cos(lean) * r - FRAME_H, rot: lean, bite };
}

/** Two-bone arm reach (shoulder → target). Returns the upper-arm and elbow angles, canvas convention (0 = down). */
export function reach(sx: number, sy: number, tx: number, ty: number, l1: number, l2: number, side: 1 | -1): [number, number] {
  const dx = tx - sx, dy = ty - sy;
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
  const base = Math.atan2(-dx, dy); // angle from straight down, + = toward −x
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const a = Math.acos(Math.max(-1, Math.min(1, cosA)));
  // Elbows point outward, away from the body.
  const upper = base - side * a;
  const cosB = (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2);
  const elbow = side * (Math.PI - Math.acos(Math.max(-1, Math.min(1, cosB))));
  return [upper, elbow];
}

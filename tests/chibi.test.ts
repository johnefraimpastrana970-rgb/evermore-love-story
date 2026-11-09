import { describe, expect, it } from 'vitest';
import {
  altFrame, anchorFor, FACE_SPEC, FACES, FRAME_H, HEAD_BOTTOM, HEAD_TOP, headMotion, HER_STYLES, HIS_STYLES, MOOD_FACE, NECK, reach,
} from '../src/art/chibi/spec';
import { ACT_COLS, ACT_FRAMES, activityPoses, COUPLE_COLS, COUPLE_FRAMES, COUPLE_W, FRAMES, SHEET_COLS } from '../src/art/characters';
import { FRAME_W } from '../src/art/chibi/spec';
import { COSMETICS } from '../src/content/cosmetics';

describe('chibi faces', () => {
  it('has the twelve requested facial states (plus eating and asleep)', () => {
    const wanted = ['idle', 'happy', 'smiling', 'laughing', 'sad', 'crying', 'irritated', 'pouting', 'surprised', 'sleepy', 'blushing', 'shy'];
    for (const f of wanted) expect(FACES).toContain(f);
    for (const f of FACES) expect(FACE_SPEC[f], f).toBeDefined();
  });

  it('maps every story mood to a face', () => {
    for (const [mood, face] of Object.entries(MOOD_FACE)) expect(FACES, mood).toContain(face);
    // Moods that used to collapse into the same chibi face now have their own.
    expect(MOOD_FACE.crying).not.toBe(MOOD_FACE.sad);
    expect(MOOD_FACE.irritated).not.toBe(MOOD_FACE.neutral);
    expect(MOOD_FACE.laughing).not.toBe(MOOD_FACE.happy);
  });

  it('head motion and face animation stay small and finite', () => {
    for (const f of FACES) {
      for (let t = 0; t < 12; t += 0.37) {
        const m = headMotion(f, t);
        expect(Number.isFinite(m.x + m.y + m.rot), f).toBe(true);
        expect(Math.abs(m.y), f).toBeLessThan(8);
        expect(Math.abs(m.rot), f).toBeLessThan(0.2);
        expect(typeof altFrame(f, t)).toBe('boolean');
      }
    }
  });
});

describe('chibi rig geometry', () => {
  it('puts the head on the neck, following bob and lean', () => {
    const still = anchorFor(0);
    expect(still.x).toBeCloseTo(0);
    expect(still.y).toBeCloseTo(NECK.y - FRAME_H);
    expect(anchorFor(-2).y).toBeCloseTo(NECK.y - 2 - FRAME_H);
    const lean = anchorFor(0, 0.07);
    expect(lean.x).toBeGreaterThan(4); // leaning into a run moves the head forward
    expect(lean.rot).toBe(0.07);
    expect(anchorFor(0, 0, 172, true).bite).toBe(true);
    // The neck sits inside the head texture.
    expect(NECK.y).toBeGreaterThan(HEAD_TOP);
    expect(NECK.y).toBeLessThan(HEAD_BOTTOM);
  });

  it('two-bone reach lands the hand on the target with the elbow down and out', () => {
    for (const side of [-1, 1] as const) {
      for (const [tx, ty] of [[60 + side * 6, 101], [60 + side * 8, 120], [60 + side * 23, 148]]) {
        const sx = 60 + side * 20, sy = 103, l1 = 27, l2 = 30;
        const [u, e] = reach(sx, sy, tx, ty, l1, l2, side);
        const ex = sx - l1 * Math.sin(u), ey = sy + l1 * Math.cos(u);
        const hx = ex - l2 * Math.sin(u + e), hy = ey + l2 * Math.cos(u + e);
        expect(Math.hypot(hx - tx, hy - ty)).toBeLessThan(0.5);
        // The elbow hangs below the shoulder (never pops up), and never swings across toward the other side.
        expect(ey).toBeGreaterThan(sy);
        expect((ex - sx) * side).toBeGreaterThan(-6);
        // Away from the body's midline, it points outward.
        if (Math.abs(tx - 60) > 20) expect((ex - sx) * side).toBeGreaterThan(0);
      }
    }
  });

  it('keeps sprite sheets within the 4096 px texture limit of older phones', () => {
    const rows = Math.ceil(FRAMES.total / SHEET_COLS);
    expect(SHEET_COLS * FRAME_W).toBeLessThanOrEqual(4096);
    expect(rows * FRAME_H).toBeLessThanOrEqual(4096);
    const crow = Math.ceil(COUPLE_FRAMES.total / COUPLE_COLS);
    expect(COUPLE_COLS * COUPLE_W).toBeLessThanOrEqual(4096);
    expect(crow * FRAME_H).toBeLessThanOrEqual(4096);
    for (const k of ['idle', 'walk', 'run', 'sit', 'eat'] as const) expect(FRAMES[k].length).toBeGreaterThan(0);
  });
});

describe('activities', () => {
  it('has cooking, reading, watering, picking flowers and stargazing frames, within the texture limit', () => {
    for (const a of ['cook', 'read', 'water', 'pick', 'bouquet', 'point'] as const) expect(ACT_FRAMES[a].length, a).toBeGreaterThan(0);
    const poses = activityPoses();
    expect(poses.length).toBe(ACT_FRAMES.total);
    expect(ACT_COLS * COUPLE_W).toBeLessThanOrEqual(4096);
    expect(Math.ceil(ACT_FRAMES.total / ACT_COLS) * FRAME_H).toBeLessThanOrEqual(4096);
    // Hand targets stay inside the (wide) activity frame.
    const pad = (COUPLE_W - FRAME_W) / 2;
    for (const p of poses) {
      for (const t of [p.handL, p.handR]) {
        if (!t || p.point) continue;
        expect(t[0]).toBeGreaterThan(-pad);
        expect(t[0]).toBeLessThan(FRAME_W + pad);
        expect(t[1]).toBeGreaterThan(0);
        expect(t[1]).toBeLessThan(FRAME_H);
      }
    }
  });

  it('has faces for reading and stargazing', () => {
    expect(FACES).toContain('reading');
    expect(FACES).toContain('starry');
    expect(FACE_SPEC.reading.lookY).toBeGreaterThan(0); // eyes down on the book
    expect(FACE_SPEC.starry.lookY).toBeLessThan(0); // eyes up at the sky
  });
});

describe('outfits', () => {
  it('every outfit cosmetic uses a cut that fits its wearer', () => {
    for (const c of COSMETICS) {
      if (!c.style) continue;
      if (c.slot === 'herOutfit') expect(HER_STYLES as readonly string[], c.id).toContain(c.style);
      if (c.slot === 'hisOutfit') expect(HIS_STYLES as readonly string[], c.id).toContain(c.style);
    }
  });

  it('offers home, sleep, outdoor, seasonal and special-occasion outfits for both', () => {
    const her = new Set(COSMETICS.filter((c) => c.slot === 'herOutfit').map((c) => c.style ?? 'dress'));
    const him = new Set(COSMETICS.filter((c) => c.slot === 'hisOutfit').map((c) => c.style ?? 'hoodie'));
    for (const s of ['tee', 'pajama', 'cardigan', 'sweater', 'gown']) expect(her, s).toContain(s);
    for (const s of ['raglan', 'pajama', 'shirt', 'sweater', 'formal']) expect(him, s).toContain(s);
  });
});

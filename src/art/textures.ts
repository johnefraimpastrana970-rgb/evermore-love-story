import Phaser from 'phaser';
import type { LocationDef, TimeOfDay } from '../content/types';
import { ROOMS } from './rooms';
import { buildSpriteSheet, FRAME_H, FRAME_W, FRAMES, Look } from './characters';
import { drawIcon } from './icons';
import { ellipse, glow, heartPath, makeCanvas, starPath, vgrad, hex, shade, drawStringLights } from './paint';
import { store } from '../core/store';
import { cosmetic } from '../content/cosmetics';

export function lookFor(who: 'her' | 'him'): Look {
  const eq = store.state.cosmetics.equipped;
  if (who === 'her') {
    const outfit = cosmetic(eq.herOutfit);
    return {
      who,
      hair: cosmetic(eq.herHair)?.color ?? 0x2c1b22,
      outfit: outfit?.color ?? 0xfbf3f4,
      accent: cosmetic(eq.herAccent)?.color ?? 0xf4a3bb,
      style: outfit?.style ?? 'dress',
    };
  }
  const hisOutfit = cosmetic(eq.hisOutfit);
  return {
    who,
    hair: cosmetic(eq.hisHair)?.color ?? 0x1b1418,
    outfit: hisOutfit?.color ?? 0x2a252e,
    accent: 0xffffff,
    style: hisOutfit?.style,
  };
}

/** Builds (once) a character sprite sheet + animations, returns the texture key. */
export function ensureCharacter(scene: Phaser.Scene, look: Look): string {
  const key = `char2-${look.who}-${look.hair.toString(16)}-${look.outfit.toString(16)}-${look.accent.toString(16)}-${look.style ?? 'dress'}`;
  if (!scene.textures.exists(key)) {
    const canvas = buildSpriteSheet(look);
    const tex = scene.textures.addCanvas(key, canvas)!;
    for (let i = 0; i < FRAMES.total; i++) tex.add(i, 0, i * FRAME_W, 0, FRAME_W, FRAME_H);
  }
  if (!scene.anims.exists(`${key}-walk`)) {
    scene.anims.create({ key: `${key}-walk`, frames: FRAMES.walk.map((f) => ({ key, frame: f })), frameRate: 13, repeat: -1 });
    // Three slow breaths; a blink lands in the middle one.
    const idle = [...FRAMES.idle, ...FRAMES.idle.map((f) => (f === 3 ? FRAMES.blink : f)), ...FRAMES.idle];
    scene.anims.create({ key: `${key}-idle`, frames: idle.map((f) => ({ key, frame: f })), frameRate: 4.5, repeat: -1 });
  }
  return key;
}

function addCanvas(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

export interface RoomTextures { bg: string; sky?: string; far?: string; fg?: string }

export function ensureRoom(scene: Phaser.Scene, loc: LocationDef, time: TimeOfDay): RoomTextures {
  const p = ROOMS[loc.id];
  const base = `room-${loc.id}-${time}`;
  const out: RoomTextures = { bg: base };
  if (!scene.textures.exists(base)) {
    const [c, ctx] = makeCanvas(loc.width, 720);
    p.bg(ctx, time, loc.width);
    addCanvas(scene, base, c);
  }
  if (p.sky) {
    out.sky = base + '-sky';
    if (!scene.textures.exists(out.sky)) {
      const [c, ctx] = makeCanvas(1280, 720);
      p.sky(ctx, time);
      addCanvas(scene, out.sky, c);
    }
  }
  if (p.far) {
    out.far = base + '-far';
    if (!scene.textures.exists(out.far)) {
      const fw = Math.ceil(loc.width * 0.5 + 700);
      const [c, ctx] = makeCanvas(fw, 720);
      p.far(ctx, time, fw);
      addCanvas(scene, out.far, c);
    }
  }
  if (p.fg) {
    out.fg = base + '-fg';
    if (!scene.textures.exists(out.fg)) {
      const [c, ctx] = makeCanvas(loc.width, 720);
      p.fg(ctx, time, loc.width);
      addCanvas(scene, out.fg, c);
    }
  }
  return out;
}

export function ensureDecorLights(scene: Phaser.Scene, width: number): string {
  const key = `decor-lights-${width}`;
  if (!scene.textures.exists(key)) {
    const [c, ctx] = makeCanvas(width, 140);
    drawStringLights(ctx, 0, width, 34, 22, true, 'occ-lights');
    addCanvas(scene, key, c);
  }
  return key;
}

/** Small textures used by particles, decorations and collectibles. */
export function buildBaseTextures(scene: Phaser.Scene) {
  const make = (key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    if (scene.textures.exists(key)) return;
    const [c, ctx] = makeCanvas(w, h);
    draw(ctx);
    scene.textures.addCanvas(key, c);
  };
  make('glow', 256, 256, (ctx) => glow(ctx, 128, 128, 128, 0xffffff, 1));
  make('dot', 16, 16, (ctx) => glow(ctx, 8, 8, 8, 0xffffff, 1));
  make('p-heart', 32, 32, (ctx) => { ctx.fillStyle = '#ff8fb0'; heartPath(ctx, 16, 4, 26); ctx.fill(); });
  make('p-heart-w', 32, 32, (ctx) => { ctx.fillStyle = '#ffffff'; heartPath(ctx, 16, 4, 26); ctx.fill(); });
  make('p-petal', 24, 24, (ctx) => {
    ctx.translate(12, 12); ctx.rotate(0.6);
    ellipse(ctx, 0, 0, 5, 10, vgrad(ctx, -10, 10, [[0, 0xffe0ea], [1, 0xf59ab8]]));
  });
  make('p-snow', 16, 16, (ctx) => { glow(ctx, 8, 8, 8, 0xffffff, 0.9); ellipse(ctx, 8, 8, 3, 3, '#ffffff'); });
  make('p-confetti', 10, 16, (ctx) => { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 10, 16); });
  make('p-rain', 4, 30, (ctx) => { ctx.fillStyle = vgrad(ctx, 0, 30, [[0, 0xc8d8ff]], 0.0); const g = ctx.createLinearGradient(0, 0, 0, 30); g.addColorStop(0, 'rgba(200,220,255,0)'); g.addColorStop(1, 'rgba(220,235,255,0.7)'); ctx.fillStyle = g; ctx.fillRect(1, 0, 2, 30); });
  make('p-star', 24, 24, (ctx) => { ctx.fillStyle = '#ffffff'; starPath(ctx, 12, 12, 11, 0.2, 4); ctx.fill(); });
  make('firefly', 32, 32, (ctx) => { glow(ctx, 16, 16, 16, 0xe8ff9a, 0.9); ellipse(ctx, 16, 16, 2.5, 2.5, '#fbffd8'); });
  make('shadow', 128, 32, (ctx) => {
    const g = ctx.createRadialGradient(64, 16, 0, 64, 16, 64);
    g.addColorStop(0, 'rgba(40,20,40,0.35)'); g.addColorStop(1, 'rgba(40,20,40,0)');
    ctx.save(); ctx.scale(1, 0.25); ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); ctx.restore();
  });
  for (const k of ['heart', 'petal', 'star', 'note', 'sparkle']) {
    make(`col-${k}`, 64, 64, (ctx) => { glow(ctx, 32, 32, 32, 0xfff0f6, 0.55); ctx.save(); ctx.translate(8, 8); drawIcon(ctx, k, 48); ctx.restore(); });
  }
  make('emote-heart', 48, 48, (ctx) => drawIcon(ctx, 'heart', 48));
  make('balloon', 70, 160, (ctx) => {
    ctx.strokeStyle = 'rgba(80,60,60,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(35, 80); ctx.quadraticCurveTo(25, 120, 38, 160); ctx.stroke();
    ellipse(ctx, 35, 42, 30, 38, '#ffffff');
    ellipse(ctx, 25, 30, 7, 11, 'rgba(255,255,255,0.0)');
    ctx.beginPath(); ctx.moveTo(30, 80); ctx.lineTo(40, 80); ctx.lineTo(35, 72); ctx.fillStyle = '#ffffff'; ctx.fill();
  });
  make('pumpkin', 80, 64, (ctx) => {
    for (const [dx, rx] of [[-16, 18], [16, 18], [0, 20]] as [number, number][]) ellipse(ctx, 40 + dx, 38, rx, 24, vgrad(ctx, 14, 62, [[0, 0xffa040], [1, 0xd86a1a]]));
    ctx.fillStyle = '#5a7a3a'; ctx.fillRect(37, 6, 6, 12);
    ctx.fillStyle = '#5a2a10'; ctx.beginPath(); ctx.moveTo(28, 34); ctx.lineTo(34, 28); ctx.lineTo(36, 36); ctx.fill();
    ctx.beginPath(); ctx.moveTo(52, 34); ctx.lineTo(46, 28); ctx.lineTo(44, 36); ctx.fill();
    ctx.beginPath(); ctx.moveTo(28, 44); ctx.quadraticCurveTo(40, 54, 52, 44); ctx.quadraticCurveTo(40, 50, 28, 44); ctx.fill();
  });
  make('hint', 40, 40, (ctx) => { glow(ctx, 20, 20, 20, 0xffffff, 0.8); ctx.fillStyle = '#fff'; starPath(ctx, 20, 20, 12, 0.25, 4); ctx.fill(); });
  void hex; void shade;
}

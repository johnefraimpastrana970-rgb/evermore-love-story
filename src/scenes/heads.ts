import Phaser from 'phaser';
import { HEAD_FRAMES, HEAD_ORIGIN, type Look } from '../art/characters';
import { ensureHead, headAnchor } from '../art/textures';
import { altFrame, blinks, headMotion, HEAD_RES, type Face } from '../art/chibi/spec';
import { store } from '../core/store';

/*
 * Heads for the world's characters. Each body sprite gets a head image that follows it every frame (position,
 * scale and facing, rotation, depth, alpha, visibility) through the body frame's head anchor. The face lives
 * only on the head, so expressions change without touching the body's animation, and the head can nod, tilt,
 * shake and blink on its own.
 */

interface HeadState {
  head: Phaser.GameObjects.Image;
  look: Look;
  /** The face it falls back to (mood of the moment: content, sleepy, hungry…). */
  base: Face;
  /** A passing expression and when it ends (ms, scene time); null = showing base. */
  temp: { face: Face; until: number } | null;
  shown: Face;
  /** Seconds since the shown face appeared (drives its motion and animation). */
  t: number;
  nextBlink: number;
  blinkUntil: number;
  ox: number; oy: number; rot: number;
}

export class HeadRig {
  private heads = new Map<Phaser.GameObjects.Sprite, HeadState>();

  constructor(private scene: Phaser.Scene) {
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.sync, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  attach(spr: Phaser.GameObjects.Sprite, look: Look, base: Face = 'idle') {
    this.detach(spr);
    const head = this.scene.add.image(spr.x, spr.y, ensureHead(this.scene, look, base), HEAD_FRAMES.open).setOrigin(HEAD_ORIGIN.x, HEAD_ORIGIN.y);
    const now = this.scene.time.now;
    this.heads.set(spr, { head, look, base, temp: null, shown: base, t: 0, nextBlink: now + 1500 + Math.random() * 2500, blinkUntil: 0, ox: 0, oy: 0, rot: 0 });
    this.place(spr, this.heads.get(spr)!, 0);
  }

  /**
   * Build the faces most likely to show up next, one at a time with gaps in between, so the first blush or laugh
   * doesn't cost a frame hitch on slower phones. Textures are shared by every scene after that.
   */
  warm(spr: Phaser.GameObjects.Sprite, faces: Face[], gapMs = 220) {
    faces.forEach((f, i) => this.scene.time.delayedCall(900 + i * gapMs, () => {
      const s = this.heads.get(spr);
      if (s && spr.active) ensureHead(this.scene, s.look, f);
    }));
  }

  detach(spr: Phaser.GameObjects.Sprite) {
    this.heads.get(spr)?.head.destroy();
    this.heads.delete(spr);
  }

  setLook(spr: Phaser.GameObjects.Sprite, look: Look) {
    const s = this.heads.get(spr);
    if (!s) return;
    s.look = look;
    s.head.setTexture(ensureHead(this.scene, look, s.shown), HEAD_FRAMES.open);
  }

  /** The face this character returns to. */
  setBase(spr: Phaser.GameObjects.Sprite | undefined, face: Face) {
    const s = spr && this.heads.get(spr);
    if (s) s.base = face;
  }

  /** Show an expression for a while (or until replaced). */
  show(spr: Phaser.GameObjects.Sprite | undefined, face: Face, ms = 2200) {
    const s = spr && this.heads.get(spr);
    if (s) s.temp = { face, until: this.scene.time.now + ms };
  }

  /** Drop any passing expression (e.g. the conversation ended). */
  clear(spr?: Phaser.GameObjects.Sprite) {
    for (const [k, s] of this.heads) if (!spr || k === spr) s.temp = null;
  }

  face(spr: Phaser.GameObjects.Sprite | undefined): Face | undefined {
    return spr ? this.heads.get(spr)?.shown : undefined;
  }

  destroy() {
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.sync, this);
    for (const s of this.heads.values()) s.head.destroy();
    this.heads.clear();
  }

  private sync(_time: number, delta: number) {
    const dt = Math.min(0.1, delta / 1000);
    const now = this.scene.time.now;
    for (const [spr, s] of this.heads) {
      if (!spr.active) { s.head.destroy(); this.heads.delete(spr); continue; }
      if (s.temp && now > s.temp.until) s.temp = null;
      const want = s.temp?.face ?? s.base;
      if (want !== s.shown) {
        s.shown = want;
        s.t = 0;
        s.head.setTexture(ensureHead(this.scene, s.look, want), HEAD_FRAMES.open);
      }
      s.t += dt;
      this.place(spr, s, dt);
    }
  }

  private place(spr: Phaser.GameObjects.Sprite, s: HeadState, dt: number) {
    const now = this.scene.time.now;
    const reduced = store.settings.reducedMotion;
    const a = headAnchor(spr.texture.key, spr.frame.name);
    // Which frame: blink now and then (open eyes only), the face's alternate frame, or the eating bite.
    if (now > s.nextBlink) {
      s.blinkUntil = now + 110 + Math.random() * 50;
      // Mostly single blinks every few seconds; sometimes a quick double blink.
      s.nextBlink = now + (Math.random() < 0.18 ? 260 : 2400 + Math.random() * 3600);
    }
    let frame: number = HEAD_FRAMES.open;
    if (s.shown === 'eating') frame = a.bite ? HEAD_FRAMES.alt : HEAD_FRAMES.open;
    else if (!reduced && altFrame(s.shown, s.t)) frame = HEAD_FRAMES.alt;
    if (now < s.blinkUntil && blinks(s.shown) && frame === HEAD_FRAMES.open) frame = HEAD_FRAMES.blink;
    if (Number(s.head.frame.name) !== frame) s.head.setFrame(frame);
    // Eased head motion for the face (none with reduced motion).
    const m = reduced ? { x: 0, y: 0, rot: 0 } : headMotion(s.shown, s.t);
    const k = dt ? 1 - Math.exp(-dt * 12) : 1;
    s.ox += (m.x - s.ox) * k;
    s.oy += (m.y - s.oy) * k;
    s.rot += (m.rot - s.rot) * k;
    // Anchor (frame px from the body's bottom-centre origin) → world, through the body's scale and rotation.
    const lx = (a.x + s.ox) * spr.scaleX, ly = (a.y + s.oy) * spr.scaleY;
    const c = Math.cos(spr.rotation), sn = Math.sin(spr.rotation);
    const dir = Math.sign(spr.scaleX) || 1;
    s.head
      .setPosition(spr.x + lx * c - ly * sn, spr.y + lx * sn + ly * c)
      .setScale(spr.scaleX / HEAD_RES, spr.scaleY / HEAD_RES)
      .setRotation(spr.rotation + (a.rot + s.rot) * dir)
      .setDepth(spr.depth + 0.01)
      .setAlpha(spr.alpha)
      .setVisible(spr.visible);
  }
}

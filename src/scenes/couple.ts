import Phaser from 'phaser';
import type { Hotspot, LocationDef } from '../content/types';
import { store } from '../core/store';
import { bus } from '../core/events';
import { audio } from '../audio/audio';
import { COUPLE, FRAME_H, type Activity } from '../art/characters';
import { shade } from '../art/paint';
import { resolveLook } from '../home/logic';
import { setPrompt } from '../ui/hud';
import type { Face } from '../art/chibi/spec';

/*
 * Couple interactions in the world, as one reusable system:
 *  - swing: she sits on the swing and the partner pushes; the push strength follows the "Higher!/Gently" choice
 *  - sit: both sit together (sofa, bed edge, stargazing blanket) and lean on each other while the activity runs
 *  - gather: the partner comes to stand beside her at any other activity and reacts afterwards
 *  - idle: if both stand still for 10 s, a small moment plays (poke, lean, hum, hold hands, twirl, …)
 *  - ambient: now and then the partner stretches, looks around or hums on their own
 * "Her" here means whoever is being played; the partner is the other character (see core/roles.ts).
 */

export interface MotionLike { face: number; faceT: number; sq: number; sqV: number; tilt: number; tiltT: number; moving: boolean }
export interface CoupleHost {
  scene: Phaser.Scene;
  loc(): LocationDef;
  player(): Phaser.GameObjects.Sprite;
  partner(): Phaser.GameObjects.Sprite | undefined;
  motion(spr: Phaser.GameObjects.Sprite): MotionLike;
  drive(spr: Phaser.GameObjects.Sprite, vx: number, vy: number, dt: number): void;
  /** Switch to the standing/breathing animation. */
  idleAnim(spr: Phaser.GameObjects.Sprite): void;
  shadow(spr: Phaser.GameObjects.Sprite): Phaser.GameObjects.Image | undefined;
  setFollowGap(px: number): void;
  burst(x: number, y: number, tex: string, n: number): void;
  /** Switch a character to a couple pose (hug) or back to normal (null). */
  setStyle(spr: Phaser.GameObjects.Sprite, style: 'hug' | null): void;
  /** Hold hands for a little while (an idle moment), even if the 🤝 button is off. */
  holdHandsFor(ms: number): void;
  /** Show an expression on a character's face for a while. */
  face(spr: Phaser.GameObjects.Sprite | undefined, face: Face, ms?: number): void;
  /** Switch to the seated (breathing) animation. */
  sitAnim(spr: Phaser.GameObjects.Sprite): void;
  /** Play an activity animation (pointing at the stars, cooking…), or stop it with null. */
  act(spr: Phaser.GameObjects.Sprite, a: Activity | null): void;
}

/** Hips sit this far above the feet in the sprite frame (legs below are what hangs/hides when seated). */
const HIP = 60;
const SPEED = 250;

interface SeatSpec {
  /** Hip positions [player, partner] in world coordinates. */
  seats: [[number, number], [number, number]];
  scale: number;
  /** Hide the legs (sitting on the ground). */
  crop?: boolean;
  /** Draws whatever is in front of the sitters (the sofa's front), so legs disappear behind it. */
  front?: (g: Phaser.GameObjects.Graphics) => void;
}

const SEATS: Record<string, SeatSpec> = {
  'living-sofa': {
    seats: [[650, 440], [770, 440]], scale: 0.74,
    front: (g) => {
      // Same colour as the painted sofa (it can be recoloured when decorating).
      const sofa = (store.hasGame ? resolveLook(store.state.home, 'livingroom').sofa : undefined) ?? 0x8aa6d6;
      g.fillStyle(shade(sofa, 0.15), 1);
      for (const cx of [580, 700, 820]) g.fillRoundedRect(cx - 54, 420, 108, 26, 10);
      g.fillGradientStyle(shade(sofa, 0.05), shade(sofa, 0.05), shade(sofa, -0.18), shade(sofa, -0.18), 1);
      g.fillRoundedRect(510, 438, 400, 47, 14);
      g.fillStyle(shade(sofa, -0.05), 1);
      g.fillRoundedRect(498, 390, 44, 100, 18);
      g.fillRoundedRect(878, 390, 44, 100, 18);
    },
  },
  'bedroom-bed': { seats: [[630, 452], [750, 452]], scale: 0.78 },
  'yard-blanket': { seats: [[1705, 478], [1795, 478]], scale: 0.8, crop: true },
};

const SWING = { pivot: [760, 222] as [number, number], len: 200, anchors: [[728, 221], [792, 225]] as [number, number][], push: [905, 556] as [number, number] };

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

type Pose = { x: number; y: number; rot: number; scale: number; crop: boolean; face: number; depth: number };

export class CoupleDirector {
  /** An act is running (swing / sit): world input is paused and these sprites are posed by us. */
  active = false;
  private posed = new Map<Phaser.GameObjects.Sprite, Pose>();
  /** Sprites kept standing still where they are (e.g. the partner pushing the swing). */
  private held = new Set<Phaser.GameObjects.Sprite>();
  private dead = false;
  private walking = new Map<Phaser.GameObjects.Sprite, { x: number; y: number; done: () => void }>();
  private bubbles: { t: Phaser.GameObjects.Text; spr: Phaser.GameObjects.Sprite; until: number }[] = [];
  private swingProp?: { g: Phaser.GameObjects.Graphics; seat: Phaser.GameObjects.Graphics; angle: number };
  private front?: Phaser.GameObjects.Graphics;
  private idleT = 0;
  /** Seconds both have stood still (never reset by idle moments). */
  private stillT = 0;
  private ambientT = 20 + Math.random() * 15;
  private time = 0;
  private swingState: { amp: number; target: number; phase: number; pushing: boolean; lastPeak: number; stop: boolean } | null = null;
  private unsub: (() => void)[] = [];

  constructor(private h: CoupleHost) {}

  // ---------------------------------------------------------------- setup
  buildProps() {
    if (this.h.loc().id !== 'backyard') return;
    const g = this.h.scene.add.graphics().setDepth(430);
    const seat = this.h.scene.add.graphics().setDepth(432);
    this.swingProp = { g, seat, angle: 0 };
    this.drawSwing(0);
  }
  destroy() {
    this.dead = true;
    this.unsub.forEach((u) => u());
    this.bubbles.forEach((b) => b.t.destroy());
    this.bubbles = [];
  }

  posedBy(spr: Phaser.GameObjects.Sprite) { return this.posed.has(spr); }
  /** How long the two of them have been standing still together. */
  idleFor() { return this.stillT; }
  controls(spr: Phaser.GameObjects.Sprite) { return this.posed.has(spr) || this.walking.has(spr) || this.held.has(spr); }

  private seatPoint(angle: number): [number, number] {
    const [px, py] = SWING.pivot;
    return [px + Math.sin(angle) * SWING.len, py + Math.cos(angle) * SWING.len];
  }
  private drawSwing(angle: number) {
    const p = this.swingProp;
    if (!p) return;
    p.angle = angle;
    const [sx, sy] = this.seatPoint(angle);
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const end = (dx: number) => [sx + dx * ca, sy - dx * sa] as [number, number];
    const [l, r] = [end(-34), end(34)];
    p.g.clear();
    p.g.lineStyle(3, 0xd8c0a0, 1);
    p.g.lineBetween(SWING.anchors[0][0], SWING.anchors[0][1], l[0], l[1]);
    p.g.lineBetween(SWING.anchors[1][0], SWING.anchors[1][1], r[0], r[1]);
    p.seat.clear();
    p.seat.fillStyle(0xb07a52, 1);
    const corners = [[-50, -2], [50, -2], [50, 10], [-50, 10]].map(([dx, dy]) => new Phaser.Math.Vector2(sx + dx * ca + dy * sa, sy - dx * sa + dy * ca));
    p.seat.fillPoints(corners, true);
    p.seat.fillStyle(0x8a5a3a, 1);
    p.seat.fillPoints(corners.slice(2).concat([new Phaser.Math.Vector2(corners[3].x, corners[3].y + 3), new Phaser.Math.Vector2(corners[2].x, corners[2].y + 3)]), true);
  }

  // ---------------------------------------------------------------- per frame
  /** Call every frame before the scene's own movement. */
  update(dt: number) {
    this.time += dt;
    const player = this.h.player();
    // Walking targets.
    for (const [spr, t] of [...this.walking]) {
      const dx = t.x - spr.x, dy = t.y - spr.y, d = Math.hypot(dx, dy);
      if (d < 5) { this.h.drive(spr, 0, 0, dt); this.walking.delete(spr); t.done(); continue; }
      const sp = Math.min(SPEED, d * 4 + 40);
      this.h.drive(spr, (dx / d) * sp, (dy / d) * sp * 0.75, dt);
    }
    for (const spr of this.held) if (!this.walking.has(spr)) this.h.drive(spr, 0, 0, dt);
    // Posed sprites.
    for (const [spr, p] of this.posed) {
      spr.setPosition(p.x, p.y);
      spr.setRotation(p.rot);
      spr.setScale(p.scale * p.face, p.scale);
      spr.setDepth(p.depth);
      if (p.crop) spr.setCrop(0, 0, spr.frame.width, FRAME_H - HIP); else spr.setCrop();
      const sh = this.h.shadow(spr);
      if (sh) sh.setVisible(false);
    }
    // Swing physics.
    if (this.swingState && this.swingProp) this.stepSwing(dt);
    else if (this.swingProp) this.drawSwing(Math.sin(this.time * 1.3) * 0.025); // breeze
    // Speech bubbles follow their speaker.
    const now = this.time;
    this.bubbles = this.bubbles.filter((b) => {
      if (now > b.until || !b.spr.active) { b.t.destroy(); return false; }
      b.t.setPosition(b.spr.x, b.spr.y - FRAME_H * Math.abs(b.spr.scaleY) - 8);
      return true;
    });
    // Idle and ambient moments.
    const partner = this.h.partner();
    if (!partner || this.active || store.blocked) { this.idleT = 0; this.stillT = 0; return; }
    const still = !this.h.motion(player).moving && !this.h.motion(partner).moving;
    this.idleT = still ? this.idleT + dt : 0;
    this.stillT = still ? this.stillT + dt : 0;
    if (this.idleT >= 10) {
      this.idleT = -(8 + Math.random() * 8); // the next one comes a bit later if they keep standing there
      this.idleMoment();
    }
    this.ambientT -= dt;
    if (this.ambientT <= 0) {
      this.ambientT = 22 + Math.random() * 20;
      if (!this.h.motion(partner).moving) this.ambient();
    }
  }

  // ---------------------------------------------------------------- building blocks
  private walk(spr: Phaser.GameObjects.Sprite, x: number, y: number): Promise<void> {
    if (this.dead) return Promise.resolve();
    const loc = this.h.loc();
    const tx = Phaser.Math.Clamp(x, 40, loc.width - 40), ty = Phaser.Math.Clamp(y, loc.floorTop, loc.floorBottom);
    return new Promise((done) => {
      this.walking.set(spr, { x: tx, y: ty, done });
      // Never hang if something blocks the path.
      this.h.scene.time.delayedCall(3500, () => { if (this.walking.get(spr)?.done === done) { this.walking.delete(spr); done(); } });
    });
  }
  /** Jump from where it stands into a pose (arc), or back down to the floor. */
  private hop(spr: Phaser.GameObjects.Sprite, to: Pose, ms = 420): Promise<void> {
    const from = { x: spr.x, y: spr.y, scale: Math.abs(spr.scaleY) };
    const pose: Pose = { ...to, x: from.x, y: from.y, scale: from.scale };
    if (this.dead) return Promise.resolve();
    this.walking.delete(spr);
    this.posed.set(spr, pose);
    this.h.idleAnim(spr);
    audio.sfx('click');
    return new Promise((done) => {
      const o = { t: 0 };
      this.h.scene.tweens.add({
        targets: o, t: 1, duration: store.settings.reducedMotion ? 1 : ms, ease: 'Sine.easeInOut',
        onUpdate: () => {
          pose.x = from.x + (to.x - from.x) * o.t;
          pose.y = from.y + (to.y - from.y) * o.t - Math.sin(Math.PI * o.t) * 46;
          pose.scale = from.scale + (to.scale - from.scale) * o.t;
          pose.rot = to.rot * o.t;
          pose.crop = o.t > 0.6 && to.crop;
        },
        onComplete: () => { Object.assign(pose, to); done(); },
      });
    });
  }
  private release(spr: Phaser.GameObjects.Sprite) {
    this.posed.delete(spr);
    spr.setCrop();
    spr.setRotation(0);
    this.h.shadow(spr)?.setVisible(true);
  }
  private floorPose(spr: Phaser.GameObjects.Sprite, x: number, y: number): Pose {
    const loc = this.h.loc();
    const t = (y - loc.floorTop) / (loc.floorBottom - loc.floorTop);
    return { x, y, rot: 0, scale: 0.82 + 0.2 * t, crop: false, face: this.h.motion(spr).face, depth: y };
  }

  say(spr: Phaser.GameObjects.Sprite | undefined, text: string, ms = 2200) {
    if (!spr) return;
    const t = this.h.scene.add.text(spr.x, spr.y, store.fmt(text), {
      fontFamily: 'Fredoka, sans-serif', fontSize: '17px', color: '#4a2a3e', backgroundColor: '#fffaf6', padding: { x: 10, y: 6 },
    }).setOrigin(0.5, 1).setDepth(9550).setScale(0.6).setAlpha(0);
    this.h.scene.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    this.bubbles = this.bubbles.filter((b) => { if (b.spr === spr) { b.t.destroy(); return false; } return true; });
    this.bubbles.push({ t, spr, until: this.time + ms / 1000 });
  }
  /** A glyph or heart that floats up from a spot. */
  emote(x: number, y: number, glyph: string | 'heart', color = '#ff5c8a') {
    const s = this.h.scene;
    const o = glyph === 'heart'
      ? s.add.image(x, y, 'emote-heart').setScale(0.2)
      : s.add.text(x, y, glyph, { fontFamily: 'Fredoka, sans-serif', fontSize: '26px', color, stroke: '#ffffff', strokeThickness: 5 }).setOrigin(0.5).setScale(0.4);
    o.setDepth(9540);
    s.tweens.add({ targets: o, scale: glyph === 'heart' ? 0.65 : 1, y: y - 34, duration: 480, ease: 'Back.easeOut' });
    s.tweens.add({ targets: o, alpha: 0, y: y - 60, delay: 1100, duration: 500, onComplete: () => o.destroy() });
  }
  /** A heart between two people, around hand height (they just took each other's hand). */
  emoteAt(a: Phaser.GameObjects.Sprite, b: Phaser.GameObjects.Sprite) {
    this.emote((a.x + b.x) / 2, a.y - FRAME_H * Math.abs(a.scaleY) * 0.42, 'heart');
  }
  private headY(spr: Phaser.GameObjects.Sprite) { return spr.y - FRAME_H * Math.abs(spr.scaleY) * 0.95; }
  private bounce(spr: Phaser.GameObjects.Sprite, amount = 0.9) { this.h.motion(spr).sqV -= amount; }
  private tilt(spr: Phaser.GameObjects.Sprite, rad: number, ms: number) {
    const m = this.h.motion(spr);
    m.tiltT = rad;
    this.h.scene.time.delayedCall(ms, () => { m.tiltT = 0; });
  }
  private faceEachOther() {
    const p = this.h.player(), q = this.h.partner();
    if (!q) return;
    this.h.motion(p).faceT = q.x > p.x ? 1 : -1;
    this.h.motion(q).faceT = p.x > q.x ? 1 : -1;
  }
  private actionPressed(): boolean {
    if (store.blocked) return false;
    const pressed = store.joy.action || this.keyPressed;
    store.joy.action = false;
    this.keyPressed = false;
    return pressed;
  }
  private keyPressed = false;
  private listenKeys() {
    const onKey = (e: KeyboardEvent) => { if (['KeyE', 'Space', 'Enter'].includes(e.code) && !store.blocked) this.keyPressed = true; };
    window.addEventListener('keydown', onKey);
    const tap = () => { if (!store.blocked) this.keyPressed = true; };
    this.h.scene.input.on('pointerdown', tap);
    return () => { window.removeEventListener('keydown', onKey); this.h.scene.input.off('pointerdown', tap); };
  }

  // ---------------------------------------------------------------- the swing
  /** She sits on the swing, the partner pushes. Plays the swing conversation while swinging. */
  async swing(runDialogue: () => Promise<void>) {
    const player = this.h.player(), partner = this.h.partner();
    if (!this.swingProp) { await runDialogue(); return; }
    this.active = true;
    const sc = 0.78;
    const st = { amp: 0.03, target: 0.3, phase: 0, pushing: false, lastPeak: 0, stop: false };
    const off = bus.on('dialogue:node', (id: string) => {
      if (id === 'swing-high') { st.target = 0.52; this.say(partner, 'Hold on tight!'); this.h.face(player, 'laughing', 2400); }
      if (id === 'swing-soft') { st.target = 0.2; this.say(partner, 'Nice and slow ♡'); this.h.face(player, 'smiling', 2400); }
    });
    try {
      // Partner heads behind the swing while she hops on.
      const partnerThere = partner ? this.walk(partner, SWING.push[0], SWING.push[1]) : Promise.resolve();
      const [sx, sy] = this.seatPoint(this.swingProp.angle);
      await this.hop(player, { x: sx, y: sy + HIP * sc, rot: 0, scale: sc, crop: false, face: 1, depth: 431 });
      this.h.sitAnim(player);
      this.h.face(player, 'happy', 1800);
      this.swingState = st;
      await partnerThere;
      if (partner) { this.held.add(partner); this.h.motion(partner).faceT = -1; st.pushing = true; }
      this.say(player, pick(['Push me? ♡', 'Ready!', 'Okay, go!']));
      await new Promise((r) => this.h.scene.time.delayedCall(1600, r));
      await runDialogue();
      // Keep swinging until she hops off (E / Space / tap) or a little while passes.
      setPrompt('Hop off the swing');
      const stopKeys = this.listenKeys();
      const until = this.time + 16;
      let nextLine = this.time + 2.5;
      await new Promise<void>((done) => {
        const ev = this.h.scene.time.addEvent({
          delay: 100, loop: true, callback: () => {
            if (this.actionPressed() || this.time > until) { ev.remove(); done(); return; }
            if (this.time > nextLine && !store.blocked) {
              nextLine = this.time + 3 + Math.random() * 3;
              if (Math.random() < 0.5) { this.say(player, pick(['Wheee!', 'Higher! …Okay, not that high.', 'I can see the whole sky!', 'Hehe ♡'])); this.h.face(player, 'laughing', 1800); }
              else { this.say(partner, pick(['You look so happy.', 'Again? Okay ♡', 'I’ve got you.', 'Ten more pushes!'])); this.h.face(partner, 'happy', 1800); this.h.face(player, 'blushing', 1800); }
              const [hx, hy] = this.seatPoint(this.swingProp!.angle);
              this.emote(hx, hy - 150, 'heart');
            }
          },
        });
      });
      stopKeys();
      setPrompt(null);
      // Let it slow down, then hop off.
      st.pushing = false;
      st.stop = true;
      await new Promise<void>((done) => {
        const ev = this.h.scene.time.addEvent({ delay: 80, loop: true, callback: () => { if (st.amp < 0.04) { ev.remove(); done(); } } });
        this.h.scene.time.delayedCall(4000, () => { ev.remove(); done(); });
      });
      this.swingState = null;
      if (this.dead) return;
      await this.hop(player, this.floorPose(player, 690, 560));
      this.release(player);
      if (partner) { this.faceEachOther(); this.bounce(player); this.emote((player.x + partner.x) / 2, this.headY(player), 'heart'); this.h.face(player, 'happy', 1600); this.h.face(partner, 'smiling', 1600); }
    } finally {
      off();
      this.swingState = null;
      if (partner) this.held.delete(partner);
      this.release(player);
      this.active = false;
    }
  }

  private stepSwing(dt: number) {
    const st = this.swingState!;
    const player = this.h.player(), partner = this.h.partner();
    const w = (Math.PI * 2) / 2.6;
    st.phase += w * dt;
    if (st.stop) st.amp *= Math.exp(-dt * 0.9);
    const angle = Math.sin(st.phase) * st.amp;
    this.drawSwing(angle);
    // At the back of each swing (towards the partner) they give a push.
    const peak = Math.floor((st.phase - Math.PI / 2) / (Math.PI * 2));
    if (st.pushing && peak !== st.lastPeak && Math.sin(st.phase) > 0.97) {
      st.lastPeak = peak;
      st.amp += (st.target - st.amp) * 0.45;
      if (partner) { this.tilt(partner, -0.16, 260); this.bounce(partner, 0.5); }
      audio.sfx('type');
    }
    const pose = this.posed.get(player);
    if (pose) {
      const [sx, sy] = this.seatPoint(angle);
      const hh = HIP * pose.scale;
      pose.x = sx + Math.sin(angle) * hh;
      pose.y = sy + Math.cos(angle) * hh;
      pose.rot = -angle;
      pose.depth = 431;
    }
  }

  // ---------------------------------------------------------------- sitting together
  hasSeat(h: Hotspot) { return !!SEATS[h.id]; }

  /** Both sit down together, lean in, run the activity, then stand up. */
  async sit(h: Hotspot, runAction: () => Promise<void>) {
    const spec = SEATS[h.id];
    const player = this.h.player(), partner = this.h.partner();
    if (!spec || !partner) { await runAction(); return; }
    this.active = true;
    try {
      // Whoever is closer to the left seat takes it.
      const [a, b] = spec.seats;
      const mine = Math.abs(player.x - a[0]) <= Math.abs(player.x - b[0]) ? a : b;
      const theirs = mine === a ? b : a;
      const yOf = (spr: Phaser.GameObjects.Sprite) => Phaser.Math.Clamp(spr.y, this.h.loc().floorTop, this.h.loc().floorTop + 20);
      // A partner who's far away (e.g. just arrived in the room) steps in from nearby instead of a long walk.
      if (Math.abs(partner.x - theirs[0]) > 420) partner.x = theirs[0] + (theirs[0] > mine[0] ? 160 : -160);
      await Promise.all([this.walk(player, mine[0], yOf(player)), this.walk(partner, theirs[0], yOf(partner))]);
      const faceP = theirs[0] > mine[0] ? 1 : -1;
      const pose = (seat: [number, number], face: number): Pose => ({ x: seat[0], y: seat[1] + HIP * spec.scale, rot: 0, scale: spec.scale, crop: !!spec.crop, face, depth: seat[1] + 5 });
      await Promise.all([this.hop(player, pose(mine, faceP)), this.hop(partner, pose(theirs, -faceP), 470)]);
      this.h.sitAnim(player);
      this.h.sitAnim(partner);
      if (spec.front) { this.front = this.h.scene.add.graphics().setDepth(mine[1] + 30); spec.front(this.front); }
      // Lean on each other (a cuddle).
      this.h.face(player, 'blushing', 2600);
      this.h.face(partner, 'smiling', 3200);
      const pp = this.posed.get(player)!, qp = this.posed.get(partner)!;
      this.h.scene.tweens.add({ targets: qp, rot: faceP * -0.12, x: qp.x - faceP * 14, duration: 700, ease: 'Sine.easeInOut' });
      this.h.scene.tweens.add({ targets: pp, rot: faceP * 0.05, duration: 700, ease: 'Sine.easeInOut' });
      this.emote((pp.x + qp.x) / 2, mine[1] - FRAME_H * spec.scale * 0.8, 'heart');
      const blanket = h.id === 'yard-blanket';
      if (blanket) this.stargaze(player, partner);
      if (blanket && store.timeOfDay() === 'night') this.h.scene.time.delayedCall(3300, () => { if (this.active) this.shootingStar(); });
      // A moment together before the activity (longer on the blanket: they look at the sky first).
      await new Promise((r) => this.h.scene.time.delayedCall(blanket ? (store.timeOfDay() === 'night' ? 5600 : 3800) : 1300, r));
      await runAction();
      if (this.dead) return; // the scene restarted (e.g. she chose to sleep)
      // Stand up.
      this.front?.destroy();
      this.front = undefined;
      const floorY = this.h.loc().floorTop + 14;
      await Promise.all([
        this.hop(player, this.floorPose(player, mine[0], floorY)),
        this.hop(partner, this.floorPose(partner, theirs[0] + (theirs[0] > mine[0] ? 30 : -30), floorY + 6), 460),
      ]);
    } finally {
      this.front?.destroy();
      this.front = undefined;
      this.release(player);
      this.release(partner);
      this.active = false;
    }
  }

  /** On the blanket: he points up at the sky (stars at night, cloud shapes by day), and they both gaze up. */
  private stargaze(player: Phaser.GameObjects.Sprite, partner: Phaser.GameObjects.Sprite) {
    const s = this.h.scene;
    const night = store.timeOfDay() === 'night' || store.timeOfDay() === 'sunset';
    s.time.delayedCall(900, () => {
      if (!this.active || !this.posed.has(partner)) return;
      this.h.act(partner, 'point');
      this.say(partner, night
        ? pick(['See that bright one? That’s yours.', 'Look, the Little Dipper!', 'So many stars tonight ♡'])
        : pick(['That cloud looks like a bunny!', 'That one’s a heart. Totally a heart.', 'Look, a whale cloud!']), 2600);
      this.h.face(partner, 'starry', 2800);
      this.h.face(player, 'starry', 3000);
    });
    s.time.delayedCall(3300, () => {
      if (this.posed.has(partner)) { this.h.act(partner, null); this.h.sitAnim(partner); }
      if (this.posed.has(player)) this.h.face(player, 'blushing', 1800);
    });
  }

  private shootingStar() {
    const s = this.h.scene;
    const cam = s.cameras.main;
    const x = cam.scrollX + 200 + Math.random() * 600, y = 60 + Math.random() * 80;
    const star = s.add.image(x, y, 'p-star').setDepth(8500).setScale(0.6).setBlendMode(Phaser.BlendModes.ADD);
    s.tweens.add({ targets: star, x: x + 380, y: y + 160, alpha: 0, duration: 1100, ease: 'Cubic.easeIn', onComplete: () => star.destroy() });
    this.say(this.h.partner(), 'Make a wish ♡', 2600);
    this.h.face(this.h.player(), 'surprised', 900);
    this.h.scene.time.delayedCall(900, () => this.h.face(this.h.player(), 'happy', 2200)); // eyes closed, wishing
  }

  // ---------------------------------------------------------------- standing together at an activity
  /** The partner comes to stand beside her (on the far side from the object). Short: never blocks long. */
  async gather(h: Hotspot) {
    const player = this.h.player(), partner = this.h.partner();
    if (!partner || store.settings.companionMode === 'hidden') return;
    const hx = h.x + h.w / 2;
    const side = player.x <= hx ? -1 : 1;
    const target = player.x + side * 78;
    if (Math.abs(partner.x - target) < 40) return;
    await Promise.race([this.walk(partner, target, player.y - 4), new Promise((r) => this.h.scene.time.delayedCall(900, r))]);
    this.walking.delete(partner);
    this.held.add(partner); // stays beside her until react()
    this.h.motion(partner).faceT = hx > partner.x ? 1 : -1;
  }
  /** A small shared reaction after an activity. */
  react(kind: 'minigame' | 'inspect' | 'secret' | 'dialogue') {
    const player = this.h.player(), partner = this.h.partner();
    if (!partner) return;
    this.held.delete(partner);
    const mid = (player.x + partner.x) / 2;
    if (kind === 'minigame') {
      this.bounce(player); this.bounce(partner);
      this.say(partner, pick(['That was fun!', 'Again later? ♡', 'We make a good team.']));
      this.emote(mid, this.headY(player), 'heart');
      this.h.face(player, 'laughing', 1600);
      this.h.face(partner, 'happy', 1800);
    } else if (kind === 'secret') {
      this.emote(partner.x, this.headY(partner), '!', '#e8a10a');
      this.say(partner, pick(['Ooh, what is it?', 'No way!', 'You found it!']));
      this.h.face(partner, 'surprised', 1500);
      this.h.face(player, 'happy', 1800);
    } else if (Math.random() < 0.45) {
      this.faceEachOther();
      this.h.face(player, 'smiling', 1600);
      this.h.face(partner, 'smiling', 1600);
      if (Math.random() < 0.5) this.emote(mid, this.headY(player), 'heart');
      else this.tilt(partner, (player.x > partner.x ? 1 : -1) * 0.1, 1400);
    }
  }

  // ---------------------------------------------------------------- hug
  /**
   * A real hug: he comes close, they turn to each other, wrap an arm around each other's waist and lean their
   * heads together, eyes closed, swaying a little while hearts float up. Lasts at least `minMs`, and as long as the
   * conversation about it is still open (up to 14 s).
   */
  async hug(minMs = 2800) {
    const player = this.h.player(), partner = this.h.partner();
    if (!partner || this.active || this.dead || store.settings.companionMode === 'hidden') return;
    const s = this.h.scene;
    const reduced = store.settings.reducedMotion;
    const wait = (ms: number) => new Promise<void>((r) => s.time.delayedCall(ms, r));
    this.active = true;
    try {
      const sc = Math.abs(player.scaleY) || 0.9;
      const loc = this.h.loc();
      let side = Math.sign(partner.x - player.x) || -this.h.motion(player).face;
      if (player.x + side * COUPLE.hugGap * sc < 40 || player.x + side * COUPLE.hugGap * sc > loc.width - 40) side = -side;
      const tx = player.x + side * COUPLE.hugGap * sc, ty = Phaser.Math.Clamp(player.y - 3, loc.floorTop, loc.floorBottom);
      this.held.add(player);
      // He hurries over (a little jog if he's far), and she turns to him.
      this.h.motion(player).faceT = side;
      await Promise.race([this.walk(partner, tx, ty), wait(1500)]);
      this.walking.delete(partner);
      if (Math.hypot(partner.x - tx, partner.y - ty) > 6) {
        await new Promise<void>((r) => s.tweens.add({ targets: partner, x: tx, y: ty, duration: reduced ? 1 : 260, ease: 'Sine.easeOut', onComplete: () => r() }));
      }
      if (this.dead) return;
      this.held.add(partner);
      this.faceEachOther();
      this.h.setStyle(player, 'hug');
      this.h.setStyle(partner, 'hug');
      audio.sfx('heart');
      // A blush as they reach for each other, then eyes closed, smiling, for as long as the hug lasts.
      this.h.face(player, 'blushing', 650);
      this.h.face(partner, 'blushing', 650);
      s.time.delayedCall(650, () => { if (this.active) { this.h.face(player, 'happy', 20000); this.h.face(partner, 'happy', 20000); } });
      // Lean in: heads together.
      const towards = Math.sign(partner.x - player.x) || 1;
      const mp = this.h.motion(player), mq = this.h.motion(partner);
      // Lean from the feet, so a little goes a long way at head height.
      mp.tiltT = towards * 0.04;
      mq.tiltT = -towards * 0.055;
      this.bounce(player, 0.7); this.bounce(partner, 0.7);
      const mid = () => (player.x + partner.x) / 2;
      this.emote(mid(), this.headY(player) - 6, 'heart');
      // Sway gently together and let a few hearts drift up.
      const start = this.time;
      let beat = 0;
      const ev = s.time.addEvent({
        delay: 700, loop: true, callback: () => {
          beat++;
          if (!reduced) { const k = beat % 2 ? 1 : -1; mp.tiltT = towards * (0.04 + 0.015 * k); mq.tiltT = -towards * (0.055 - 0.015 * k); }
          if (beat % 2 === 0) this.emote(mid() + (Math.random() - 0.5) * 30, this.headY(player) - 4, 'heart');
          if (beat === 3 && !reduced) this.h.burst(mid(), this.headY(player) + 30, 'p-heart', 6);
        },
      });
      await wait(minMs);
      // Keep holding while the hug's conversation is still on screen.
      while (store.blocked && this.time - start < 14 && !this.dead) await wait(200);
      ev.remove();
      if (this.dead) return;
      // Let go: a happy little bounce, then back to walking.
      this.h.setStyle(player, null);
      this.h.setStyle(partner, null);
      mp.tiltT = 0; mq.tiltT = 0;
      this.bounce(player, 0.9); this.bounce(partner, 0.6);
      this.h.face(player, 'shy', 1800);
      this.h.face(partner, 'smiling', 2000);
      this.say(partner, pick(['♡', 'Better?', 'Mm. Needed that.', 'One more later?']), 1800);
    } finally {
      this.held.delete(player);
      this.held.delete(partner);
      if (!this.dead) { this.h.setStyle(player, null); this.h.setStyle(partner, null); }
      this.active = false;
    }
  }

  // ---------------------------------------------------------------- idle & ambient
  private idleMoment() {
    const player = this.h.player(), partner = this.h.partner()!;
    const reduced = store.settings.reducedMotion;
    const towards = player.x > partner.x ? 1 : -1;
    const close = (gap: number, ms: number) => { this.h.setFollowGap(gap); this.h.scene.time.delayedCall(ms, () => this.h.setFollowGap(95)); };
    const moments = [
      () => { // poke
        close(52, 3200);
        this.h.scene.time.delayedCall(900, () => {
          this.faceEachOther();
          this.tilt(partner, towards * 0.14, 300);
          this.bounce(player, 1.1);
          this.emote(player.x, this.headY(player), '!', '#e8577d');
          this.say(partner, pick(['Boop.', 'Hey you ♡', 'Earth to {her}!']));
          this.h.face(player, 'surprised', 800);
          this.h.face(partner, 'happy', 2200);
          this.h.scene.time.delayedCall(800, () => this.h.face(player, pick<Face>(['laughing', 'pouting']), 1700));
        });
      },
      () => { // lean on each other
        close(58, 4200);
        this.h.scene.time.delayedCall(900, () => {
          this.faceEachOther();
          this.tilt(partner, towards * 0.13, 2600);
          this.tilt(player, -towards * 0.08, 2600);
          this.emote((player.x + partner.x) / 2, this.headY(player), 'heart');
          this.h.face(player, 'blushing', 2600);
          this.h.face(partner, 'smiling', 2600);
        });
      },
      () => { // hum a tune
        this.say(partner, '♪ ~ ♪', 2600);
        this.h.face(partner, 'happy', 2600);
        this.h.scene.time.delayedCall(1200, () => this.h.face(player, 'smiling', 1800));
        for (let i = 0; i < 3; i++) this.h.scene.time.delayedCall(i * 500, () => this.emote(partner.x + 10 * i, this.headY(partner), '♪', '#7a5ad8'));
        this.tilt(partner, 0.07, 700);
        this.h.scene.time.delayedCall(800, () => this.tilt(partner, -0.07, 700));
      },
      () => { // hold hands
        this.h.holdHandsFor(5200);
        this.h.scene.time.delayedCall(1000, () => {
          this.bounce(player, 0.6); this.bounce(partner, 0.6);
          this.emote((player.x + partner.x) / 2, player.y - FRAME_H * Math.abs(player.scaleY) * 0.45, 'heart');
          this.say(player, pick(['Hehe.', '♡', 'Your hand is warm.']));
          this.h.face(player, 'shy', 2400);
          this.h.face(partner, 'smiling', 3600);
        });
      },
      () => { // what are you thinking about?
        this.faceEachOther();
        this.say(partner, pick(['Whatcha thinking about?', 'I like just standing here with you.', 'You’re cute when you’re thinking.', 'Let’s go somewhere?']), 2600);
        this.h.face(partner, 'smiling', 2600);
        this.h.scene.time.delayedCall(1800, () => {
          const line = pick(['Hm? Nothing~', 'You ♡', 'Maybe…', 'Okay!']);
          this.say(player, line);
          this.h.face(player, line === 'You ♡' ? 'blushing' : 'smiling', 1800);
        });
      },
      () => { // twirl to show off the outfit
        if (reduced) { this.emote(player.x, this.headY(player), 'heart'); return; }
        const m = this.h.motion(player);
        this.h.face(player, 'happy', 1500);
        for (let i = 1; i <= 4; i++) this.h.scene.time.delayedCall(i * 140, () => { m.faceT = -m.faceT; });
        this.h.scene.time.delayedCall(700, () => {
          this.h.burst(player.x, player.y - 80, 'p-star', 10);
          this.say(partner, pick(['Wow. Spin again?', 'Cute outfit ♡', 'Show-off ♡']));
          this.h.face(partner, 'surprised', 700);
          this.h.scene.time.delayedCall(700, () => this.h.face(partner, 'happy', 1500));
          this.h.face(player, 'blushing', 1800);
        });
      },
      () => { // stretch + yawn
        this.h.motion(player).sqV += 1.4; // tall stretch
        const night = store.timeOfDay() === 'night';
        this.h.face(player, night ? 'sleepy' : 'happy', 2200);
        this.emote(player.x + 14, this.headY(player), night ? 'z' : '~', '#7a6a9a');
        if (night) this.h.scene.time.delayedCall(900, () => this.say(partner, 'Sleepy? Bed’s that way ♡'));
      },
    ];
    pick(moments)();
  }

  private ambient() {
    const partner = this.h.partner();
    if (!partner) return;
    const m = this.h.motion(partner);
    const r = Math.random();
    if (r < 0.34) { m.sqV += 1.2; this.emote(partner.x + 12, this.headY(partner), '~', '#7a6a9a'); this.h.face(partner, 'sleepy', 2200); } // stretch + yawn
    else if (r < 0.67) { const f = m.faceT; m.faceT = -f; this.h.face(partner, 'idle', 900); this.h.scene.time.delayedCall(900, () => { m.faceT = f; }); } // look around
    else { this.emote(partner.x, this.headY(partner), '♪', '#7a5ad8'); this.h.face(partner, 'happy', 1400); } // hum
  }
}

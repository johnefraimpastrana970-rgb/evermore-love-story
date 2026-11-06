import Phaser from 'phaser';
import type { LocationDef } from '../content/types';
import { store } from '../core/store';
import { audio } from '../audio/audio';
import { PERSONALITIES, PET_GIFTS, PET_LINES, breed, type BreedDef } from './data';
import { mood, roomOf, speciesOf, type Pet } from './logic';
import type { ItemSpot } from '../home/world';
import type { ItemUse } from '../home/data';
import { PET_FRAMES, PET_H, PET_W, buildPetSheet } from './draw';

/*
 * Pets in the world: each pet in this room gets a little sprite that wanders, sits, naps and comes to say hi.
 * The visiting stray sits by the fence in the backyard. Gifts the pets left lie on the floor until she taps them.
 */

type Anim = 'idle' | 'walk' | 'sit' | 'sleep' | 'eat' | 'happy';

/** Build (once) a breed's sheet and its animations. */
export function ensurePet(scene: Phaser.Scene, b: BreedDef): string {
  const key = `pet-${b.id}`;
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.addCanvas(key, buildPetSheet(b))!;
    for (let i = 0; i < PET_FRAMES.total; i++) tex.add(i, 0, i * PET_W, 0, PET_W, PET_H);
  }
  if (!scene.anims.exists(`${key}-idle`)) {
    const f = (list: number[]) => list.map((frame) => ({ key, frame }));
    const idle = [...PET_FRAMES.idle, ...PET_FRAMES.idle, PET_FRAMES.blink, ...PET_FRAMES.idle];
    scene.anims.create({ key: `${key}-idle`, frames: f(idle), frameRate: 4, repeat: -1 });
    scene.anims.create({ key: `${key}-walk`, frames: f(PET_FRAMES.walk), frameRate: 11, repeat: -1 });
    scene.anims.create({ key: `${key}-sit`, frames: f(PET_FRAMES.sit), frameRate: 1.5, repeat: -1, yoyo: true });
    scene.anims.create({ key: `${key}-sleep`, frames: f(PET_FRAMES.sleep), frameRate: 0.9, repeat: -1, yoyo: true });
    scene.anims.create({ key: `${key}-eat`, frames: f(PET_FRAMES.eat), frameRate: 4, repeat: -1 });
    scene.anims.create({ key: `${key}-happy`, frames: f(PET_FRAMES.happy), frameRate: 5, repeat: -1 });
  }
  return key;
}

interface Actor {
  pet: Pet | null; // null = the stray
  breed: BreedDef;
  key: string;
  spr: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  state: Anim;
  timer: number;
  target: number | null;
  face: number;
  /** Shown a hello when she came close. */
  greeted: boolean;
  /** Held in place by a card / an action. */
  hold: number;
  zzz?: Phaser.GameObjects.Text;
  /** Floor position (y), where it's heading on the floor, and how high it's perched (cat tree). */
  fy: number;
  ty: number | null;
  lift: number;
  /** What it's walking to: a bed, a perch, a toy, or something new to sniff. */
  goal: ItemUse | 'sniff' | null;
}

export interface PetWorldHost {
  scene: Phaser.Scene;
  loc: LocationDef;
  player(): Phaser.GameObjects.Sprite;
  /** Tapped a pet (null = the stray). */
  onTap(pet: Pet | null): void;
  onGift(id: string): void;
  /** Beds, perches and toys placed in this room. */
  spots?(): ItemSpot[];
}

const SPEED = 70;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export class PetWorld {
  private actors: Actor[] = [];
  private gifts = new Map<string, Phaser.GameObjects.Text>();
  constructor(private h: PetWorldHost) {}

  build() {
    const s = store.state;
    const now = Date.now();
    const here = s.pets.list.filter((p) => roomOf(p, now) === this.h.loc.id).slice(0, 4);
    for (const p of here) this.add(p, breed(p.breed)!);
    if (this.h.loc.id === 'backyard' && s.pets.stray) this.add(null, breed(s.pets.stray.breed)!, 1980);
    this.syncGifts();
  }

  private add(pet: Pet | null, b: BreedDef, x?: number) {
    const loc = this.h.loc;
    const key = ensurePet(this.h.scene, b);
    const px = x ?? rnd(180, loc.width - 180);
    const py = rnd(loc.floorTop + 20, loc.floorBottom - 10);
    const spr = this.h.scene.add.sprite(px, py, key, 0).setOrigin(0.5, 1);
    const shadow = this.h.scene.add.image(px, py, 'shadow').setAlpha(0.7);
    spr.setInteractive({ useHandCursor: true });
    spr.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      if (store.blocked) return;
      audio.unlock();
      this.h.onTap(pet);
    });
    const a: Actor = { pet, breed: b, key, spr, shadow, state: 'idle', timer: rnd(0.5, 3), target: null, face: Math.random() < 0.5 ? -1 : 1, greeted: false, hold: 0, fy: py, ty: null, lift: 0, goal: null };
    // Napping pets start asleep, the stray sits and watches.
    if (!pet) this.play(a, 'sit');
    else if (Math.random() < PERSONALITIES[pet.personality].sleepy * 0.6) this.play(a, 'sleep');
    else this.play(a, 'idle');
    this.actors.push(a);
  }

  private play(a: Actor, st: Anim) {
    a.state = st;
    a.spr.play(`${a.key}-${st}`, true);
    a.zzz?.destroy();
    a.zzz = undefined;
    if (st === 'sleep' && !store.settings.reducedMotion) {
      a.zzz = this.h.scene.add.text(a.spr.x, a.spr.y, 'z', { fontFamily: 'Fredoka, sans-serif', fontSize: '18px', color: '#7a6a9a', stroke: '#ffffff', strokeThickness: 4 }).setOrigin(0.5);
    }
  }

  /** Make a pet do something visible for a moment (after petting, feeding…). */
  react(pet: Pet | null, st: Anim, ms: number, line?: string) {
    const a = this.actors.find((x) => x.pet === pet || (pet && x.pet?.id === pet.id));
    if (!a) return;
    a.hold = ms / 1000;
    a.target = null;
    const pl = this.h.player();
    a.face = pl.x < a.spr.x ? -1 : 1;
    this.play(a, st);
    if (line) this.bubble(a, line);
  }

  private bubble(a: Actor, text: string) {
    const t = this.h.scene.add.text(a.spr.x, a.spr.y - PET_H * a.spr.scaleY - 6, text, {
      fontFamily: 'Fredoka, sans-serif', fontSize: '18px', color: '#4a2a3e', backgroundColor: '#fffaf6', padding: { x: 7, y: 3 },
    }).setOrigin(0.5, 1).setDepth(9560).setScale(0.5).setAlpha(0);
    this.h.scene.tweens.add({ targets: t, scale: 1, alpha: 1, y: t.y - 10, duration: 260, ease: 'Back.easeOut' });
    this.h.scene.tweens.add({ targets: t, alpha: 0, delay: 1500, duration: 300, onComplete: () => t.destroy() });
  }

  /** Pet sprite (for the camera / photos). */
  sprite(pet: Pet | null) { return this.actors.find((x) => x.pet === pet || (pet && x.pet?.id === pet.id))?.spr; }
  get count() { return this.actors.length; }

  /** Something new was placed: curious and playful pets come to sniff it. */
  investigate(x: number, y: number) {
    for (const a of this.actors) {
      if (!a.pet || !['curious', 'playful', 'cuddly'].includes(a.pet.personality) || a.hold > 0) continue;
      this.leavePerch(a);
      a.target = x + (a.spr.x < x ? -60 : 60);
      a.ty = Phaser.Math.Clamp(y + 6, this.h.loc.floorTop, this.h.loc.floorBottom);
      a.goal = 'sniff';
      this.play(a, 'walk');
    }
  }

  /** Jump down from the cat tree before doing anything else. */
  private leavePerch(a: Actor) {
    if (a.lift <= 0) return;
    this.h.scene.tweens.add({ targets: a, lift: 0, duration: 380, ease: 'Quad.easeIn' });
  }

  /** Arrived where it was going: nap in the bed, climb the tree, play, sniff. */
  private arrive(a: Actor) {
    const goal = a.goal;
    a.goal = null;
    a.ty = null;
    const spot = (this.h.spots?.() ?? []).reduce<ItemSpot | null>((best, s) => (!best || Math.abs(s.x - a.spr.x) < Math.abs(best.x - a.spr.x) ? s : best), null);
    if (goal === 'bed' && spot) { this.play(a, 'sleep'); a.timer = rnd(14, 26); return; }
    if (goal === 'perch' && spot?.perchY) {
      this.h.scene.tweens.add({ targets: a, lift: spot.perchY * spot.scale, duration: 520, ease: 'Back.easeOut' });
      audio.sfx('plop');
      this.play(a, 'sit'); a.timer = rnd(8, 16); return;
    }
    if (goal === 'toy') { this.play(a, 'happy'); this.bubble(a, pick(['🎾', '♪', '!'])); a.timer = rnd(3, 6); return; }
    if (goal === 'sniff') { this.bubble(a, pick(['?', '!', '👃', '♡'])); this.play(a, 'sit'); a.timer = rnd(3, 6); return; }
    this.play(a, Math.random() < 0.4 ? 'sit' : 'idle');
    a.timer = rnd(2, 5);
  }

  update(dt: number) {
    const loc = this.h.loc;
    const pl = this.h.player();
    for (const a of this.actors) {
      const pers = a.pet ? PERSONALITIES[a.pet.personality] : PERSONALITIES.shy;
      const near = Math.abs(pl.x - a.spr.x) < 140 && Math.abs(pl.y - a.fy) < 80;
      if (a.hold > 0) a.hold -= dt;
      else {
        // Say hi once when she comes close (unless asleep; shy pets and the stray are more careful).
        if (near && !a.greeted && a.state !== 'sleep') {
          a.greeted = true;
          a.face = pl.x < a.spr.x ? -1 : 1;
          if (a.pet && Math.random() < 0.7) { this.bubble(a, this.hello(a.pet)); this.play(a, 'happy'); a.hold = 1.4; }
          else if (!a.pet) this.bubble(a, '…?');
        }
        if (!near && Math.abs(pl.x - a.spr.x) > 300) a.greeted = false;
        a.timer -= dt;
        if (a.target !== null) {
          const dx = a.target - a.spr.x;
          const sp = SPEED * (a.pet?.personality === 'playful' ? 1.5 : 1) * dt;
          if (a.ty !== null) a.fy += Phaser.Math.Clamp(a.ty - a.fy, -sp * 0.6, sp * 0.6);
          if (Math.abs(dx) < 4 && (a.ty === null || Math.abs(a.ty - a.fy) < 3)) { a.target = null; this.arrive(a); }
          else if (Math.abs(dx) >= 4) { a.face = Math.sign(dx); a.spr.x += Math.sign(dx) * Math.min(Math.abs(dx), sp); }
        } else if (a.timer <= 0 && a.pet) {
          // Decide what to do next (furniture first: a bed to nap in, a cat tree to climb, toys to play with).
          const r = Math.random();
          const spots = this.h.spots?.() ?? [];
          const beds = spots.filter((s) => s.use === 'bed');
          const perches = speciesOf(a.pet) === 'cat' ? spots.filter((s) => s.use === 'perch') : [];
          const toys = spots.filter((s) => s.use === 'toy');
          const go = (s: ItemSpot, goal: ItemUse, dy = 0) => {
            this.leavePerch(a);
            a.target = Phaser.Math.Clamp(s.x, 60, loc.width - 60);
            a.ty = Phaser.Math.Clamp(s.y + dy, loc.floorTop, loc.floorBottom);
            a.goal = goal;
            this.play(a, 'walk');
          };
          const follows = !pl.anims.isPlaying || pl.anims.currentAnim?.key.endsWith('-idle');
          if (a.lift > 0 && r < 0.5) { this.leavePerch(a); this.play(a, 'idle'); a.timer = rnd(1, 2); }
          else if (beds.length && r < pers.sleepy * 0.55) go(pick(beds), 'bed', 2);
          else if (perches.length && r < 0.25 + (a.pet.personality === 'curious' || a.pet.personality === 'playful' ? 0.15 : 0)) go(pick(perches), 'perch', 3);
          else if (toys.length && r < 0.3 && (a.pet.personality === 'playful' || a.pet.personality === 'curious')) go(pick(toys), 'toy', 10);
          else if (follows && r < pers.follow * 0.5 && Math.abs(pl.x - a.spr.x) > 90) {
            this.leavePerch(a);
            a.target = Phaser.Math.Clamp(pl.x + (a.spr.x < pl.x ? -70 : 70), 60, loc.width - 60);
            this.play(a, 'walk');
          } else if (r < pers.follow * 0.5 + pers.wander * 0.5) {
            this.leavePerch(a);
            a.target = Phaser.Math.Clamp(a.spr.x + rnd(-320, 320), 80, loc.width - 80);
            this.play(a, 'walk');
          } else if (r < 0.85 && Math.random() < pers.sleepy) { this.play(a, 'sleep'); a.timer = rnd(10, 22); }
          else { this.play(a, Math.random() < 0.5 ? 'sit' : 'idle'); a.timer = rnd(3, 7); }
          if (a.state !== 'sleep') a.timer = Math.max(a.timer, rnd(2.5, 6));
        }
      }
      // Present: depth scale, facing, shadow (stays on the floor when perched), z's.
      const t = (a.fy - loc.floorTop) / (loc.floorBottom - loc.floorTop);
      const sc = (0.66 + 0.16 * t);
      a.spr.y = a.fy - a.lift;
      a.spr.setScale(sc * a.face, sc).setDepth(a.fy + (a.lift > 0 ? 4 : 0));
      a.shadow.setPosition(a.spr.x, a.fy - 2).setDepth(a.fy - 1).setScale(0.42 * sc * a.breed.size, 0.5 * sc).setAlpha(a.lift > 0 ? 0.25 : 0.7);
      if (a.zzz) a.zzz.setPosition(a.spr.x + 16 * a.face, a.spr.y - 50 - Math.sin(this.h.scene.time.now / 500) * 6).setDepth(9300).setAlpha(0.6 + 0.4 * Math.sin(this.h.scene.time.now / 400));
    }
  }

  private hello(p: Pet): string {
    const m = mood(p);
    if (m === 'hungry') return PET_LINES.hungry[Math.floor(Math.random() * PET_LINES.hungry.length)];
    if (m === 'dirty') return PET_LINES.dirty[0];
    return PET_LINES.hello[Math.floor(Math.random() * PET_LINES.hello.length)];
  }

  // ---------------------------------------------------------------- gifts on the floor
  syncGifts() {
    const list = store.state.pets.gifts.filter((g) => g.room === this.h.loc.id);
    for (const [id, t] of this.gifts) if (!list.some((g) => g.id === id)) { t.destroy(); this.gifts.delete(id); }
    for (const g of list) {
      if (this.gifts.has(g.id)) continue;
      const def = PET_GIFTS.find((x) => x.id === g.gift)!;
      const y = this.h.loc.floorTop + 30 + ((g.x * 7) % Math.max(1, this.h.loc.floorBottom - this.h.loc.floorTop - 40));
      const t = this.h.scene.add.text(Phaser.Math.Clamp(g.x, 60, this.h.loc.width - 60), y, def.emoji, { fontSize: '30px' }).setOrigin(0.5, 1).setDepth(y);
      t.setInteractive({ useHandCursor: true });
      t.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => { e.stopPropagation(); if (!store.blocked) this.h.onGift(g.id); });
      if (!store.settings.reducedMotion) this.h.scene.tweens.add({ targets: t, y: y - 6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.gifts.set(g.id, t);
    }
  }
  /** A gift was picked up: pop it. */
  popGift(id: string) {
    const t = this.gifts.get(id);
    if (!t) return;
    this.gifts.delete(id);
    this.h.scene.tweens.killTweensOf(t);
    this.h.scene.tweens.add({ targets: t, y: t.y - 60, alpha: 0, scale: 1.6, duration: 450, onComplete: () => t.destroy() });
  }

  /** The stray moved in: it becomes a normal pet sprite. */
  rebuild() {
    this.destroy();
    this.build();
  }

  destroy() {
    for (const a of this.actors) { a.spr.destroy(); a.shadow.destroy(); a.zzz?.destroy(); }
    this.actors = [];
    for (const t of this.gifts.values()) t.destroy();
    this.gifts.clear();
  }
}

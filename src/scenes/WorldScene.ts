import Phaser from 'phaser';
import type { Hotspot, LocationDef, LocationId, TimeOfDay, CollectibleKind, OccasionDef } from '../content/types';
import { LOCATIONS } from '../content/locations';
import { store } from '../core/store';
import { bus } from '../core/events';
import { rng } from '../core/rng';
import { audio } from '../audio/audio';
import { AMBIENT } from '../art/paint';
import { ensureCharacter, ensureCouple, ensureRoom, lookFor, ensureDecorLights, type CoupleStyle } from '../art/textures';
import { COUPLE, FRAME_H } from '../art/characters';
import { isHoldingHands } from '../systems/hands';
import {
  visit, interact, collect, findSecret, applyEffects, topOccasion, ctx as condCtx, startSession,
} from '../systems/game';
import { checkCondition, dayFlag, pickVariant } from '../systems/conditions';
import { playDialogue, narrate, talkToHim } from '../ui/dialogue';
import { openPanel } from '../ui/panels';
import { runMinigame } from '../ui/minigames';
import { setPrompt, showHud } from '../ui/hud';
import { showJoystick } from '../ui/joystick';
import { locationCard, fadeOut, fadeIn, welcome } from '../ui/overlays';
import { CoupleDirector } from './couple';
import { openGarden } from '../garden/garden';
import { gardenUnlocked } from '../garden/unlock';
import { openBento } from '../work/bento';
import { openDoor, partnerAway, waitingAtDoor } from '../work/work';
import { UNLOCK_LEVEL as WORK_UNLOCK } from '../work/data';
import { PetWorld } from '../pets/world';
import { openPetCard } from '../pets/card';
import { collectGift } from '../pets/pets';

/** A hotspot's on-screen name (the backyard flower bed becomes our garden at level 5). */
const hotspotLabel = (h: Hotspot) => {
  if (h.id === 'yard-flowers' && gardenUnlocked()) return 'Our Garden 🌷';
  if (h.id === 'living-front' && waitingAtDoor()) return `Open the door for ${store.partnerName()} ♡`;
  if (h.id === 'kitchen-bento' && store.hasGame && store.state.level >= WORK_UNLOCK) return `Pack lunch for ${store.partnerName()} 🍱`;
  return store.fmt(h.label);
};

interface WorldData { location: LocationId; spawnX?: number; spawnY?: number; fromLoad?: boolean; intro?: boolean }

interface Target { kind: 'hotspot' | 'him'; x: number; label: string; h?: Hotspot }

/** Per-character motion state for smooth, non-stiff movement. */
interface Motion {
  vx: number; vy: number;        // smoothed velocity (px/s)
  face: number; faceT: number;   // facing (±1); flips instantly
  turn: number;                  // 1 → 0 just after a turn: drives the pivot squash (never paper-thin)
  lean: number;                  // body lean (radians)
  sq: number; sqV: number;       // squash & stretch spring
  tilt: number; tiltT: number;   // extra lean for couple moments (leaning on each other, pushing the swing)
  moving: boolean;
}

const newMotion = (face = 1): Motion => ({ vx: 0, vy: 0, face, faceT: face, turn: 0, lean: 0, sq: 0, sqV: 0, tilt: 0, tiltT: 0, moving: false });

const SPEED = 280;

export class WorldScene extends Phaser.Scene {
  private loc!: LocationDef;
  private tod!: TimeOfDay;
  private occ?: OccasionDef;
  private player!: Phaser.GameObjects.Sprite;
  private him?: Phaser.GameObjects.Sprite;
  private shadows = new Map<Phaser.GameObjects.Sprite, Phaser.GameObjects.Image>();
  private herKey = '';
  private hisKey = '';
  private facing = 1;
  private moveTarget: { x: number; y: number } | null = null;
  private pending: Target | null = null;
  private busy = false;
  private leaving = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private hotspotObjs: { h: Hotspot; zone: Phaser.GameObjects.Zone; label: Phaser.GameObjects.Text; hint?: Phaser.GameObjects.Image; revealed: boolean }[] = [];
  private highlight!: Phaser.GameObjects.Graphics;
  private collectibles: { id: string; kind: CollectibleKind; spr: Phaser.GameObjects.Image; x: number; y: number }[] = [];
  private unsub: (() => void)[] = [];
  private lastTime!: TimeOfDay;
  private lastDay = '';
  private nearest: Target | null = null;
  private emoteTimer = 0;
  private motions = new Map<Phaser.GameObjects.Sprite, Motion>();
  private couple!: CoupleDirector;
  /** How far behind her the partner walks (couple moments bring them closer for a bit). */
  private followGap = 95;
  /** Couple pose per character: holding hands (which arm) or hugging. */
  private styles = new Map<Phaser.GameObjects.Sprite, CoupleStyle | null>();
  /** Cats and dogs in this room. */
  private pets?: PetWorld;
  /** Hold hands until this time (an idle moment), even with the 🤝 button off. */
  private tempHoldUntil = 0;

  private keyOf(spr: Phaser.GameObjects.Sprite) { return spr === this.player ? this.herKey : this.hisKey; }

  /** Change a character's couple pose; builds the couple frames the first time they're needed. */
  private setStyle(spr: Phaser.GameObjects.Sprite, style: CoupleStyle | null) {
    if ((this.styles.get(spr) ?? null) === style) return;
    this.styles.set(spr, style);
    const key = this.keyOf(spr);
    if (style) ensureCouple(this, key, lookFor(spr === this.player ? store.playAs() : store.partner()));
    const moving = this.mo(spr).moving;
    if (style === 'hug') { spr.play(`${key}-hugIn`); spr.chain(`${key}-hug`); }
    else spr.play(style ? `${key}-${style}-${moving ? 'walk' : 'idle'}` : `${key}-${moving ? 'walk' : 'idle'}`, true);
  }

  private holdingNow() {
    return (isHoldingHands() || this.time.now < this.tempHoldUntil) && !!this.him && store.settings.companionMode === 'follow';
  }

  /** Each frame: show joined hands when they're walking or standing side by side at the right distance. */
  private updateHands() {
    const him = this.him;
    const want = this.holdingNow() && him && !this.couple.active && !this.couple.controls(him) && !this.couple.posedBy(this.player);
    for (const spr of [this.player, him]) {
      if (!spr || this.styles.get(spr) === 'hug') continue;
      let style: CoupleStyle | null = null;
      if (want) {
        const other = spr === this.player ? him! : this.player;
        const gap = COUPLE.holdGap * Math.abs(spr.scaleY);
        const dx = other.x - spr.x;
        if (Math.abs(Math.abs(dx) - gap) < gap * 0.3 && Math.abs(other.y - spr.y) < 18) {
          style = Math.sign(dx) * this.mo(spr).face > 0 ? 'holdR' : 'holdL';
        }
      }
      this.setStyle(spr, style);
    }
  }

  private mo(spr: Phaser.GameObjects.Sprite): Motion {
    let m = this.motions.get(spr);
    if (!m) { m = newMotion(); this.motions.set(spr, m); }
    return m;
  }

  /**
   * Ease a character toward a target velocity and update its animation state.
   * Returns the smoothed speed ratio (0..1+).
   */
  private drive(spr: Phaser.GameObjects.Sprite, key: string, tvx: number, tvy: number, dt: number): number {
    const m = this.mo(spr);
    const want = Math.hypot(tvx, tvy) > 1;
    // Accelerate a little slower than we brake, so starts feel weighty and stops feel crisp.
    const k = 1 - Math.exp(-(want ? 11 : 15) * dt);
    m.vx += (tvx - m.vx) * k;
    m.vy += (tvy - m.vy) * k;
    if (!want && Math.hypot(m.vx, m.vy) < 4) { m.vx = 0; m.vy = 0; }
    spr.x = Phaser.Math.Clamp(spr.x + m.vx * dt, 40, this.loc.width - 40);
    spr.y = Phaser.Math.Clamp(spr.y + m.vy * dt, this.loc.floorTop, this.loc.floorBottom);
    const speed = Math.hypot(m.vx, m.vy / 0.6) / SPEED;
    const moving = speed > 0.12;
    if (moving !== m.moving) {
      // Small squash when starting, a soft settle when stopping.
      m.sqV += moving ? -0.9 : -0.6;
      m.moving = moving;
    }
    if (Math.abs(tvx) > 8) m.faceT = tvx > 0 ? 1 : -1;
    // A hug is posed by the couple director; holding hands swaps in the walk/idle with a hand reaching out.
    const style = this.styles.get(spr);
    if (style === 'hug') return speed;
    const anim = style ? `${key}-${style}-${moving ? 'walk' : 'idle'}` : moving ? `${key}-walk` : `${key}-idle`;
    if (spr.anims.currentAnim?.key !== anim) spr.play(anim, true);
    // Walk cadence follows actual speed so feet don't slide.
    spr.anims.timeScale = moving ? Phaser.Math.Clamp(speed * 1.05, 0.5, 1.2) : 1;
    return speed;
  }

  constructor() {
    super('World');
  }

  init(data: WorldData) {
    this.loc = LOCATIONS[data.location] ?? LOCATIONS.bedroom;
    this.tod = store.timeOfDay();
    this.lastTime = this.tod;
    this.lastDay = store.today();
    this.occ = topOccasion();
    this.busy = false;
    this.leaving = false;
    this.moveTarget = null;
    this.pending = null;
    this.hotspotObjs = [];
    this.collectibles = [];
    this.shadows.clear();
    this.motions = new Map();
    this.unsub = [];
    this.him = undefined;
    this.styles = new Map();
    this.tempHoldUntil = 0;
  }

  preload() {
    const img = this.loc.backgroundImage?.[this.tod];
    if (img) this.load.image(`art-${this.loc.id}-${this.tod}`, img);
  }

  create(data: WorldData) {
    const loc = this.loc;
    const cam = this.cameras.main;
    cam.setBounds(0, 0, loc.width, 720);
    cam.setBackgroundColor('#20182a');

    this.buildEnvironment();
    this.buildHotspots();
    this.buildCollectibles();
    this.buildCharacters(data);
    this.followGap = 95;
    this.couple = new CoupleDirector({
      scene: this,
      loc: () => this.loc,
      player: () => this.player,
      partner: () => this.him,
      motion: (spr) => this.mo(spr),
      drive: (spr, vx, vy, dt) => { this.drive(spr, spr === this.player ? this.herKey : this.hisKey, vx, vy, dt); },
      idleAnim: (spr) => { const k = spr === this.player ? this.herKey : this.hisKey; spr.play(`${k}-idle`, true); spr.anims.timeScale = 1; },
      shadow: (spr) => this.shadows.get(spr),
      setFollowGap: (px) => { this.followGap = px; },
      burst: (x, y, tex, n) => this.burst(x, y, tex, n),
      setStyle: (spr, style) => this.setStyle(spr, style),
      holdHandsFor: (ms) => { this.tempHoldUntil = this.time.now + ms; },
    });
    this.couple.buildProps();
    this.pets = new PetWorld({
      scene: this, loc: this.loc, player: () => this.player,
      onTap: (pet) => void openPetCard(pet, { react: (p, anim, ms, line) => this.pets?.react(p, anim, ms, line) }),
      onGift: (id) => { collectGift(id); this.pets?.popGift(id); },
    });
    this.pets.build();
    this.buildLighting();
    this.buildDecorations();

    this.highlight = this.add.graphics().setDepth(9500);
    if (!store.settings.reducedMotion) {
      this.tweens.add({ targets: this.highlight, alpha: { from: 1, to: 0.55 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,ENTER') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.disableGlobalCapture();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (store.blocked || this.busy || over.length) return;
      audio.unlock();
      const wx = p.worldX, wy = p.worldY;
      const y = wy > loc.floorTop - 60 ? Phaser.Math.Clamp(wy, loc.floorTop, loc.floorBottom) : this.player.y;
      this.moveTarget = { x: Phaser.Math.Clamp(wx, 40, loc.width - 40), y };
      this.pending = null;
      this.tapMarker(this.moveTarget.x, y);
    });

    // Events
    const on = (evt: string, fn: (p?: any) => void) => this.unsub.push(bus.on(evt, fn));
    on('travel', (p: { to: LocationId; spawnX?: number }) => void this.travel(p.to, p.spawnX));
    on('sleep', () => void this.reload('Zzz…', true));
    on('time', () => void this.reload());
    on('occasions', () => void this.reload());
    on('settings', (patch: Record<string, unknown>) => { if ('companionMode' in patch) void this.reload(); });
    on('cosmetics', () => this.refreshLooks());
    on('reload-world', () => void this.travel(store.state.location));
    // "Hug" in the talk menu (and the long hug when she needs one) plays a real hug in the world.
    on('dialogue:node', (id: string) => { if (id === '__hug' || id === 'feel-hug') void this.couple.hug(id === 'feel-hug' ? 6000 : 2800); });
    on('pets:changed', () => this.pets?.rebuild());
    on('pets:gifts', () => this.pets?.syncGifts());
    on('work:leave', () => this.partnerLeaves());
    on('work:home', () => this.partnerArrives());
    on('hands', (holding: boolean) => {
      if (!this.him) return;
      if (holding) { this.couple.emoteAt(this.player, this.him); this.mo(this.him).sqV -= 0.6; }
    });
    this.events.once('shutdown', () => { this.unsub.forEach((u) => u()); this.couple.destroy(); this.pets?.destroy(); this.pets = undefined; setPrompt(null); });

    this.time_events();
    showHud(true);
    showJoystick(true);
    audio.playMusic(this.occ?.theme.music ?? (this.tod === 'night' && !loc.indoor ? 'night' : loc.music));
    audio.setAmbience(loc.ambience, this.tod, this.isRaining());

    visit(loc.id);
    locationCard(loc);
    cam.fadeIn(450, 32, 24, 42);
    fadeIn();
    store.save();
    void this.afterEnter(data);
  }

  private async afterEnter(data: WorldData) {
    if (!data.fromLoad && !data.intro) { bus.emit('world-ready'); return; }
    this.busy = true;
    await new Promise((r) => setTimeout(r, 500));
    if (data.intro) await playDialogue('intro');
    const info = startSession();
    await welcome(info);
    for (const g of info.greetings) await playDialogue(g);
    this.busy = false;
    bus.emit('world-ready');
  }

  // ---------------------------------------------------------------- building
  private buildEnvironment() {
    const loc = this.loc;
    const tex = ensureRoom(this, loc, this.tod);
    if (tex.sky) this.add.image(0, 0, tex.sky).setOrigin(0).setScrollFactor(0).setDepth(-30);
    if (tex.far) this.add.image(0, 0, tex.far).setOrigin(0).setScrollFactor(0.5, 1).setDepth(-20);
    const art = `art-${loc.id}-${this.tod}`;
    if (this.textures.exists(art)) {
      this.add.image(0, 0, art).setOrigin(0).setDisplaySize(loc.width, 720).setDepth(-10);
    } else {
      this.add.image(0, 0, tex.bg).setOrigin(0).setDepth(-10);
    }
    if (tex.fg) this.add.image(0, 0, tex.fg).setOrigin(0).setDepth(5000);
  }

  private buildHotspots() {
    const c = condCtx();
    for (const h of this.loc.hotspots) {
      if (!checkCondition(h.if, c)) continue;
      const zone = this.add.zone(h.x, h.y, h.w, h.h).setOrigin(0).setDepth(-5);
      const label = this.add.text(h.x + h.w / 2, Math.max(28, h.y - 14), hotspotLabel(h), {
        fontFamily: 'Fredoka, sans-serif', fontSize: '20px', color: '#5a2a44', backgroundColor: '#fff6eecc',
        padding: { x: 10, y: 5 },
      }).setOrigin(0.5, 1).setDepth(9600).setVisible(false);
      const obj = { h, zone, label, revealed: !h.hidden, hint: undefined as Phaser.GameObjects.Image | undefined };
      if (h.hidden && !store.state.secrets[h.id]) {
        // Depth = bottom of the hotspot so characters walking in front cover the sparkle.
        obj.hint = this.add.image(h.x + h.w / 2, h.y + h.h / 2, 'hint').setDepth(h.y + h.h).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: obj.hint, scale: { from: 0.6, to: 1.1 }, angle: 90, duration: 900, yoyo: true, repeat: -1 });
      }
      if (!h.hidden) zone.setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => { if (obj.revealed && !store.blocked) this.drawHighlight(h); });
      zone.on('pointerout', () => this.drawHighlight(null));
      zone.on('pointerdown', () => {
        if (store.blocked || this.busy || !obj.revealed) return;
        audio.unlock();
        audio.sfx('click');
        this.pressHotspot(h);
        this.walkToTarget({ kind: 'hotspot', x: this.standX(h), label: hotspotLabel(h), h });
      });
      this.hotspotObjs.push(obj);
    }
  }

  private standX(h: Hotspot) {
    return Phaser.Math.Clamp(h.standX ?? h.x + h.w / 2, 50, this.loc.width - 50);
  }

  private periodKey() {
    return `${store.today()}:${this.tod}`;
  }

  private buildCollectibles() {
    const s = store.state;
    const key = this.periodKey();
    if (s.collected.key !== key) s.collected = { key, ids: [] };
    const r = rng(`${key}:${this.loc.id}:${s.createdAt}`);
    this.loc.collectibleSpots.forEach((spot, i) => {
      if (r.next() > 0.7) return;
      let kind = r.pick(this.loc.collectibleKinds);
      if (kind === 'sparkle' && r.next() < 0.6) kind = this.loc.collectibleKinds[0];
      if (this.occ && r.next() < 0.4) kind = 'heart';
      const id = `${this.loc.id}:${i}`;
      if (s.collected.ids.includes(id)) return;
      const y = spot.y - 34;
      const spr = this.add.image(spot.x, y, `col-${kind}`).setDepth(spot.y).setScale(0.8);
      this.tweens.add({ targets: spr, y: y - 12, duration: 1100 + i * 37, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: spr, scale: 0.9, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 80 });
      this.collectibles.push({ id, kind, spr, x: spot.x, y: spot.y });
    });
  }

  private buildCharacters(data: WorldData) {
    const loc = this.loc;
    const s = store.state;
    const midY = (loc.floorTop + loc.floorBottom) / 2 + 20;
    let x = data.spawnX ?? loc.spawnX;
    let y = data.spawnY ?? midY;
    if (data.fromLoad && s.location === loc.id) { x = s.x; y = s.y; }
    x = Phaser.Math.Clamp(x, 40, loc.width - 40);
    y = Phaser.Math.Clamp(y, loc.floorTop, loc.floorBottom);
    this.herKey = ensureCharacter(this, lookFor(store.playAs()));
    this.player = this.add.sprite(x, y, this.herKey, 0).setOrigin(0.5, 1);
    this.player.play(`${this.herKey}-idle`);
    this.addShadow(this.player);
    this.cameras.main.startFollow(this.player, true, 0.09, 0.09, 0, 120);

    const mode = store.settings.companionMode;
    // He's only in the house when he isn't at work (or waiting at the door).
    if (mode !== 'hidden' && !partnerAway()) {
      const hx = mode === 'stay' ? Phaser.Math.Clamp(loc.spawnX + 260, 60, loc.width - 60) : x - 90;
      this.spawnPartner(hx, y - 8);
    }
  }

  private spawnPartner(x: number, y: number) {
    if (this.him) return;
    const loc = this.loc;
    this.hisKey = ensureCharacter(this, lookFor(store.partner()));
    this.him = this.add.sprite(Phaser.Math.Clamp(x, 40, loc.width - 40), Phaser.Math.Clamp(y, loc.floorTop, loc.floorBottom), this.hisKey, 0).setOrigin(0.5, 1);
    this.him.play(`${this.hisKey}-idle`);
    this.addShadow(this.him);
    this.him.setInteractive({ useHandCursor: true, pixelPerfect: false });
    this.him.on('pointerdown', () => {
      if (store.blocked || this.busy) return;
      audio.unlock();
      this.walkToTarget({ kind: 'him', x: this.him!.x + (this.player.x < this.him!.x ? -70 : 70), label: `Talk to ${store.partnerName()}` });
    });
  }

  /** He heads out: a wave, then he walks off toward the nearest edge and fades away. */
  private partnerLeaves() {
    const him = this.him;
    if (!him) return;
    this.him = undefined;
    this.styles.delete(him);
    const sh = this.shadows.get(him);
    this.shadows.delete(him);
    this.motions.delete(him);
    him.disableInteractive();
    const toRight = him.x > this.loc.width / 2;
    him.setScale(Math.abs(him.scaleX) * (toRight ? 1 : -1), him.scaleY);
    him.play(`${this.hisKey}-walk`, true);
    const dist = 260;
    this.tweens.add({ targets: [him, sh].filter(Boolean), x: him.x + (toRight ? dist : -dist), alpha: 0, duration: 1600, ease: 'Sine.easeIn',
      onComplete: () => { him.destroy(); sh?.destroy(); } });
    this.couple.emote(him.x, him.y - FRAME_H * Math.abs(him.scaleY) - 4, '👋');
  }

  /** She opens the front door: he steps in from outside. */
  private partnerArrives() {
    if (this.him || store.settings.companionMode === 'hidden') return;
    const door = this.loc.hotspots.find((h) => h.id === 'living-front');
    const x = door ? door.x + door.w / 2 : this.player.x + 120;
    this.spawnPartner(x, this.player.y - 4);
    const him = this.him!;
    him.setAlpha(0);
    this.tweens.add({ targets: him, alpha: 1, duration: 400 });
    this.mo(him).faceT = this.player.x < him.x ? -1 : 1;
    this.mo(this.player).faceT = this.player.x < him.x ? 1 : -1;
    this.burst(him.x, him.y - 120, 'p-heart', 10);
  }

  private addShadow(spr: Phaser.GameObjects.Sprite) {
    this.shadows.set(spr, this.add.image(spr.x, spr.y, 'shadow').setDepth(spr.y - 1));
  }

  private refreshLooks() {
    this.styles = new Map(); // couple frames are per outfit: rebuilt on next use
    this.herKey = ensureCharacter(this, lookFor(store.playAs()));
    this.player.setTexture(this.herKey, 0).play(`${this.herKey}-idle`);
    if (this.him) {
      this.hisKey = ensureCharacter(this, lookFor(store.partner()));
      this.him.setTexture(this.hisKey, 0).play(`${this.hisKey}-idle`);
    }
  }

  private buildLighting() {
    const amb = AMBIENT[this.tod];
    const rain = this.isRaining();
    const alpha = amb.alpha + (rain ? 0.15 : 0) + (this.loc.indoor ? 0 : this.tod === 'night' ? 0.05 : 0);
    if (alpha > 0) {
      this.add.rectangle(0, 0, 1280, 720, rain && this.tod !== 'night' ? 0x8090b0 : amb.tint, alpha)
        .setOrigin(0).setScrollFactor(0).setDepth(8000).setBlendMode(Phaser.BlendModes.MULTIPLY);
    }
    if (this.occ?.theme.tint) {
      this.add.rectangle(0, 0, 1280, 720, this.occ.theme.tint, 0.14).setOrigin(0).setScrollFactor(0).setDepth(8001)
        .setBlendMode(Phaser.BlendModes.SCREEN);
    }
    for (const l of this.loc.lights) {
      if (!l.on.includes(this.tod)) continue;
      const g = this.add.image(l.x, l.y, 'glow').setTint(l.color).setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(8002).setScale(l.r / 128).setAlpha(this.tod === 'night' ? 0.42 : 0.22);
      if (!store.settings.reducedMotion) this.tweens.add({ targets: g, alpha: g.alpha * 0.82, duration: 1600 + l.x % 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private isRaining() {
    if (this.loc.indoor || this.occ?.theme.decorations.includes('snow')) return false;
    return rng(`rain:${store.today()}:${this.tod}`).next() < 0.18;
  }

  private buildDecorations() {
    const w = this.loc.width;
    const reduced = store.settings.reducedMotion;
    const freq = (f: number) => (reduced ? f * 4 : f);
    const area = new Phaser.Geom.Rectangle(0, 0, w, 720);
    // Ambient particles
    if (this.loc.indoor && (this.tod === 'morning' || this.tod === 'day')) {
      this.add.particles(0, 0, 'dot', {
        emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(0, 100, w, 450) } as any,
        lifespan: 6000, speed: { min: 2, max: 10 }, scale: { min: 0.15, max: 0.35 }, alpha: { start: 0, end: 0.5, ease: 'Sine.easeInOut' },
        frequency: freq(260), blendMode: Phaser.BlendModes.ADD, tint: 0xfff0d0,
      }).setDepth(7000);
    }
    if (!this.loc.indoor) {
      if (this.tod === 'night' || this.tod === 'sunset') {
        this.add.particles(0, 0, 'firefly', {
          emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(0, 250, w, 420) } as any,
          lifespan: 5000, speed: { min: 6, max: 26 }, scale: { start: 0.8, end: 0.3 }, alpha: { start: 0, end: 1, ease: 'Sine.easeInOut' },
          frequency: freq(this.tod === 'night' ? 160 : 500), blendMode: Phaser.BlendModes.ADD,
        }).setDepth(7100);
      }
      if (this.tod !== 'night') {
        this.add.particles(0, 0, 'p-petal', {
          emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(380, 40, 520, 200) } as any,
          lifespan: 7000, speedY: { min: 25, max: 55 }, speedX: { min: -40, max: 30 }, rotate: { min: 0, max: 360 },
          scale: { min: 0.6, max: 1.1 }, alpha: { start: 1, end: 0.2 }, frequency: freq(420),
        }).setDepth(7000);
      }
      if (this.isRaining()) {
        this.add.particles(0, 0, 'p-rain', {
          x: { min: 0, max: 1400 }, y: -40, lifespan: 1100, speedY: { min: 700, max: 900 }, speedX: -80,
          scale: { min: 0.7, max: 1.2 }, alpha: 0.6, frequency: freq(14), quantity: 2,
        }).setScrollFactor(0).setDepth(7200);
      }
    }
    // Occasion decorations
    const deco = this.occ?.theme.decorations ?? [];
    for (const d of deco) {
      switch (d) {
        case 'hearts':
          this.add.particles(0, 0, 'p-heart', {
            emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(0, 500, w, 220) } as any,
            lifespan: 6000, speedY: { min: -60, max: -25 }, speedX: { min: -15, max: 15 },
            scale: { start: 0.7, end: 0.2 }, alpha: { start: 0.9, end: 0 }, frequency: freq(500),
          }).setDepth(7300);
          break;
        case 'snow':
          this.add.particles(0, 0, 'p-snow', {
            x: { min: 0, max: 1280 }, y: -10, lifespan: 9000, speedY: { min: 40, max: 90 }, speedX: { min: -25, max: 25 },
            scale: { min: 0.4, max: 1 }, alpha: { start: 0.95, end: 0.5 }, frequency: freq(this.loc.indoor ? 300 : 70),
          }).setScrollFactor(0).setDepth(7300).setAlpha(this.loc.indoor ? 0.5 : 1);
          break;
        case 'confetti':
          this.add.particles(0, 0, 'p-confetti', {
            x: { min: 0, max: 1280 }, y: -10, lifespan: 6000, speedY: { min: 60, max: 120 }, speedX: { min: -40, max: 40 },
            rotate: { min: 0, max: 360 }, scale: { min: 0.4, max: 0.8 }, frequency: freq(160),
            tint: [0xff8fb0, 0xffd36a, 0x7fb4e8, 0x86d1b0, 0xc8a0f0],
          }).setScrollFactor(0).setDepth(7300);
          break;
        case 'petals':
          this.add.particles(0, 0, 'p-petal', {
            x: { min: 0, max: 1280 }, y: -10, lifespan: 9000, speedY: { min: 30, max: 60 }, speedX: { min: -30, max: 30 },
            rotate: { min: 0, max: 360 }, frequency: freq(380),
          }).setScrollFactor(0).setDepth(7300);
          break;
        case 'lights':
          this.add.image(0, 0, ensureDecorLights(this, w)).setOrigin(0).setDepth(50);
          break;
        case 'balloons': {
          const r = rng('balloons' + this.loc.id);
          const colors = [0xff8fb0, 0xffd36a, 0x7fb4e8, 0xc8a0f0, 0x86d1b0];
          for (let x = 160; x < w; x += 260 + r.next() * 200) {
            const b = this.add.image(x, 320 + r.next() * 60, 'balloon').setTint(r.pick(colors)).setDepth(40).setOrigin(0.5, 1);
            if (!reduced) this.tweens.add({ targets: b, y: b.y - 14, angle: { from: -4, to: 4 }, duration: 2200 + r.next() * 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          }
          break;
        }
        case 'pumpkins': {
          const r = rng('pumpkins' + this.loc.id);
          for (let x = 220; x < w; x += 380 + r.next() * 200) this.add.image(x, 508, 'pumpkin').setOrigin(0.5, 1).setDepth(45).setScale(0.8 + r.next() * 0.4);
          break;
        }
      }
    }
    void area;
  }

  private time_events() {
    this.time_loop = this.time_loop.bind(this);
    this.timeEvent = this.time_add(30000, () => store.save());
    this.time_add(5000, () => this.time_loop());
  }
  private timeEvent?: Phaser.Time.TimerEvent;
  private time_add(ms: number, cb: () => void) {
    return this.time.addEvent({ delay: ms, loop: true, callback: cb });
  }
  private time_loop() {
    if (this.leaving) return;
    const t = store.timeOfDay();
    if (t !== this.lastTime) {
      this.lastTime = t;
      if (!store.blocked && !this.busy) void this.reload();
      return;
    }
    if (store.today() !== this.lastDay && !store.blocked && !this.busy) {
      this.lastDay = store.today();
      this.busy = true;
      const info = startSession();
      void welcome(info).then(async () => {
        for (const g of info.greetings) await playDialogue(g);
        this.busy = false;
        void this.reload();
      });
    }
  }

  // ---------------------------------------------------------------- travel
  async travel(to: LocationId, spawnX?: number, text = '') {
    if (this.leaving) return;
    this.leaving = true;
    audio.sfx('door');
    store.save();
    await fadeOut(text);
    store.state.location = to;
    this.scene.restart({ location: to, spawnX });
  }

  async reload(text = '', woke = false) {
    if (this.leaving) return;
    this.leaving = true;
    await fadeOut(text, woke ? 700 : 300);
    const d: WorldData = { location: this.loc.id, spawnX: this.player.x, spawnY: this.player.y };
    this.scene.restart(d);
    if (woke) setTimeout(() => void narrate('You wake up feeling cozy and refreshed.'), 900);
  }

  // ---------------------------------------------------------------- interaction
  private walkToTarget(t: Target) {
    this.pending = t;
    this.moveTarget = { x: Phaser.Math.Clamp(t.x, 40, this.loc.width - 40), y: this.player.y };
  }

  private async useTarget(t: Target) {
    this.busy = true;
    this.moveTarget = null;
    this.pending = null;
    setPrompt(null);
    this.drawHighlight(null);
    try {
      if (t.kind === 'him') {
        if (this.him) {
          // Turn to face each other.
          this.mo(this.him).faceT = this.player.x < this.him.x ? -1 : 1;
          this.mo(this.player).faceT = this.player.x < this.him.x ? 1 : -1;
        }
        await talkToHim();
      } else if (t.h) {
        await this.useHotspot(t.h);
      }
    } finally {
      this.busy = false;
    }
  }

  /** Use a hotspot, with the partner joining in: the swing, sitting together, or standing beside her. */
  private async useHotspot(h: Hotspot) {
    const a = h.action;
    const together = !!this.him && store.settings.companionMode !== 'hidden';
    if (together && h.id === 'yard-swing') {
      await this.couple.swing(() => this.runHotspot(h));
      return;
    }
    if (together && this.couple.hasSeat(h)) {
      await this.couple.sit(h, () => this.runHotspot(h));
      return;
    }
    const joins = together && ['inspect', 'dialogue', 'minigame', 'secret', 'photo'].includes(a.kind);
    if (joins) await this.couple.gather(h);
    try {
      await this.runHotspot(h);
    } finally {
      if (joins) this.couple.react(a.kind === 'photo' ? 'inspect' : (a.kind as 'minigame' | 'inspect' | 'secret' | 'dialogue'));
    }
  }

  private async runHotspot(h: Hotspot) {
    const a = h.action;
    // Turn toward the object she's using.
    const hx = h.x + h.w / 2;
    if (Math.abs(hx - this.player.x) > 20) this.mo(this.player).faceT = hx > this.player.x ? 1 : -1;
    // From level 5 the backyard flower bed is our garden.
    // His lunch box (from level 2), and the front door when he's waiting outside.
    if (h.id === 'kitchen-bento' && store.state.level >= WORK_UNLOCK) {
      await openBento();
      interact(h.id);
      return;
    }
    if (h.id === 'living-front' && waitingAtDoor()) {
      audio.sfx('door');
      await openDoor();
      interact(h.id);
      return;
    }
    if (h.id === 'yard-flowers' && gardenUnlocked()) {
      await openGarden();
      interact(h.id);
      return;
    }
    switch (a.kind) {
      case 'inspect': {
        const v = pickVariant(a.texts, condCtx());
        const text = v?.text ?? '';
        if (a.onceFlag) {
          const key = dayFlag(a.onceFlag, store.today());
          if (store.state.flags[key]) { await narrate(a.repeatText ?? text); break; }
          store.state.flags[key] = true;
          await narrate(text);
          applyEffects(a.effects);
        } else {
          await narrate(text);
          applyEffects(a.effects);
        }
        break;
      }
      case 'dialogue': {
        const v = pickVariant(a.options, condCtx());
        if (v) await playDialogue(v.id);
        break;
      }
      case 'door':
        interact(h.id);
        await this.travel(a.to, a.spawnX, a.travelText ?? '');
        return;
      case 'minigame':
        await runMinigame(a.id);
        break;
      case 'secret': {
        const isNew = findSecret(a.id);
        if (isNew) {
          audio.sfx('secret');
          this.burst(h.x + h.w / 2, h.y + h.h / 2, 'p-star', 18);
          const obj = this.hotspotObjs.find((o) => o.h.id === h.id);
          obj?.hint?.destroy();
        }
        await narrate(isNew ? a.text : 'You’ve already found this secret. It’s in your journal under Surprises.');
        break;
      }
      case 'panel':
        await openPanel(a.panel, a.tab);
        break;
      case 'sleep':
        await playDialogue('sleep-menu');
        break;
      case 'photo':
        await openPanel('journal', 'photo');
        break;
    }
    interact(h.id);
  }

  private burst(x: number, y: number, tex: string, n: number) {
    const e = this.add.particles(x, y, tex, {
      speed: { min: 80, max: 220 }, lifespan: 800, scale: { start: 0.9, end: 0 }, alpha: { start: 1, end: 0 },
      angle: { min: 0, max: 360 }, blendMode: Phaser.BlendModes.ADD, emitting: false,
    }).setDepth(9400);
    e.explode(n);
    this.time_once(1200, () => e.destroy());
  }
  private time_once(ms: number, cb: () => void) {
    this.time.delayedCall(ms, cb);
  }

  private floatText(x: number, y: number, text: string, color = '#ff5c8a') {
    const t = this.add.text(x, y, text, {
      fontFamily: 'Fredoka, sans-serif', fontSize: '22px', color, stroke: '#ffffff', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(9500);
    this.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  /** Small dust puff kicked up behind the feet when changing direction mid-walk. */
  private turnDust(x: number, y: number, face: number) {
    for (let i = 0; i < 4; i++) {
      const d = this.add.image(x - face * (6 + i * 4), y - 4, 'dot').setTint(0xe8d8cc).setAlpha(0.7).setScale(0.6 + Math.random() * 0.5).setDepth(y + 1);
      this.tweens.add({
        targets: d, x: d.x - face * (14 + Math.random() * 16), y: d.y - 6 - Math.random() * 8,
        scale: d.scale * 1.8, alpha: 0, duration: 380 + i * 40, ease: 'Cubic.easeOut', onComplete: () => d.destroy(),
      });
    }
  }

  /** A little ring + heart where she's walking to. */
  private tapMarker(x: number, y: number) {
    if (store.settings.reducedMotion) return;
    // Drawn above the lighting layer so feedback stays visible at night.
    const ring = this.add.graphics().setDepth(8600).setPosition(x, y);
    ring.lineStyle(3, 0xffffff, 0.95).strokeEllipse(0, 0, 60, 18);
    ring.lineStyle(6, 0xff8fb0, 0.45).strokeEllipse(0, 0, 66, 22);
    ring.setScale(0.2);
    this.tweens.add({ targets: ring, scale: 1.2, alpha: 0, duration: 560, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    const heart = this.add.image(x, y - 6, 'p-heart').setDepth(8601).setScale(0.2).setAlpha(0);
    this.tweens.add({ targets: heart, y: y - 34, scale: 0.75, alpha: { from: 1, to: 0 }, duration: 620, ease: 'Sine.easeOut', onComplete: () => heart.destroy() });
  }

  /** Squeeze-and-glow pulse on an object when it's clicked. */
  private pressHotspot(h: Hotspot) {
    const g = this.add.graphics().setDepth(9501);
    const cx = h.x + h.w / 2, cy = h.y + h.h / 2;
    g.setPosition(cx, cy);
    g.lineStyle(4, 0xffffff, 1);
    g.strokeRoundedRect(-h.w / 2 - 6, -h.h / 2 - 6, h.w + 12, h.h + 12, 14);
    g.lineStyle(10, 0xff8fb0, 0.35);
    g.strokeRoundedRect(-h.w / 2 - 9, -h.h / 2 - 9, h.w + 18, h.h + 18, 16);
    this.tweens.add({ targets: g, scale: { from: 0.96, to: 1.06 }, alpha: { from: 1, to: 0 }, duration: 420, ease: 'Cubic.easeOut', onComplete: () => g.destroy() });
  }

  private drawHighlight(h: Hotspot | null) {
    const g = this.highlight;
    g.clear();
    this.hotspotObjs.forEach((o) => o.label.setVisible(false));
    if (!h) return;
    const pad = 6;
    g.lineStyle(3, 0xffffff, 0.9);
    g.strokeRoundedRect(h.x - pad, h.y - pad, h.w + pad * 2, h.h + pad * 2, 14);
    g.lineStyle(8, 0xff8fb0, 0.25);
    g.strokeRoundedRect(h.x - pad - 3, h.y - pad - 3, h.w + pad * 2 + 6, h.h + pad * 2 + 6, 16);
    this.hotspotObjs.find((o) => o.h === h)?.label.setVisible(true);
  }

  // ---------------------------------------------------------------- update
  update(_t: number, delta: number) {
    const dt = Math.min(0.05, delta / 1000);
    const loc = this.loc;
    const s = store.state;
    this.couple.update(dt);
    this.pets?.update(dt);
    const locked = store.blocked || this.busy || this.leaving || this.couple.active;
    if (!locked) s.playSeconds += dt;

    let vx = 0, vy = 0;
    if (!locked) {
      const k = this.keys;
      if (k.LEFT.isDown || k.A.isDown) vx -= 1;
      if (k.RIGHT.isDown || k.D.isDown) vx += 1;
      if (k.UP.isDown || k.W.isDown) vy -= 1;
      if (k.DOWN.isDown || k.S.isDown) vy += 1;
      vx += store.joy.x;
      vy += store.joy.y;
      if (vx || vy) {
        this.moveTarget = null;
        this.pending = null;
      } else if (this.moveTarget) {
        const dx = this.moveTarget.x - this.player.x, dy = this.moveTarget.y - this.player.y;
        const d = Math.hypot(dx, dy);
        if (d < 6) {
          this.moveTarget = null;
          if (this.pending) { void this.useTarget(this.pending); }
        } else {
          // Ease into the destination instead of stopping dead.
          const arrive = Math.min(1, d / 50) * 0.85 + 0.15;
          vx = (dx / d) * arrive;
          vy = ((dy / d) / 0.6) * arrive;
        }
      }
    } else {
      this.moveTarget = null;
    }

    const mag = Math.hypot(vx, vy);
    if (mag > 1) { vx /= mag; vy /= mag; }
    if (!this.couple.controls(this.player)) this.drive(this.player, this.herKey, vx * SPEED, vy * SPEED * 0.6, dt);
    const pm = this.mo(this.player);
    if (pm.faceT !== 0) this.facing = pm.faceT;
    const moving = pm.moving;
    s.x = Math.round(this.player.x);
    s.y = Math.round(this.player.y);

    if (!this.him || !this.couple.controls(this.him)) this.updateCompanion(dt, moving);
    this.updateHands();
    if (!this.couple.posedBy(this.player)) this.present(this.player, dt);
    if (this.him && !this.couple.posedBy(this.him)) this.present(this.him, dt);

    // Collectibles
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const c = this.collectibles[i];
      if (Math.abs(c.x - this.player.x) < 46 && Math.abs(c.y - this.player.y) < 50) {
        this.collectibles.splice(i, 1);
        this.tweens.killTweensOf(c.spr);
        this.tweens.add({ targets: c.spr, y: c.spr.y - 70, scale: 1.4, alpha: 0, duration: 450, onComplete: () => c.spr.destroy() });
        this.burst(c.x, c.spr.y, c.kind === 'heart' ? 'p-heart' : 'p-star', 10);
        audio.sfx(c.kind === 'heart' ? 'heart' : 'collect');
        collect(c.kind, c.id);
        this.floatText(c.x, c.spr.y - 30, c.kind === 'heart' ? '+♥' : '+✦');
      }
    }

    // Secrets reveal + nearest interactable
    let best: Target | null = null;
    let bestD = Infinity;
    for (const o of this.hotspotObjs) {
      const sx = this.standX(o.h);
      const near = Math.abs(sx - this.player.x);
      if (o.h.hidden && !o.revealed && near < 150) {
        o.revealed = true;
        o.zone.setInteractive({ useHandCursor: true });
        if (o.hint) this.tweens.add({ targets: o.hint, alpha: 0.9, duration: 500 });
      }
      if (o.revealed && near < 85 && near < bestD) {
        bestD = near;
        best = { kind: 'hotspot', x: sx, label: hotspotLabel(o.h), h: o.h };
      }
    }
    if (this.him) {
      const d = Phaser.Math.Distance.Between(this.him.x, this.him.y, this.player.x, this.player.y);
      if (d < 120 && d < bestD + 30) best = { kind: 'him', x: this.him.x, label: `Talk to ${store.partnerName()}` };
    }
    if (!locked) {
      if (best?.label !== this.nearest?.label || best?.h !== this.nearest?.h) {
        this.nearest = best;
        setPrompt(best ? best.label : null);
        this.drawHighlight(best?.h ?? null);
      }
      const k = this.keys;
      const pressed = Phaser.Input.Keyboard.JustDown(k.E) || Phaser.Input.Keyboard.JustDown(k.SPACE) || Phaser.Input.Keyboard.JustDown(k.ENTER) || store.joy.action;
      store.joy.action = false;
      if (pressed) {
        audio.unlock();
        if (best) void this.useTarget(best);
      }
    } else {
      if (!this.couple.active) store.joy.action = false; // during a couple moment the director reads it
      if (this.nearest) { this.nearest = null; setPrompt(null); this.drawHighlight(null); }
    }
  }

  private updateCompanion(dt: number, playerMoving: boolean) {
    const him = this.him;
    if (!him) return;
    const loc = this.loc;
    const m = this.mo(him);
    let tvx = 0, tvy = 0;
    const holding = this.holdingNow();
    if (holding) {
      // Holding hands: stay right beside her on whichever side he's on (turning around doesn't make him walk
      // around her), at the distance where their hands meet. He keeps pace, with a little jog to catch up.
      let side = Math.sign(him.x - this.player.x) || -this.facing;
      const gap = COUPLE.holdGap * (Math.abs(this.player.scaleY) || 0.9);
      if (this.player.x + side * gap < 40 || this.player.x + side * gap > loc.width - 40) side = -side;
      const tx = this.player.x + side * gap;
      const ty = Phaser.Math.Clamp(this.player.y - 2, loc.floorTop, loc.floorBottom);
      // Match her actual speed, plus a correction toward the hand-holding spot (so he never lags behind).
      const pm = this.mo(this.player);
      const dx = tx - him.x, dy = ty - him.y;
      tvx = Phaser.Math.Clamp(pm.vx + dx * 8, -SPEED * 1.4, SPEED * 1.4);
      tvy = Phaser.Math.Clamp(pm.vy + dy * 8, -SPEED, SPEED);
      if (Math.abs(tvx) < 6 && Math.abs(tvy) < 6) { tvx = 0; tvy = 0; }
    } else if (store.settings.companionMode === 'follow') {
      // Follow a spot just behind her; speed scales with distance so he glides in and settles.
      const tx = Phaser.Math.Clamp(this.player.x - this.facing * this.followGap, 40, loc.width - 40);
      const ty = Phaser.Math.Clamp(this.player.y - 10, loc.floorTop, loc.floorBottom);
      const dx = tx - him.x, dy = ty - him.y;
      const d = Math.hypot(dx, dy);
      if (d > 12) {
        const sp = Math.min(SPEED * 1.08, (d - 8) * 3.2);
        tvx = (dx / d) * sp;
        tvy = (dy / d) * sp * 0.7;
      }
    }
    this.drive(him, this.hisKey, tvx, tvy, dt);
    const moving = m.moving;
    // When standing, turn to look at her (holding hands, they face the same way she does).
    if (!moving && holding) m.faceT = this.facing;
    else if (!moving && Math.abs(this.player.x - him.x) > 6) m.faceT = this.player.x < him.x ? -1 : 1;

    // Occasional heart emote when idle together.
    this.emoteTimer -= dt;
    if (this.emoteTimer <= 0) {
      this.emoteTimer = 9 + Math.random() * 10;
      if (!playerMoving && !moving && Phaser.Math.Distance.Between(him.x, him.y, this.player.x, this.player.y) < 200) {
        const e = this.add.image(him.x + 18, him.y - FRAME_H * him.scaleY - 6, 'emote-heart').setDepth(9300).setScale(0.2);
        this.tweens.add({ targets: e, scale: 0.7, y: e.y - 30, duration: 500, ease: 'Back.easeOut' });
        this.tweens.add({ targets: e, alpha: 0, delay: 1300, duration: 400, onComplete: () => e.destroy() });
      }
    }
  }

  /** Depth scale + turn, lean and squash/stretch, all eased every frame. */
  private present(spr: Phaser.GameObjects.Sprite, dt: number) {
    const loc = this.loc;
    const m = this.mo(spr);
    const t = (spr.y - loc.floorTop) / (loc.floorBottom - loc.floorTop);
    const sc = 0.82 + 0.2 * t;
    const reduced = store.settings.reducedMotion;
    // Turn: flip instantly, and sell it with a quick body pivot (slight narrowing + crouch-and-spring)
    // instead of squeezing the sprite through zero width like a sheet of paper.
    if (m.faceT !== m.face) {
      m.face = m.faceT;
      if (!reduced) {
        m.turn = 1;
        m.sqV -= 0.55;                                   // tiny crouch that springs back up
        if (m.moving) this.turnDust(spr.x, spr.y, m.face);
      }
    }
    m.turn = Math.max(0, m.turn - dt / 0.16);
    const pivot = m.turn * m.turn;                       // ease-out
    const f = m.face * (1 - 0.15 * pivot);
    // Lean slightly into the direction of travel.
    // Lean into travel; right after a turn, a brief tilt toward the new direction.
    const leanT = reduced ? 0 : Phaser.Math.Clamp(m.vx / SPEED, -1, 1) * 0.045 + m.face * pivot * 0.05;
    m.lean += (leanT - m.lean) * (1 - Math.exp(-dt * 9));
    // Squash/stretch spring.
    if (!reduced) {
      const acc = -260 * m.sq - 18 * m.sqV;
      m.sqV += acc * dt;
      m.sq += m.sqV * dt;
      m.sq = Phaser.Math.Clamp(m.sq, -0.08, 0.08);
    } else { m.sq = 0; m.sqV = 0; }
    spr.setFlipX(false);
    spr.setScale(sc * f * (1 - m.sq * 0.6), sc * (1 + m.sq));
    m.tilt += (m.tiltT - m.tilt) * (1 - Math.exp(-dt * (reduced ? 30 : 7)));
    spr.setRotation(m.lean + (reduced ? 0 : m.tilt));
    spr.setDepth(spr.y);
    const sh = this.shadows.get(spr);
    if (sh) sh.setPosition(spr.x, spr.y - 2).setDepth(spr.y - 1).setScale(sc * 0.75 * (1 - m.sq), sc * (1 - m.sq * 0.5));
  }
}

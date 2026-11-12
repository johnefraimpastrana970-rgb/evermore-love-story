import Phaser from 'phaser';
import type { LocationDef } from '../content/types';
import { store } from '../core/store';
import { audio } from '../audio/audio';
import { isHouseRoom, itemDef, type ItemFx, type ItemUse } from './data';
import { move } from './logic';
import { ITEM_SPOTS, buildItem } from './draw';

/*
 * Placed items in a house room. While decorating they can be dragged along the floor and tapped to select.
 * Pets ask for the spots: beds to nap in, perches to climb, toys to play near.
 */

export interface ItemSpot { id: string; item: string; use: ItemUse; x: number; y: number; perchY?: number; bedY?: number; scale: number; w: number; h: number }

export function ensureItem(scene: Phaser.Scene, id: string) {
  const key = `item-${id}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, buildItem(id));
  return key;
}

export class HomeItems {
  private sprites = new Map<string, Phaser.GameObjects.Image>();
  private editing = false;
  private selected: string | null = null;
  private ring?: Phaser.GameObjects.Graphics;
  onSelect: (id: string | null) => void = () => {};
  onMoved: (id: string) => void = () => {};
  /** Outside decorating: an item was tapped (she walks over and uses it). */
  onUse: (id: string) => void = () => {};
  /** Lamps switched on this visit (a soft glow over each). */
  private lit = new Map<string, Phaser.GameObjects.Image>();
  constructor(private scene: Phaser.Scene, private loc: LocationDef) {}

  private scaleAt(y: number) { const t = (y - this.loc.floorTop) / (this.loc.floorBottom - this.loc.floorTop); return 0.82 + 0.2 * t; }

  build() {
    this.destroy();
    if (!store.hasGame || !isHouseRoom(this.loc.id)) return;
    for (const p of store.state.home.items.filter((i) => i.room === this.loc.id)) {
      const img = this.scene.add.image(p.x, p.y, ensureItem(this.scene, p.item)).setOrigin(0.5, 1);
      img.setScale(this.scaleAt(p.y)).setDepth(p.y - 2);
      img.setData('id', p.id);
      this.sprites.set(p.id, img);
    }
    this.ring = this.scene.add.graphics().setDepth(9400);
    this.setEdit(this.editing);
  }

  /** Decorating mode: items become draggable (and tappable to select). */
  setEdit(on: boolean) {
    this.editing = on;
    for (const img of this.sprites.values()) {
      img.removeAllListeners();
      if (!on) {
        // Not decorating: tap an item to use it.
        img.setInteractive({ useHandCursor: true, draggable: false });
        img.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
          if (store.blocked) return;
          e.stopPropagation();
          this.onUse(img.getData('id'));
        });
        continue;
      }
      img.setInteractive({ useHandCursor: true, draggable: true });
      img.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => { e.stopPropagation(); this.select(img.getData('id')); });
      img.on('drag', (_p: Phaser.Input.Pointer, x: number, y: number) => {
        img.x = Phaser.Math.Clamp(x, 60, this.loc.width - 60);
        img.y = Phaser.Math.Clamp(y, this.loc.floorTop + 10, this.loc.floorBottom);
        img.setScale(this.scaleAt(img.y)).setDepth(img.y - 2);
        this.drawRing();
      });
      img.on('dragend', () => {
        move(store.state.home, img.getData('id'), img.x, img.y);
        audio.sfx('plop');
        store.save();
        this.onMoved(img.getData('id'));
      });
    }
    if (!on) this.select(null);
  }

  select(id: string | null) {
    this.selected = id;
    this.drawRing();
    this.onSelect(id);
  }
  private drawRing() {
    const g = this.ring;
    if (!g) return;
    g.clear();
    const img = this.selected ? this.sprites.get(this.selected) : undefined;
    if (!img || !this.editing) return;
    const w = img.displayWidth, h = img.displayHeight;
    g.lineStyle(3, 0xffffff, 0.95).strokeRoundedRect(img.x - w / 2 - 6, img.y - h - 6, w + 12, h + 12, 12);
    g.lineStyle(6, 0xff8fb0, 0.35).strokeRoundedRect(img.x - w / 2 - 9, img.y - h - 9, w + 18, h + 18, 14);
  }

  /** Where pets can nap, perch and play in this room. */
  spots(): ItemSpot[] {
    return [...this.sprites.values()].map((img) => {
      const p = store.state.home.items.find((i) => i.id === img.getData('id'))!;
      const d = itemDef(p.item)!;
      const s = ITEM_SPOTS[p.item] ?? {};
      return { id: p.id, item: p.item, use: d.use, x: img.x, y: img.y, perchY: s.perchY, bedY: s.bedY, scale: img.scaleY, w: img.displayWidth, h: img.displayHeight };
    });
  }
  spot(id: string) { return this.spots().find((s) => s.id === id); }

  /** A little moment at an item (someone used it). */
  fx(id: string, kind: ItemFx) {
    const img = this.sprites.get(id);
    if (!img) return;
    const s = this.scene, x = img.x, top = img.y - img.displayHeight, mid = img.y - img.displayHeight * 0.55;
    const reduced = store.settings.reducedMotion;
    const float = (o: Phaser.GameObjects.GameObject & { x: number; y: number; alpha: number }, dy: number, ms: number, delay = 0) =>
      s.tweens.add({ targets: o, y: o.y - dy, alpha: 0, duration: reduced ? 400 : ms, delay, ease: 'Sine.easeOut', onComplete: () => o.destroy() });
    const glyph = (t: string, gx: number, gy: number, color: string, delay: number) => {
      const o = s.add.text(gx, gy, t, { fontFamily: 'Fredoka, sans-serif', fontSize: '24px', color, stroke: '#ffffff', strokeThickness: 4 }).setOrigin(0.5).setDepth(9300);
      float(o, 60, 1300, delay);
    };
    switch (kind) {
      case 'hearts': for (let i = 0; i < 4; i++) { const h = s.add.image(x - 20 + i * 14, mid, 'emote-heart').setScale(0.4).setDepth(9300); float(h, 70, 1200, i * 140); } break;
      case 'notes': for (let i = 0; i < 6; i++) glyph(i % 2 ? '♪' : '♫', x - 30 + Math.random() * 60, top + 10, '#7a5ad8', i * 320); break;
      case 'petals': for (let i = 0; i < 6; i++) glyph('✿', x - 30 + Math.random() * 60, top + 20, '#f08aaa', i * 120); break;
      case 'sparkle': for (let i = 0; i < 5; i++) { const p = s.add.image(x - 30 + Math.random() * 60, mid - Math.random() * 30, 'p-star').setScale(0.5).setDepth(9300).setBlendMode(Phaser.BlendModes.ADD); float(p, 30, 900, i * 90); } break;
      case 'bubbles': for (let i = 0; i < 7; i++) { const b = s.add.circle(x - 14 + Math.random() * 28, mid, 3 + Math.random() * 3, 0xffffff, 0.8).setStrokeStyle(1, 0x9ad0e8).setDepth(9300); float(b, 50, 1000, i * 110); } break;
      case 'warm': {
        const g = s.add.image(x, mid, 'firefly').setScale(5).setTint(0xffa860).setAlpha(0).setDepth(img.depth + 1).setBlendMode(Phaser.BlendModes.ADD);
        s.tweens.add({ targets: g, alpha: { from: 0, to: 0.55 }, duration: 500, yoyo: true, hold: reduced ? 600 : 1800, onComplete: () => g.destroy() });
        break;
      }
      case 'light': {
        // The lamp toggles: on (a warm glow that stays while she's in the room) or off.
        const on = this.lit.get(id);
        if (on) { on.destroy(); this.lit.delete(id); break; }
        const g = s.add.image(x, top + img.displayHeight * 0.25, 'firefly').setScale(6).setTint(0xffe0a0).setAlpha(0).setDepth(img.depth + 1).setBlendMode(Phaser.BlendModes.ADD);
        s.tweens.add({ targets: g, alpha: 0.6, duration: 400 });
        this.lit.set(id, g);
        break;
      }
    }
  }

  destroy() {
    for (const img of this.sprites.values()) img.destroy();
    this.sprites.clear();
    for (const g of this.lit.values()) g.destroy();
    this.lit.clear();
    this.ring?.destroy();
    this.ring = undefined;
  }
}

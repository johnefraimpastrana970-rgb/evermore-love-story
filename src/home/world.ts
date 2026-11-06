import Phaser from 'phaser';
import type { LocationDef } from '../content/types';
import { store } from '../core/store';
import { audio } from '../audio/audio';
import { isHouseRoom, itemDef, type ItemUse } from './data';
import { move } from './logic';
import { ITEM_SPOTS, buildItem } from './draw';

/*
 * Placed items in a house room. While decorating they can be dragged along the floor and tapped to select.
 * Pets ask for the spots: beds to nap in, perches to climb, toys to play near.
 */

export interface ItemSpot { id: string; item: string; use: ItemUse; x: number; y: number; perchY?: number; bedY?: number; scale: number }

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
      if (!on) { img.disableInteractive(); continue; }
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
      return { id: p.id, item: p.item, use: d.use, x: img.x, y: img.y, perchY: s.perchY, bedY: s.bedY, scale: img.scaleY };
    });
  }

  destroy() {
    for (const img of this.sprites.values()) img.destroy();
    this.sprites.clear();
    this.ring?.destroy();
    this.ring = undefined;
  }
}

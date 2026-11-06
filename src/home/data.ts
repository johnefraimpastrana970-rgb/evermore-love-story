// Decorating the house: wallpapers, floors, furniture colours, one-tap "vibes", and items to place.
// Everything is drawn in code (see ../art/rooms.ts and ./draw.ts). Prices are heart tokens.

import type { LocationId } from '../content/types';
import type { WallStyle } from '../art/paint';

export type HouseRoom = 'bedroom' | 'livingroom' | 'kitchen';
export const HOUSE_ROOMS: HouseRoom[] = ['bedroom', 'livingroom', 'kitchen'];
export const isHouseRoom = (id: LocationId): id is HouseRoom => (HOUSE_ROOMS as string[]).includes(id);

export interface WallDef { id: string; name: string; style: WallStyle; price: number }
export const WALLS: WallDef[] = [
  { id: 'wall-pink-dots', name: 'Pink dots', style: { base: 0xfbe4e8, accent: 0xe79cb0, pattern: 'dots', wainscot: 0xf9eef0 }, price: 0 },
  { id: 'wall-cream-stripes', name: 'Cream stripes', style: { base: 0xf7ecdc, accent: 0xe2c7a0, pattern: 'stripes' }, price: 0 },
  { id: 'wall-kitchen', name: 'Warm cream', style: { base: 0xfff4e2, accent: 0xf2cfa0, pattern: 'plain' }, price: 0 },
  { id: 'wall-strawberry', name: 'Strawberry milk', style: { base: 0xffe1ea, accent: 0xff9ab8, pattern: 'hearts', wainscot: 0xfff4f7 }, price: 40 },
  { id: 'wall-mint', name: 'Mint café', style: { base: 0xe2f6ee, accent: 0x9ad8c0, pattern: 'stripes', wainscot: 0xf2fbf7 }, price: 40 },
  { id: 'wall-lavender', name: 'Lavender dream', style: { base: 0xece4fb, accent: 0xb9a2ec, pattern: 'dots', wainscot: 0xf7f2ff }, price: 45 },
  { id: 'wall-sky', name: 'Baby blue', style: { base: 0xe2f0fd, accent: 0x9cc4ec, pattern: 'plain', wainscot: 0xf4f9ff }, price: 35 },
  { id: 'wall-butter', name: 'Butter yellow', style: { base: 0xfff6d6, accent: 0xf2d482, pattern: 'tiles' }, price: 35 },
  { id: 'wall-midnight', name: 'Midnight stars', style: { base: 0x3a3a66, accent: 0x5a5a96, pattern: 'dots', wainscot: 0x2e2e52 }, price: 60 },
  { id: 'wall-panel', name: 'Wood panels', style: { base: 0xe8d4bc, accent: 0xc8a882, pattern: 'panel' }, price: 50 },
];

export interface FloorDef { id: string; name: string; kind: 'wood' | 'tile' | 'carpet'; color: number; price: number }
export const FLOORS: FloorDef[] = [
  { id: 'floor-honey', name: 'Honey wood', kind: 'wood', color: 0xc99c78, price: 0 },
  { id: 'floor-walnut', name: 'Walnut wood', kind: 'wood', color: 0xb3825e, price: 0 },
  { id: 'floor-cream-tile', name: 'Cream tiles', kind: 'tile', color: 0xe6d6c2, price: 0 },
  { id: 'floor-white-wood', name: 'White oak', kind: 'wood', color: 0xe8dccb, price: 40 },
  { id: 'floor-pink-carpet', name: 'Pink carpet', kind: 'carpet', color: 0xf3c4cf, price: 45 },
  { id: 'floor-mint-tile', name: 'Mint tiles', kind: 'tile', color: 0xbfe6d6, price: 40 },
  { id: 'floor-lilac-carpet', name: 'Lilac carpet', kind: 'carpet', color: 0xd4c4ee, price: 45 },
  { id: 'floor-dark-wood', name: 'Cocoa wood', kind: 'wood', color: 0x7a5236, price: 50 },
];

/** Colour choices for the big furniture (sofa, bed blanket, curtains, rugs). */
export type FurnitureSlot = 'sofa' | 'blanket' | 'curtain' | 'rug';
export const FURNITURE_SLOTS: { slot: FurnitureSlot; label: string; rooms: HouseRoom[] }[] = [
  { slot: 'sofa', label: 'Sofa', rooms: ['livingroom'] },
  { slot: 'blanket', label: 'Bed blanket', rooms: ['bedroom'] },
  { slot: 'curtain', label: 'Curtains', rooms: ['bedroom', 'livingroom'] },
  { slot: 'rug', label: 'Rug', rooms: ['bedroom', 'livingroom'] },
];
export interface ColorDef { id: string; name: string; color: number; price: number }
export const COLORS: ColorDef[] = [
  { id: 'c-default', name: 'Original', color: -1, price: 0 },
  { id: 'c-blush', name: 'Blush', color: 0xf4b6c8, price: 20 },
  { id: 'c-rose', name: 'Rose', color: 0xe8738f, price: 20 },
  { id: 'c-peach', name: 'Peach', color: 0xffc29a, price: 20 },
  { id: 'c-butter', name: 'Butter', color: 0xf6d982, price: 20 },
  { id: 'c-mint', name: 'Mint', color: 0x8fd6b8, price: 20 },
  { id: 'c-sky', name: 'Sky', color: 0x8ab8e8, price: 20 },
  { id: 'c-lilac', name: 'Lilac', color: 0xb9a2ec, price: 20 },
  { id: 'c-cream', name: 'Cream', color: 0xf3e6d2, price: 20 },
  { id: 'c-navy', name: 'Navy', color: 0x3a4a7a, price: 25 },
  { id: 'c-cocoa', name: 'Cocoa', color: 0x8a5a44, price: 25 },
];

export interface RoomLook { wall: string; floor: string; sofa: string; blanket: string; curtain: string; rug: string }
export const DEFAULT_LOOK: Record<HouseRoom, RoomLook> = {
  bedroom: { wall: 'wall-pink-dots', floor: 'floor-honey', sofa: 'c-default', blanket: 'c-default', curtain: 'c-default', rug: 'c-default' },
  livingroom: { wall: 'wall-cream-stripes', floor: 'floor-walnut', sofa: 'c-default', blanket: 'c-default', curtain: 'c-default', rug: 'c-default' },
  kitchen: { wall: 'wall-kitchen', floor: 'floor-cream-tile', sofa: 'c-default', blanket: 'c-default', curtain: 'c-default', rug: 'c-default' },
};

/** One-tap themes: a whole look for a room (bought once, then free to switch). */
export interface VibeDef { id: string; name: string; emoji: string; price: number; look: Omit<RoomLook, never> }
export const VIBES: VibeDef[] = [
  { id: 'vibe-cozy', name: 'Cozy original', emoji: '🏡', price: 0, look: { wall: '', floor: '', sofa: 'c-default', blanket: 'c-default', curtain: 'c-default', rug: 'c-default' } },
  { id: 'vibe-strawberry', name: 'Strawberry milk', emoji: '🍓', price: 120, look: { wall: 'wall-strawberry', floor: 'floor-white-wood', sofa: 'c-blush', blanket: 'c-rose', curtain: 'c-blush', rug: 'c-cream' } },
  { id: 'vibe-mint', name: 'Mint café', emoji: '🍃', price: 120, look: { wall: 'wall-mint', floor: 'floor-white-wood', sofa: 'c-mint', blanket: 'c-mint', curtain: 'c-cream', rug: 'c-butter' } },
  { id: 'vibe-lavender', name: 'Lavender dream', emoji: '💜', price: 140, look: { wall: 'wall-lavender', floor: 'floor-lilac-carpet', sofa: 'c-lilac', blanket: 'c-lilac', curtain: 'c-cream', rug: 'c-blush' } },
  { id: 'vibe-sunny', name: 'Sunny cottage', emoji: '🌻', price: 120, look: { wall: 'wall-butter', floor: 'floor-honey', sofa: 'c-peach', blanket: 'c-butter', curtain: 'c-peach', rug: 'c-mint' } },
  { id: 'vibe-midnight', name: 'Midnight stars', emoji: '🌙', price: 160, look: { wall: 'wall-midnight', floor: 'floor-dark-wood', sofa: 'c-navy', blanket: 'c-navy', curtain: 'c-lilac', rug: 'c-sky' } },
];

/** Things she can place on the floor (and that pets use). */
export type ItemUse = 'bed' | 'perch' | 'toy' | 'deco';
export interface ItemDef { id: string; name: string; emoji: string; price: number; use: ItemUse; w: number; h: number }
export const ITEMS: ItemDef[] = [
  { id: 'cat-tree', name: 'Cat tree', emoji: '🐈', price: 90, use: 'perch', w: 110, h: 210 },
  { id: 'pet-bed', name: 'Round pet bed', emoji: '🛏️', price: 50, use: 'bed', w: 110, h: 46 },
  { id: 'pet-bed-heart', name: 'Heart pet bed', emoji: '💗', price: 70, use: 'bed', w: 110, h: 50 },
  { id: 'toy-box', name: 'Toy basket', emoji: '🧺', price: 40, use: 'toy', w: 80, h: 64 },
  { id: 'monstera', name: 'Big plant', emoji: '🪴', price: 35, use: 'deco', w: 90, h: 150 },
  { id: 'floor-lamp', name: 'Mushroom lamp', emoji: '🍄', price: 45, use: 'deco', w: 70, h: 120 },
  { id: 'beanbag', name: 'Beanbag', emoji: '🫘', price: 55, use: 'bed', w: 120, h: 70 },
  { id: 'bear', name: 'Giant teddy', emoji: '🧸', price: 60, use: 'deco', w: 100, h: 120 },
  { id: 'fishbowl', name: 'Fish bowl', emoji: '🐠', price: 40, use: 'toy', w: 70, h: 90 },
  { id: 'heart-pillow', name: 'Heart floor cushion', emoji: '❤️', price: 30, use: 'bed', w: 90, h: 40 },
];
export const MAX_ITEMS_PER_ROOM = 6;
export const itemDef = (id: string) => ITEMS.find((i) => i.id === id);

import type { CollectibleKind, ItemDef } from './types';

export const ITEMS: Record<string, ItemDef> = {
  heart: { id: 'heart', name: 'Heart Charm', description: 'A little glowing heart. They seem to appear wherever love is.', icon: 'heart', giftable: true, affection: 1 },
  petal: { id: 'petal', name: 'Blossom Petal', description: 'Soft and pink. Smells faintly like spring.', icon: 'petal', giftable: true, affection: 1 },
  star: { id: 'star', name: 'Star Shard', description: 'A tiny piece of a wish that came true.', icon: 'star', giftable: true, affection: 1 },
  note: { id: 'note', name: 'Folded Note', description: 'A scrap of paper with a doodle on it.', icon: 'note', giftable: true, affection: 1 },
  sparkle: { id: 'sparkle', name: 'Sparkle', description: 'Pure, shiny happiness. Hard to hold on to.', icon: 'sparkle' },
  cookie: { id: 'cookie', name: 'Cookie', description: 'Homemade, slightly lopsided, absolutely perfect.', icon: 'cookie', giftable: true, affection: 3 },
  cocoa: { id: 'cocoa', name: 'Warm Mug', description: 'Something warm to drink. Better when shared.', icon: 'cocoa', giftable: true, affection: 3 },
  bouquet: { id: 'bouquet', name: 'Backyard Bouquet', description: 'Flowers picked fresh from the garden.', icon: 'bouquet', giftable: true, affection: 5 },
  'love-note': { id: 'love-note', name: 'Locker Note', description: 'A note slipped into her locker. Some day it will hold real words.', icon: 'letter', giftable: true, affection: 4 },
  ribbon: { id: 'ribbon', name: 'Silk Ribbon', description: 'A reward for finding secrets.', icon: 'ribbon', giftable: true, affection: 4 },
  polaroid: { id: 'polaroid', name: 'Instant Photo', description: 'Won from the photo puzzle. A memory waiting to be added.', icon: 'polaroid', giftable: true, affection: 4 },
  pancake: { id: 'pancake', name: 'Pancake Stack', description: 'Cooked together. Fluffy-ish.', icon: 'pancake', giftable: true, affection: 5 },
};

export const COLLECTIBLE_ITEM: Record<CollectibleKind, string> = {
  heart: 'heart',
  petal: 'petal',
  star: 'star',
  note: 'note',
  sparkle: 'sparkle',
};

export const COLLECTIBLE_XP: Record<CollectibleKind, number> = {
  heart: 6,
  petal: 5,
  star: 8,
  note: 7,
  sparkle: 10,
};

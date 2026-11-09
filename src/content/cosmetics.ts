import type { CosmeticDef } from './types';

/** Outfit / hair colours. New ones unlock with levels or can be bought with heart tokens. */
export const COSMETICS: CosmeticDef[] = [
  // Her hair
  { id: 'hair-espresso', name: 'Her Natural Black-Brown', slot: 'herHair', color: 0x2c1b22 },
  { id: 'hair-cocoa', name: 'Cocoa', slot: 'herHair', color: 0x5a3a2e },
  { id: 'hair-midnight', name: 'Midnight', slot: 'herHair', color: 0x23202e, unlockLevel: 2 },
  { id: 'hair-honey', name: 'Honey', slot: 'herHair', color: 0xc08a4a, unlockLevel: 4 },
  { id: 'hair-sakura', name: 'Sakura', slot: 'herHair', color: 0xe59ab4, cost: 60 },
  { id: 'hair-lavender', name: 'Lavender', slot: 'herHair', color: 0xa58ad6, cost: 80 },
  { id: 'hair-auburn', name: 'Auburn', slot: 'herHair', color: 0x8c3b2a, unlockLevel: 8 },
  { id: 'hair-silver', name: 'Moonlight Silver', slot: 'herHair', color: 0xd9dbe8, unlockLevel: 15 },
  // Her outfit
  { id: 'outfit-cat-tee', name: 'Comfy Cat Tee', slot: 'herOutfit', color: 0xfbf3f4, style: 'tee' },
  { id: 'outfit-lilac-tee', name: 'Lilac Cat Tee', slot: 'herOutfit', color: 0xdccdf2, style: 'tee', unlockLevel: 4 },
  { id: 'outfit-pink-tee', name: 'Strawberry Cat Tee', slot: 'herOutfit', color: 0xffd3df, style: 'tee', cost: 45 },
  { id: 'outfit-rose', name: 'Rose Dress', slot: 'herOutfit', color: 0xe8738f },
  { id: 'outfit-sky', name: 'Sky Blue', slot: 'herOutfit', color: 0x7fb4e8, unlockLevel: 3 },
  { id: 'outfit-mint', name: 'Mint', slot: 'herOutfit', color: 0x86d1b0, cost: 50 },
  { id: 'outfit-cream', name: 'Cream Sweater', slot: 'herOutfit', color: 0xf3e3c6, style: 'sweater', unlockLevel: 6 },
  { id: 'outfit-lilac', name: 'Lilac', slot: 'herOutfit', color: 0xb99be0, cost: 70 },
  { id: 'outfit-cherry', name: 'Cherry Red', slot: 'herOutfit', color: 0xc8324a, unlockLevel: 10 },
  { id: 'outfit-sailor', name: 'School Navy', slot: 'herOutfit', color: 0x2f3e66, unlockLevel: 5 },
  { id: 'outfit-starlight', name: 'Starlight Gown', slot: 'herOutfit', color: 0x3a2f6e, style: 'gown', unlockLevel: 20 },
  { id: 'outfit-garden-dress', name: 'Heartvine Sundress', slot: 'herOutfit', color: 0x9fd8a4, garden: true },
  // Sleepwear, outdoor and seasonal
  { id: 'outfit-cloud-pajamas', name: 'Cloud Pajamas', slot: 'herOutfit', color: 0xcfe0f6, style: 'pajama', unlockLevel: 3 },
  { id: 'outfit-strawberry-pajamas', name: 'Strawberry Pajamas', slot: 'herOutfit', color: 0xffc9d6, style: 'pajama', cost: 55 },
  { id: 'outfit-maple-cardigan', name: 'Maple Cardigan', slot: 'herOutfit', color: 0xd99a5b, style: 'cardigan', unlockLevel: 7 },
  { id: 'outfit-snowday-sweater', name: 'Snowday Sweater', slot: 'herOutfit', color: 0xc94d5e, style: 'sweater', cost: 70 },
  // Her accent
  { id: 'accent-ribbon-sakura', name: 'Sakura Bow', slot: 'herAccent', color: 0xf4a3bb },
  { id: 'accent-ribbon-red', name: 'Red Ribbon', slot: 'herAccent', color: 0xd8344f },
  { id: 'accent-ribbon-white', name: 'White Ribbon', slot: 'herAccent', color: 0xfaf6f0, unlockLevel: 2 },
  { id: 'accent-ribbon-gold', name: 'Gold Ribbon', slot: 'herAccent', color: 0xf0c050, cost: 40 },
  { id: 'accent-ribbon-blue', name: 'Blue Ribbon', slot: 'herAccent', color: 0x4f7fd8, unlockLevel: 7 },
  { id: 'accent-ribbon-pink', name: 'Pink Ribbon', slot: 'herAccent', color: 0xff8fb8, cost: 40 },
  { id: 'accent-flower-crown', name: 'Promise Flower Crown', slot: 'herAccent', color: 0xc8324a, garden: true },
  // His hair
  { id: 'his-hair-black', name: 'His Messy Black', slot: 'hisHair', color: 0x1b1418 },
  { id: 'his-hair-ink', name: 'Ink', slot: 'hisHair', color: 0x1f1d26 },
  { id: 'his-hair-chestnut', name: 'Chestnut', slot: 'hisHair', color: 0x6b4130, unlockLevel: 3 },
  { id: 'his-hair-ash', name: 'Ash', slot: 'hisHair', color: 0x8a8790, cost: 60 },
  // His outfit
  { id: 'his-outfit-raglan', name: 'Black & Grey Hoodie', slot: 'hisOutfit', color: 0x2a252e, style: 'raglan' },
  { id: 'his-outfit-raglan-navy', name: 'Navy & Grey Hoodie', slot: 'hisOutfit', color: 0x2c3654, style: 'raglan', unlockLevel: 4 },
  { id: 'his-outfit-raglan-wine', name: 'Wine & Grey Hoodie', slot: 'hisOutfit', color: 0x5a2434, style: 'raglan', cost: 55 },
  { id: 'his-outfit-navy', name: 'Navy Hoodie', slot: 'hisOutfit', color: 0x34466e, style: 'hoodie' },
  { id: 'his-outfit-white', name: 'White Shirt', slot: 'hisOutfit', color: 0xeef0f4, style: 'shirt', unlockLevel: 2 },
  { id: 'his-outfit-forest', name: 'Forest Green', slot: 'hisOutfit', color: 0x3f6b4f, style: 'hoodie', cost: 50 },
  { id: 'his-outfit-maroon', name: 'Maroon', slot: 'hisOutfit', color: 0x7a2a3a, style: 'hoodie', unlockLevel: 9 },
  { id: 'his-outfit-garden', name: 'Heartvine Gardener', slot: 'hisOutfit', color: 0x5f8f5a, style: 'hoodie', garden: true },
  { id: 'his-outfit-pajama', name: 'Sleepy Stripe Pajamas', slot: 'hisOutfit', color: 0x8fa8d8, style: 'pajama', unlockLevel: 3 },
  { id: 'his-outfit-knit', name: 'Cozy Knit Sweater', slot: 'hisOutfit', color: 0xb5653f, style: 'sweater', cost: 60 },
  { id: 'his-outfit-vest', name: 'Date Night Vest', slot: 'hisOutfit', color: 0x3a3046, style: 'formal', unlockLevel: 10 },
];

export function cosmetic(id: string): CosmeticDef | undefined {
  return COSMETICS.find((c) => c.id === id);
}

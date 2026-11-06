// Garden content: plants, special plants, decor, levels. Plain data, edit freely.
// Growth times are in real minutes; plants keep growing while the game is closed and never wilt.

import type { IngKind } from '../pizza/data';

export type PlantKind = 'flower' | 'produce' | 'topping' | 'special';

export interface PlantDef {
  id: string;
  name: string;
  kind: PlantKind;
  emoji: string;
  /** Real minutes from seed to harvest (unwatered). */
  growMin: number;
  /** Seed price in shop coins (0 = never sold, e.g. special plants). */
  seedPrice: number;
  /** Coins per harvested unit at the stall. */
  sellPrice: number;
  /** Units per harvest [min, max]. */
  yield: [number, number];
  /** Garden level needed before the seed is sold. */
  gardenLevel: number;
  /** Petal / fruit colour used when drawing it. */
  color: string;
  /** Toppings go straight into the pizza pantry as premium ("garden fresh") stock. */
  pizza?: IngKind;
  /** Produce: the cooking-game recipe it makes extra special. */
  cooking?: string;
}

export const PLANTS: PlantDef[] = [
  // Flowers: for bouquets (gift, sell, photograph).
  { id: 'daisy', name: 'Daisy', kind: 'flower', emoji: '🌼', growMin: 3, seedPrice: 2, sellPrice: 3, yield: [2, 3], gardenLevel: 1, color: '#fff7d6' },
  { id: 'tulip', name: 'Tulip', kind: 'flower', emoji: '🌷', growMin: 15, seedPrice: 4, sellPrice: 6, yield: [2, 3], gardenLevel: 1, color: '#ff7aa2' },
  { id: 'sunflower', name: 'Sunflower', kind: 'flower', emoji: '🌻', growMin: 45, seedPrice: 8, sellPrice: 12, yield: [1, 2], gardenLevel: 2, color: '#f6c343' },
  { id: 'lavender', name: 'Lavender', kind: 'flower', emoji: '💜', growMin: 90, seedPrice: 10, sellPrice: 9, yield: [3, 4], gardenLevel: 3, color: '#a58ad6' },
  { id: 'rose', name: 'Rose', kind: 'flower', emoji: '🌹', growMin: 180, seedPrice: 16, sellPrice: 22, yield: [2, 3], gardenLevel: 4, color: '#e8577d' },
  { id: 'peony', name: 'Peony', kind: 'flower', emoji: '🌸', growMin: 240, seedPrice: 20, sellPrice: 26, yield: [2, 3], gardenLevel: 6, color: '#f7a8c4' },
  // Produce: sells well and makes the matching cooking-game recipe extra special.
  { id: 'blueberry', name: 'Blueberries', kind: 'produce', emoji: '🫐', growMin: 10, seedPrice: 3, sellPrice: 4, yield: [3, 5], gardenLevel: 1, color: '#4f6bd8', cooking: 'Fluffy Pancakes' },
  { id: 'strawberry', name: 'Strawberries', kind: 'produce', emoji: '🍓', growMin: 25, seedPrice: 5, sellPrice: 6, yield: [3, 5], gardenLevel: 1, color: '#e5413d', cooking: 'Strawberry Cake' },
  { id: 'chives', name: 'Chives', kind: 'produce', emoji: '🌱', growMin: 8, seedPrice: 2, sellPrice: 3, yield: [3, 4], gardenLevel: 2, color: '#5fb36b', cooking: 'Heart Omelette' },
  { id: 'mint', name: 'Mint', kind: 'produce', emoji: '🌿', growMin: 30, seedPrice: 4, sellPrice: 5, yield: [3, 4], gardenLevel: 3, color: '#7fd1b9', cooking: 'Midnight Cocoa' },
  { id: 'corn', name: 'Sweet Corn', kind: 'produce', emoji: '🌽', growMin: 60, seedPrice: 7, sellPrice: 8, yield: [2, 4], gardenLevel: 4, color: '#f6d36b', cooking: 'Grilled Skewers' },
  // Pizza toppings: only appear once the pizza shop is open (level 10).
  { id: 'g-tomato', name: 'Tomatoes', kind: 'topping', emoji: '🍅', growMin: 30, seedPrice: 5, sellPrice: 5, yield: [3, 5], gardenLevel: 1, color: '#d8432f', pizza: 'tomato' },
  { id: 'g-basil', name: 'Basil', kind: 'topping', emoji: '🌿', growMin: 12, seedPrice: 3, sellPrice: 3, yield: [4, 6], gardenLevel: 1, color: '#3f9a3a', pizza: 'basil' },
  { id: 'g-pepper', name: 'Bell Peppers', kind: 'topping', emoji: '🫑', growMin: 45, seedPrice: 5, sellPrice: 5, yield: [3, 4], gardenLevel: 2, color: '#e74c3c', pizza: 'pepper' },
  { id: 'g-onion', name: 'Red Onions', kind: 'topping', emoji: '🧅', growMin: 40, seedPrice: 4, sellPrice: 4, yield: [3, 4], gardenLevel: 2, color: '#b05a9a', pizza: 'onion' },
  { id: 'g-mushroom', name: 'Mushrooms', kind: 'topping', emoji: '🍄', growMin: 75, seedPrice: 8, sellPrice: 8, yield: [3, 5], gardenLevel: 4, color: '#b89878', pizza: 'mushroom' },
  { id: 'g-pineapple', name: 'Pineapple', kind: 'topping', emoji: '🍍', growMin: 150, seedPrice: 12, sellPrice: 12, yield: [2, 4], gardenLevel: 5, color: '#ffd23f', pizza: 'pineapple' },
];

// ------------------------------------------------------------------ special plants
// Six meaningful plants. Each first bloom sets the flag `garden-bloom:<id>`; in the Author tool you can make a
// letter, photo or memory appear when a plant blooms, and write a short scene that plays right then.
// Mystery seeds always grow the next special plant she hasn't seen yet, so all six appear in this order.

export interface SpecialDef extends PlantDef {
  kind: 'special';
  /** Shown before it first blooms. */
  hint: string;
  /** What the partner says when it blooms (used when no scene was written in the Author tool). */
  line: string;
  /** Bonus reward on the first bloom. */
  reward: { coins?: number; decor?: string; cosmetic?: string[] };
}

export const SPECIALS: SpecialDef[] = [
  { id: 'sp-moonpetal', name: 'Moonpetal', kind: 'special', emoji: '🌙', growMin: 60, seedPrice: 0, sellPrice: 40, yield: [1, 1], gardenLevel: 1, color: '#cfd6ff',
    hint: 'It only opens when it feels safe… like someone’s watching over it.', line: 'It glows a little, like the night we stayed up talking ♡', reward: { coins: 40 } },
  { id: 'sp-starbloom', name: 'Starbloom', kind: 'special', emoji: '⭐', growMin: 90, seedPrice: 0, sellPrice: 45, yield: [1, 1], gardenLevel: 1, color: '#ffe27a',
    hint: 'Its bud is shaped like a tiny wish.', line: 'Make a wish on it with me?', reward: { decor: 'lights-stars' } },
  { id: 'sp-heartvine', name: 'Heartvine', kind: 'special', emoji: '💗', growMin: 120, seedPrice: 0, sellPrice: 50, yield: [1, 1], gardenLevel: 1, color: '#ff8fb1',
    hint: 'Two vines, slowly winding around each other.', line: 'Look, the two vines grew into one heart.', reward: { cosmetic: ['outfit-garden-dress', 'his-outfit-garden'] } },
  { id: 'sp-sunkiss', name: 'Sunkiss Lily', kind: 'special', emoji: '🌞', growMin: 150, seedPrice: 0, sellPrice: 55, yield: [1, 1], gardenLevel: 1, color: '#ffb35c',
    hint: 'It turns to follow you, like a sunflower follows the sun.', line: 'It keeps turning toward you. Same, honestly.', reward: { decor: 'bench-swing' } },
  { id: 'sp-promise', name: 'Promise Rose', kind: 'special', emoji: '🌹', growMin: 180, seedPrice: 0, sellPrice: 60, yield: [1, 1], gardenLevel: 1, color: '#c8324a',
    hint: 'A rose that only blooms for a promise that’s kept.', line: 'I promise I’ll keep growing things with you.', reward: { cosmetic: ['accent-flower-crown'] } },
  { id: 'sp-forever', name: 'Forever Orchid', kind: 'special', emoji: '🌺', growMin: 240, seedPrice: 0, sellPrice: 80, yield: [1, 1], gardenLevel: 1, color: '#b56fc2',
    hint: 'The rarest flower in town. They say it lasts forever.', line: 'Some things are worth waiting for. Like you.', reward: { decor: 'arch-roses', coins: 120 } },
];

export const ALL_PLANTS: PlantDef[] = [...PLANTS, ...SPECIALS];
export const plantDef = (id: string): PlantDef | undefined => ALL_PLANTS.find((p) => p.id === id);
export const bloomFlag = (id: string) => `garden-bloom:${id}`;

// ------------------------------------------------------------------ plots, levels, seeds

export const START_PLOTS = 4;
export const MAX_PLOTS = 12;
/** Price of the 5th, 6th… plot. */
export const PLOT_PRICES = [40, 60, 85, 110, 140, 180, 230, 290];
/** Garden XP for each level (index = level - 1). Keeps going after the list. */
export const GARDEN_LEVELS = [0, 40, 110, 220, 380, 600, 900, 1300, 1800, 2400];
/** Garden levels that give a mystery seed. */
export const SEED_LEVELS = [2, 4, 6, 8];
/** A mystery seed every N different days she visits the garden. */
export const SEED_EVERY_DAYS = 3;
/** Chance of finding a mystery seed when harvesting a normal plant. */
export const SEED_DROP_CHANCE = 0.04;
/** A mystery seed from him after every N bouquets she gives him. */
export const SEED_EVERY_BOUQUETS = 3;
/** Watering makes a plant grow this much faster from then on (once per planting). */
export const WATER_BOOST = 0.35;
export const START_SEEDS: Record<string, number> = { daisy: 3, tulip: 2, strawberry: 2 };
export const UNLOCK_LEVEL = 5;
/** Pizza pantry tier for garden-grown toppings (Premium). */
export const GARDEN_TIER = 3;

export const BOUQUET = { min: 3, max: 7 };
export const WRAPS: { id: string; name: string; color: string }[] = [
  { id: 'kraft', name: 'Kraft paper', color: '#d8b98a' },
  { id: 'blush', name: 'Blush tissue', color: '#ffd6e2' },
  { id: 'cream', name: 'Cream lace', color: '#fff4e0' },
  { id: 'lilac', name: 'Lilac ribbon', color: '#dccdf2' },
  { id: 'night', name: 'Midnight', color: '#2f3a66' },
];

// ------------------------------------------------------------------ decor

export type GardenDecorSlot = 'fence' | 'path' | 'bench' | 'lights' | 'ornament';
export interface GardenDecorDef { id: string; slot: GardenDecorSlot; name: string; price: number; swatch: string; emoji: string;
  /** Only given by a special plant, never sold. */ special?: boolean }
export const GARDEN_DECOR_SLOTS: { slot: GardenDecorSlot; label: string; icon: string }[] = [
  { slot: 'fence', label: 'Fence', icon: '🪵' },
  { slot: 'path', label: 'Path', icon: '🪨' },
  { slot: 'bench', label: 'Seat', icon: '🪑' },
  { slot: 'lights', label: 'Lights', icon: '💡' },
  { slot: 'ornament', label: 'Ornament', icon: '🍄' },
];
export const GARDEN_DECOR: GardenDecorDef[] = [
  { id: 'fence-wood', slot: 'fence', name: 'Wooden fence', price: 0, swatch: '#b07a4a', emoji: '🪵' },
  { id: 'fence-white', slot: 'fence', name: 'White picket', price: 50, swatch: '#ffffff', emoji: '🤍' },
  { id: 'fence-hedge', slot: 'fence', name: 'Little hedge', price: 90, swatch: '#4f8a3a', emoji: '🌳' },
  { id: 'fence-pink', slot: 'fence', name: 'Pink picket', price: 120, swatch: '#ffb3c8', emoji: '🩷' },
  { id: 'path-dirt', slot: 'path', name: 'Dirt path', price: 0, swatch: '#a07850', emoji: '🟫' },
  { id: 'path-stones', slot: 'path', name: 'Stepping stones', price: 60, swatch: '#b9b4ad', emoji: '🪨' },
  { id: 'path-bricks', slot: 'path', name: 'Brick path', price: 100, swatch: '#c9785a', emoji: '🧱' },
  { id: 'path-petals', slot: 'path', name: 'Petal path', price: 150, swatch: '#ffd6e2', emoji: '🌸' },
  { id: 'bench-none', slot: 'bench', name: 'No seat', price: 0, swatch: '#e8e0d4', emoji: '▫️' },
  { id: 'bench-wood', slot: 'bench', name: 'Garden bench', price: 70, swatch: '#8a5a3a', emoji: '🪑' },
  { id: 'bench-picnic', slot: 'bench', name: 'Picnic blanket', price: 90, swatch: 'repeating-conic-gradient(#e8577d 0 25%,#fff 0 50%) 0 0/16px 16px', emoji: '🧺' },
  { id: 'bench-swing', slot: 'bench', name: 'Sunkiss swing seat', price: 0, swatch: '#ffb35c', emoji: '🌞', special: true },
  { id: 'lights-none', slot: 'lights', name: 'No lights', price: 0, swatch: '#e8e0d4', emoji: '▫️' },
  { id: 'lights-fairy', slot: 'lights', name: 'Fairy lights', price: 80, swatch: 'radial-gradient(circle,#ffd36b 3px,transparent 4px) 0 0/14px 14px,#3b2b2e', emoji: '✨' },
  { id: 'lights-lanterns', slot: 'lights', name: 'Paper lanterns', price: 120, swatch: 'radial-gradient(circle,#ff8fb1 6px,transparent 7px) 0 0/20px 20px,#fff4e8', emoji: '🏮' },
  { id: 'lights-stars', slot: 'lights', name: 'Starbloom lights', price: 0, swatch: 'radial-gradient(circle,#ffe27a 2px,transparent 3px) 0 0/12px 12px,#2b2d5a', emoji: '⭐', special: true },
  { id: 'ornament-none', slot: 'ornament', name: 'Nothing', price: 0, swatch: '#e8e0d4', emoji: '▫️' },
  { id: 'ornament-gnome', slot: 'ornament', name: 'Garden gnome', price: 40, swatch: '#d8432f', emoji: '🧙' },
  { id: 'ornament-birdbath', slot: 'ornament', name: 'Bird bath', price: 80, swatch: '#9ad0f5', emoji: '🐦' },
  { id: 'ornament-cat', slot: 'ornament', name: 'Sleepy cat statue', price: 100, swatch: '#f3e3c6', emoji: '🐈' },
  { id: 'arch-roses', slot: 'ornament', name: 'Forever rose arch', price: 0, swatch: '#c8324a', emoji: '💐', special: true },
];
export const GARDEN_DECOR_DEFAULT: Record<GardenDecorSlot, string> = {
  fence: 'fence-wood', path: 'path-dirt', bench: 'bench-none', lights: 'lights-none', ornament: 'ornament-none',
};

/** What the partner says in the garden. {her} = the player. */
export const GARDEN_LINES: Record<string, string[]> = {
  hello: ['Our garden ♡', 'Hi, gardener!', 'I watered the path. …That’s not how it works, is it.', 'Welcome back! Things grew while you were gone.'],
  plant: ['Grow big, little seed ♡', 'I’ll guard this one.', 'Good spot!', 'Can’t wait to see it bloom.'],
  water: ['Splash! There you go ♡', 'Drink up, little guy.', 'I’ll carry the watering can next time.'],
  harvest: ['Look at that!', 'We grew that. Together ♡', 'Fresh from our garden!', 'Ooh, that’s a good one.'],
  ready: ['Something’s ready to pick!', 'Psst, the garden has a surprise.'],
  seed: ['A mystery seed?! What do you think it is?', 'This one feels special…'],
  sell: ['Sold! You’re a natural.', 'Our stall is famous now ♡'],
  bouquet: ['That’s gorgeous. You have such good taste.', 'Is that… for me?', 'Prettiest bouquet in town.'],
  gift: ['For me?! I’m keeping these forever ♡', 'I’m going to put these right by the window.', 'You always know how to make me smile.'],
  photo: ['Say cheese! …Or say flowers.', 'Saved to your phone ♡'],
  decor: ['It looks so cozy now.', 'Our garden is getting so cute ♡'],
  plot: ['More room to grow!', 'I’ll dig, you plant ♡'],
  idle: ['I love it out here with you.', 'Smells like spring.', 'Should we name the gnome?'],
};

// Pets: breeds, personalities, foods, gifts. Plain data, edit freely.
// All pets are drawn in code (see draw.ts) in the game's own chibi style.

import type { LocationId } from '../content/types';

export type Species = 'cat' | 'dog';
export type Pattern = 'solid' | 'tabby' | 'calico' | 'tuxedo' | 'points' | 'spots';
export type Ears = 'pointy' | 'floppy' | 'round';
export type Tail = 'long' | 'curl' | 'fluffy' | 'stub';

export interface BreedDef {
  id: string;
  species: Species;
  name: string;
  /** Main coat, second colour (patches / points / stripes), belly & muzzle, inner ear, eye colour. */
  coat: number; patch: number; belly: number; ear: number; eye: number;
  pattern: Pattern;
  ears: Ears;
  tail: Tail;
  /** Drawing scale (1 = a normal cat). */
  size: number;
  /** Fluffy fur outline. */
  fluffy?: boolean;
  /** Heart tokens at the pet shop (0 = only as a stray). */
  price: number;
  /** Pet-shop level / player level needed. */
  level: number;
}

export const BREEDS: BreedDef[] = [
  // Cats
  { id: 'cat-orange', species: 'cat', name: 'Orange Tabby', coat: 0xf6a45a, patch: 0xd9803a, belly: 0xfff1de, ear: 0xffb8a8, eye: 0x7ab648, pattern: 'tabby', ears: 'pointy', tail: 'long', size: 1, price: 0, level: 3 },
  { id: 'cat-calico', species: 'cat', name: 'Calico', coat: 0xfffaf2, patch: 0xe58a3c, belly: 0xffffff, ear: 0xffb8c4, eye: 0xd9a330, pattern: 'calico', ears: 'pointy', tail: 'long', size: 0.95, price: 120, level: 4 },
  { id: 'cat-black', species: 'cat', name: 'Midnight Black', coat: 0x2b2630, patch: 0x3a3442, belly: 0x3a3442, ear: 0x8a5a6a, eye: 0xf2c43a, pattern: 'solid', ears: 'pointy', tail: 'long', size: 0.95, price: 110, level: 4 },
  { id: 'cat-tuxedo', species: 'cat', name: 'Tuxedo', coat: 0x3a3440, patch: 0xffffff, belly: 0xffffff, ear: 0xffb8c4, eye: 0x7ab648, pattern: 'tuxedo', ears: 'pointy', tail: 'long', size: 1, price: 130, level: 4 },
  { id: 'cat-siamese', species: 'cat', name: 'Siamese', coat: 0xf6ead6, patch: 0x5a4034, belly: 0xfff8ee, ear: 0x5a4034, eye: 0x6aa8e8, pattern: 'points', ears: 'pointy', tail: 'long', size: 0.95, price: 160, level: 5 },
  { id: 'cat-fluffy', species: 'cat', name: 'Fluffy Cloud', coat: 0xfdfcfa, patch: 0xe8e2ea, belly: 0xffffff, ear: 0xffc4d0, eye: 0x6aa8e8, pattern: 'solid', ears: 'round', tail: 'fluffy', size: 1.08, fluffy: true, price: 200, level: 6 },
  { id: 'cat-grey', species: 'cat', name: 'Grey Mochi', coat: 0xa8a6b4, patch: 0x8a8898, belly: 0xe8e6ee, ear: 0xffb8c4, eye: 0xf2c43a, pattern: 'tabby', ears: 'round', tail: 'long', size: 1.04, price: 140, level: 5 },
  // Dogs
  { id: 'dog-shiba', species: 'dog', name: 'Shiba Inu', coat: 0xe8964a, patch: 0xc87a38, belly: 0xfff4e4, ear: 0xffc4a0, eye: 0x3a2a24, pattern: 'solid', ears: 'pointy', tail: 'curl', size: 1.1, price: 180, level: 4 },
  { id: 'dog-corgi', species: 'dog', name: 'Corgi', coat: 0xf0a250, patch: 0xffffff, belly: 0xffffff, ear: 0xffc4a0, eye: 0x3a2a24, pattern: 'tuxedo', ears: 'pointy', tail: 'stub', size: 1.08, price: 200, level: 5 },
  { id: 'dog-pom', species: 'dog', name: 'Pomeranian', coat: 0xf6c27a, patch: 0xe8a858, belly: 0xfff0d8, ear: 0xffc4a0, eye: 0x3a2a24, pattern: 'solid', ears: 'pointy', tail: 'fluffy', size: 0.9, fluffy: true, price: 220, level: 5 },
  { id: 'dog-poodle', species: 'dog', name: 'Toy Poodle', coat: 0xc88a5a, patch: 0xa86a40, belly: 0xd89a6a, ear: 0xa86a40, eye: 0x2a2024, pattern: 'solid', ears: 'floppy', tail: 'fluffy', size: 0.95, fluffy: true, price: 240, level: 6 },
  { id: 'dog-golden', species: 'dog', name: 'Golden Pup', coat: 0xf4cc7a, patch: 0xe4b460, belly: 0xfff4d8, ear: 0xe4b460, eye: 0x3a2a24, pattern: 'solid', ears: 'floppy', tail: 'long', size: 1.18, price: 260, level: 7 },
  { id: 'dog-dalmatian', species: 'dog', name: 'Dalmatian Pup', coat: 0xffffff, patch: 0x2b2630, belly: 0xffffff, ear: 0x2b2630, eye: 0x3a2a24, pattern: 'spots', ears: 'floppy', tail: 'long', size: 1.12, price: 280, level: 8 },
];
export const breed = (id: string) => BREEDS.find((b) => b.id === id);

export type Personality = 'lazy' | 'playful' | 'shy' | 'greedy' | 'cuddly' | 'curious';
export const PERSONALITIES: Record<Personality, { label: string; emoji: string; desc: string;
  /** 0..1 how often they nap, wander, follow her. */ sleepy: number; wander: number; follow: number;
  /** Activity they love most. */ loves: ActivityId }> = {
  lazy: { label: 'Lazy', emoji: '😴', desc: 'Naps anywhere, anytime. Loves soft cushions.', sleepy: 0.6, wander: 0.2, follow: 0.1, loves: 'pet' },
  playful: { label: 'Playful', emoji: '⚡', desc: 'Never stops moving. Fetch is life.', sleepy: 0.1, wander: 0.8, follow: 0.4, loves: 'fetch' },
  shy: { label: 'Shy', emoji: '🙈', desc: 'Hides at first, then becomes your shadow.', sleepy: 0.3, wander: 0.3, follow: 0.15, loves: 'brush' },
  greedy: { label: 'Foodie', emoji: '🍖', desc: 'Will do anything for a treat.', sleepy: 0.3, wander: 0.4, follow: 0.5, loves: 'treat' },
  cuddly: { label: 'Cuddly', emoji: '💗', desc: 'Wants to be held. All. The. Time.', sleepy: 0.3, wander: 0.3, follow: 0.7, loves: 'pet' },
  curious: { label: 'Curious', emoji: '🔍', desc: 'Investigates every new piece of furniture.', sleepy: 0.2, wander: 0.7, follow: 0.3, loves: 'fetch' },
};

export type ActivityId = 'pet' | 'treat' | 'bath' | 'nails' | 'brush' | 'fetch';

export interface FoodDef { id: string; name: string; emoji: string; for: Species | 'both'; hunger: number; joy: number; price: number; pack: number }
export const PET_FOODS: FoodDef[] = [
  { id: 'kibble-cat', name: 'Cat Kibble', emoji: '🥣', for: 'cat', hunger: 40, joy: 4, price: 12, pack: 5 },
  { id: 'kibble-dog', name: 'Puppy Kibble', emoji: '🥣', for: 'dog', hunger: 40, joy: 4, price: 12, pack: 5 },
  { id: 'fish', name: 'Fish Treats', emoji: '🐟', for: 'cat', hunger: 20, joy: 14, price: 10, pack: 3 },
  { id: 'bone', name: 'Chew Bone', emoji: '🦴', for: 'dog', hunger: 15, joy: 16, price: 10, pack: 3 },
  { id: 'can', name: 'Gourmet Can', emoji: '🥫', for: 'both', hunger: 60, joy: 12, price: 24, pack: 2 },
  { id: 'milk', name: 'Pet Milk', emoji: '🍼', for: 'both', hunger: 15, joy: 10, price: 8, pack: 2 },
];
export const petFood = (id: string) => PET_FOODS.find((f) => f.id === id);

/** Things pets leave around the house while she's away. */
export const PET_GIFTS: { id: string; name: string; emoji: string; tokens?: number; item?: string; weight: number }[] = [
  { id: 'feather', name: 'a feather', emoji: '🪶', tokens: 3, weight: 4 },
  { id: 'leaf', name: 'a pretty leaf', emoji: '🍁', tokens: 2, weight: 4 },
  { id: 'sock', name: 'one of {him}’s socks', emoji: '🧦', tokens: 4, weight: 3 },
  { id: 'flower', name: 'a flower', emoji: '🌼', item: 'bouquet', weight: 2 },
  { id: 'coin', name: 'a shiny coin', emoji: '🪙', tokens: 10, weight: 2 },
  { id: 'ribbon', name: 'a ribbon', emoji: '🎀', tokens: 6, weight: 1 },
];

/** Where pets hang out. They move between these rooms through the day. */
export const PET_ROOMS: LocationId[] = ['bedroom', 'livingroom', 'kitchen', 'backyard'];

export const STRAY_LEVEL = 3;
/** Feedings (on separate visits, this far apart) before the stray asks to stay. */
export const STRAY_FEEDS = 3;
export const STRAY_GAP_MIN = 20;
export const MAX_PETS = 8;
/** Need points lost per real hour (never below the floor: pets get hungry, never sick). */
export const DECAY = { hunger: 9, clean: 5, nails: 3, joy: 6 };
export const NEED_FLOOR = 15;

export const CAT_NAMES = ['Mochi', 'Peach', 'Biscuit', 'Tofu', 'Nori', 'Pudding', 'Bean', 'Latte', 'Sushi', 'Boba', 'Muffin', 'Cocoa'];
export const DOG_NAMES = ['Mango', 'Waffles', 'Kuma', 'Pancake', 'Hachi', 'Butter', 'Taro', 'Cookie', 'Momo', 'Churro'];

/** What a pet "says" (thought bubbles). */
export const PET_LINES: Record<string, string[]> = {
  pet: ['💗', '😽', '♡', 'purr…'],
  petDog: ['💗', '🐾', '♡', '*wag wag*'],
  fed: ['😋', '🍽️', 'nom nom', '♡'],
  hungry: ['🍽️?', '…food?', '🥺'],
  sleepy: ['💤', 'zzz'],
  dirty: ['🫧?', '💦'],
  hello: ['!', '♡', '👋'],
};

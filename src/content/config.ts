import type { MusicMood } from './types';
import { AUTHORED } from './authored';

/*
 * General configuration.
 */

/** Default names used until she types her own on "New Story". Leave empty to ask (or set them in the Author tool). */
export const DEFAULT_NAMES = { her: AUTHORED.names.her, him: AUTHORED.names.him };

/** Title shown on the main menu. */
export const GAME_TITLE = 'Evermore';
export const GAME_SUBTITLE = 'a love story without a last page';

/**
 * Optional real music. Put files in public/assets/audio/music/ and map moods to them, e.g.
 *   cozy: 'assets/audio/music/cozy.mp3'
 * Unmapped moods use the built-in generative music.
 */
export const MUSIC_FILES: Partial<Record<MusicMood, string>> = {};

/** Generic romantic words for the chalkboard puzzle (personal words go in personal.ts → CUSTOM_WORDS). */
export const SCRAMBLE_WORDS = [
  'LOVE', 'HUG', 'KISS', 'SWEET', 'HEART', 'CUDDLE', 'FOREVER', 'DARLING', 'SUNSHINE', 'STARLIGHT',
  'TOGETHER', 'PROMISE', 'BLOSSOM', 'COZY', 'SMILE', 'DREAM', 'ROSES', 'MOONLIGHT', 'HONEY', 'ADORE',
  'CHERISH', 'SPARKLE', 'WARMTH', 'GIGGLE', 'PICNIC', 'DATE', 'TREASURE', 'BELOVED', 'ALWAYS', 'MINE',
];

/** Recipes for the cooking mini-game – just step names. */
export const RECIPES = [
  { name: 'Fluffy Pancakes', steps: ['Crack the eggs', 'Whisk the batter', 'Pour into the pan', 'Flip!', 'Add syrup', 'Serve with love'] },
  { name: 'Grilled Skewers', steps: ['Thread the skewers', 'Brush the sauce', 'Onto the grill', 'Turn them', 'Sprinkle salt', 'Plate up'] },
  { name: 'Heart Omelette', steps: ['Crack the eggs', 'Add cheese', 'Pour gently', 'Shape a heart', 'Fold it', 'Serve warm'] },
  { name: 'Midnight Cocoa', steps: ['Warm the milk', 'Stir in cocoa', 'A pinch of sugar', 'Whisk it frothy', 'Add marshmallows', 'Two mugs'] },
  { name: 'Strawberry Cake', steps: ['Mix the flour', 'Fold in eggs', 'Into the oven', 'Whip the cream', 'Add strawberries', 'Make a wish'] },
];

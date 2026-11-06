import type { Mood } from './types';

/*
 * Illustrated character art.
 *
 * Her portraits were made from the files in "gf assets/" (label pills painted out, cropped, WebP).
 * Every mood used in dialogue maps to one of her drawings. To add or swap a picture, put a file in
 * public/assets/characters/her/ and point a mood at it here.
 *
 * His portraits were made from "bf assets/" (run `npm run art:him` after adding new drawings).
 */
const HER = 'assets/characters/her/';

export const HER_PORTRAITS: Partial<Record<Mood, string>> = {
  natural: HER + 'natural.webp',
  neutral: HER + 'natural.webp',
  surprised: HER + 'natural.webp',
  idle: HER + 'idle.webp',
  sleepy: HER + 'idle.webp',
  happy: HER + 'happy.webp',
  cute: HER + 'cute.webp',
  shy: HER + 'cute.webp',
  love: HER + 'cute.webp',
  laughing: HER + 'laughing.webp',
  pouty: HER + 'pouty.webp',
  irritated: HER + 'irritated.webp',
  sad: HER + 'sad.webp',
  crying: HER + 'crying.webp',
};

/** Small round face used in the HUD. */
export const HER_AVATAR = HER + 'natural-avatar.webp';

/** His portraits, made from "bf assets/" the same way. */
const HIM = 'assets/characters/him/';
export const HIS_PORTRAITS: Partial<Record<Mood, string>> = {
  natural: HIM + 'natural.webp',
  neutral: HIM + 'natural.webp',
  surprised: HIM + 'natural.webp',
  idle: HIM + 'idle.webp',
  sleepy: HIM + 'idle.webp',
  happy: HIM + 'happy.webp',
  laughing: HIM + 'laughing.webp',
  cute: HIM + 'cute.webp',
  shy: HIM + 'cute.webp',
  love: HIM + 'cute.webp',
  pouty: HIM + 'pouty.webp',
  irritated: HIM + 'irritated.webp',
  sad: HIM + 'sad.webp',
  crying: HIM + 'crying.webp',
};
export const HIS_AVATAR = HIM + 'natural-avatar.webp';

/** How the drawn chibi (used for him, and in-world) shows the extra moods. */
export const CHIBI_MOOD: Record<Mood, 'neutral' | 'happy' | 'shy' | 'surprised' | 'love' | 'sleepy' | 'sad'> = {
  neutral: 'neutral', natural: 'neutral', idle: 'neutral', happy: 'happy', laughing: 'happy',
  shy: 'shy', cute: 'shy', pouty: 'shy', irritated: 'neutral', surprised: 'surprised',
  love: 'love', sleepy: 'sleepy', sad: 'sad', crying: 'sad',
};

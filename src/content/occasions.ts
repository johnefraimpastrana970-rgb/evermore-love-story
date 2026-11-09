import type { OccasionDef } from './types';
import { AUTHORED, mergeGreetings, mergeOccasions } from './authored';

/*
 * Occasions change decorations, tint, music, greetings and quests while active.
 * Public holidays are enabled. PERSONAL dates are templates: they stay DISABLED until you
 * fill in the real date and set enabled: true. Nothing here guesses your dates.
 *
 * Rule types:
 *   { type: 'yearly', month: 2, day: 14, durationDays?: 1, leadDays?: 0 }
 *   { type: 'monthly', day: 14 }                (e.g. monthsary)
 *   { type: 'fixed', date: '2027-06-01' }        (one-off)
 *   { type: 'range', start: '12-20', end: '01-01' }  (wraps the year)
 *   { type: 'nthWeekday', month: 5, weekday: 0, nth: 2 } (2nd Sunday of May; nth -1 = last)
 *   { type: 'manual' }                           (no automatic calendar date)
 */
export const OCCASION_TEMPLATES: OccasionDef[] = [
  // ---- Personal templates (fill these in!) --------------------------------
  {
    id: 'anniversary', name: '⟦Our Anniversary⟧', enabled: false, priority: 100, placeholder: true,
    rule: { type: 'yearly', month: 1, day: 1, durationDays: 1 },
    theme: { tint: 0xffd0e0, decorations: ['hearts', 'lights', 'petals'], music: 'festive', banner: 'Happy Anniversary' },
    greeting: 'occ-anniversary', questId: 'occ-generic', surpriseId: 'surprise-anniversary', bonusXp: 500,
  },
  {
    id: 'her-birthday', name: '⟦Her Birthday⟧', enabled: false, priority: 110, placeholder: true, literal: true,
    rule: { type: 'yearly', month: 1, day: 1, durationDays: 1 },
    theme: { tint: 0xfff0c8, decorations: ['balloons', 'confetti', 'lights'], music: 'festive', banner: 'Happy Birthday, {her}!' },
    greeting: 'occ-birthday', questId: 'occ-generic', surpriseId: 'surprise-birthday', bonusXp: 500,
  },
  {
    id: 'his-birthday', name: '⟦His Birthday⟧', enabled: false, priority: 105, placeholder: true, literal: true,
    rule: { type: 'yearly', month: 1, day: 1, durationDays: 1 },
    theme: { tint: 0xd8e8ff, decorations: ['balloons', 'confetti'], music: 'festive', banner: 'It’s {him}’s birthday!' },
    greeting: 'occ-his-birthday', questId: 'occ-generic', bonusXp: 300,
  },
  {
    id: 'monthsary', name: '⟦Monthsary⟧', enabled: false, priority: 60, placeholder: true,
    rule: { type: 'monthly', day: 1 },
    theme: { tint: 0xffe0ea, decorations: ['hearts', 'petals'], banner: 'Happy Monthsary' },
    greeting: 'occ-monthsary', bonusXp: 150,
  },
  // ---- Public occasions --------------------------------------------------
  {
    id: 'valentines', name: 'Valentine’s Day', enabled: true, priority: 80,
    rule: { type: 'yearly', month: 2, day: 14, durationDays: 1 },
    theme: { tint: 0xffc8d8, decorations: ['hearts', 'petals', 'lights'], music: 'festive', banner: 'Happy Valentine’s Day' },
    greeting: 'occ-valentines', questId: 'occ-generic', surpriseId: 'surprise-valentines', bonusXp: 300,
  },
  {
    id: 'christmas', name: 'Christmas Season', enabled: true, priority: 50,
    rule: { type: 'range', start: '12-16', end: '12-26' },
    theme: { tint: 0xd8ecff, decorations: ['snow', 'lights'], music: 'festive', banner: 'Merry Christmas' },
    greeting: 'occ-christmas', questId: 'occ-generic', bonusXp: 200,
  },
  {
    id: 'newyear', name: 'New Year', enabled: true, priority: 70,
    rule: { type: 'range', start: '12-31', end: '01-01' },
    theme: { tint: 0xfff2d0, decorations: ['confetti', 'lights'], music: 'festive', banner: 'Happy New Year' },
    greeting: 'occ-newyear', questId: 'occ-generic', bonusXp: 200,
  },
  {
    id: 'halloween', name: 'Halloween', enabled: true, priority: 40,
    rule: { type: 'yearly', month: 10, day: 31, durationDays: 1 },
    theme: { tint: 0xffd6b0, decorations: ['pumpkins', 'lights'], banner: 'Happy Halloween' },
    greeting: 'occ-halloween', bonusXp: 100,
  },
  {
    id: 'just-because', name: 'Just Because', enabled: true, priority: 10,
    rule: { type: 'manual' },
    theme: { tint: 0xffe6f0, decorations: ['hearts', 'balloons'], music: 'festive', banner: 'Just because I love you' },
    greeting: 'occ-just-because', questId: 'occ-generic', bonusXp: 100,
  },
];

/** What the game uses: the templates, with special days set in the Author tool switched on. */
export const OCCASIONS: OccasionDef[] = mergeOccasions(OCCASION_TEMPLATES, AUTHORED);

/** Greetings shown once per occasion day. Edit the text — personal ones are placeholders. */
const DIALOGUE_TEMPLATES: Record<string, { speaker: 'her' | 'him' | 'narrator'; text: string }[]> = {
  'occ-anniversary': [{ speaker: 'him', text: '⟦Write your anniversary message here.⟧' }],
  'occ-birthday': [{ speaker: 'him', text: '⟦Write her birthday message here.⟧' }],
  'occ-his-birthday': [{ speaker: 'her', text: '⟦A birthday line for him.⟧' }],
  'occ-monthsary': [{ speaker: 'him', text: '⟦Write a monthsary message here.⟧' }],
  'occ-valentines': [
    { speaker: 'narrator', text: 'Pink and red hearts float through every room today.' },
    { speaker: 'him', text: 'Happy Valentine’s Day, {her}. Will you be mine? Again? Every year?' },
  ],
  'occ-christmas': [
    { speaker: 'narrator', text: 'Snow drifts past the windows and fairy lights twinkle everywhere.' },
    { speaker: 'him', text: 'Merry Christmas, {her}. You’re my favorite present.' },
  ],
  'occ-newyear': [{ speaker: 'him', text: 'New year, same us. I wouldn’t change a thing.' }],
  'occ-halloween': [{ speaker: 'him', text: 'Boo! …Did I scare you? No? Okay, you scare me with how cute you are.' }],
  'occ-just-because': [{ speaker: 'him', text: 'No special reason today. Just wanted to celebrate you.' }],
};
export const OCCASION_DIALOGUE = mergeGreetings(OCCASION_TEMPLATES, DIALOGUE_TEMPLATES, AUTHORED);

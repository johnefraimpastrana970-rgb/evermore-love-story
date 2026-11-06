import type { LocationId, ObjectiveDef, QuestDef, TimeOfDay } from '../content/types';
import { defaultPhone, PhoneState } from '../phone/types';
import { defaultPizza, repairPizza, UNLOCK_LEVEL as PIZZA_UNLOCK, type PizzaState } from '../pizza/logic';
import { defaultGarden, repairGarden, type GardenState } from '../garden/logic';
import { defaultWork, repairWork, type WorkState } from '../work/logic';
import { defaultPets, repairPets, type PetsState } from '../pets/logic';

export const SAVE_VERSION = 10;

/** His real look (from his character art) + the older defaults. */
export const HIS_DEFAULT_OWNED = ['his-hair-black', 'his-outfit-raglan', 'his-hair-ink', 'his-outfit-navy'];

/** Her real look (from her character art) + the older default looks. */
export const HER_DEFAULT_OWNED = ['hair-espresso', 'outfit-cat-tee', 'accent-ribbon-sakura', 'hair-cocoa', 'outfit-rose', 'accent-ribbon-red'];

export interface QuestProgress {
  progress: number[];
  startedAt: number;
}

export interface Settings {
  master: number;
  music: number;
  ambience: number;
  sfx: number;
  textSpeed: number; // chars per second, 0 = instant
  reducedMotion: boolean;
  timeMode: 'real' | 'manual';
  manualTime: TimeOfDay;
  companionMode: 'follow' | 'stay' | 'hidden';
  /** ISO date to pretend "today" is (preview occasions). Empty = real date. */
  debugDate: string;
  /** Occasion ids forced on. */
  manualOccasions: string[];
  showHints: boolean;
}

export interface GameState {
  version: number;
  createdAt: number;
  updatedAt: number;
  playSeconds: number;
  /** playAs: which of the two the player walks around as. The other one is the companion. */
  profile: { herName: string; hisName: string; playAs: 'her' | 'him' };
  level: number;
  xp: number;
  totalXp: number;
  tokens: number;
  affection: number;
  location: LocationId;
  x: number;
  y: number;
  inventory: Record<string, number>;
  flags: Record<string, boolean>;
  stats: Record<string, number>;
  visited: Partial<Record<LocationId, number>>;
  quests: {
    active: Record<string, QuestProgress>;
    completed: Record<string, number>;
    /** Definitions for generated (daily / weekly) quests. */
    generated: Record<string, QuestDef>;
    dailyKey: string;
    weeklyKey: string;
    tracked: string | null;
  };
  achievements: Record<string, number>;
  secrets: Record<string, number>;
  /** Personal entries seen/unlocked: id -> timestamp. */
  unlocked: Record<string, number>;
  /** Personal entries she has read. */
  read: Record<string, number>;
  challengesDone: Record<string, number>;
  collected: { key: string; ids: string[] };
  cosmetics: {
    owned: string[];
    equipped: { herHair: string; herOutfit: string; herAccent: string; hisHair: string; hisOutfit: string };
  };
  daily: { lastDay: string; streak: number; bestStreak: number; days: number };
  occasionsSeen: Record<string, string>; // occasion id -> last day greeted
  hugKey: string;
  minigameBest: Record<string, number>;
  /** The in-game smartphone (messages, notes, reminders…). */
  phone: PhoneState;
  /** The pizza shop (unlocks at level 10). */
  pizza: PizzaState;
  /** The backyard garden (unlocks at level 5). Shares the pizza coins. */
  garden: GardenState;
  /** His job: the bento she packed, shifts today, and whether he's away or waiting at the door. */
  work: WorkState;
  /** Cats and dogs living with them, their food, the visiting stray, gifts they left. */
  pets: PetsState;
}

export function defaultSettings(): Settings {
  return {
    master: 0.8,
    music: 0.6,
    ambience: 0.5,
    sfx: 0.8,
    textSpeed: 45,
    reducedMotion: false,
    timeMode: 'real',
    manualTime: 'day',
    companionMode: 'follow',
    debugDate: '',
    manualOccasions: [],
    showHints: true,
  };
}

export function defaultState(herName = '', hisName = '', playAs: 'her' | 'him' = 'her'): GameState {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    playSeconds: 0,
    profile: { herName, hisName, playAs },
    level: 1,
    xp: 0,
    totalXp: 0,
    tokens: 0,
    affection: 0,
    location: 'bedroom',
    x: 520,
    y: 600,
    inventory: {},
    flags: {},
    stats: {},
    visited: {},
    quests: { active: {}, completed: {}, generated: {}, dailyKey: '', weeklyKey: '', tracked: null },
    achievements: {},
    secrets: {},
    unlocked: {},
    read: {},
    challengesDone: {},
    collected: { key: '', ids: [] },
    cosmetics: {
      owned: [...HER_DEFAULT_OWNED, ...HIS_DEFAULT_OWNED],
      equipped: {
        herHair: 'hair-espresso',
        herOutfit: 'outfit-cat-tee',
        herAccent: 'accent-ribbon-sakura',
        hisHair: 'his-hair-black',
        hisOutfit: 'his-outfit-raglan',
      },
    },
    daily: { lastDay: '', streak: 0, bestStreak: 0, days: 0 },
    occasionsSeen: {},
    hugKey: '',
    minigameBest: {},
    phone: defaultPhone(),
    pizza: defaultPizza(),
    garden: defaultGarden(),
    work: defaultWork(),
    pets: defaultPets(),
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Deep-merge saved data over defaults so older saves gain new fields. */
function mergeDefaults<T>(def: T, saved: unknown): T {
  if (!isObj(def) || !isObj(saved)) return (saved === undefined ? def : (saved as T));
  const out: Record<string, unknown> = { ...(def as Record<string, unknown>) };
  for (const [k, v] of Object.entries(saved)) {
    const d = (def as Record<string, unknown>)[k];
    // Records keyed by ids (inventory, flags...) have empty defaults: take saved as-is.
    out[k] = isObj(d) && Object.keys(d).length > 0 ? mergeDefaults(d, v) : v;
  }
  return out as T;
}

export function migrate(raw: unknown): GameState {
  if (!isObj(raw)) throw new Error('Save data is not an object');
  const s = mergeDefaults(defaultState(), raw);
  // v1 -> v2: "hearts" field renamed to tokens.
  const legacy = raw as { hearts?: number };
  if ((raw.version as number | undefined ?? 1) < 2 && typeof legacy.hearts === 'number') {
    s.tokens = legacy.hearts;
  }
  // v2 -> v3: her character art arrived. Give her real look and wear it unless she already changed outfits.
  if ((raw.version as number | undefined ?? 1) < 3) {
    for (const id of HER_DEFAULT_OWNED) if (!s.cosmetics.owned.includes(id)) s.cosmetics.owned.push(id);
    const eq = s.cosmetics.equipped;
    if (eq.herHair === 'hair-cocoa') eq.herHair = 'hair-espresso';
    if (eq.herOutfit === 'outfit-rose') eq.herOutfit = 'outfit-cat-tee';
    if (eq.herAccent === 'accent-ribbon-red') eq.herAccent = 'accent-ribbon-sakura';
  }
  // v3 -> v4: his character art arrived. Same idea: give him his real look unless it was changed.
  if ((raw.version as number | undefined ?? 1) < 4) {
    for (const id of HIS_DEFAULT_OWNED) if (!s.cosmetics.owned.includes(id)) s.cosmetics.owned.push(id);
    const eq = s.cosmetics.equipped;
    if (eq.hisHair === 'his-hair-ink') eq.hisHair = 'his-hair-black';
    if (eq.hisOutfit === 'his-outfit-navy') eq.hisOutfit = 'his-outfit-raglan';
  }
  s.version = SAVE_VERSION;
  // v4 -> v5: the phone arrived. mergeDefaults already added an empty phone; make sure its lists are lists.
  for (const k of ['messages', 'contacts', 'notes', 'reminders', 'history'] as const) if (!Array.isArray(s.phone[k])) s.phone[k] = [];
  // v5 -> v6: the pizza shop. Make sure records are records.
  if (!isObj(s.pizza.stock)) s.pizza.stock = {};
  if (!Array.isArray(s.pizza.menu)) s.pizza.menu = [];
  if (!isObj(s.pizza.regulars)) s.pizza.regulars = {};
  if (s.level >= PIZZA_UNLOCK) s.pizza.unlocked = true;
  // v6 -> v7: pizza of the day, shop decor and a saved shop session.
  repairPizza(s.pizza);
  // v7 -> v8: the garden. The unlock scene (and starter seeds) plays in the game, not here.
  repairGarden(s.garden);
  // v8 -> v9: his job (bento, shifts).
  repairWork(s.work);
  // v9 -> v10: pets.
  repairPets(s.pets);
  if (s.profile.playAs !== 'him') s.profile.playAs = 'her'; // older saves: she was always the player
  if (!Number.isFinite(s.level) || s.level < 1) s.level = 1;
  if (!Number.isFinite(s.xp) || s.xp < 0) s.xp = 0;
  return s;
}

export type { ObjectiveDef };

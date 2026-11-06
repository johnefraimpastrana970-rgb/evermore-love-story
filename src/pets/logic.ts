import {
  BREEDS, DECAY, MAX_PETS, NEED_FLOOR, PERSONALITIES, PET_FOODS, PET_GIFTS, PET_ROOMS, STRAY_FEEDS, STRAY_GAP_MIN, STRAY_LEVEL,
  breed, petFood, type ActivityId, type Personality, type Species,
} from './data';
import type { LocationId } from '../content/types';

/*
 * Pet rules as pure functions over the saved state (tests move the clock). Needs fall slowly in real time,
 * also while the game is closed, but never below a floor: pets get hungry or scruffy, never sick or gone.
 */

export interface Needs { hunger: number; joy: number; clean: number; nails: number }
export interface Pet {
  id: string;
  breed: string;
  name: string;
  personality: Personality;
  adoptedAt: number;
  needs: Needs;
  /** When needs were last brought up to date. */
  updatedAt: number;
  /** Friendship points (hearts = bondLevel). */
  bond: number;
  /** Last time each activity was done (cooldowns). */
  last: Partial<Record<ActivityId | 'feed', number>>;
}
export interface Stray { breed: string; personality: Personality; feeds: number; lastFeed: number; arrivedAt: number }
export interface PetGift { id: string; gift: string; room: LocationId; x: number; at: number; from: string }
export interface PetPhoto { id: string; at: number; pets: { breed: string; name: string; pose: string }[]; room: LocationId }
export interface PetsState {
  list: Pet[];
  /** Pet food in the cupboard: food id -> count. */
  food: Record<string, number>;
  stray: Stray | null;
  /** The first stray already found a home here. */
  strayDone: boolean;
  gifts: PetGift[];
  photos: PetPhoto[];
  /** Last time gifts were rolled. */
  giftCheck: number;
}

export const PHOTO_MAX = 60;
const GIFT_MAX = 5;
const GIFT_EVERY = 40 * 60_000;

let seq = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

export function defaultPets(): PetsState {
  return { list: [], food: {}, stray: null, strayDone: false, gifts: [], photos: [], giftCheck: 0 };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const clamp = (n: number, lo = NEED_FLOOR, hi = 100) => Math.max(lo, Math.min(hi, n));
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const isPersonality = (v: unknown): v is Personality => typeof v === 'string' && v in PERSONALITIES;

function cleanPet(v: unknown): Pet | null {
  if (!isObj(v) || typeof v.id !== 'string' || typeof v.breed !== 'string' || !breed(v.breed)) return null;
  const n = isObj(v.needs) ? v.needs : {};
  return {
    id: v.id, breed: v.breed, name: typeof v.name === 'string' && v.name.trim() ? v.name.slice(0, 16) : 'Mochi',
    personality: isPersonality(v.personality) ? v.personality : 'cuddly',
    adoptedAt: num(v.adoptedAt, 0), updatedAt: num(v.updatedAt, 0), bond: Math.max(0, num(v.bond, 0)),
    needs: { hunger: clamp(num(n.hunger, 70)), joy: clamp(num(n.joy, 70)), clean: clamp(num(n.clean, 80)), nails: clamp(num(n.nails, 80)) },
    last: isObj(v.last) ? Object.fromEntries(Object.entries(v.last).filter(([, t]) => typeof t === 'number')) as Pet['last'] : {},
  };
}

/** Make an older or damaged save safe to use. */
export function repairPets(s: PetsState) {
  const seen = new Set<string>();
  s.list = (Array.isArray(s.list) ? s.list : []).map(cleanPet).filter((p): p is Pet => !!p && !seen.has(p.id) && !!seen.add(p.id)).slice(0, MAX_PETS);
  const food: Record<string, number> = {};
  if (isObj(s.food)) for (const [k, n] of Object.entries(s.food)) if (petFood(k) && typeof n === 'number' && n > 0) food[k] = Math.floor(n);
  s.food = food;
  const st = s.stray as unknown;
  s.stray = isObj(st) && typeof st.breed === 'string' && breed(st.breed) ? {
    breed: st.breed, personality: isPersonality(st.personality) ? st.personality : 'shy',
    feeds: Math.max(0, Math.floor(num(st.feeds, 0))), lastFeed: num(st.lastFeed, 0), arrivedAt: num(st.arrivedAt, 0),
  } : null;
  s.strayDone = s.strayDone === true;
  s.gifts = (Array.isArray(s.gifts) ? s.gifts : []).filter((g) => isObj(g) && PET_GIFTS.some((x) => x.id === g.gift) && PET_ROOMS.includes(g.room as LocationId)).slice(0, GIFT_MAX);
  s.photos = (Array.isArray(s.photos) ? s.photos : []).filter((p) => isObj(p) && Array.isArray(p.pets)).slice(-PHOTO_MAX);
  s.giftCheck = num(s.giftCheck, 0);
}

// ------------------------------------------------------------------ needs

/** Bring a pet's needs up to `now` (slow decay; never below the floor; a clock set back changes nothing). */
export function tick(p: Pet, now: number) {
  const hours = Math.max(0, now - p.updatedAt) / 3_600_000;
  if (p.updatedAt && hours > 0) {
    p.needs.hunger = clamp(p.needs.hunger - DECAY.hunger * hours);
    p.needs.clean = clamp(p.needs.clean - DECAY.clean * hours);
    p.needs.nails = clamp(p.needs.nails - DECAY.nails * hours);
    // Joy drifts down faster when hungry or scruffy.
    const sad = (p.needs.hunger < 40 ? 1.5 : 1) * (p.needs.clean < 35 ? 1.3 : 1);
    p.needs.joy = clamp(p.needs.joy - DECAY.joy * sad * hours);
  }
  p.updatedAt = Math.max(p.updatedAt, now);
}
export const tickAll = (s: PetsState, now: number) => s.list.forEach((p) => tick(p, now));

export type Mood = 'happy' | 'content' | 'hungry' | 'dirty' | 'scratchy' | 'bored';
export function mood(p: Pet): Mood {
  const n = p.needs;
  if (n.hunger < 35) return 'hungry';
  if (n.clean < 30) return 'dirty';
  if (n.nails < 25) return 'scratchy';
  if (n.joy < 35) return 'bored';
  return n.joy > 70 && n.hunger > 60 ? 'happy' : 'content';
}
export const MOOD_LABEL: Record<Mood, string> = {
  happy: 'Very happy ♡', content: 'Content', hungry: 'Hungry', dirty: 'Needs a bath', scratchy: 'Nails are long', bored: 'Wants to play',
};

/** 0–5 hearts. */
export const bondLevel = (bond: number) => Math.min(5, Math.floor(Math.sqrt(bond / 12)));

// ------------------------------------------------------------------ care

export const speciesOf = (p: Pet): Species => breed(p.breed)!.species;
export const canEat = (foodId: string, sp: Species) => { const f = petFood(foodId); return !!f && (f.for === 'both' || f.for === sp); };

export function feed(s: PetsState, p: Pet, foodId: string, now: number): boolean {
  const f = petFood(foodId);
  if (!f || (s.food[foodId] ?? 0) <= 0 || !canEat(foodId, speciesOf(p))) return false;
  tick(p, now);
  s.food[foodId]--;
  if (!s.food[foodId]) delete s.food[foodId];
  const greedy = p.personality === 'greedy' ? 1.5 : 1;
  p.needs.hunger = clamp(p.needs.hunger + f.hunger, 0);
  p.needs.joy = clamp(p.needs.joy + f.joy * greedy, 0);
  p.bond += 3 * greedy;
  p.last.feed = now;
  return true;
}

/** Foods she has that this pet can eat. */
export const foodsFor = (s: PetsState, p: Pet) => PET_FOODS.filter((f) => (s.food[f.id] ?? 0) > 0 && canEat(f.id, speciesOf(p)));

export const PET_COOLDOWN = 8_000;
/** A pat on the head. Small joy, with a short cooldown so tapping fast doesn't farm it. */
export function pat(p: Pet, now: number): boolean {
  tick(p, now);
  if (now - (p.last.pet ?? 0) < PET_COOLDOWN) return false;
  const loves = PERSONALITIES[p.personality].loves === 'pet' ? 1.5 : 1;
  p.needs.joy = clamp(p.needs.joy + 8 * loves, 0);
  p.bond += 2 * loves;
  p.last.pet = now;
  return true;
}

/** Results of the care activities (bath, nails, brushing, fetch, treat, petting) with a 0..1 skill score. */
export function applyActivity(p: Pet, id: ActivityId, score: number, now: number) {
  tick(p, now);
  const sc = Math.max(0, Math.min(1, score));
  const loves = PERSONALITIES[p.personality].loves === id ? 1.4 : 1;
  const n = p.needs;
  if (id === 'bath') { n.clean = clamp(55 + 45 * sc, 0); n.joy = clamp(n.joy + 4 * sc * loves, 0); }
  if (id === 'nails') { n.nails = clamp(50 + 50 * sc, 0); n.joy = clamp(n.joy + 3 * sc, 0); }
  if (id === 'brush') { n.clean = clamp(n.clean + 20 * sc, 0); n.joy = clamp(n.joy + 14 * sc * loves, 0); }
  if (id === 'fetch' || id === 'pet') n.joy = clamp(n.joy + 30 * sc * loves, 0);
  if (id === 'treat') { n.joy = clamp(n.joy + 12 * loves, 0); n.hunger = clamp(n.hunger + 8, 0); }
  p.bond += Math.round((4 + 8 * sc) * loves);
  p.last[id] = now;
}

// ------------------------------------------------------------------ where they are

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** The room a pet is in right now: it moves every ~90 minutes (stable between reloads). */
export function roomOf(p: Pet, now: number): LocationId {
  const bucket = Math.floor(now / (90 * 60_000));
  const outdoorsy = p.personality === 'playful' || p.personality === 'curious';
  const rooms = outdoorsy ? PET_ROOMS : PET_ROOMS.filter((r) => r !== 'backyard').concat('livingroom');
  return rooms[hash(`${p.id}|${bucket}`) % rooms.length];
}

// ------------------------------------------------------------------ the stray, adoption

/** From STRAY_LEVEL a stray cat starts visiting the backyard (once, until it has a home). */
export function maybeStray(s: PetsState, level: number, now: number, rand = Math.random): Stray | null {
  if (s.stray || s.strayDone || level < STRAY_LEVEL) return null;
  const ps = Object.keys(PERSONALITIES) as Personality[];
  s.stray = { breed: 'cat-orange', personality: ps[Math.floor(rand() * ps.length)], feeds: 0, lastFeed: 0, arrivedAt: now };
  return s.stray;
}

/** Feed the stray. Counts once per visit (STRAY_GAP_MIN apart). Returns feeds so far, or -1 if not now. */
export function feedStray(s: PetsState, foodId: string, now: number): number {
  const st = s.stray;
  if (!st || (s.food[foodId] ?? 0) <= 0 || !canEat(foodId, 'cat')) return -1;
  if (st.feeds > 0 && now - st.lastFeed < STRAY_GAP_MIN * 60_000) return -1;
  s.food[foodId]--;
  if (!s.food[foodId]) delete s.food[foodId];
  st.feeds++;
  st.lastFeed = now;
  return st.feeds;
}
export const strayWantsToStay = (s: PetsState) => !!s.stray && s.stray.feeds >= STRAY_FEEDS;
export const strayReadyIn = (s: PetsState, now: number) => (s.stray && s.stray.feeds > 0 ? Math.max(0, s.stray.lastFeed + STRAY_GAP_MIN * 60_000 - now) : 0);

export function adopt(s: PetsState, breedId: string, personality: Personality, name: string, now: number): Pet | null {
  if (s.list.length >= MAX_PETS || !breed(breedId)) return null;
  const p: Pet = {
    id: uid('pet'), breed: breedId, name: name.trim().slice(0, 16) || 'Mochi', personality, adoptedAt: now, updatedAt: now, bond: 0,
    needs: { hunger: 80, joy: 75, clean: 85, nails: 85 }, last: {},
  };
  s.list.push(p);
  return p;
}

/** The stray moves in with the name she chose. */
export function adoptStray(s: PetsState, name: string, now: number): Pet | null {
  if (!strayWantsToStay(s)) return null;
  const st = s.stray!;
  const p = adopt(s, st.breed, st.personality, name, now);
  if (!p) return null;
  p.bond = 20;
  s.stray = null;
  s.strayDone = true;
  return p;
}

// ------------------------------------------------------------------ the pet shop

export const SHOP_LEVEL = 4;
export const LINEUP_SIZE = 4;

/** Today's animals at the pet shop (stable for the day): breeds unlocked at her level, each with a personality. */
export function lineup(day: string, level: number): { breed: string; personality: Personality; price: number }[] {
  const pool = BREEDS.filter((b) => b.price > 0 && b.level <= Math.max(SHOP_LEVEL, level));
  const ranked = [...pool].sort((a, b) => hash(`${day}|${a.id}`) - hash(`${day}|${b.id}`));
  // Shuffle the personalities for the day so the four animals all feel different.
  const ps = (Object.keys(PERSONALITIES) as Personality[]).sort((a, b) => hash(`${day}|p|${a}`) - hash(`${day}|p|${b}`));
  return ranked.slice(0, LINEUP_SIZE).map((b, i) => ({ breed: b.id, personality: ps[i % ps.length], price: b.price }));
}

/** Buy a pet from today's lineup with heart tokens. */
export function buyPet(s: PetsState, wallet: { tokens: number }, day: string, level: number, breedId: string, name: string, now: number): Pet | null {
  if (level < SHOP_LEVEL) return null;
  const offer = lineup(day, level).find((o) => o.breed === breedId);
  if (!offer || wallet.tokens < offer.price || s.list.length >= MAX_PETS) return null;
  const p = adopt(s, breedId, offer.personality, name, now);
  if (!p) return null;
  wallet.tokens -= offer.price;
  return p;
}

export function buyFood(s: PetsState, wallet: { tokens: number }, foodId: string): boolean {
  const f = petFood(foodId);
  if (!f || wallet.tokens < f.price) return false;
  wallet.tokens -= f.price;
  s.food[foodId] = (s.food[foodId] ?? 0) + f.pack;
  return true;
}

// ------------------------------------------------------------------ gifts while she's away

/** Every ~40 minutes each pet may leave a little gift somewhere (kept until she picks it up, at most 5). */
export function rollGifts(s: PetsState, now: number, widths: Partial<Record<LocationId, number>>, rand = Math.random): PetGift[] {
  if (!s.giftCheck) { s.giftCheck = now; return []; }
  const rounds = Math.min(4, Math.floor((now - s.giftCheck) / GIFT_EVERY));
  if (rounds <= 0) return [];
  s.giftCheck += rounds * GIFT_EVERY;
  const out: PetGift[] = [];
  for (let r = 0; r < rounds; r++) for (const p of s.list) {
    if (s.gifts.length >= GIFT_MAX || rand() > 0.35) continue;
    const total = PET_GIFTS.reduce((a, g) => a + g.weight, 0);
    let roll = rand() * total;
    const g = PET_GIFTS.find((x) => (roll -= x.weight) <= 0) ?? PET_GIFTS[0];
    const room = roomOf(p, now);
    const w = widths[room] ?? 1600;
    const gift: PetGift = { id: uid('g'), gift: g.id, room, x: Math.round(160 + rand() * (w - 320)), at: now, from: p.id };
    s.gifts.push(gift);
    out.push(gift);
  }
  return out;
}

export function takeGift(s: PetsState, id: string) {
  const i = s.gifts.findIndex((g) => g.id === id);
  if (i < 0) return null;
  const g = s.gifts.splice(i, 1)[0];
  return { gift: g, def: PET_GIFTS.find((x) => x.id === g.gift)! };
}

export function addPhoto(s: PetsState, ph: Omit<PetPhoto, 'id'>): PetPhoto {
  const full = { ...ph, id: uid('pp') };
  s.photos.push(full);
  if (s.photos.length > PHOTO_MAX) s.photos.splice(0, s.photos.length - PHOTO_MAX);
  return full;
}

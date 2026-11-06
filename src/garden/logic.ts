import {
  ALL_PLANTS, BOUQUET, GARDEN_DECOR, GARDEN_DECOR_DEFAULT, GARDEN_LEVELS, GARDEN_TIER, MAX_PLOTS, PLANTS, PLOT_PRICES, SEED_DROP_CHANCE,
  SEED_EVERY_BOUQUETS, SEED_EVERY_DAYS, SEED_LEVELS, SPECIALS, START_PLOTS, START_SEEDS, WATER_BOOST, WRAPS, plantDef,
  type GardenDecorSlot, type PlantDef, type SpecialDef,
} from './data';

/*
 * Garden rules. Pure functions over the saved garden (and the pizza coins / pantry it shares), so tests can move the clock.
 * Growth is worked out from timestamps: plants keep growing while the game is closed, never wilt, and a clock that
 * jumps backwards only pauses them.
 */

export interface Plot {
  /** Planted seed, or null for an empty plot. */
  plantId: string | null;
  plantedAt: number;
  /** When it was watered (once per planting), or null. */
  wateredAt: number | null;
  /** A "ready to pick" message was already sent for this planting. */
  told?: boolean;
}

export interface Bouquet { id: string; flowers: string[]; wrap: string; at: number }
export interface GardenPhoto {
  id: string;
  at: number;
  kind: 'bouquet' | 'garden';
  flowers?: string[];
  wrap?: string;
  /** Garden snapshot: plant id and growth stage (0–3) per plot. */
  plots?: { plantId: string | null; stage: number }[];
  decor?: Record<GardenDecorSlot, string>;
}

/** Saved garden progress (lives in GameState.garden). */
export interface GardenState {
  unlocked: boolean;
  plots: Plot[];
  /** Seed id -> count. */
  seeds: Record<string, number>;
  /** Mystery seeds: each grows the next special plant. */
  mystery: number;
  /** Harvested flowers and produce, id -> count. */
  basket: Record<string, number>;
  xp: number;
  harvested: number;
  sold: number;
  /** Special plant id -> first bloom time. */
  bloomed: Record<string, number>;
  /** Garden levels whose mystery seed was already given. */
  seedLevels: number[];
  /** Different days she visited the garden. */
  visit: { last: string; days: number };
  bouquetsGiven: number;
  /** Made but not yet given or sold. */
  bouquets: Bouquet[];
  photos: GardenPhoto[];
  decor: { owned: string[]; on: Record<GardenDecorSlot, string> };
}

/** The part of the pizza save the garden shares: coins and the ingredient pantry. */
export interface Wallet { coins: number; stock: Record<string, number> }

export const PHOTO_MAX = 60;
export const BOUQUET_HOLD = 12;

const emptyPlot = (): Plot => ({ plantId: null, plantedAt: 0, wateredAt: null });
let idSeq = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(idSeq++).toString(36)}`;

export function defaultGardenDecor(): GardenState['decor'] {
  return { owned: Object.values(GARDEN_DECOR_DEFAULT), on: { ...GARDEN_DECOR_DEFAULT } };
}

export function defaultGarden(): GardenState {
  return {
    unlocked: false, plots: Array.from({ length: START_PLOTS }, emptyPlot), seeds: {}, mystery: 0, basket: {}, xp: 0, harvested: 0, sold: 0,
    bloomed: {}, seedLevels: [], visit: { last: '', days: 0 }, bouquetsGiven: 0, bouquets: [], photos: [], decor: defaultGardenDecor(),
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
function cleanCounts(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (isObj(v)) for (const [k, n] of Object.entries(v)) if (plantDef(k) && count(n)) out[k] = count(n);
  return out;
}

/** Make an older or damaged garden save safe to use. */
export function repairGarden(g: GardenState) {
  const plots = Array.isArray(g.plots) ? g.plots : [];
  g.plots = plots.slice(0, MAX_PLOTS).map((p) => {
    if (!isObj(p) || typeof p.plantId !== 'string' || !plantDef(p.plantId)) return emptyPlot();
    const plantedAt = Number.isFinite(p.plantedAt) ? Number(p.plantedAt) : 0;
    const wateredAt = Number.isFinite(p.wateredAt) ? Number(p.wateredAt) : null;
    return { plantId: p.plantId, plantedAt, wateredAt, ...(p.told ? { told: true } : {}) };
  });
  while (g.plots.length < START_PLOTS) g.plots.push(emptyPlot());
  g.seeds = cleanCounts(g.seeds);
  g.basket = cleanCounts(g.basket);
  g.mystery = count(g.mystery);
  for (const k of ['xp', 'harvested', 'sold', 'bouquetsGiven'] as const) g[k] = count(g[k]);
  if (!isObj(g.bloomed)) g.bloomed = {};
  if (!Array.isArray(g.seedLevels)) g.seedLevels = [];
  if (!isObj(g.visit) || typeof g.visit.last !== 'string') g.visit = { last: '', days: 0 };
  g.visit.days = count(g.visit.days);
  g.bouquets = (Array.isArray(g.bouquets) ? g.bouquets : []).filter(validBouquet).slice(-BOUQUET_HOLD);
  g.photos = (Array.isArray(g.photos) ? g.photos : []).filter((p) => isObj(p) && (p.kind === 'bouquet' || p.kind === 'garden')).slice(-PHOTO_MAX);
  const d = g.decor as Partial<GardenState['decor']> | undefined;
  if (!d || !Array.isArray(d.owned) || !isObj(d.on)) g.decor = defaultGardenDecor();
  for (const id of Object.values(GARDEN_DECOR_DEFAULT)) if (!g.decor.owned.includes(id)) g.decor.owned.push(id);
  for (const slot of Object.keys(GARDEN_DECOR_DEFAULT) as GardenDecorSlot[]) {
    const id = g.decor.on[slot];
    if (!id || !GARDEN_DECOR.some((x) => x.id === id && x.slot === slot) || !g.decor.owned.includes(id)) g.decor.on[slot] = GARDEN_DECOR_DEFAULT[slot];
  }
}

function validBouquet(b: unknown): b is Bouquet {
  if (!isObj(b) || typeof b.id !== 'string' || !Array.isArray(b.flowers)) return false;
  return b.flowers.length >= BOUQUET.min && b.flowers.length <= BOUQUET.max && b.flowers.every((f) => isBouquetFlower(String(f)));
}

/** The first time she reaches the unlock level: starter seeds. */
export function giveStarterSeeds(g: GardenState) {
  g.unlocked = true;
  for (const [id, n] of Object.entries(START_SEEDS)) g.seeds[id] = (g.seeds[id] ?? 0) + n;
}

// ------------------------------------------------------------------ levels

export function gardenLevel(xp: number): number {
  let lvl = 1;
  for (let i = 1; i < GARDEN_LEVELS.length; i++) if (xp >= GARDEN_LEVELS[i]) lvl = i + 1;
  const top = GARDEN_LEVELS[GARDEN_LEVELS.length - 1];
  if (xp >= top) lvl += Math.floor((xp - top) / 700);
  return lvl;
}
export function nextLevelXp(xp: number): number {
  const lvl = gardenLevel(xp);
  return lvl < GARDEN_LEVELS.length ? GARDEN_LEVELS[lvl] : GARDEN_LEVELS[GARDEN_LEVELS.length - 1] + (lvl - GARDEN_LEVELS.length + 1) * 700;
}

/** Give the mystery seeds earned by garden levels (once per level). Returns how many were given. */
export function levelSeeds(g: GardenState): number {
  const lvl = gardenLevel(g.xp);
  let n = 0;
  for (const l of SEED_LEVELS) if (lvl >= l && !g.seedLevels.includes(l)) { g.seedLevels.push(l); g.mystery++; n++; }
  return n;
}

/** Count a visit on a new day. Every SEED_EVERY_DAYS different days gives a mystery seed. */
export function visitGarden(g: GardenState, day: string): { newDay: boolean; seed: boolean } {
  if (!day || g.visit.last === day) return { newDay: false, seed: false };
  g.visit.last = day;
  g.visit.days++;
  const seed = g.visit.days % SEED_EVERY_DAYS === 0;
  if (seed) g.mystery++;
  return { newDay: true, seed };
}

// ------------------------------------------------------------------ growth

/** Grown milliseconds at `now`: real time since planting, plus the watering boost. A clock set backwards counts as 0. */
export function grownMs(p: Plot, now: number): number {
  if (!p.plantId) return 0;
  const base = Math.max(0, now - p.plantedAt);
  const boost = p.wateredAt !== null ? Math.max(0, now - Math.max(p.wateredAt, p.plantedAt)) * WATER_BOOST : 0;
  return base + boost;
}
export const growMs = (d: PlantDef) => d.growMin * 60_000;

/** 0..1 */
export function growth(p: Plot, now: number): number {
  const d = p.plantId ? plantDef(p.plantId) : undefined;
  if (!d) return 0;
  return Math.min(1, grownMs(p, now) / growMs(d));
}
/** 0 seed · 1 sprout · 2 bud · 3 ready */
export function stage(p: Plot, now: number): number {
  if (!p.plantId) return 0;
  const g = growth(p, now);
  return g >= 1 ? 3 : g >= 0.55 ? 2 : g >= 0.15 ? 1 : 0;
}
export const isReady = (p: Plot, now: number) => !!p.plantId && growth(p, now) >= 1;

/** When the plant will be ready (epoch ms), solving the growth formula. */
export function readyAt(p: Plot): number | null {
  const d = p.plantId ? plantDef(p.plantId) : undefined;
  if (!d) return null;
  const need = growMs(d);
  const w = p.wateredAt;
  if (w === null) return p.plantedAt + need;
  const ws = Math.max(w, p.plantedAt);
  if (need <= ws - p.plantedAt) return p.plantedAt + need;
  // (t - planted) + BOOST·(t - ws) = need
  return Math.ceil((need + p.plantedAt + WATER_BOOST * ws) / (1 + WATER_BOOST));
}

// ------------------------------------------------------------------ seeds & planting

/** Seeds she can buy right now. Topping seeds only once the pizza shop is open. */
export function seedsForSale(g: GardenState, pizzaOpen: boolean): PlantDef[] {
  const lvl = gardenLevel(g.xp);
  return PLANTS.filter((p) => p.gardenLevel <= lvl && (p.kind !== 'topping' || pizzaOpen));
}

export function buySeeds(g: GardenState, w: Wallet, id: string, qty: number, pizzaOpen: boolean): boolean {
  const d = seedsForSale(g, pizzaOpen).find((p) => p.id === id);
  if (!d || !Number.isInteger(qty) || qty <= 0) return false;
  const cost = d.seedPrice * qty;
  if (cost > w.coins) return false;
  w.coins -= cost;
  g.seeds[id] = (g.seeds[id] ?? 0) + qty;
  return true;
}

/** The special plant a mystery seed grows: the first one not yet bloomed or growing; after all six, any of them. */
export function nextSpecial(g: GardenState, rand = Math.random): SpecialDef {
  const growing = new Set(g.plots.map((p) => p.plantId));
  const fresh = SPECIALS.find((s) => !g.bloomed[s.id] && !growing.has(s.id));
  if (fresh) return fresh;
  return SPECIALS[Math.floor(rand() * SPECIALS.length) % SPECIALS.length];
}

export const MYSTERY = 'mystery';

/** Plant a seed (or MYSTERY) in an empty plot. Returns the plant id, or null. */
export function plant(g: GardenState, i: number, seedId: string, now: number, rand = Math.random): string | null {
  const p = g.plots[i];
  if (!p || p.plantId) return null;
  let id = seedId;
  if (seedId === MYSTERY) {
    if (g.mystery <= 0) return null;
    g.mystery--;
    id = nextSpecial(g, rand).id;
  } else {
    if (!plantDef(seedId) || (g.seeds[seedId] ?? 0) <= 0) return null;
    g.seeds[seedId]--;
    if (!g.seeds[seedId]) delete g.seeds[seedId];
  }
  g.plots[i] = { plantId: id, plantedAt: now, wateredAt: null };
  return id;
}

/** Water once per planting; not needed, only speeds it up. */
export function water(g: GardenState, i: number, now: number): boolean {
  const p = g.plots[i];
  if (!p?.plantId || p.wateredAt !== null || isReady(p, now)) return false;
  p.wateredAt = Math.max(now, p.plantedAt);
  return true;
}

/** Dig up a plant that isn't ready (the seed is returned unless it was a mystery seed, which comes back as one). */
export function dig(g: GardenState, i: number): boolean {
  const p = g.plots[i];
  if (!p?.plantId) return false;
  const d = plantDef(p.plantId);
  if (d?.kind === 'special') g.mystery++;
  else if (d) g.seeds[d.id] = (g.seeds[d.id] ?? 0) + 1;
  g.plots[i] = emptyPlot();
  return true;
}

// ------------------------------------------------------------------ harvest

export interface Harvest {
  plantId: string;
  qty: number;
  xp: number;
  /** Toppings went to the pizza pantry instead of the basket. */
  toPizza: boolean;
  /** First time this special plant bloomed (caller plays the reward). */
  firstBloom: SpecialDef | null;
  seedDrop: boolean;
  levelBefore: number;
  levelAfter: number;
  /** Mystery seeds from reaching new garden levels. */
  levelSeeds: number;
}

export function harvest(g: GardenState, w: Wallet, i: number, now: number, rand = Math.random): Harvest | null {
  const p = g.plots[i];
  if (!p || !isReady(p, now)) return null;
  const d = plantDef(p.plantId!)!;
  const qty = d.yield[0] + Math.floor(rand() * (d.yield[1] - d.yield[0] + 1));
  const toPizza = !!d.pizza;
  if (d.pizza) { const k = `${d.pizza}:${GARDEN_TIER}`; w.stock[k] = (w.stock[k] ?? 0) + qty; }
  else g.basket[d.id] = (g.basket[d.id] ?? 0) + qty;
  let firstBloom: SpecialDef | null = null;
  if (d.kind === 'special' && !g.bloomed[d.id]) {
    g.bloomed[d.id] = now;
    firstBloom = SPECIALS.find((s) => s.id === d.id)!;
    if (firstBloom.reward.coins) w.coins += firstBloom.reward.coins;
    if (firstBloom.reward.decor && !g.decor.owned.includes(firstBloom.reward.decor)) g.decor.owned.push(firstBloom.reward.decor);
  }
  const seedDrop = d.kind !== 'special' && rand() < SEED_DROP_CHANCE;
  if (seedDrop) g.mystery++;
  const levelBefore = gardenLevel(g.xp);
  const xp = Math.max(2, Math.round(4 + Math.sqrt(d.growMin) * 2)) + (d.kind === 'special' ? 30 : 0);
  g.xp += xp;
  g.harvested++;
  g.plots[i] = emptyPlot();
  const seeds = levelSeeds(g);
  return { plantId: d.id, qty, xp, toPizza, firstBloom, seedDrop, levelBefore, levelAfter: gardenLevel(g.xp), levelSeeds: seeds };
}

// ------------------------------------------------------------------ stall

export function sell(g: GardenState, w: Wallet, id: string, qty: number): number {
  const d = plantDef(id);
  const have = g.basket[id] ?? 0;
  if (!d || !Number.isInteger(qty) || qty <= 0 || qty > have) return 0;
  g.basket[id] = have - qty;
  if (!g.basket[id]) delete g.basket[id];
  const coins = d.sellPrice * qty;
  w.coins += coins;
  g.sold += qty;
  return coins;
}

/** Sell everything in the basket except special flowers (she might want them for a bouquet). */
export function sellAll(g: GardenState, w: Wallet): number {
  let total = 0;
  for (const [id, n] of Object.entries(g.basket)) if (plantDef(id)?.kind !== 'special') total += sell(g, w, id, n);
  return total;
}

// ------------------------------------------------------------------ bouquets

export const isBouquetFlower = (id: string) => { const k = plantDef(id)?.kind; return k === 'flower' || k === 'special'; };

/** Tie a bouquet from basket flowers. Returns null if the basket doesn't have them. */
export function makeBouquet(g: GardenState, flowers: string[], wrap: string, now: number): Bouquet | null {
  if (flowers.length < BOUQUET.min || flowers.length > BOUQUET.max) return null;
  if (!WRAPS.some((x) => x.id === wrap) || !flowers.every(isBouquetFlower)) return null;
  if (g.bouquets.length >= BOUQUET_HOLD) return null;
  const need: Record<string, number> = {};
  for (const f of flowers) need[f] = (need[f] ?? 0) + 1;
  for (const [f, n] of Object.entries(need)) if ((g.basket[f] ?? 0) < n) return null;
  for (const [f, n] of Object.entries(need)) { g.basket[f] -= n; if (!g.basket[f]) delete g.basket[f]; }
  const b: Bouquet = { id: uid('b'), flowers: [...flowers], wrap, at: now };
  g.bouquets.push(b);
  return b;
}

/** Bouquets sell for more than the loose flowers. */
export function bouquetValue(b: Pick<Bouquet, 'flowers'>): number {
  const base = b.flowers.reduce((s, f) => s + (plantDef(f)?.sellPrice ?? 0), 0);
  const kinds = new Set(b.flowers).size;
  return Math.round(base * (1.4 + 0.05 * kinds));
}

const takeBouquet = (g: GardenState, id: string) => {
  const i = g.bouquets.findIndex((b) => b.id === id);
  return i < 0 ? null : g.bouquets.splice(i, 1)[0];
};

/** Give a bouquet to him. Every SEED_EVERY_BOUQUETS gifts he gives a mystery seed back. */
export function giftBouquet(g: GardenState, id: string): { bouquet: Bouquet; seed: boolean } | null {
  const b = takeBouquet(g, id);
  if (!b) return null;
  g.bouquetsGiven++;
  const seed = g.bouquetsGiven % SEED_EVERY_BOUQUETS === 0;
  if (seed) g.mystery++;
  return { bouquet: b, seed };
}

export function sellBouquet(g: GardenState, w: Wallet, id: string): number {
  const b = takeBouquet(g, id);
  if (!b) return 0;
  const v = bouquetValue(b);
  w.coins += v;
  return v;
}

// ------------------------------------------------------------------ photos

export function photoBouquet(g: GardenState, b: Bouquet, now: number): GardenPhoto {
  return addPhoto(g, { id: uid('p'), at: now, kind: 'bouquet', flowers: [...b.flowers], wrap: b.wrap });
}
export function photoGarden(g: GardenState, now: number): GardenPhoto {
  return addPhoto(g, {
    id: uid('p'), at: now, kind: 'garden', decor: { ...g.decor.on },
    plots: g.plots.map((p) => ({ plantId: p.plantId, stage: stage(p, now) })),
  });
}
function addPhoto(g: GardenState, ph: GardenPhoto) {
  g.photos.push(ph);
  if (g.photos.length > PHOTO_MAX) g.photos.splice(0, g.photos.length - PHOTO_MAX);
  return ph;
}

// ------------------------------------------------------------------ plots & decor

export const plotPrice = (g: GardenState): number | null =>
  g.plots.length >= MAX_PLOTS ? null : PLOT_PRICES[g.plots.length - START_PLOTS] ?? PLOT_PRICES[PLOT_PRICES.length - 1];

export function buyPlot(g: GardenState, w: Wallet): boolean {
  const price = plotPrice(g);
  if (price === null || w.coins < price) return false;
  w.coins -= price;
  g.plots.push(emptyPlot());
  return true;
}

export function buyGardenDecor(g: GardenState, w: Wallet, id: string): boolean {
  const d = GARDEN_DECOR.find((x) => x.id === id);
  if (!d || d.special || g.decor.owned.includes(id) || w.coins < d.price) return false;
  w.coins -= d.price;
  g.decor.owned.push(id);
  g.decor.on[d.slot] = id;
  return true;
}
export function useGardenDecor(g: GardenState, id: string): boolean {
  const d = GARDEN_DECOR.find((x) => x.id === id);
  if (!d || !g.decor.owned.includes(id)) return false;
  g.decor.on[d.slot] = id;
  return true;
}

// ------------------------------------------------------------------ notifications

/** Plots that became ready and haven't been announced yet (marks them as told). */
export function newlyReady(g: GardenState, now: number): { plot: number; plantId: string }[] {
  const out: { plot: number; plantId: string }[] = [];
  g.plots.forEach((p, i) => {
    if (p.plantId && !p.told && isReady(p, now)) { p.told = true; out.push({ plot: i, plantId: p.plantId }); }
  });
  return out;
}

/** Future "ready" times, soonest first (for Android notifications scheduled while the game is closed). */
export function upcomingReady(g: GardenState, now: number): { plot: number; plantId: string; at: number }[] {
  return g.plots
    .map((p, i) => ({ plot: i, plantId: p.plantId, at: readyAt(p) }))
    .filter((x): x is { plot: number; plantId: string; at: number } => !!x.plantId && x.at !== null && x.at > now)
    .sort((a, b) => a.at - b.at);
}

// ------------------------------------------------------------------ cooking

/** The garden produce that makes a cooking-game recipe extra special, if she has some. */
export function cookingProduce(g: GardenState, recipeName: string): PlantDef | null {
  const d = ALL_PLANTS.find((p) => p.cooking === recipeName);
  return d && (g.basket[d.id] ?? 0) > 0 ? d : null;
}
export function useProduce(g: GardenState, id: string): boolean {
  if ((g.basket[id] ?? 0) <= 0) return false;
  g.basket[id]--;
  if (!g.basket[id]) delete g.basket[id];
  return true;
}

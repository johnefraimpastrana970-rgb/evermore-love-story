import {
  CUSTOMERS, DECOR, DECOR_DEFAULT, INGREDIENTS, ING_ORDER, RECIPES, SHOP_LEVELS, TIER_COST, TIER_UNLOCK,
  type CustomerDef, type DecorSlot, type IngKind, type RecipeDef, type Tier,
} from './data';

/** Her own "pizza of the day" (a 7th menu item). */
export interface CustomRecipe { name: string; sauce: 'tomato' | 'cream'; toppings: { kind: IngKind; count: number }[]; price: number }

/** The shop session saved between plays: who is waiting and the pizza on the counter. */
export interface SavedLook {
  dough: { size: number; tier: Tier } | null;
  sauce: { kind: 'tomato' | 'cream'; tier: Tier; cells: string } | null;
  cheese: { tier: Tier; cells: string } | null;
  pieces: { kind: IngKind; tier: Tier; x: number; y: number; rot: number }[];
  bake: number;
  cuts: { a: [number, number]; b: [number, number] }[];
}
export interface SavedSession {
  queue: { uid: number; customerId: string; recipeId: string; patience: number; left: number }[];
  spawnIn: number;
  uid: number;
  cooking: { uid: number; step: string; look: SavedLook; build: PizzaBuild; active?: IngKind } | null;
}

/** Saved pizza-shop progress (lives in GameState.pizza). */
export interface PizzaState {
  /** True once she reaches the unlock level (kept even if levels are reset by a bug). */
  unlocked: boolean;
  coins: number;
  /** "kind:tier" -> units in stock. */
  stock: Record<string, number>;
  /** Recipe ids on today's menu. */
  menu: string[];
  open: boolean;
  xp: number;
  served: number;
  earned: number;
  starsSum: number;
  fiveStars: number;
  /** Per customer: visits and total stars, so regulars remember you. */
  regulars: Record<string, { visits: number; stars: number }>;
  /** Today's session totals. */
  day: { key: string; served: number; earned: number; stars: number; left: number };
  /** Her own pizza of the day (shop level 3+). */
  custom: CustomRecipe | null;
  /** Shop decorations and aprons: what she owns and what is on display. */
  decor: { owned: string[]; on: Record<DecorSlot, string> };
  /** Waiting customers and the pizza in progress, so a reload loses nothing. */
  session: SavedSession | null;
}

export const START_COINS = 80;

export function defaultDecor(): PizzaState['decor'] {
  return { owned: Object.values(DECOR_DEFAULT), on: { ...DECOR_DEFAULT } };
}

export function defaultPizza(): PizzaState {
  return {
    unlocked: false, coins: 0, stock: {}, menu: [], open: false, xp: 0, served: 0, earned: 0, starsSum: 0, fiveStars: 0, regulars: {},
    day: { key: '', served: 0, earned: 0, stars: 0, left: 0 }, custom: null, decor: defaultDecor(), session: null,
  };
}

/** Make an older or damaged pizza save safe to use. */
export function repairPizza(p: PizzaState) {
  if (p.custom !== null && !isValidCustom(p.custom)) p.custom = null;
  const d = p.decor as Partial<PizzaState['decor']> | undefined;
  if (!d || !Array.isArray(d.owned) || typeof d.on !== 'object' || !d.on) p.decor = defaultDecor();
  for (const id of Object.values(DECOR_DEFAULT)) if (!p.decor.owned.includes(id)) p.decor.owned.push(id);
  for (const slot of Object.keys(DECOR_DEFAULT) as DecorSlot[]) {
    const id = p.decor.on[slot];
    if (!id || !DECOR.some((x) => x.id === id && x.slot === slot) || !p.decor.owned.includes(id)) p.decor.on[slot] = DECOR_DEFAULT[slot];
  }
  if (p.session !== null && (typeof p.session !== 'object' || !Array.isArray(p.session.queue))) p.session = null;
}

// ------------------------------------------------------------------ decor

export function buyDecor(p: PizzaState, id: string): boolean {
  const d = DECOR.find((x) => x.id === id);
  if (!d || p.decor.owned.includes(id) || p.coins < d.price) return false;
  p.coins -= d.price;
  p.decor.owned.push(id);
  p.decor.on[d.slot] = id;
  return true;
}
export function useDecor(p: PizzaState, id: string): boolean {
  const d = DECOR.find((x) => x.id === id);
  if (!d || !p.decor.owned.includes(id)) return false;
  p.decor.on[d.slot] = id;
  return true;
}

// ------------------------------------------------------------------ her own pizza of the day

export const CUSTOM_ID = 'custom';
/** Shop level that unlocks the pizza of the day. */
export const CUSTOM_LEVEL = 3;
export const TOPPING_KINDS: IngKind[] = ING_ORDER.filter((k) => INGREDIENTS[k].category === 'topping');
export const CUSTOM_LIMITS = { name: 24, kinds: 3, minCount: 2, maxCount: 10 };

/** A fair price for her recipe (in line with the six menu pizzas), and the range she may choose from. */
export function customPriceRange(c: Pick<CustomRecipe, 'sauce' | 'toppings'>) {
  const fair = Math.round(12 + (c.sauce === 'cream' ? 3 : 0) + c.toppings.reduce((s, t) => s + INGREDIENTS[t.kind].basePrice * 3 + t.count * 0.6, 0));
  return { fair, min: Math.max(6, Math.round(fair * 0.6)), max: Math.round(fair * 1.5) };
}
export function isValidCustom(c: unknown): c is CustomRecipe {
  if (!c || typeof c !== 'object') return false;
  const r = c as CustomRecipe;
  if (typeof r.name !== 'string' || !r.name.trim() || r.name.length > CUSTOM_LIMITS.name) return false;
  if (r.sauce !== 'tomato' && r.sauce !== 'cream') return false;
  if (!Array.isArray(r.toppings) || r.toppings.length > CUSTOM_LIMITS.kinds) return false;
  const seen = new Set<string>();
  for (const t of r.toppings) {
    if (!TOPPING_KINDS.includes(t.kind) || seen.has(t.kind)) return false;
    if (!Number.isInteger(t.count) || t.count < CUSTOM_LIMITS.minCount || t.count > CUSTOM_LIMITS.maxCount) return false;
    seen.add(t.kind);
  }
  const { min, max } = customPriceRange(r);
  return Number.isInteger(r.price) && r.price >= min && r.price <= max;
}
export function customRecipeDef(c: CustomRecipe): RecipeDef {
  const first = c.toppings[0]?.kind;
  return {
    id: CUSTOM_ID, rank: Math.max(1, Math.min(6, Math.round(c.price / 9))), name: c.name.trim(), desc: 'Our pizza of the day ♡',
    sauce: c.sauce, toppings: c.toppings.map((t) => ({ ...t })), price: c.price, shopLevel: CUSTOM_LEVEL,
    color: first ? INGREDIENTS[first].colors[1] : '#ff8fb1',
  };
}
/** The six menu pizzas plus her own, if she has made one. */
export function allRecipes(p: Pick<PizzaState, 'custom'>): RecipeDef[] {
  return p.custom ? [...RECIPES, customRecipeDef(p.custom)] : RECIPES;
}
export function findRecipe(p: Pick<PizzaState, 'custom'>, id: string): RecipeDef | undefined {
  return allRecipes(p).find((r) => r.id === id);
}
/** Customers are curious about her pizza; a fair price makes it more popular, a steep one less. */
export function customWeight(c: CustomRecipe): number {
  const { fair } = customPriceRange(c);
  return 1.6 * Math.max(0.4, Math.min(1.4, fair / c.price));
}

export const UNLOCK_LEVEL = 10;
export const sk = (kind: IngKind, tier: Tier) => `${kind}:${tier}`;
export const have = (p: PizzaState, kind: IngKind, tier: Tier) => p.stock[sk(kind, tier)] ?? 0;
export const haveAny = (p: PizzaState, kind: IngKind) => have(p, kind, 1) + have(p, kind, 2) + have(p, kind, 3);

export function shopLevel(xp: number): number {
  let lvl = 1;
  for (let i = 1; i < SHOP_LEVELS.length; i++) if (xp >= SHOP_LEVELS[i]) lvl = i + 1;
  if (xp >= SHOP_LEVELS[SHOP_LEVELS.length - 1]) lvl += Math.floor((xp - SHOP_LEVELS[SHOP_LEVELS.length - 1]) / 1000);
  return lvl;
}
export function nextLevelXp(xp: number): number | null {
  const lvl = shopLevel(xp);
  return lvl < SHOP_LEVELS.length ? SHOP_LEVELS[lvl] : SHOP_LEVELS[SHOP_LEVELS.length - 1] + (lvl - SHOP_LEVELS.length + 1) * 1000;
}

export const tierUnlocked = (p: PizzaState, t: Tier) => shopLevel(p.xp) >= TIER_UNLOCK[t];
export const recipeUnlocked = (p: PizzaState, r: RecipeDef) => shopLevel(p.xp) >= r.shopLevel;

export function price(kind: IngKind, tier: Tier): number {
  return Math.round(INGREDIENTS[kind].basePrice * TIER_COST[tier]);
}

/** Every ingredient kind a recipe uses (one unit each, plus a box). */
export function recipeKinds(r: RecipeDef): IngKind[] {
  return ['dough', r.sauce, 'mozzarella', ...r.toppings.map((t) => t.kind), 'box'];
}
/** Kinds she's missing entirely for a recipe. */
export function missingFor(p: PizzaState, r: RecipeDef): IngKind[] {
  return recipeKinds(r).filter((k) => haveAny(p, k) <= 0);
}
/** How many of a recipe she can make with current stock. */
export function canMakeCount(p: PizzaState, r: RecipeDef): number {
  return Math.min(...recipeKinds(r).map((k) => haveAny(p, k)));
}

export function buy(p: PizzaState, kind: IngKind, tier: Tier, qty = 1): boolean {
  const cost = price(kind, tier) * qty;
  if (qty <= 0 || cost > p.coins || !tierUnlocked(p, tier)) return false;
  p.coins -= cost;
  p.stock[sk(kind, tier)] = have(p, kind, tier) + qty;
  return true;
}
/** Use one unit; prefers the requested tier. Returns false if none left. */
export function consume(p: PizzaState, kind: IngKind, tier: Tier): boolean {
  if (have(p, kind, tier) <= 0) return false;
  p.stock[sk(kind, tier)] = have(p, kind, tier) - 1;
  return true;
}

// ------------------------------------------------------------------ scoring

export interface PizzaBuild {
  recipeId: string;
  tiers: Partial<Record<IngKind, Tier>>;
  /** 0..1 per step. */
  scores: { dough: number; sauce: number; cheese: number; toppings: number; bake: number; slice: number };
  /** Toppings actually placed: kind -> count. */
  placed: Partial<Record<IngKind, number>>;
}

const W = { dough: 0.12, sauce: 0.16, cheese: 0.16, toppings: 0.24, bake: 0.2, slice: 0.12 };

export function skillScore(b: PizzaBuild): number {
  return (Object.keys(W) as (keyof typeof W)[]).reduce((s, k) => s + W[k] * Math.max(0, Math.min(1, b.scores[k])), 0);
}
export function avgTier(b: PizzaBuild): number {
  const t = Object.entries(b.tiers).filter(([k]) => k !== 'box').map(([, v]) => v as number);
  return t.length ? t.reduce((a, c) => a + c, 0) / t.length : 1;
}
/** Toppings: right kinds, right amounts, nothing extra. */
export function toppingAccuracy(r: RecipeDef, placed: Partial<Record<IngKind, number>>): number {
  const need = new Map(r.toppings.map((t) => [t.kind, t.count]));
  if (!need.size) return Object.values(placed).some((n) => (n ?? 0) > 0) ? 0.6 : 1;
  let s = 0;
  for (const [k, n] of need) { const got = placed[k] ?? 0; s += got === 0 ? 0 : Math.min(got / n, n / got); }
  s /= need.size;
  const extra = Object.entries(placed).filter(([k, n]) => !need.has(k as IngKind) && (n ?? 0) > 0).length;
  return Math.max(0, s - extra * 0.2);
}

export interface Verdict { stars: number; pay: number; tip: number; xp: number; correct: boolean }

/**
 * Stars 1–5 from skill, ingredient quality and packaging. A wrong pizza is always 1 star.
 * Relaxed shop: waiting never costs stars; a long wait only trims the tip a little (up to 35%).
 */
export function judgePizza(b: PizzaBuild, orderId: string, customer: CustomerDef, waitedFrac: number, recipe?: RecipeDef): Verdict {
  const r = recipe ?? RECIPES.find((x) => x.id === b.recipeId)!;
  const correct = b.recipeId === orderId;
  const quality = avgTier(b);
  const box = b.tiers.box ?? 1;
  let stars = correct ? 1 + skillScore(b) * 3.6 + (quality - 1) * 0.4 + (box - 1) * 0.12 : 1;
  stars = Math.max(1, Math.min(5, Math.round(stars)));
  const qualityMult = 1 + 0.3 * (quality - 1);
  const pay = correct ? Math.round(r.price * qualityMult) : Math.round(r.price * 0.3);
  const premiumLove = customer.likesPremium ? 1 + 0.4 * (quality - 1) : 1;
  const waitCut = 1 - 0.35 * Math.max(0, Math.min(1, waitedFrac));
  const tip = correct ? Math.round((stars - 2) * 1.6 * customer.generosity * premiumLove * (1 + r.rank * 0.15) * waitCut) : 0;
  return { stars, pay, tip: Math.max(0, tip), xp: stars * 4 + r.rank * 2, correct };
}

/** Record a finished order. */
export function settle(p: PizzaState, v: Verdict, customerId: string, dayKey: string) {
  if (p.day.key !== dayKey) p.day = { key: dayKey, served: 0, earned: 0, stars: 0, left: 0 };
  const total = v.pay + v.tip;
  p.coins += total;
  p.earned += total;
  p.served++;
  p.starsSum += v.stars;
  if (v.stars === 5) p.fiveStars++;
  p.xp += v.xp;
  p.day.served++;
  p.day.earned += total;
  p.day.stars += v.stars;
  const reg = (p.regulars[customerId] ??= { visits: 0, stars: 0 });
  reg.visits++;
  reg.stars += v.stars;
}

// ------------------------------------------------------------------ customers

/** Pick who walks in next (not someone already waiting) and what they order from today's menu. */
export function nextCustomer(menu: string[], waiting: string[], rand = Math.random, extraWeight: (id: string) => number = () => 1): { customer: CustomerDef; recipeId: string } | null {
  const pool = CUSTOMERS.filter((c) => !waiting.includes(c.id));
  if (!pool.length || !menu.length) return null;
  const customer = pool[Math.floor(rand() * pool.length)];
  const weights = menu.map((id) => (customer.favorites.includes(id) ? 3 : 1) * extraWeight(id));
  let roll = rand() * weights.reduce((a, b) => a + b, 0);
  let recipeId = menu[0];
  for (let i = 0; i < menu.length; i++) { roll -= weights[i]; if (roll <= 0) { recipeId = menu[i]; break; } }
  return { customer, recipeId };
}

// ------------------------------------------------------------------ prep helpers (pure, tested)

/** Dough stretch: hold until the ring reaches the target size (0.93 of the tray). */
export function doughScore(size: number) {
  return Math.max(0, 1 - Math.abs(size - 0.93) * 3);
}
/** Oven: the golden zone is 0.62–0.78; 1.0 is burnt. */
export function bakeScore(level: number) {
  if (level >= 1) return 0.05;
  if (level >= 0.62 && level <= 0.78) return 1;
  const d = level < 0.62 ? 0.62 - level : level - 0.78;
  return Math.max(0, 1 - d * 3.2);
}
/** Slicing: each cut should pass through the centre; cuts should be spread evenly. */
export function sliceScore(cuts: { a: [number, number]; b: [number, number] }[], r: number): number {
  if (!cuts.length) return 0;
  const centre = cuts.map(({ a, b }) => {
    const [x1, y1] = a, [x2, y2] = b;
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const dist = Math.abs(x2 * y1 - y2 * x1) / len; // distance from origin (pizza centre) to the line
    return Math.max(0, 1 - dist / (r * 0.35));
  });
  const angles = cuts.map(({ a, b }) => ((Math.atan2(b[1] - a[1], b[0] - a[0]) % Math.PI) + Math.PI) % Math.PI).sort((x, y) => x - y);
  let spread = 1;
  if (angles.length > 1) {
    const ideal = Math.PI / angles.length;
    const gaps = angles.map((a, i) => (i ? a - angles[i - 1] : a + Math.PI - angles[angles.length - 1]));
    spread = Math.max(0, 1 - gaps.reduce((s, g) => s + Math.abs(g - ideal), 0) / Math.PI);
  }
  const countOk = Math.min(1, cuts.length / 4);
  return (centre.reduce((a, b) => a + b, 0) / centre.length) * 0.6 + spread * 0.25 + countOk * 0.15;
}

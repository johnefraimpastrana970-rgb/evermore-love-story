import { describe, it, expect } from 'vitest';
import {
  GARDEN_DECOR, GARDEN_DECOR_DEFAULT, MAX_PLOTS, PLANTS, SEED_EVERY_BOUQUETS, SEED_EVERY_DAYS, SPECIALS, START_PLOTS, UNLOCK_LEVEL,
  WATER_BOOST, bloomFlag, plantDef,
} from '../src/garden/data';
import {
  MYSTERY, bouquetValue, buyGardenDecor, buyPlot, buySeeds, cookingProduce, defaultGarden, dig, gardenLevel, giftBouquet,
  giveStarterSeeds, growth, harvest, isReady, levelSeeds, makeBouquet, newlyReady, nextSpecial, photoBouquet, photoGarden, plant,
  plotPrice, readyAt, repairGarden, seedsForSale, sell, sellAll, sellBouquet, stage, upcomingReady, useGardenDecor, useProduce,
  visitGarden, water, type GardenState, type Wallet,
} from '../src/garden/logic';
import { COSMETICS } from '../src/content/cosmetics';
import { RECIPES as COOKING } from '../src/content/config';
import { INGREDIENTS } from '../src/pizza/data';
import { migrate, defaultState, SAVE_VERSION } from '../src/core/state';

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 6, 9, 0);
const wallet = (coins = 0): Wallet => ({ coins, stock: {} });
const fresh = () => { const g = defaultGarden(); giveStarterSeeds(g); return g; };
const never = () => 0.99; // no seed drops
const grow = (g: GardenState, i: number, id: string) => { g.seeds[id] = (g.seeds[id] ?? 0) + 1; return plant(g, i, id, T0); };

describe('garden data', () => {
  it('unlocks at level 5 with six special plants', () => {
    expect(UNLOCK_LEVEL).toBe(5);
    expect(SPECIALS).toHaveLength(6);
    expect(new Set([...PLANTS, ...SPECIALS].map((p) => p.id)).size).toBe(PLANTS.length + SPECIALS.length);
  });
  it('topping plants map to real pizza ingredients, produce to real cooking recipes', () => {
    for (const p of PLANTS.filter((x) => x.kind === 'topping')) expect(INGREDIENTS[p.pizza!], p.id).toBeTruthy();
    const names = new Set(COOKING.map((r) => r.name));
    for (const p of PLANTS.filter((x) => x.kind === 'produce')) expect(names.has(p.cooking!), p.id).toBe(true);
  });
  it('special rewards point at decor and outfits that exist', () => {
    for (const s of SPECIALS) {
      if (s.reward.decor) expect(GARDEN_DECOR.find((d) => d.id === s.reward.decor)?.special, s.id).toBe(true);
      for (const c of s.reward.cosmetic ?? []) expect(COSMETICS.find((x) => x.id === c)?.garden, c).toBe(true);
    }
  });
  it('growth times are short: minutes to a few hours', () => {
    for (const p of [...PLANTS, ...SPECIALS]) { expect(p.growMin).toBeGreaterThan(0); expect(p.growMin).toBeLessThanOrEqual(240); }
  });
});

describe('growing', () => {
  it('grows in real time and is ready after growMin', () => {
    const g = fresh();
    expect(plant(g, 0, 'tulip', T0)).toBe('tulip');
    const p = g.plots[0];
    expect(stage(p, T0)).toBe(0);
    expect(isReady(p, T0 + 14 * MIN)).toBe(false);
    expect(isReady(p, T0 + 15 * MIN)).toBe(true);
    expect(stage(p, T0 + 15 * MIN)).toBe(3);
    expect(readyAt(p)).toBe(T0 + 15 * MIN);
  });
  it('watering speeds it up, and readyAt matches the growth formula', () => {
    const g = fresh();
    plant(g, 0, 'tulip', T0);
    expect(water(g, 0, T0 + 5 * MIN)).toBe(true);
    expect(water(g, 0, T0 + 6 * MIN)).toBe(false); // once per planting
    const at = readyAt(g.plots[0])!;
    expect(at).toBeLessThan(T0 + 15 * MIN);
    expect(at).toBe(Math.ceil((15 * MIN + T0 + WATER_BOOST * (T0 + 5 * MIN)) / (1 + WATER_BOOST)));
    expect(isReady(g.plots[0], at)).toBe(true);
    expect(isReady(g.plots[0], at - 2000)).toBe(false);
  });
  it('a clock set backwards never breaks a plant', () => {
    const g = fresh();
    plant(g, 0, 'daisy', T0);
    expect(growth(g.plots[0], T0 - 3600_000)).toBe(0);
    expect(isReady(g.plots[0], T0 + 3 * MIN)).toBe(true);
  });
  it('never plants twice in one plot or without a seed', () => {
    const g = fresh();
    expect(plant(g, 0, 'daisy', T0)).toBe('daisy');
    expect(plant(g, 0, 'daisy', T0)).toBeNull();
    expect(plant(g, 1, 'rose', T0)).toBeNull();
    expect(plant(g, 99, 'daisy', T0)).toBeNull();
  });
  it('digging up returns the seed', () => {
    const g = fresh();
    plant(g, 0, 'tulip', T0);
    const before = g.seeds.tulip ?? 0;
    expect(dig(g, 0)).toBe(true);
    expect(g.seeds.tulip).toBe(before + 1);
    expect(g.plots[0].plantId).toBeNull();
  });
});

describe('harvest', () => {
  it('flowers go to the basket and give garden XP', () => {
    const g = fresh(), w = wallet();
    plant(g, 0, 'daisy', T0);
    expect(harvest(g, w, 0, T0 + MIN, never)).toBeNull();
    const h = harvest(g, w, 0, T0 + 3 * MIN, never)!;
    expect(h.qty).toBeGreaterThanOrEqual(2);
    expect(g.basket.daisy).toBe(h.qty);
    expect(g.xp).toBe(h.xp);
    expect(g.plots[0].plantId).toBeNull();
  });
  it('toppings go to the pizza pantry as premium stock', () => {
    const g = fresh(), w = wallet();
    grow(g, 0, 'g-basil');
    const h = harvest(g, w, 0, T0 + 12 * MIN, never)!;
    expect(h.toPizza).toBe(true);
    expect(w.stock['basil:3']).toBe(h.qty);
    expect(g.basket['g-basil']).toBeUndefined();
  });
  it('rare harvests drop a mystery seed', () => {
    const g = fresh(), w = wallet();
    plant(g, 0, 'daisy', T0);
    expect(harvest(g, w, 0, T0 + 3 * MIN, () => 0)!.seedDrop).toBe(true);
    expect(g.mystery).toBe(1);
  });
});

describe('special plants', () => {
  it('mystery seeds grow the six specials in order, then any', () => {
    const g = fresh(), w = wallet();
    for (const s of SPECIALS) {
      g.mystery = 1;
      expect(plant(g, 0, MYSTERY, T0)).toBe(s.id);
      const h = harvest(g, w, 0, T0 + s.growMin * MIN, never)!;
      expect(h.firstBloom?.id).toBe(s.id);
      expect(g.bloomed[s.id]).toBe(T0 + s.growMin * MIN);
    }
    expect(SPECIALS.map((s) => s.id)).toContain(nextSpecial(g, () => 0.5).id);
    g.mystery = 1;
    const id = plant(g, 0, MYSTERY, T0)!;
    expect(harvest(g, w, 0, T0 + 999 * MIN, never)!.firstBloom).toBeNull(); // second bloom: no reward again
    expect(SPECIALS.some((s) => s.id === id)).toBe(true);
  });
  it('two mystery seeds at once grow two different specials', () => {
    const g = fresh();
    g.mystery = 2;
    expect(plant(g, 0, MYSTERY, T0)).toBe(SPECIALS[0].id);
    expect(plant(g, 1, MYSTERY, T0)).toBe(SPECIALS[1].id);
  });
  it('first blooms give coins and special decor', () => {
    const g = fresh(), w = wallet();
    g.mystery = 2;
    plant(g, 0, MYSTERY, T0); plant(g, 1, MYSTERY, T0);
    harvest(g, w, 0, T0 + 999 * MIN, never);
    expect(w.coins).toBe(SPECIALS[0].reward.coins);
    harvest(g, w, 1, T0 + 999 * MIN, never);
    expect(g.decor.owned).toContain('lights-stars');
    expect(bloomFlag('sp-moonpetal')).toBe('garden-bloom:sp-moonpetal');
  });
  it('digging up a special gives the mystery seed back', () => {
    const g = fresh();
    g.mystery = 1;
    plant(g, 0, MYSTERY, T0);
    dig(g, 0);
    expect(g.mystery).toBe(1);
  });
});

describe('mystery seed sources', () => {
  it('garden levels give one seed each, once', () => {
    const g = fresh();
    g.xp = 10_000;
    expect(levelSeeds(g)).toBe(4);
    expect(levelSeeds(g)).toBe(0);
    expect(g.mystery).toBe(4);
  });
  it('every few different days of visiting gives one', () => {
    const g = fresh();
    let seeds = 0;
    for (let d = 1; d <= SEED_EVERY_DAYS * 2; d++) {
      expect(visitGarden(g, `2026-11-0${d}`).newDay).toBe(true);
      expect(visitGarden(g, `2026-11-0${d}`).newDay).toBe(false); // same day twice
    }
    seeds = g.mystery;
    expect(seeds).toBe(2);
  });
  it('his gift back after a few bouquets', () => {
    const g = fresh();
    g.basket = { daisy: 30 };
    let seeds = 0;
    for (let i = 0; i < SEED_EVERY_BOUQUETS; i++) {
      const b = makeBouquet(g, ['daisy', 'daisy', 'daisy'], 'kraft', T0)!;
      if (giftBouquet(g, b.id)!.seed) seeds++;
    }
    expect(seeds).toBe(1);
    expect(g.bouquetsGiven).toBe(SEED_EVERY_BOUQUETS);
  });
});

describe('stall, seeds and coins', () => {
  it('topping seeds only appear once the pizza shop is open', () => {
    const g = fresh();
    expect(seedsForSale(g, false).some((p) => p.kind === 'topping')).toBe(false);
    expect(seedsForSale(g, true).some((p) => p.kind === 'topping')).toBe(true);
  });
  it('buys seeds with shared coins, only what is unlocked and affordable', () => {
    const g = fresh(), w = wallet(10);
    expect(buySeeds(g, w, 'tulip', 2, false)).toBe(true);
    expect(w.coins).toBe(2);
    expect(buySeeds(g, w, 'tulip', 1, false)).toBe(false);
    expect(buySeeds(g, wallet(999), 'peony', 1, false)).toBe(false); // garden level too low
    expect(buySeeds(g, wallet(999), 'g-basil', 1, false)).toBe(false);
  });
  it('sells harvests for coins (the early way to earn before the pizza shop)', () => {
    const g = fresh(), w = wallet();
    g.basket = { daisy: 4, 'sp-moonpetal': 1 };
    expect(sell(g, w, 'daisy', 5)).toBe(0);
    expect(sell(g, w, 'daisy', 2)).toBe(plantDef('daisy')!.sellPrice * 2);
    expect(sellAll(g, w)).toBe(plantDef('daisy')!.sellPrice * 2);
    expect(g.basket).toEqual({ 'sp-moonpetal': 1 }); // specials are kept
  });
  it('more plots cost more, up to the maximum', () => {
    const g = fresh(), w = wallet(100_000);
    let last = 0;
    while (g.plots.length < MAX_PLOTS) { const p = plotPrice(g)!; expect(p).toBeGreaterThanOrEqual(last); last = p; expect(buyPlot(g, w)).toBe(true); }
    expect(plotPrice(g)).toBeNull();
    expect(buyPlot(g, w)).toBe(false);
  });
  it('decor: buy, switch, never sell special decor', () => {
    const g = fresh(), w = wallet(100);
    expect(buyGardenDecor(g, w, 'fence-white')).toBe(true);
    expect(g.decor.on.fence).toBe('fence-white');
    expect(useGardenDecor(g, 'fence-wood')).toBe(true);
    expect(buyGardenDecor(g, wallet(9999), 'lights-stars')).toBe(false);
    expect(useGardenDecor(g, 'lights-stars')).toBe(false);
  });
});

describe('bouquets & photos', () => {
  it('ties a bouquet from basket flowers only', () => {
    const g = fresh();
    g.basket = { daisy: 2, rose: 1, strawberry: 5 };
    expect(makeBouquet(g, ['daisy', 'daisy'], 'kraft', T0)).toBeNull(); // too small
    expect(makeBouquet(g, ['daisy', 'daisy', 'daisy'], 'kraft', T0)).toBeNull(); // not enough daisies
    expect(makeBouquet(g, ['daisy', 'strawberry', 'rose'], 'kraft', T0)).toBeNull(); // not a flower
    expect(makeBouquet(g, ['daisy', 'daisy', 'rose'], 'nope', T0)).toBeNull();
    const b = makeBouquet(g, ['daisy', 'daisy', 'rose'], 'blush', T0)!;
    expect(b.flowers).toHaveLength(3);
    expect(g.basket).toEqual({ strawberry: 5 });
  });
  it('a bouquet sells for more than its loose flowers', () => {
    const g = fresh(), w = wallet();
    g.basket = { rose: 3 };
    const b = makeBouquet(g, ['rose', 'rose', 'rose'], 'kraft', T0)!;
    expect(bouquetValue(b)).toBeGreaterThan(plantDef('rose')!.sellPrice * 3);
    expect(sellBouquet(g, w, b.id)).toBe(bouquetValue(b));
    expect(g.bouquets).toHaveLength(0);
  });
  it('photos store the arrangement, not pixels', () => {
    const g = fresh();
    plant(g, 0, 'daisy', T0);
    const p = photoGarden(g, T0 + 3 * MIN);
    expect(p.plots![0]).toEqual({ plantId: 'daisy', stage: 3 });
    const b = photoBouquet(g, { id: 'x', flowers: ['rose', 'rose', 'daisy'], wrap: 'kraft', at: T0 }, T0);
    expect(b.flowers).toEqual(['rose', 'rose', 'daisy']);
    expect(JSON.stringify(g.photos).length).toBeLessThan(1000);
  });
});

describe('notifications & cooking', () => {
  it('announces each ready plant once, and lists upcoming ready times', () => {
    const g = fresh();
    plant(g, 0, 'daisy', T0);
    plant(g, 1, 'tulip', T0);
    expect(upcomingReady(g, T0).map((x) => x.plantId)).toEqual(['daisy', 'tulip']);
    expect(newlyReady(g, T0 + 3 * MIN).map((x) => x.plantId)).toEqual(['daisy']);
    expect(newlyReady(g, T0 + 4 * MIN)).toEqual([]);
    expect(upcomingReady(g, T0 + 4 * MIN).map((x) => x.plantId)).toEqual(['tulip']);
  });
  it('garden produce makes the matching cooking recipe special', () => {
    const g = fresh();
    expect(cookingProduce(g, 'Strawberry Cake')).toBeNull();
    g.basket.strawberry = 1;
    expect(cookingProduce(g, 'Strawberry Cake')?.id).toBe('strawberry');
    expect(useProduce(g, 'strawberry')).toBe(true);
    expect(useProduce(g, 'strawberry')).toBe(false);
  });
});

describe('garden save', () => {
  it('new games start with a locked garden of four empty plots', () => {
    const s = defaultState();
    expect(SAVE_VERSION).toBe(8);
    expect(s.garden.unlocked).toBe(false);
    expect(s.garden.plots).toHaveLength(START_PLOTS);
  });
  it('older saves gain a garden; damaged gardens are repaired', () => {
    expect(migrate({ version: 7, level: 12 }).garden.plots).toHaveLength(START_PLOTS);
    const m = migrate({ version: 8, garden: {
      unlocked: true, plots: [{ plantId: 'nope', plantedAt: 1 }, { plantId: 'rose', plantedAt: T0, wateredAt: 'x' }, 5],
      seeds: { daisy: 2, fake: 9, tulip: -1 }, basket: 'bad', decor: { owned: [], on: { fence: 'lights-stars' } }, bouquets: [{ id: 'b', flowers: ['carrot'] }],
    } });
    expect(m.garden.plots.map((p) => p.plantId)).toEqual([null, 'rose', null, null]);
    expect(m.garden.plots[1].wateredAt).toBeNull();
    expect(m.garden.seeds).toEqual({ daisy: 2 });
    expect(m.garden.basket).toEqual({});
    expect(m.garden.decor.on).toEqual(GARDEN_DECOR_DEFAULT);
    expect(m.garden.bouquets).toEqual([]);
  });
  it('garden levels rise with XP', () => {
    expect(gardenLevel(0)).toBe(1);
    expect(gardenLevel(40)).toBe(2);
    expect(gardenLevel(100_000)).toBeGreaterThan(10);
  });
  it('repair keeps a good garden as it is', () => {
    const g = fresh();
    plant(g, 0, 'daisy', T0);
    const copy = JSON.parse(JSON.stringify(g));
    repairGarden(copy);
    expect(copy).toEqual(g);
  });
});

import { describe, it, expect } from 'vitest';
import { CUSTOMERS, DECOR, DECOR_DEFAULT, RECIPES, SHOP_LEVELS } from '../src/pizza/data';
import {
  CUSTOM_ID, UNLOCK_LEVEL, allRecipes, bakeScore, buy, buyDecor, canMakeCount, consume, customPriceRange, customRecipeDef,
  defaultPizza, doughScore, findRecipe, have, isValidCustom, judgePizza, missingFor, nextCustomer, price, recipeUnlocked,
  settle, shopLevel, sliceScore, tierUnlocked, toppingAccuracy, useDecor, type CustomRecipe, type PizzaBuild,
} from '../src/pizza/logic';
import { coverage, emptyLook, packLook, paint, unpackLook, GRID } from '../src/pizza/draw';
import { migrate, defaultState } from '../src/core/state';
import { STORY_QUESTS } from '../src/content/quests';

const perfect = (recipeId: string, tier: 1 | 2 | 3 = 1): PizzaBuild => {
  const r = RECIPES.find((x) => x.id === recipeId)!;
  const tiers: PizzaBuild['tiers'] = { dough: tier, [r.sauce]: tier, mozzarella: tier, box: tier };
  const placed: PizzaBuild['placed'] = {};
  for (const t of r.toppings) { tiers[t.kind] = tier; placed[t.kind] = t.count; }
  return { recipeId, tiers, placed, scores: { dough: 1, sauce: 1, cheese: 1, toppings: 1, bake: 1, slice: 1 } };
};

describe('pizza shop data', () => {
  it('has six recipes, cheapest to most expensive', () => {
    expect(RECIPES).toHaveLength(6);
    for (let i = 1; i < RECIPES.length; i++) expect(RECIPES[i].price).toBeGreaterThan(RECIPES[i - 1].price);
    expect(RECIPES[5].rank).toBe(6);
  });
  it('has ten customers whose favourites exist', () => {
    expect(CUSTOMERS).toHaveLength(10);
    const ids = new Set(RECIPES.map((r) => r.id));
    for (const c of CUSTOMERS) for (const f of c.favorites) expect(ids.has(f), `${c.id} → ${f}`).toBe(true);
  });
  it('unlocks at level 10 with a Grand Opening quest', () => {
    expect(UNLOCK_LEVEL).toBe(10);
    expect(STORY_QUESTS.find((q) => q.id === 'pizza-grand-opening')?.autoStart).toEqual({ minLevel: UNLOCK_LEVEL });
    expect(migrate({ version: 6, level: 12 }).pizza.unlocked).toBe(true);
    expect(migrate({ version: 6, level: 9 }).pizza.unlocked).toBe(false);
    expect(migrate({ version: 5 }).pizza.coins).toBe(0);
  });
  it('older pizza saves gain decor, no custom pizza and no session', () => {
    const m = migrate({ version: 6, level: 30, pizza: { unlocked: true, coins: 50, stock: {}, menu: [], regulars: {} } });
    expect(m.pizza.decor.on).toEqual(DECOR_DEFAULT);
    expect(m.pizza.custom).toBeNull();
    expect(m.pizza.session).toBeNull();
    const bad = migrate({ version: 7, pizza: { custom: { name: '', sauce: 'x' }, decor: { owned: [], on: { wall: 'nope' } }, session: 'junk' } });
    expect(bad.pizza.custom).toBeNull();
    expect(bad.pizza.decor.on.wall).toBe('wall-cream');
    expect(bad.pizza.session).toBeNull();
  });
});

describe('market & stock', () => {
  it('buys, spends coins and respects tier unlocks', () => {
    const p = defaultPizza();
    p.coins = 20;
    expect(buy(p, 'dough', 1, 3)).toBe(true);
    expect(p.coins).toBe(20 - price('dough', 1) * 3);
    expect(have(p, 'dough', 1)).toBe(3);
    expect(tierUnlocked(p, 3)).toBe(false);
    expect(buy(p, 'dough', 3)).toBe(false); // premium needs shop level 4
    expect(buy(p, 'truffle', 1, 99)).toBe(false); // can't afford
    expect(consume(p, 'dough', 1)).toBe(true);
    expect(have(p, 'dough', 1)).toBe(2);
    expect(consume(p, 'dough', 2)).toBe(false);
  });
  it('knows what is missing and how many can be made', () => {
    const p = defaultPizza();
    const cheese = RECIPES[0];
    expect(missingFor(p, cheese)).toEqual(['dough', 'tomato', 'mozzarella', 'box']);
    for (const k of ['dough', 'tomato', 'mozzarella', 'box'] as const) p.stock[`${k}:1`] = 2;
    p.stock['mozzarella:1'] = 1;
    expect(canMakeCount(p, cheese)).toBe(1);
  });
  it('shop levels unlock recipes over time', () => {
    const p = defaultPizza();
    expect(RECIPES.filter((r) => recipeUnlocked(p, r)).map((r) => r.id)).toEqual(['cheese', 'basil']);
    p.xp = SHOP_LEVELS[4];
    expect(shopLevel(p.xp)).toBe(5);
    expect(RECIPES.every((r) => recipeUnlocked(p, r))).toBe(true);
  });
});

describe('making and judging pizzas', () => {
  const mika = CUSTOMERS[0];
  it('a perfect pizza gets 5 stars; premium pays more', () => {
    const basic = judgePizza(perfect('basil', 1), 'basil', mika, 0.2);
    const premium = judgePizza(perfect('basil', 3), 'basil', mika, 0.2);
    expect(basic.stars).toBe(5);
    expect(premium.pay).toBeGreaterThan(basic.pay);
    expect(basic.correct).toBe(true);
  });
  it('the wrong pizza is one star', () => {
    const v = judgePizza(perfect('cheese'), 'pepperoni', mika, 0.1);
    expect(v.stars).toBe(1);
    expect(v.correct).toBe(false);
    expect(v.tip).toBe(0);
  });
  it('sloppy work costs stars; a long wait only trims the tip (relaxed shop)', () => {
    const b = perfect('cheese');
    b.scores = { dough: 0.3, sauce: 0.4, cheese: 0.4, toppings: 1, bake: 0.2, slice: 0.3 };
    expect(judgePizza(b, 'cheese', mika, 0.2).stars).toBeLessThanOrEqual(3);
    const quick = judgePizza(perfect('royale'), 'royale', mika, 0);
    const slow = judgePizza(perfect('royale'), 'royale', mika, 1);
    expect(slow.stars).toBe(5);
    expect(slow.tip).toBeLessThan(quick.tip);
    expect(slow.tip).toBeGreaterThanOrEqual(Math.floor(quick.tip * 0.65));
  });
  it('toppings: right amounts, no extras', () => {
    const veg = RECIPES.find((r) => r.id === 'garden')!;
    expect(toppingAccuracy(veg, { pepper: 5, onion: 5, olive: 6 })).toBe(1);
    expect(toppingAccuracy(veg, { pepper: 5, onion: 5 })).toBeLessThan(0.7);
    expect(toppingAccuracy(veg, { pepper: 5, onion: 5, olive: 6, ham: 2 })).toBeLessThan(1);
  });
  it('dough, bake and slice timing', () => {
    expect(doughScore(0.93)).toBe(1);
    expect(doughScore(0.5)).toBe(0);
    expect(bakeScore(0.7)).toBe(1);
    expect(bakeScore(1.02)).toBeLessThan(0.1);
    const through = (a: number) => ({ a: [-Math.cos(a), -Math.sin(a)] as [number, number], b: [Math.cos(a), Math.sin(a)] as [number, number] });
    expect(sliceScore([0, 1, 2, 3].map((i) => through((i * Math.PI) / 4)), 1)).toBeCloseTo(1, 5);
    expect(sliceScore([{ a: [-1, 0.8], b: [1, 0.8] }], 1)).toBeLessThan(0.4);
  });
  it('sauce coverage counts the inside, spill counts the crust', () => {
    const cells = new Uint8Array(GRID * GRID);
    expect(coverage(cells).covered).toBe(0);
    for (let y = -1; y <= 1; y += 0.05) for (let x = -1; x <= 1; x += 0.05) if (Math.hypot(x, y) < 0.7) paint(cells, x, y, 0.1);
    const c = coverage(cells);
    expect(c.covered).toBeGreaterThan(0.6);
    expect(c.spill).toBe(0);
  });
  it('settling pays, levels and remembers regulars', () => {
    const p = defaultPizza();
    const v = judgePizza(perfect('cheese'), 'cheese', mika, 0.1);
    settle(p, v, 'mika', '2026-11-06');
    settle(p, v, 'mika', '2026-11-06');
    expect(p.coins).toBe((v.pay + v.tip) * 2);
    expect(p.served).toBe(2);
    expect(p.regulars.mika.visits).toBe(2);
    expect(p.day.served).toBe(2);
    settle(p, v, 'mika', '2026-11-07');
    expect(p.day.served).toBe(1); // a new day starts fresh
  });
});

describe('customers', () => {
  it('only order from today’s menu and never twice at once', () => {
    const waiting = CUSTOMERS.slice(0, 9).map((c) => c.id);
    for (let i = 0; i < 20; i++) {
      const n = nextCustomer(['cheese', 'basil'], waiting)!;
      expect(['cheese', 'basil']).toContain(n.recipeId);
      expect(n.customer.id).toBe(CUSTOMERS[9].id);
    }
    expect(nextCustomer([], [])).toBeNull();
    expect(nextCustomer(['cheese'], CUSTOMERS.map((c) => c.id))).toBeNull();
  });
  it('the new save field exists', () => {
    expect(defaultState().pizza.stock).toEqual({});
  });
  it('custom pizza can be weighted up', () => {
    let custom = 0;
    let n = 0;
    const rand = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 400; i++) if (nextCustomer(['cheese', CUSTOM_ID], [], rand, (id) => (id === CUSTOM_ID ? 3 : 1))!.recipeId === CUSTOM_ID) custom++;
    expect(custom).toBeGreaterThan(220);
  });
});

describe('pizza of the day', () => {
  const mine = (over: Partial<CustomRecipe> = {}): CustomRecipe => {
    const base = { name: 'Chi Chi Special', sauce: 'tomato' as const, toppings: [{ kind: 'pineapple' as const, count: 6 }, { kind: 'basil' as const, count: 4 }] };
    return { ...base, price: customPriceRange(base).fair, ...over };
  };
  it('validates name, toppings and price', () => {
    expect(isValidCustom(mine())).toBe(true);
    expect(isValidCustom(mine({ name: '  ' }))).toBe(false);
    expect(isValidCustom(mine({ price: 1 }))).toBe(false);
    expect(isValidCustom(mine({ toppings: [{ kind: 'box', count: 3 }] }))).toBe(false);
    expect(isValidCustom(mine({ toppings: [{ kind: 'ham', count: 99 }] }))).toBe(false);
    expect(isValidCustom(mine({ toppings: [{ kind: 'ham', count: 3 }, { kind: 'ham', count: 3 }] }))).toBe(false);
  });
  it('joins the menu, needs its own ingredients and is judged against its own price', () => {
    const p = defaultPizza();
    expect(allRecipes(p)).toHaveLength(6);
    p.custom = mine();
    const r = findRecipe(p, CUSTOM_ID)!;
    expect(allRecipes(p)).toHaveLength(7);
    expect(r.shopLevel).toBe(3);
    expect(recipeUnlocked(p, r)).toBe(false);
    p.xp = SHOP_LEVELS[2];
    expect(recipeUnlocked(p, r)).toBe(true);
    expect(missingFor(p, r)).toEqual(['dough', 'tomato', 'mozzarella', 'pineapple', 'basil', 'box']);
    const build: PizzaBuild = { recipeId: CUSTOM_ID, tiers: { dough: 1, tomato: 1, mozzarella: 1, pineapple: 1, basil: 1, box: 1 }, placed: { pineapple: 6, basil: 4 }, scores: { dough: 1, sauce: 1, cheese: 1, toppings: 1, bake: 1, slice: 1 } };
    const v = judgePizza(build, CUSTOM_ID, CUSTOMERS[0], 0, r);
    expect(v.stars).toBe(5);
    expect(v.pay).toBe(r.price);
    expect(customRecipeDef(mine({ price: customPriceRange(mine()).max })).rank).toBeGreaterThanOrEqual(r.rank);
  });
});

describe('decor', () => {
  it('buys with shop coins, equips and switches back', () => {
    const p = defaultPizza();
    const neon = DECOR.find((d) => d.id === 'lights-neon')!;
    expect(buyDecor(p, neon.id)).toBe(false); // no coins
    p.coins = neon.price + 5;
    expect(buyDecor(p, neon.id)).toBe(true);
    expect(p.coins).toBe(5);
    expect(p.decor.on.lights).toBe(neon.id);
    expect(buyDecor(p, neon.id)).toBe(false); // already owned
    expect(useDecor(p, 'lights-none')).toBe(true);
    expect(useDecor(p, 'wall-stars')).toBe(false); // not owned
    expect(Object.values(DECOR_DEFAULT).every((id) => DECOR.find((d) => d.id === id)?.price === 0)).toBe(true);
  });
});

describe('saved shop session', () => {
  it('a half-made pizza survives packing to JSON', () => {
    const look = emptyLook();
    look.dough = { size: 0.9, tier: 2 };
    const cells = new Uint8Array(GRID * GRID);
    paint(cells, 0.1, 0.1, 0.3);
    look.sauce = { kind: 'tomato', tier: 1, cells };
    look.pieces.push({ kind: 'basil', tier: 1, x: 0.2, y: -0.1, rot: 1 });
    look.cuts.push({ a: [-1, 0], b: [1, 0] });
    const back = unpackLook(JSON.parse(JSON.stringify(packLook(look))));
    expect(back.dough).toEqual(look.dough);
    expect(Array.from(back.sauce!.cells)).toEqual(Array.from(cells));
    expect(back.cheese).toBeNull();
    expect(back.pieces).toEqual(look.pieces);
    expect(back.cuts).toEqual(look.cuts);
  });
  it('a saved session survives save/load (migrate)', () => {
    const s = defaultState();
    s.pizza.open = true;
    s.pizza.session = { queue: [{ uid: 3, customerId: 'mika', recipeId: 'cheese', patience: 90, left: 40 }], spawnIn: 5, uid: 4, cooking: null };
    const back = migrate(JSON.parse(JSON.stringify(s)));
    expect(back.pizza.session?.queue[0].customerId).toBe('mika');
  });
});

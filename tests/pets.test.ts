import { describe, it, expect } from 'vitest';
import { BREEDS, NEED_FLOOR, PERSONALITIES, PET_FOODS, PET_GIFTS, PET_ROOMS, STRAY_FEEDS, STRAY_GAP_MIN, STRAY_LEVEL, MAX_PETS } from '../src/pets/data';
import {
  adopt, adoptStray, applyActivity, bondLevel, buyFood, buyPet, canEat, lineup, defaultPets, feed, feedStray, foodsFor, maybeStray, mood, pat, PET_COOLDOWN,
  repairPets, rollGifts, roomOf, strayWantsToStay, takeGift, tick, type PetsState,
} from '../src/pets/logic';
import { ITEMS } from '../src/content/items';
import { migrate } from '../src/core/state';

const MIN = 60_000, H = 3_600_000;
const T0 = Date.UTC(2026, 10, 7, 9, 0);
const withFood = (): PetsState => { const s = defaultPets(); s.food = { 'kibble-cat': 5, 'kibble-dog': 5, fish: 3, bone: 3, can: 2 }; return s; };

describe('pet data', () => {
  it('cats and dogs, unique ids, shop pets cost tokens, the stray breed exists', () => {
    expect(new Set(BREEDS.map((b) => b.id)).size).toBe(BREEDS.length);
    expect(BREEDS.some((b) => b.species === 'cat')).toBe(true);
    expect(BREEDS.some((b) => b.species === 'dog')).toBe(true);
    expect(BREEDS.find((b) => b.id === 'cat-orange')).toBeTruthy();
    for (const b of BREEDS.filter((x) => x.price > 0)) expect(b.level).toBeGreaterThanOrEqual(4);
  });
  it('gift items exist; every food feeds someone', () => {
    for (const g of PET_GIFTS) if (g.item) expect(ITEMS[g.item], g.id).toBeTruthy();
    for (const f of PET_FOODS) expect(canEat(f.id, 'cat') || canEat(f.id, 'dog')).toBe(true);
  });
});

describe('needs', () => {
  it('fall slowly in real time, never below the floor, never on a clock set backwards', () => {
    const s = withFood();
    const p = adopt(s, 'cat-calico', 'lazy', 'Peach', T0)!;
    const before = { ...p.needs };
    tick(p, T0 - 5 * H);
    expect(p.needs).toEqual(before);
    tick(p, T0 + 2 * H);
    expect(p.needs.hunger).toBeLessThan(before.hunger);
    tick(p, T0 + 500 * H);
    for (const v of Object.values(p.needs)) expect(v).toBe(NEED_FLOOR);
    expect(mood(p)).toBe('hungry');
  });
  it('feeding: right species only, uses food, fills hunger; greedy pets love it more', () => {
    const s = withFood();
    const cat = adopt(s, 'cat-black', 'greedy', 'Nori', T0)!;
    const dog = adopt(s, 'dog-shiba', 'lazy', 'Kuma', T0)!;
    cat.needs.hunger = 30; dog.needs.hunger = 30;
    expect(feed(s, cat, 'bone', T0)).toBe(false);
    expect(feed(s, dog, 'fish', T0)).toBe(false);
    expect(feed(s, cat, 'fish', T0)).toBe(true);
    expect(s.food.fish).toBe(2);
    expect(feed(s, dog, 'can', T0)).toBe(true);
    expect(dog.needs.hunger).toBe(90);
    expect(cat.bond).toBeGreaterThan(dog.bond);
    expect(foodsFor(s, cat).map((f) => f.id)).not.toContain('bone');
    s.food = {};
    expect(feed(s, cat, 'fish', T0)).toBe(false);
  });
  it('petting has a short cooldown', () => {
    const s = withFood();
    const p = adopt(s, 'cat-grey', 'cuddly', 'Mochi', T0)!;
    p.needs.joy = 40;
    expect(pat(p, T0)).toBe(true);
    expect(pat(p, T0 + 1000)).toBe(false);
    expect(pat(p, T0 + PET_COOLDOWN)).toBe(true);
    expect(p.needs.joy).toBeGreaterThan(55);
  });
  it('activities restore the right need; bond hearts grow', () => {
    const s = withFood();
    const p = adopt(s, 'dog-corgi', 'playful', 'Waffles', T0)!;
    p.needs = { hunger: 50, joy: 20, clean: 20, nails: 20 };
    applyActivity(p, 'bath', 1, T0);
    applyActivity(p, 'nails', 1, T0);
    applyActivity(p, 'fetch', 1, T0);
    expect(p.needs.clean).toBe(100);
    expect(p.needs.nails).toBe(100);
    expect(p.needs.joy).toBeGreaterThan(55);
    expect(bondLevel(0)).toBe(0);
    expect(bondLevel(10_000)).toBe(5);
  });
});

describe('the stray', () => {
  it('appears from level 3, needs feeding on separate visits, then moves in once', () => {
    const s = withFood();
    expect(maybeStray(s, STRAY_LEVEL - 1, T0)).toBeNull();
    expect(maybeStray(s, STRAY_LEVEL, T0, () => 0)?.breed).toBe('cat-orange');
    expect(maybeStray(s, STRAY_LEVEL, T0)).toBeNull(); // only one at a time
    expect(feedStray(s, 'bone', T0)).toBe(-1); // dog food
    expect(feedStray(s, 'fish', T0)).toBe(1);
    expect(feedStray(s, 'fish', T0 + MIN)).toBe(-1); // same visit
    let t = T0;
    for (let i = 2; i <= STRAY_FEEDS; i++) { t += STRAY_GAP_MIN * MIN; expect(feedStray(s, 'kibble-cat', t)).toBe(i); }
    expect(strayWantsToStay(s)).toBe(true);
    const p = adoptStray(s, '  Marmalade  ', t)!;
    expect(p.name).toBe('Marmalade');
    expect(s.stray).toBeNull();
    expect(s.strayDone).toBe(true);
    expect(maybeStray(s, 10, t)).toBeNull();
  });
});

describe('pets around the house', () => {
  it('each pet is in one of the pet rooms, stable within a while', () => {
    const s = withFood();
    const p = adopt(s, 'cat-siamese', 'shy', 'Latte', T0)!;
    expect(PET_ROOMS).toContain(roomOf(p, T0));
    expect(roomOf(p, T0 + MIN)).toBe(roomOf(p, T0));
  });
  it('leave gifts while she is away (at most 5), picked up once', () => {
    const s = withFood();
    adopt(s, 'cat-tuxedo', 'curious', 'Bean', T0);
    adopt(s, 'dog-pom', 'playful', 'Mango', T0);
    expect(rollGifts(s, T0, {})).toEqual([]); // starts the clock
    const g = rollGifts(s, T0 + 10 * H, { livingroom: 2000 }, () => 0.1);
    expect(g.length).toBeGreaterThan(0);
    expect(s.gifts.length).toBeLessThanOrEqual(5);
    const first = s.gifts[0];
    expect(takeGift(s, first.id)?.gift.id).toBe(first.id);
    expect(takeGift(s, first.id)).toBeNull();
  });
  it('no more than the house can hold', () => {
    const s = withFood();
    for (let i = 0; i < MAX_PETS; i++) expect(adopt(s, 'cat-black', 'lazy', `C${i}`, T0)).not.toBeNull();
    expect(adopt(s, 'cat-black', 'lazy', 'One too many', T0)).toBeNull();
  });
});

describe('pet shop', () => {
  it('a daily lineup of 4 unlocked animals, stable for the day', () => {
    const a = lineup('2026-11-07', 4);
    expect(a).toHaveLength(4);
    expect(lineup('2026-11-07', 4)).toEqual(a);
    for (const o of a) expect(BREEDS.find((b) => b.id === o.breed)!.level).toBeLessThanOrEqual(4);
    expect(new Set(a.map((o) => o.personality)).size).toBe(4); // all different
    const later = lineup('2026-11-07', 20).map((o) => o.breed);
    expect(later.every((id) => BREEDS.find((b) => b.id === id)!.price > 0)).toBe(true);
  });
  it('buys pets and food with heart tokens', () => {
    const s = defaultPets();
    const wallet = { tokens: 1000 };
    const offer = lineup('2026-11-07', 8)[0];
    expect(buyPet(s, wallet, '2026-11-07', 3, offer.breed, 'Too early', T0)).toBeNull();
    expect(buyPet(s, wallet, '2026-11-07', 8, 'cat-orange', 'Not sold', T0)).toBeNull();
    const p = buyPet(s, wallet, '2026-11-07', 8, offer.breed, 'Bean', T0)!;
    expect(p.personality).toBe(offer.personality);
    expect(wallet.tokens).toBe(1000 - offer.price);
    expect(buyPet(s, { tokens: 1 }, '2026-11-07', 8, offer.breed, 'Broke', T0)).toBeNull();
    expect(buyFood(s, wallet, 'fish')).toBe(true);
    expect(s.food.fish).toBe(PET_FOODS.find((f) => f.id === 'fish')!.pack);
    expect(buyFood(s, { tokens: 0 }, 'fish')).toBe(false);
  });
});

describe('pet save', () => {
  it('older saves gain an empty home; damaged pets are fixed or dropped', () => {
    expect(migrate({ version: 9 }).pets.list).toEqual([]);
    const m = migrate({ version: 10, pets: {
      list: [{ id: 'a', breed: 'cat-orange', name: '', personality: 'weird', needs: { hunger: 999 } }, { id: 'b', breed: 'dragon' }, { id: 'a', breed: 'cat-orange' }],
      food: { fish: 2, rocks: 9 }, stray: { breed: 'nope' }, gifts: [{ gift: 'sock', room: 'moon' }],
    } });
    expect(m.pets.list).toHaveLength(1);
    expect(m.pets.list[0].name).toBe('Mochi');
    expect(m.pets.list[0].personality in PERSONALITIES).toBe(true);
    expect(m.pets.list[0].needs.hunger).toBe(100);
    expect(m.pets.food).toEqual({ fish: 2 });
    expect(m.pets.stray).toBeNull();
    expect(m.pets.gifts).toEqual([]);
  });
  it('repair keeps a good state', () => {
    const s = withFood();
    adopt(s, 'cat-orange', 'lazy', 'Mochi', T0);
    const copy = JSON.parse(JSON.stringify(s));
    repairPets(copy);
    expect(copy).toEqual(s);
  });
});

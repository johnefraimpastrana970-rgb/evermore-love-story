import { describe, it, expect } from 'vitest';
import { COLORS, DEFAULT_LOOK, FLOORS, ITEM_INTERACT, ITEMS, MAX_ITEMS_PER_ROOM, VIBES, WALLS } from '../src/home/data';
import { FACES } from '../src/art/chibi/spec';

describe('using placed items', () => {
  it('every item can be used by her, by him and (decorations) by pets, with real faces', () => {
    for (const it of ITEMS) {
      const x = ITEM_INTERACT[it.id];
      expect(x, it.id).toBeDefined();
      expect(x.label.length, it.id).toBeGreaterThan(0);
      expect(x.lines.length, it.id).toBeGreaterThan(0);
      expect(x.his.lines.length, it.id).toBeGreaterThan(0);
      expect(FACES as readonly string[], it.id).toContain(x.face);
      if (x.his.face) expect(FACES as readonly string[], it.id).toContain(x.his.face);
      if (x.pose === 'sit') expect(x.seat, it.id).toBeGreaterThan(0);
      // Beds, perches and toys have their own pet behaviour; plain decorations need a pet moment.
      if (it.use === 'deco') expect(x.pet, it.id).toBeDefined();
    }
  });
});

describe('the comfort room is gone', () => {
  it('a save made in the comfort room wakes up in the bathroom, and old quests point there too', () => {
    const m = migrate({
      version: 13, location: 'comfortroom', visited: { comfortroom: 2, bedroom: 1 },
      quests: { active: {}, completed: {}, generated: { d1: { id: 'd1', objectives: [{ type: 'visit', location: 'comfortroom', label: 'Visit the comfort room' }] } }, dailyKey: '', weeklyKey: '', tracked: null },
    });
    expect(m.location).toBe('bathroom');
    expect((m.visited as Record<string, number>).comfortroom).toBeUndefined();
    const o = (m.quests.generated.d1 as unknown as { objectives: { location: string; label: string }[] }).objectives[0];
    expect(o.location).toBe('bathroom');
    expect(o.label).toBe('Visit the bathroom');
  });
});
import { applyVibe, buy, defaultHome, lookKey, move, owns, place, repairHome, remember, resolveLook, setColor, setFloor, setWall, spare, store } from '../src/home/logic';
import { migrate } from '../src/core/state';

describe('decorating data', () => {
  it('unique ids; vibes only use things that exist', () => {
    const ids = [...WALLS, ...FLOORS, ...COLORS, ...VIBES, ...ITEMS].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const v of VIBES) for (const id of Object.values(v.look)) if (id) expect(ids, `${v.id} → ${id}`).toContain(id);
  });
  it('includes varied wallpaper designs and a larger furniture catalog', () => {
    expect(WALLS.map((wall) => wall.style.pattern)).toEqual(expect.arrayContaining(['floral', 'scallop', 'checker', 'stars']));
    expect(ITEMS.length).toBeGreaterThanOrEqual(18);
    expect(MAX_ITEMS_PER_ROOM).toBeGreaterThan(6);
    expect(ITEMS.find((item) => item.id === 'bookshelf')?.use).toBe('deco');
    expect(ITEMS.find((item) => item.id === 'cushion-stack')?.use).toBe('bed');
  });
  it('the default look is free and unchanged when painting', () => {
    const h = defaultHome();
    for (const r of ['bedroom', 'livingroom', 'kitchen'] as const) {
      for (const id of Object.values(DEFAULT_LOOK[r])) expect(owns(h, id)).toBe(true);
      expect(resolveLook(h, r)).toEqual({});
    }
  });
});

describe('buying and applying', () => {
  it('walls, floors and colours: buy once with tokens, then use freely', () => {
    const h = defaultHome();
    const w = { tokens: 100 };
    expect(setWall(h, 'bedroom', 'wall-mint')).toBe(false); // not owned
    expect(buy(h, w, 'wall-mint')).toBe(true);
    expect(w.tokens).toBe(60);
    expect(buy(h, w, 'wall-mint')).toBe(false); // already owned
    expect(setWall(h, 'bedroom', 'wall-mint')).toBe(true);
    expect(resolveLook(h, 'bedroom').wall?.base).toBe(WALLS.find((x) => x.id === 'wall-mint')!.style.base);
    expect(buy(h, { tokens: 1 }, 'floor-pink-carpet')).toBe(false);
    expect(setFloor(h, 'kitchen', 'floor-honey')).toBe(true);
    expect(buy(h, w, 'c-mint')).toBe(true);
    expect(setColor(h, 'livingroom', 'sofa', 'c-mint')).toBe(true);
    expect(setColor(h, 'kitchen', 'sofa', 'c-mint')).toBe(false); // no sofa in the kitchen
    expect(resolveLook(h, 'livingroom').sofa).toBe(COLORS.find((c) => c.id === 'c-mint')!.color);
  });
  it('a vibe restyles a whole room and the look key changes', () => {
    const h = defaultHome();
    const before = lookKey(h, 'livingroom');
    buy(h, { tokens: 999 }, 'vibe-strawberry');
    expect(applyVibe(h, 'livingroom', 'vibe-strawberry')).toBe(true);
    expect(h.rooms.livingroom.wall).toBe('wall-strawberry');
    expect(owns(h, 'wall-strawberry')).toBe(true); // granted with the vibe
    expect(lookKey(h, 'livingroom')).not.toBe(before);
    expect(applyVibe(h, 'livingroom', 'vibe-cozy')).toBe(true);
    expect(h.rooms.livingroom).toEqual(DEFAULT_LOOK.livingroom);
  });
});

describe('items', () => {
  it('buy copies, place, move, put away; a room holds at most a few', () => {
    const h = defaultHome();
    const w = { tokens: 10_000 };
    expect(place(h, 'bedroom', 'cat-tree', 500, 560)).toBeNull();
    expect(buy(h, w, 'cat-tree')).toBe(true);
    expect(buy(h, w, 'cat-tree')).toBe(true); // items can be bought again
    expect(spare(h, 'cat-tree')).toBe(2);
    const p = place(h, 'bedroom', 'cat-tree', 500, 560)!;
    expect(spare(h, 'cat-tree')).toBe(1);
    expect(move(h, p.id, 700.4, 580.6)).toBe(true);
    expect(h.items[0]).toMatchObject({ x: 700, y: 581 });
    expect(store(h, p.id)).toBe(true);
    expect(spare(h, 'cat-tree')).toBe(2);
    for (let i = 0; i < MAX_ITEMS_PER_ROOM + 2; i++) buy(h, w, 'heart-pillow');
    for (let i = 0; i < MAX_ITEMS_PER_ROOM; i++) expect(place(h, 'kitchen', 'heart-pillow', 300, 560)).not.toBeNull();
    expect(place(h, 'kitchen', 'heart-pillow', 300, 560)).toBeNull();
  });
});

describe('home save', () => {
  it('older saves get the original look; damaged parts are repaired', () => {
    expect(migrate({ version: 10 }).home.rooms).toEqual(DEFAULT_LOOK);
    expect(migrate({ version: 12 }).home.memories).toEqual([]);
    const m = migrate({ version: 11, home: { owned: ['wall-mint', 'nope'], rooms: { bedroom: { wall: 'wall-lavender', floor: 'floor-honey' }, attic: {} }, items: [{ id: 'a', item: 'cat-tree', room: 'bedroom', x: 1, y: 2 }, { id: 'b', item: 'rocket', room: 'bedroom', x: 1, y: 2 }] } });
    expect(m.home.rooms.bedroom.wall).toBe(DEFAULT_LOOK.bedroom.wall); // lavender isn't owned
    expect(m.home.owned).toContain('wall-mint');
    expect(m.home.owned).not.toContain('nope');
    expect(m.home.items.map((i) => i.id)).toEqual(['a']);
  });
  it('repair keeps a good home', () => {
    const h = defaultHome();
    buy(h, { tokens: 999 }, 'wall-mint'); setWall(h, 'kitchen', 'wall-mint');
    const copy = JSON.parse(JSON.stringify(h));
    repairHome(copy);
    expect(copy).toEqual(h);
  });
  it('records each first-time home memory once and repairs saved entries', () => {
    const h = defaultHome();
    expect(remember(h, 'first-dinner', 123)).toMatchObject({ title: 'Our first cozy meal', room: 'kitchen', at: 123 });
    expect(remember(h, 'first-dinner', 456)).toBeNull();
    const copy = JSON.parse(JSON.stringify(h));
    repairHome(copy);
    expect(copy.memories).toEqual([
      { id: 'first-dinner', title: 'Our first cozy meal', caption: 'A little meal together at the kitchen table.', room: 'kitchen', at: 123 },
    ]);
  });
});

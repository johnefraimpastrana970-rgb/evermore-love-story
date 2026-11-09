import {
  COLORS, DEFAULT_LOOK, FLOORS, FURNITURE_SLOTS, HOUSE_ROOMS, ITEMS, MAX_ITEMS_PER_ROOM, VIBES, WALLS, itemDef,
  type HouseRoom, type RoomLook,
} from './data';
import type { PaintLook } from '../art/rooms';

/*
 * Decorating rules: what she owns, how each room looks, and the items placed on the floor.
 * Buying something (heart tokens) makes it free to switch to forever after.
 */

export interface PlacedItem { id: string; item: string; room: HouseRoom; x: number; y: number }
export const HOME_MEMORY_DEFS = {
  'first-dinner': { title: 'Our first cozy meal', caption: 'A little meal together at the kitchen table.', room: 'kitchen' },
  'first-bedroom-decor': { title: 'Making our bedroom ours', caption: 'We made our bedroom feel a little more like home.', room: 'bedroom' },
  'first-pet-play': { title: 'A playdate at home', caption: 'We made time for a little play together.', room: 'livingroom' },
} as const;
export type HomeMemoryId = keyof typeof HOME_MEMORY_DEFS;
export interface HomeMemory {
  id: HomeMemoryId;
  title: string;
  caption: string;
  room: HouseRoom;
  at: number;
}

export interface HomeState {
  owned: string[];
  rooms: Record<HouseRoom, RoomLook>;
  items: PlacedItem[];
  memories: HomeMemory[];
}

const FREE = [...WALLS, ...FLOORS, ...COLORS, ...VIBES].filter((x) => x.price === 0).map((x) => x.id);
let seq = 0;
const uid = () => `it${Date.now().toString(36)}${(seq++).toString(36)}`;

export function defaultHome(): HomeState {
  return { owned: [...FREE], rooms: JSON.parse(JSON.stringify(DEFAULT_LOOK)), items: [], memories: [] };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const known = (id: string) => [...WALLS, ...FLOORS, ...COLORS, ...VIBES, ...ITEMS].some((x) => x.id === id);
const memoryIds = Object.keys(HOME_MEMORY_DEFS) as HomeMemoryId[];

export function repairHome(h: HomeState) {
  h.owned = Array.isArray(h.owned) ? [...new Set(h.owned.filter((x) => typeof x === 'string' && known(x)))] : [];
  for (const id of FREE) if (!h.owned.includes(id)) h.owned.push(id);
  const rooms: Record<string, unknown> = isObj(h.rooms) ? h.rooms : {};
  const out = {} as Record<HouseRoom, RoomLook>;
  for (const r of HOUSE_ROOMS) {
    const d = DEFAULT_LOOK[r];
    const v = isObj(rooms[r]) ? rooms[r] as Record<string, unknown> : {};
    const ok = (id: unknown, list: { id: string }[]) => typeof id === 'string' && list.some((x) => x.id === id) && h.owned.includes(id);
    out[r] = {
      wall: ok(v.wall, WALLS) ? v.wall as string : d.wall, floor: ok(v.floor, FLOORS) ? v.floor as string : d.floor,
      sofa: ok(v.sofa, COLORS) ? v.sofa as string : d.sofa, blanket: ok(v.blanket, COLORS) ? v.blanket as string : d.blanket,
      curtain: ok(v.curtain, COLORS) ? v.curtain as string : d.curtain, rug: ok(v.rug, COLORS) ? v.rug as string : d.rug,
    };
  }
  h.rooms = out;
  h.items = (Array.isArray(h.items) ? h.items : []).filter((i): i is PlacedItem => isObj(i) && typeof i.id === 'string' && !!itemDef(String(i.item))
    && HOUSE_ROOMS.includes(i.room as HouseRoom) && Number.isFinite(i.x) && Number.isFinite(i.y));
  const seen = new Set<HomeMemoryId>();
  h.memories = (Array.isArray(h.memories) ? h.memories : []).filter((m) =>
    isObj(m) && typeof m.id === 'string' && memoryIds.includes(m.id as HomeMemoryId) && Number.isFinite(m.at) && !seen.has(m.id as HomeMemoryId)
      && !!seen.add(m.id as HomeMemoryId),
  ).map((m) => {
    const id = m.id as HomeMemoryId;
    const def = HOME_MEMORY_DEFS[id];
    return { id, title: def.title, caption: typeof m.caption === 'string' ? m.caption.slice(0, 160) : def.caption, room: def.room, at: m.at as number };
  });
}

export function remember(h: HomeState, id: HomeMemoryId, at = Date.now()): HomeMemory | null {
  if (h.memories.some((m) => m.id === id)) return null;
  const def = HOME_MEMORY_DEFS[id];
  const memory: HomeMemory = { id, ...def, at };
  h.memories.push(memory);
  return memory;
}

export const owns = (h: HomeState, id: string) => h.owned.includes(id);
const priceOf = (id: string) => [...WALLS, ...FLOORS, ...COLORS, ...VIBES, ...ITEMS].find((x) => x.id === id)?.price;

/** Buy something with heart tokens (items can be bought more than once: each is one placeable copy). */
export function buy(h: HomeState, wallet: { tokens: number }, id: string): boolean {
  const p = priceOf(id);
  if (p === undefined || wallet.tokens < p) return false;
  const isItem = !!itemDef(id);
  if (!isItem && owns(h, id)) return false;
  wallet.tokens -= p;
  h.owned.push(id);
  return true;
}

/** Copies of an item she owns that aren't placed anywhere. */
export const spare = (h: HomeState, item: string) => h.owned.filter((x) => x === item).length - h.items.filter((i) => i.item === item).length;

export function setWall(h: HomeState, room: HouseRoom, id: string) { if (owns(h, id) && WALLS.some((w) => w.id === id)) { h.rooms[room].wall = id; return true; } return false; }
export function setFloor(h: HomeState, room: HouseRoom, id: string) { if (owns(h, id) && FLOORS.some((w) => w.id === id)) { h.rooms[room].floor = id; return true; } return false; }
export function setColor(h: HomeState, room: HouseRoom, slot: keyof Omit<RoomLook, 'wall' | 'floor'>, id: string) {
  if (!owns(h, id) || !COLORS.some((c) => c.id === id) || !FURNITURE_SLOTS.find((s) => s.slot === slot)?.rooms.includes(room)) return false;
  h.rooms[room][slot] = id;
  return true;
}

/** Apply a vibe: everything it changes that this room has. Unowned parts of a bought vibe are granted. */
export function applyVibe(h: HomeState, room: HouseRoom, vibeId: string): boolean {
  const v = VIBES.find((x) => x.id === vibeId);
  if (!v || !owns(h, vibeId)) return false;
  const look = { ...DEFAULT_LOOK[room], ...Object.fromEntries(Object.entries(v.look).filter(([, id]) => id)) } as RoomLook;
  for (const id of Object.values(look)) if (!owns(h, id)) h.owned.push(id);
  h.rooms[room] = { ...look };
  for (const s of FURNITURE_SLOTS) if (!s.rooms.includes(room)) h.rooms[room][s.slot] = DEFAULT_LOOK[room][s.slot];
  return true;
}

export function place(h: HomeState, room: HouseRoom, item: string, x: number, y: number): PlacedItem | null {
  if (spare(h, item) <= 0 || h.items.filter((i) => i.room === room).length >= MAX_ITEMS_PER_ROOM) return null;
  const p: PlacedItem = { id: uid(), item, room, x: Math.round(x), y: Math.round(y) };
  h.items.push(p);
  return p;
}
export function move(h: HomeState, id: string, x: number, y: number) {
  const p = h.items.find((i) => i.id === id);
  if (!p) return false;
  p.x = Math.round(x); p.y = Math.round(y);
  return true;
}
export function store(h: HomeState, id: string) {
  const i = h.items.findIndex((x) => x.id === id);
  if (i < 0) return false;
  h.items.splice(i, 1);
  return true;
}

/** A short key of how a room looks (for caching its painted background). */
export const lookKey = (h: HomeState, room: HouseRoom) => Object.values(h.rooms[room]).join('|');

/** The painter's view of a room's look (only what differs from the original drawing). */
export function resolveLook(h: HomeState, room: HouseRoom): PaintLook {
  const L = h.rooms[room];
  const d = DEFAULT_LOOK[room];
  const color = (id: string) => { const c = COLORS.find((x) => x.id === id)?.color; return c === undefined || c < 0 ? undefined : c; };
  const out: PaintLook = {};
  if (L.wall !== d.wall) out.wall = WALLS.find((w) => w.id === L.wall)?.style;
  if (L.floor !== d.floor) { const f = FLOORS.find((x) => x.id === L.floor); if (f) out.floor = { kind: f.kind, color: f.color }; }
  for (const k of ['sofa', 'blanket', 'curtain', 'rug'] as const) { const c = color(L[k]); if (c !== undefined) out[k] = c; }
  return out;
}

import { describe, it, expect, beforeEach } from 'vitest';
import { xpToNext, addXp, titleFor } from '../src/systems/progression';
import { ruleMatches, activeOccasions } from '../src/systems/occasions';
import { startQuest, notifyQuests, refreshGenerated, questDef, isComplete } from '../src/systems/quests';
import { checkCondition, pickVariant, CondCtx } from '../src/systems/conditions';
import { defaultState, migrate, SAVE_VERSION } from '../src/core/state';
import { useStorage, writeSlot, readSlot, exportSave, importSave, latestSlot, KV } from '../src/core/save';
import { weekKey, daysBetween, timeOfDayForHour } from '../src/core/time';
import { OCCASIONS, OCCASION_TEMPLATES } from '../src/content/occasions';
import { LOCATIONS } from '../src/content/locations';
import { STORY_QUESTS } from '../src/content/quests';
import { DIALOGUE } from '../src/content/dialogue';
import { PERSONAL } from '../src/content/personal';
import { ITEMS } from '../src/content/items';
import { COSMETICS } from '../src/content/cosmetics';
import { TALK_NODES, JOKES, TEASES, DEEP_TALKS } from '../src/content/talks';
import { HER_PORTRAITS, HIS_PORTRAITS } from '../src/content/characters';
import { swapGender } from '../src/core/roles';
import { store } from '../src/core/store';
import { parseRoute } from '../src/phone/routes';
import fs from 'fs';
import path from 'path';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day, 12);

describe('progression', () => {
  it('xp curve grows and never stops', () => {
    let prev = 0;
    for (let l = 1; l <= 1000; l++) {
      const x = xpToNext(l);
      expect(x).toBeGreaterThan(0);
      expect(Number.isFinite(x)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(prev);
      prev = x;
    }
  });
  it('levels up with carry-over and rewards', () => {
    const s = defaultState('A', 'B');
    const res = addXp(s, xpToNext(1) + xpToNext(2) + 5);
    expect(s.level).toBe(3);
    expect(s.xp).toBe(5);
    expect(res.levelsGained).toBe(2);
    expect(s.tokens).toBeGreaterThan(0);
    // level 2 & 3 cosmetics unlock
    expect(s.cosmetics.owned).toContain('hair-midnight');
    expect(s.cosmetics.owned).toContain('outfit-sky');
  });
  it('ignores invalid xp', () => {
    const s = defaultState();
    addXp(s, -50);
    addXp(s, NaN);
    expect(s.xp).toBe(0);
  });
  it('has titles forever', () => {
    expect(titleFor(1)).toBe('Sleepyhead');
    expect(titleFor(500)).toMatch(/Evermore/);
  });
});

describe('occasions', () => {
  it('yearly with lead days', () => {
    const rule = { type: 'yearly' as const, month: 2, day: 14, durationDays: 1, leadDays: 1 };
    expect(ruleMatches(rule, d(2027, 2, 13))).toBe(true);
    expect(ruleMatches(rule, d(2027, 2, 14))).toBe(true);
    expect(ruleMatches(rule, d(2027, 2, 15))).toBe(false);
  });
  it('range wrapping the new year', () => {
    const rule = { type: 'range' as const, start: '12-31', end: '01-01' };
    expect(ruleMatches(rule, d(2026, 12, 31))).toBe(true);
    expect(ruleMatches(rule, d(2027, 1, 1))).toBe(true);
    expect(ruleMatches(rule, d(2027, 1, 2))).toBe(false);
  });
  it('monthly clamps to short months', () => {
    const rule = { type: 'monthly' as const, day: 31 };
    expect(ruleMatches(rule, d(2027, 2, 28))).toBe(true);
    expect(ruleMatches(rule, d(2027, 3, 31))).toBe(true);
    expect(ruleMatches(rule, d(2027, 3, 30))).toBe(false);
  });
  it('nth weekday and last weekday', () => {
    // 2nd Sunday of May 2027 = May 9
    expect(ruleMatches({ type: 'nthWeekday', month: 5, weekday: 0, nth: 2 }, d(2027, 5, 9))).toBe(true);
    expect(ruleMatches({ type: 'nthWeekday', month: 5, weekday: 0, nth: 2 }, d(2027, 5, 16))).toBe(false);
    // last Monday of May 2027 = May 31
    expect(ruleMatches({ type: 'nthWeekday', month: 5, weekday: 1, nth: -1 }, d(2027, 5, 31))).toBe(true);
  });
  it('fixed dates', () => {
    expect(ruleMatches({ type: 'fixed', date: '2027-06-01' }, d(2027, 6, 1))).toBe(true);
    expect(ruleMatches({ type: 'fixed', date: '2027-06-01' }, d(2028, 6, 1))).toBe(false);
  });
  it('personal templates stay off until enabled, but preview forces them', () => {
    const jan1 = d(2027, 1, 1);
    // Templates (before anything is set in the Author tool).
    expect(activeOccasions(OCCASION_TEMPLATES, jan1).map((o) => o.id)).not.toContain('anniversary');
    expect(activeOccasions(OCCASION_TEMPLATES, jan1, ['anniversary']).map((o) => o.id)).toContain('anniversary');
  });
  it('sorted by priority', () => {
    const list = activeOccasions(OCCASIONS, d(2026, 12, 31), ['just-because']);
    expect(list[0].id).toBe('newyear');
  });
});

describe('quests', () => {
  it('story chain progresses and starts the next chapter', () => {
    const s = defaultState();
    expect(startQuest(s, 'ch1-wake')).toBe(true);
    notifyQuests(s, { type: 'talk' });
    notifyQuests(s, { type: 'interact', hotspot: 'bedroom-window' });
    for (let i = 0; i < 2; i++) notifyQuests(s, { type: 'collect', kind: 'heart', location: 'bedroom' });
    expect(s.quests.active['ch1-wake']).toBeDefined();
    const res = notifyQuests(s, { type: 'collect', kind: 'petal', location: 'bedroom' });
    expect(res.completed.map((q) => q.id)).toEqual(['ch1-wake']);
    expect(s.quests.active['ch1-breakfast']).toBeDefined();
    expect(startQuest(s, 'ch1-wake')).toBe(false);
  });
  it('flag objectives complete from existing flags', () => {
    const s = defaultState();
    s.flags['secret-count-2'] = true;
    startQuest(s, 'ch2-secrets');
    expect(isComplete(s, 'ch2-secrets')).toBe(true);
    const res = notifyQuests(s, { type: 'flag' });
    expect(res.completed[0].id).toBe('ch2-secrets');
  });
  it('minigame minScore is respected', () => {
    const s = defaultState();
    refreshGenerated(s, '2027-01-04', '2027-W01');
    const weekly = Object.keys(s.quests.active).find((k) => k.startsWith('weekly-'))!;
    const def = questDef(s, weekly)!;
    const mg = def.objectives.find((o) => o.type === 'minigame')!;
    const idx = def.objectives.indexOf(mg);
    notifyQuests(s, { type: 'minigame', id: (mg as any).id, score: 10 });
    expect(s.quests.active[weekly].progress[idx]).toBe(0);
    notifyQuests(s, { type: 'minigame', id: (mg as any).id, score: 90 });
    expect(s.quests.active[weekly].progress[idx]).toBe(1);
  });
  it('daily quests are deterministic per day and replaced next day', () => {
    const a = defaultState(); a.createdAt = 1;
    const b = defaultState(); b.createdAt = 1;
    refreshGenerated(a, '2027-01-04', '2027-W01');
    refreshGenerated(b, '2027-01-04', '2027-W01');
    expect(JSON.stringify(a.quests.generated)).toBe(JSON.stringify(b.quests.generated));
    const dailies = Object.keys(a.quests.active).filter((k) => k.startsWith('daily-'));
    expect(dailies).toHaveLength(3);
    refreshGenerated(a, '2027-01-05', '2027-W01');
    const next = Object.keys(a.quests.active).filter((k) => k.startsWith('daily-'));
    expect(next).toHaveLength(3);
    expect(next.every((k) => k.includes('2027-01-05'))).toBe(true);
    expect(Object.keys(a.quests.active).filter((k) => k.startsWith('weekly-'))).toHaveLength(1);
  });
});

describe('conditions', () => {
  const base = (): CondCtx => ({ state: defaultState(), time: 'night', occasions: [], location: 'bedroom', day: '2027-01-01' });
  it('evaluates all fields', () => {
    const c = base();
    expect(checkCondition({ time: ['night'] }, c)).toBe(true);
    expect(checkCondition({ time: ['day'] }, c)).toBe(false);
    expect(checkCondition({ minLevel: 2 }, c)).toBe(false);
    expect(checkCondition({ occasion: '*' }, c)).toBe(false);
    c.occasions = ['valentines'];
    expect(checkCondition({ occasion: '*' }, c)).toBe(true);
    c.state.flags['tea-2027-01-01'] = true;
    expect(checkCondition({ notFlag: 'tea-{day}' }, c)).toBe(false);
  });
  it('conditional variants beat defaults', () => {
    const v = pickVariant([{ text: 'default' }, { if: { time: ['night'] }, text: 'night' }], base());
    expect(v?.text).toBe('night');
  });
});

describe('saves', () => {
  let mem: Map<string, string>;
  beforeEach(() => {
    mem = new Map();
    const kv: KV = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) };
    useStorage(kv);
  });
  it('round-trips and picks latest slot', () => {
    const s = defaultState('Her', 'Him');
    s.level = 7;
    writeSlot('slot2', s);
    const back = readSlot('slot2')!;
    expect(back.level).toBe(7);
    expect(back.profile.herName).toBe('Her');
    expect(latestSlot()).toBe('slot2');
  });
  it('falls back to backup on corruption', () => {
    const s = defaultState();
    s.level = 3;
    writeSlot('auto', s);
    s.level = 4;
    writeSlot('auto', s);
    mem.set('evermore.auto', '{broken');
    expect(readSlot('auto')!.level).toBe(3);
  });
  it('migrates old saves and fills new fields', () => {
    const old = { version: 1, level: 5, hearts: 42, profile: { herName: 'X', hisName: 'Y' } };
    const m = migrate(old);
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.tokens).toBe(42);
    expect(m.level).toBe(5);
    expect(m.cosmetics.equipped.herHair).toBeDefined();
    expect(m.quests.active).toEqual({});
  });
  it('removes the legacy online AI counter from existing saves', () => {
    const m = migrate({ version: SAVE_VERSION, phone: { ai: { day: 'today', count: 10 } } });
    expect(m.phone).not.toHaveProperty('ai');
  });
  it('export/import', () => {
    const s = defaultState('A', 'B');
    s.inventory.cookie = 3;
    const back = importSave(exportSave(s));
    expect(back.inventory.cookie).toBe(3);
    expect(() => importSave('nope')).toThrow();
  });
});

describe('time', () => {
  it('week keys and day maths', () => {
    expect(weekKey(d(2027, 1, 4))).toBe('2027-W01');
    expect(daysBetween('2027-01-31', '2027-02-01')).toBe(1);
    expect(timeOfDayForHour(7)).toBe('morning');
    expect(timeOfDayForHour(23)).toBe('night');
  });
});

describe('content integrity', () => {
  it('every hotspot dialogue / door / quest reference exists', () => {
    for (const loc of Object.values(LOCATIONS)) {
      for (const h of loc.hotspots) {
        if (h.action.kind === 'dialogue') for (const o of h.action.options) expect(DIALOGUE[o.id], `${h.id} -> ${o.id}`).toBeDefined();
        if (h.action.kind === 'door') expect(LOCATIONS[h.action.to]).toBeDefined();
        if (h.action.kind === 'inspect') for (const e of h.action.effects ?? []) if (e.type === 'item') expect(ITEMS[e.id]).toBeDefined();
        expect(h.x + h.w).toBeLessThanOrEqual(loc.width + 1);
      }
    }
  });
  it('dialogue next links resolve', () => {
    const special = new Set(['__chat', '__hug', '__joke', '__tease', '__deep']);
    const all = { ...DIALOGUE, ...TALK_NODES };
    for (const [id, n] of Object.entries(all)) {
      if (n.next) expect(all[n.next] || special.has(n.next), `${id}.next`).toBeTruthy();
      for (const c of n.choices ?? []) if (c.next) expect(all[c.next] || special.has(c.next), `${id} choice -> ${c.next}`).toBeTruthy();
    }
    for (const p of [...JOKES, ...TEASES, ...DEEP_TALKS]) expect(TALK_NODES[p.id], p.id).toBeDefined();
  });
  it('every mood used by her has a portrait, and art files exist', () => {
    const all = { ...DIALOGUE, ...TALK_NODES };
    for (const n of Object.values(all)) for (const l of n.lines) {
      if (l.speaker === 'her' && l.mood) expect(HER_PORTRAITS[l.mood], `her mood ${l.mood}`).toBeDefined();
    }
    for (const n of Object.values(all)) for (const l of n.lines) {
      if (l.speaker === 'him' && l.mood) expect(HIS_PORTRAITS[l.mood], `his mood ${l.mood}`).toBeDefined();
    }
    for (const src of [...Object.values(HER_PORTRAITS), ...Object.values(HIS_PORTRAITS)]) {
      expect(fs.existsSync(path.join(__dirname, '..', 'public', src!)), src).toBe(true);
      expect(fs.existsSync(path.join(__dirname, '..', 'public', src!.replace('.webp', '-avatar.webp')))).toBe(true);
    }
  });
  it('old saves switch to her real look', () => {
    const old = { version: 2, cosmetics: { owned: ['hair-cocoa', 'outfit-rose', 'accent-ribbon-red'], equipped: { herHair: 'hair-cocoa', herOutfit: 'outfit-rose', herAccent: 'accent-ribbon-red', hisHair: 'his-hair-ink', hisOutfit: 'his-outfit-navy' } } };
    const m = migrate(old);
    expect(m.cosmetics.equipped.herOutfit).toBe('outfit-cat-tee');
    expect(m.cosmetics.owned).toContain('hair-espresso');
    // and his real look too
    expect(m.cosmetics.equipped.hisOutfit).toBe('his-outfit-raglan');
    expect(m.cosmetics.equipped.hisHair).toBe('his-hair-black');
  });
  it('quests chain correctly', () => {
    const ids = new Set(STORY_QUESTS.map((q) => q.id));
    for (const q of STORY_QUESTS) if (q.next) expect(ids.has(q.next)).toBe(true);
  });
  it('personal ids are unique and default cosmetics exist', () => {
    const ids = PERSONAL.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const s = defaultState();
    for (const id of s.cosmetics.owned) expect(COSMETICS.find((c) => c.id === id)).toBeDefined();
  });
});

describe('play as her or him', () => {
  it('older saves keep her as the player', () => {
    expect(migrate({ version: 4, profile: { herName: 'A', hisName: 'B' } }).profile.playAs).toBe('her');
    expect(defaultState('A', 'B', 'him').profile.playAs).toBe('him');
  });
  it('swaps he/she words but not tokens', () => {
    expect(swapGender('{him} says he hid things.')).toBe('{him} says she hid things.');
    expect(swapGender('Her glasses fog up. Hug her.')).toBe('His glasses fog up. Hug him.');
    expect(swapGender('Hear 10 of his terrible jokes.')).toBe('Hear 10 of her terrible jokes.');
    expect(swapGender('Tell him how you feel.')).toBe('Tell her how you feel.');
    expect(swapGender('Hydrated girlfriend, happy boyfriend.')).toBe('Hydrated boyfriend, happy girlfriend.');
    expect(swapGender('It is his.')).toBe('It is hers.');
  });
  it('maps roles, names and text to whoever is played', () => {
    store.load(defaultState('Ella', 'Rob', 'him'));
    expect(store.playAs()).toBe('him');
    expect(store.cast('her')).toBe('him');
    expect(store.cast('him')).toBe('her');
    expect(store.fmt('Talk to {him}. {him} says he hid things.')).toBe('Talk to Ella. Ella says she hid things.');
    expect(store.fmt('the cat on my shirt', 'my hoodie')).toBe('my hoodie');
    expect(store.fmtLiteral('Dear {her}, — {him}')).toBe('Dear Ella, — Rob');
    store.load(defaultState('Ella', 'Rob'));
    expect(store.fmt('Talk to {him}. {him} says he hid things.')).toBe('Talk to Rob. Rob says he hid things.');
    store.unload();
  });
});
describe('phone foundation', () => {
  it('older saves gain an empty phone', () => {
    const m = migrate({ version: 4, profile: { herName: 'A', hisName: 'B' } });
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.phone.messages).toEqual([]);
    expect(m.phone.reminders).toEqual([]);
    expect(m.phone.wallpaper).toBe('blush');
  });
  it('keeps saved phone data', () => {
    const m = migrate({ version: 5, phone: { notes: [{ id: 'n1', title: 'x', body: 'y', createdAt: 1, updatedAt: 1 }], messages: 'broken' } });
    expect(m.phone.notes).toHaveLength(1);
    expect(m.phone.messages).toEqual([]);
  });
  it('parses deep links', () => {
    expect(parseRoute('evermore://phone/calendar?date=2026-11-20')).toBe('calendar?date=2026-11-20');
    expect(parseRoute('#/phone/messages')).toBe('messages');
    expect(parseRoute('#/phone')).toBe('home');
    expect(parseRoute('/phone/nope')).toBe('home');
    expect(parseRoute('#/settings')).toBeNull();
    expect(parseRoute('')).toBeNull();
  });
});
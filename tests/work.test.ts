import { describe, it, expect } from 'vitest';
import { BENTO_SLOTS, CRAVINGS, FOODS, SHIFTS_PER_DAY, SHIFT_MINUTES, UNLOCK_LEVEL, WORK_MESSAGES } from '../src/work/data';
import {
  arrive, bentoScore, cantGo, cleanBento, cravingFor, defaultWork, dueMessages, greet, messageText, repairWork, returnTime,
  shiftsLeft, startShift, status, type Bento,
} from '../src/work/logic';
import { PLANTS } from '../src/garden/data';
import { ITEMS } from '../src/content/items';
import { migrate } from '../src/core/state';

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 7, 9, 0);
const DAY = '2026-11-07';
const full = (): Bento => ({ slots: { rice: 'rice-heart', main: 'main-karaage', side: 'side-gyoza', veggie: 'veg-broccoli', sweet: 'sweet-apple' }, note: 'Love you!', wrap: 'pink' });

describe('work data', () => {
  it('every slot has foods, garden foods are real garden plants, cravings point at real foods', () => {
    for (const { slot } of BENTO_SLOTS) expect(FOODS.some((f) => f.slot === slot), slot).toBe(true);
    for (const f of FOODS.filter((x) => x.garden)) expect(PLANTS.some((p) => p.id === f.garden), f.id).toBe(true);
    for (const c of CRAVINGS) for (const id of c.foods) expect(FOODS.find((f) => f.id === id)?.slot, id).toBe(c.slot);
  });
  it('shifts are 15 minutes, 3 a day, from level 2; souvenir items exist', async () => {
    expect(SHIFT_MINUTES).toBe(15);
    expect(SHIFTS_PER_DAY).toBe(3);
    expect(UNLOCK_LEVEL).toBe(2);
    const { SOUVENIRS } = await import('../src/work/data');
    for (const s of SOUVENIRS) if (s.item) expect(ITEMS[s.item], s.id).toBeTruthy();
  });
});

describe('a work day', () => {
  it('pack → away → messages → waiting at the door → home with souvenirs', () => {
    const w = defaultWork();
    expect(status(w)).toBe('home');
    const s = startShift(w, full(), T0, DAY, 5)!;
    expect(status(w)).toBe('away');
    expect(returnTime(w)).toBe(T0 + 15 * MIN);
    expect(dueMessages(w, T0 + 3 * MIN)).toEqual([]);
    expect(dueMessages(w, T0 + 4 * MIN).map((m) => m.index)).toEqual([0]);
    expect(dueMessages(w, T0 + 5 * MIN)).toEqual([]); // never twice
    expect(arrive(w, T0 + 14 * MIN)).toBe(false);
    expect(arrive(w, T0 + 15 * MIN)).toBe(true);
    expect(status(w)).toBe('waiting');
    expect(arrive(w, T0 + 16 * MIN)).toBe(false);
    const g = greet(w, () => 0.5)!;
    expect(g.shift.leftAt).toBe(s.leftAt);
    expect(g.souvenirs.length).toBeGreaterThanOrEqual(2);
    expect(new Set(g.souvenirs.map((x) => x.id)).size).toBe(g.souvenirs.length);
    expect(status(w)).toBe('home');
    expect(greet(w)).toBeNull();
  });
  it('with the game closed all shift, the missed messages come at their own times', () => {
    const w = defaultWork();
    startShift(w, full(), T0, DAY, 5);
    expect(dueMessages(w, T0 + 60 * MIN).map((m) => m.at)).toEqual(WORK_MESSAGES.map((m) => T0 + m.at * MIN));
  });
  it('3 shifts a day, not while away or at the door, not with an empty box, not before level 2', () => {
    const w = defaultWork();
    expect(cantGo(w, 1, DAY, full())).toMatch(/level 2/);
    expect(cantGo(w, 5, DAY, { slots: {}, note: '', wrap: 'pink' })).toMatch(/lunch box/);
    for (let i = 0; i < 3; i++) {
      expect(startShift(w, full(), T0 + i * 20 * MIN, DAY, 5)).not.toBeNull();
      expect(cantGo(w, 5, DAY, full())).toMatch(/at work/);
      arrive(w, T0 + i * 20 * MIN + 15 * MIN);
      expect(cantGo(w, 5, DAY, full())).toMatch(/door/);
      greet(w);
    }
    expect(shiftsLeft(w, DAY)).toBe(0);
    expect(cantGo(w, 5, DAY, full())).toMatch(/done/);
    expect(shiftsLeft(w, '2026-11-08')).toBe(3); // a new day
    expect(startShift(w, full(), T0 + 24 * 60 * MIN, '2026-11-08', 5)).not.toBeNull();
  });
});

describe('bento', () => {
  it('a full, varied box with a note and his craving scores higher', () => {
    const c = cravingFor(DAY);
    const b = full();
    b.slots[c.slot] = c.foods[0];
    const best = bentoScore(b, DAY);
    expect(best.craved).toBe(true);
    const plain = bentoScore({ slots: { rice: 'rice-plain' }, note: '', wrap: 'pink' }, DAY);
    expect(best.score).toBeGreaterThan(plain.score);
    expect(bentoScore({ ...b, slots: { ...b.slots, sweet: 'sweet-strawberry' } }, DAY).garden).toBe(true);
  });
  it('the day’s craving is stable', () => {
    expect(cravingFor(DAY)).toBe(cravingFor(DAY));
  });
  it('his lunch message mentions something from the box', () => {
    const w = defaultWork();
    const s = startShift(w, { slots: { main: 'main-octopus' }, note: '', wrap: 'pink' }, T0, DAY, 5)!;
    expect(messageText(s, 0, () => 0)).toContain('octopus');
  });
  it('cleans bad bentos (wrong slot, unknown food, long note)', () => {
    const b = cleanBento({ slots: { rice: 'main-karaage', main: 'main-karaage', side: 'nope' }, note: 'x'.repeat(500), wrap: 'zzz' })!;
    expect(b.slots).toEqual({ main: 'main-karaage' });
    expect(b.note.length).toBe(60);
    expect(b.wrap).toBe('pink');
  });
});

describe('work save', () => {
  it('older saves gain an idle job; damaged shifts are dropped', () => {
    expect(migrate({ version: 8 }).work.away).toBeNull();
    const m = migrate({ version: 9, work: { day: 5, shifts: -2, away: { leftAt: 'x' }, waiting: { leftAt: 1, returnAt: 2, bento: { slots: { rice: 'rice-heart' } } }, last: 'bad' } });
    expect(m.work.shifts).toBe(0);
    expect(m.work.away).toBeNull();
    expect(m.work.waiting?.bento.slots).toEqual({ rice: 'rice-heart' });
    expect(m.work.last).toBeNull();
  });
  it('repair leaves a good state alone', () => {
    const w = defaultWork();
    startShift(w, full(), T0, DAY, 5);
    const copy = JSON.parse(JSON.stringify(w));
    repairWork(copy);
    expect(copy).toEqual(w);
  });
});

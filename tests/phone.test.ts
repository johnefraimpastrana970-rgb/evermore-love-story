import { describe, it, expect } from 'vitest';
import { Calculator, evaluate, formatNumber } from '../src/phone/calc';
import { occurrences, nextOccurrence, zonedToUtc, tzOffset, wallClock } from '../src/phone/scheduler/rules';
import type { Reminder } from '../src/phone/types';
import { SnakeGame } from '../src/phone/games/snake-logic';
import { MazeGame, MAZE } from '../src/phone/games/maze-logic';
import { RpsMatch, judge } from '../src/phone/games/rps-logic';
import { runScheduler, slotSendTime, localDay, CATCH_UP } from '../src/phone/scheduler/scheduler';
import { PHONE_GREETINGS } from '../src/content/phone';
import { store } from '../src/core/store';
import { defaultState } from '../src/core/state';

const calc = (keys: string) => {
  const c = new Calculator();
  for (const k of keys.split(' ')) c.press(k);
  return c;
};

describe('calculator', () => {
  it('respects precedence', () => {
    expect(calc('2 + 3 × 4 =').display).toBe('14');
    expect(calc('1 0 − 4 ÷ 2 =').display).toBe('8');
    expect(evaluate([2, '×', 3, '+', 4, '×', 5])).toEqual({ value: 26 });
  });
  it('shows running totals like a phone', () => {
    const c = calc('2 + 3 ×');
    expect(c.display).toBe('3');
    c.press('4'); c.press('+');
    expect(c.display).toBe('14');
  });
  it('handles decimals without float noise', () => {
    expect(calc('0 . 1 + 0 . 2 =').display).toBe('0.3');
    expect(calc('1 ÷ 3 × 3 =').display).toBe('1');
  });
  it('percent, sign, backspace, clear', () => {
    expect(calc('2 0 0 + 1 0 % =').display).toBe('220');
    expect(calc('5 0 %').display).toBe('0.5');
    expect(calc('1 2 ±').display).toBe('-12');
    expect(calc('1 2 3 ⌫').display).toBe('12');
    const c = calc('5 + 7');
    c.press('C');
    expect(c.display).toBe('0');
    c.press('3'); c.press('=');
    expect(c.display).toBe('8');
  });
  it('divide by zero is an error, then recovers', () => {
    const c = calc('8 ÷ 0 =');
    expect(c.error).toBeTruthy();
    c.press('4');
    expect(c.display).toBe('4');
  });
  it('changing the operator replaces it', () => {
    expect(calc('9 + × 2 =').display).toBe('18');
  });
  it('memory keys', () => {
    const c = calc('5 M+ 3 M+ AC MR');
    expect(c.display).toBe('8');
    c.press('MC'); c.press('MR');
    expect(c.display).toBe('0');
  });
  it('formats thousands', () => {
    expect(formatNumber('1234567.5')).toBe('1,234,567.5');
    expect(formatNumber('-1000')).toBe('-1,000');
  });
});

const R = (o: Partial<Reminder>): Reminder => ({
  id: 'r', title: 't', date: '2026-11-06', time: '08:00', tz: 'Asia/Manila', repeat: 'none', enabled: true, createdAt: 0, updatedAt: 0, ...o,
});
const iso = (ms: number) => new Date(ms).toISOString();

describe('reminder rules', () => {
  it('converts zone wall-clock to UTC', () => {
    expect(iso(zonedToUtc(2026, 11, 6, 8, 0, 'Asia/Manila'))).toBe('2026-11-06T00:00:00.000Z');
    expect(tzOffset('Asia/Manila', Date.UTC(2026, 0, 1))).toBe(8 * 3600_000);
  });
  it('one-off and daily', () => {
    const from = Date.UTC(2026, 10, 1), to = Date.UTC(2026, 10, 30);
    expect(occurrences(R({}), from, to).map(iso)).toEqual(['2026-11-06T00:00:00.000Z']);
    const d = occurrences(R({ repeat: 'daily' }), from, Date.UTC(2026, 10, 9));
    expect(d.map(iso)).toEqual(['2026-11-06T00:00:00.000Z', '2026-11-07T00:00:00.000Z', '2026-11-08T00:00:00.000Z']);
  });
  it('weekdays skip the weekend', () => {
    // 2026-11-06 is a Friday.
    const w = occurrences(R({ repeat: 'weekdays' }), Date.UTC(2026, 10, 5), Date.UTC(2026, 10, 11));
    expect(w.map((t) => wallClock('Asia/Manila', t).d)).toEqual([6, 9, 10]);
  });
  it('weekly, monthly on the 31st, yearly on Feb 29', () => {
    const wk = occurrences(R({ repeat: 'weekly' }), Date.UTC(2027, 0, 1), Date.UTC(2027, 0, 31));
    expect(wk.map((t) => wallClock('Asia/Manila', t).d)).toEqual([1, 8, 15, 22, 29]);
    const mo = occurrences(R({ date: '2027-01-31', repeat: 'monthly' }), Date.UTC(2027, 0, 1), Date.UTC(2027, 6, 1));
    expect(mo.map((t) => wallClock('Asia/Manila', t).m)).toEqual([1, 3, 5]); // Feb, Apr, Jun have no 31st
    const leap = occurrences(R({ date: '2028-02-29', repeat: 'yearly' }), Date.UTC(2028, 0, 1), Date.UTC(2037, 0, 1));
    expect(leap.map((t) => wallClock('Asia/Manila', t).y)).toEqual([2028, 2032, 2036]);
  });
  it('locked zones keep their own clock; DST gap moves forward', () => {
    // New York springs forward on 2026-03-08: 02:30 does not exist → fires at 03:30 EDT (07:30Z).
    const ny = occurrences(R({ tz: 'America/New_York', date: '2026-03-07', time: '02:30', repeat: 'daily' }), Date.UTC(2026, 2, 7), Date.UTC(2026, 2, 10));
    expect(ny.map(iso)).toEqual(['2026-03-07T07:30:00.000Z', '2026-03-08T07:30:00.000Z', '2026-03-09T06:30:00.000Z']);
    // 08:00 every day stays 08:00 local across the change.
    const am = occurrences(R({ tz: 'America/New_York', date: '2026-03-07', time: '08:00', repeat: 'daily' }), Date.UTC(2026, 2, 7), Date.UTC(2026, 2, 10));
    expect(am.map((t) => wallClock('America/New_York', t).h)).toEqual([8, 8, 8]);
  });
  it('next occurrence, disabled and deleted', () => {
    const r = R({ repeat: 'daily' });
    expect(iso(nextOccurrence(r, Date.UTC(2026, 10, 6, 0, 0))!)).toBe('2026-11-07T00:00:00.000Z');
    expect(nextOccurrence(R({}), Date.UTC(2027, 0, 1))).toBeNull();
    expect(nextOccurrence(R({ repeat: 'daily', enabled: false }), 0)).toBeNull();
    expect(nextOccurrence(R({ repeat: 'daily', deleted: true }), 0)).toBeNull();
  });
});

describe('phone games', () => {
  it('snake eats, grows and dies on walls', () => {
    const g = new SnakeGame(10, 10, () => 0);
    g.food = [5, 5];
    g.body = [[4, 5], [3, 5], [2, 5]];
    expect(g.step()).toBe('eat');
    expect(g.body).toHaveLength(4);
    expect(g.score).toBe(1);
    g.turn('left'); // can't reverse
    g.turn('up');
    for (let i = 0; i < 10 && !g.over; i++) g.step();
    expect(g.over).toBe(true);
  });
  it('heart maze: every sparkle is reachable from the start', () => {
    expect(new Set(MAZE.map((r) => r.length)).size).toBe(1);
    const g = new MazeGame(() => 0.5);
    const start = MAZE.findIndex((r) => r.includes('P'));
    const seen = new Set<string>();
    const q: [number, number][] = [[MAZE[start].indexOf('P'), start]];
    while (q.length) {
      const [x, y] = q.pop()!;
      const k = `${x},${y}`;
      if (seen.has(k) || !g.open(x, y)) continue;
      seen.add(k);
      q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    for (const k of [...g.sparkles, ...g.petals]) expect(seen.has(k), k).toBe(true);
  });
  it('heart maze: collecting and losing a life', () => {
    const g = new MazeGame(() => 0.5);
    const before = g.sparkles.size;
    g.steer('up');
    for (let i = 0; i < 120; i++) g.update(1 / 30);
    expect(g.sparkles.size).toBeLessThan(before);
    expect(g.score).toBeGreaterThan(0);
    const c = g.clouds[0];
    Object.assign(c, { x: g.player.x, y: g.player.y, wait: 0, scared: false });
    g.pause = 0;
    const lives = g.lives;
    g.update(0.001);
    expect(g.lives).toBe(lives - 1);
  });
  it('rock paper scissors', () => {
    expect(judge('rock', 'scissors')).toBe(1);
    expect(judge('rock', 'paper')).toBe(-1);
    expect(judge('paper', 'paper')).toBe(0);
    const m = new RpsMatch(3, () => 0); // partner always plays rock
    for (let i = 0; i < 3; i++) m.play('paper');
    expect(m.done).toBe(true);
    expect(m.me).toBe(3);
    expect(() => m.play('rock')).toThrow();
  });
});

describe('partner scheduler', () => {
  const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime(); // November 2026, local time
  const fresh = (playAs: 'her' | 'him' = 'her') => { store.load(defaultState('Ella', 'Rob', playAs)); return store.state.phone; };
  const greetings = (slot: string) => store.state.phone.messages.filter((m) => m.kind === 'greeting' && store.state.phone.history.some((h) => h.refId === slot && h.body === m.text));

  it('sends the morning greeting once, at its chosen time', () => {
    fresh();
    const morning = PHONE_GREETINGS.find((s) => s.id === 'morning')!;
    const send = slotSendTime(morning, localDay(at(6, 7)));
    expect(runScheduler(at(6, 6, 30))).toHaveLength(0);
    expect(runScheduler(send - 60_000).filter((d) => d.log.refId === 'morning')).toHaveLength(0);
    const out = runScheduler(send + 60_000).filter((d) => d.log.refId === 'morning');
    expect(out).toHaveLength(1);
    expect(out[0].message.at).toBe(send);
    expect(out[0].message.from).toBe('partner');
    expect(runScheduler(send + 120_000).filter((d) => d.log.refId === 'morning')).toHaveLength(0);
    expect(greetings('morning')).toHaveLength(1);
  });
  it('skips a greeting whose window was missed (no good morning at night)', () => {
    fresh();
    const out = runScheduler(at(6, 12));
    expect(out.filter((d) => d.log.refId === 'morning')).toHaveLength(0);
    expect(store.state.phone.greetings.morning).toBe(localDay(at(6, 12)));
    // ...and the next morning it comes again.
    const next = runScheduler(at(7, 10, 59)).filter((d) => d.log.refId === 'morning');
    expect(next).toHaveLength(1);
  });
  it('uses the right names when playing as him', () => {
    fresh('him');
    const out = runScheduler(at(6, 23, 40)).filter((d) => d.log.refId === 'night');
    expect(out).toHaveLength(1);
    expect(out[0].log.title).toBe('Ella');
    expect(out[0].message.text).not.toContain('{her}');
  });

  const reminder = (o: Record<string, unknown> = {}) => {
    const r = { id: 'r1', title: 'Drink water', date: '2026-11-06', time: '09:30', tz: '', repeat: 'daily' as const, enabled: true, createdAt: at(6, 8), updatedAt: at(6, 8), ...o };
    store.state.phone.reminders.push(r as any);
    return r;
  };
  const reminders = (list: ReturnType<typeof runScheduler>) => list.filter((d) => d.log.source === 'reminder');

  it('delivers a reminder at its time, once', () => {
    fresh();
    reminder();
    expect(reminders(runScheduler(at(6, 9, 29)))).toHaveLength(0);
    const out = reminders(runScheduler(at(6, 9, 30, )));
    expect(out).toHaveLength(1);
    expect(out[0].message.kind).toBe('reminder');
    expect(out[0].message.text).toContain('Drink water');
    expect(out[0].message.text).not.toContain('this was for');
    expect(reminders(runScheduler(at(6, 9, 45)))).toHaveLength(0);
  });
  it('catches up after being closed: one message, marked as late', () => {
    fresh();
    reminder();
    runScheduler(at(6, 9, 31));
    // Closed for three days; opened in the evening.
    const out = reminders(runScheduler(at(9, 20)));
    expect(out).toHaveLength(1);
    expect(out[0].message.at).toBe(at(9, 9, 30));
    expect(out[0].message.text).toContain('this was for');
  });
  it('only logs reminders that are too old', () => {
    fresh();
    const r = reminder({ repeat: 'none' });
    const out = reminders(runScheduler(at(6, 9, 30) + CATCH_UP + 60_000));
    expect(out).toHaveLength(0);
    const h = store.state.phone.history.filter((x) => x.refId === r.id);
    expect(h).toHaveLength(1);
    expect(h[0].missed).toBe(true);
  });
  it('ignores disabled and deleted reminders', () => {
    fresh();
    reminder({ id: 'a', enabled: false });
    reminder({ id: 'b', deleted: true });
    expect(reminders(runScheduler(at(6, 10)))).toHaveLength(0);
  });
  it('sends an occasion greeting once that day', () => {
    fresh();
    const before = store.settings.manualOccasions;
    store.settings.manualOccasions = ['valentines'];
    try {
      const out = runScheduler(at(6, 12)).filter((d) => d.log.refId === 'occ:valentines');
      expect(out).toHaveLength(1);
      expect(out[0].message.text).toContain('Valentine');
      expect(runScheduler(at(6, 13)).filter((d) => d.log.refId === 'occ:valentines')).toHaveLength(0);
    } finally {
      store.settings.manualOccasions = before;
      store.unload();
    }
  });
});
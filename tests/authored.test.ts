import { describe, it, expect } from 'vitest';
import { AUTHORED, mergeEntries, mergeGreetings, mergeOccasions, normalizeAuthored, parseScene } from '../src/content/authored';
import { PERSONAL, PERSONAL_TEMPLATES } from '../src/content/personal';
import { OCCASION_TEMPLATES } from '../src/content/occasions';
import { activeOccasions } from '../src/systems/occasions';

describe('authored content (Author tool)', () => {
  it('the shipped authored.json is valid', () => {
    expect(AUTHORED.version).toBe(1);
    expect(PERSONAL.length).toBeGreaterThan(0);
  });

  it('cleans junk, bad ids, unsafe image paths and short words', () => {
    const a = normalizeAuthored({
      names: { her: 'Chi Chi', him: 42 },
      entries: [
        { id: 'letter-welcome', kind: 'letter', title: 'Hi', body: 'Hello {her}' },
        { id: 'letter-welcome', kind: 'letter', title: 'dupe', body: 'x' },
        { id: 'x', kind: 'spaceship', title: 'no' },
        { id: 'p', kind: 'photo', title: 'P', image: '../../etc/passwd' },
        { id: 'q', kind: 'photo', title: 'Q', image: 'assets/photos/authored/us.jpg', unlock: { minLevel: 3, time: ['night', 'noon'] } },
      ],
      occasions: { anniversary: { enabled: true, rule: { type: 'yearly', month: 13, day: 1 } }, monthsary: { enabled: true, rule: { type: 'monthly', day: 14 } }, valentines: { enabled: false } },
      words: ['pancakes', 'ok', 'Chi-chi', 'PANCAKES'],
    });
    expect(a.names).toEqual({ her: 'Chi Chi', him: '' });
    expect(a.entries.map((e) => e.id)).toEqual(['letter-welcome', 'p', 'q']);
    expect(a.entries[1].image).toBeUndefined();
    expect(a.entries[2].unlock).toEqual({ minLevel: 3, time: ['night'] });
    expect(a.occasions.anniversary.enabled).toBe(false); // invalid date never switches a day on
    expect(a.occasions.monthsary.rule).toEqual({ type: 'monthly', day: 14 });
    expect(a.occasions.valentines).toBeUndefined();
    expect(a.words).toEqual(['PANCAKES', 'CHICHI']);
  });

  it('written entries replace templates; unfinished ones and hidden templates stay out', () => {
    const a = normalizeAuthored({ entries: [
      { id: 'letter-welcome', kind: 'letter', title: 'For you', body: 'Dear {her}…' },
      { id: 'letter-level5', kind: 'letter', title: 'Started', body: '   ' },
      { id: 'my-joke-1', kind: 'joke', title: 'The pancake incident', body: 'You know.' },
    ] });
    const merged = mergeEntries(PERSONAL_TEMPLATES, a);
    const welcome = merged.find((e) => e.id === 'letter-welcome')!;
    expect(welcome.title).toBe('For you');
    expect(welcome.placeholder).toBe(false);
    expect(merged.find((e) => e.id === 'letter-level5')!.placeholder).toBe(true); // still the template
    expect(merged.find((e) => e.id === 'my-joke-1')).toBeTruthy();
    expect(merged).toHaveLength(PERSONAL_TEMPLATES.length + 1);

    const hidden = mergeEntries(PERSONAL_TEMPLATES, { ...a, hideTemplates: true });
    expect(hidden.every((e) => !e.placeholder)).toBe(true);
    expect(hidden.map((e) => e.id).sort()).toEqual(['letter-welcome', 'my-joke-1']);
  });

  it('garden bloom scenes: only for real special plants, parsed by speaker', () => {
    const a = normalizeAuthored({ garden: { 'sp-moonpetal': { scene: 'him: Look, it’s glowing.\n\nThe petals open slowly.\nHER : For me?' }, 'sp-fake': { scene: 'x' }, 'sp-starbloom': { scene: '   ' } } });
    expect(Object.keys(a.garden)).toEqual(['sp-moonpetal']);
    expect(parseScene(a.garden['sp-moonpetal'].scene)).toEqual([
      { speaker: 'him', text: 'Look, it’s glowing.' },
      { speaker: 'narrator', text: 'The petals open slowly.' },
      { speaker: 'her', text: 'For me?' },
    ]);
    expect(normalizeAuthored({}).garden).toEqual({});
  });

  it('an entry can open when a garden flower blooms', () => {
    const a = normalizeAuthored({ entries: [{ id: 'garden-letter-1', kind: 'letter', title: 'Moon', body: 'Hi', unlock: { flag: 'garden-bloom:sp-moonpetal' } }] });
    expect(a.entries[0].unlock).toEqual({ flag: 'garden-bloom:sp-moonpetal' });
  });

  it('a special day with a date switches on, with its own greeting', () => {
    const a = normalizeAuthored({ occasions: { anniversary: { enabled: true, name: 'Our Day', rule: { type: 'yearly', month: 6, day: 14 }, greeting: 'Happy anniversary, {her}.\n\nHere’s to forever.' } } });
    const occ = mergeOccasions(OCCASION_TEMPLATES, a);
    const ann = occ.find((o) => o.id === 'anniversary')!;
    expect(ann.enabled).toBe(true);
    expect(ann.name).toBe('Our Day');
    expect(activeOccasions(occ, new Date(2027, 5, 14)).map((o) => o.id)).toContain('anniversary');
    expect(activeOccasions(occ, new Date(2027, 5, 15)).map((o) => o.id)).not.toContain('anniversary');
    const lines = mergeGreetings(OCCASION_TEMPLATES, { 'occ-anniversary': [{ speaker: 'him', text: 'x' }] }, a)['occ-anniversary'];
    expect(lines).toEqual([{ speaker: 'him', text: 'Happy anniversary, {her}.' }, { speaker: 'him', text: 'Here’s to forever.' }]);
    // Untouched templates stay off.
    expect(occ.find((o) => o.id === 'her-birthday')!.enabled).toBe(false);
  });
});

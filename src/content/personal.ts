import type { PersonalEntry } from './types';
import { AUTHORED, mergeEntries } from './authored';
import { LETTERS } from './letters';

/*
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  YOUR PERSONAL CONTENT GOES HERE.                                    ║
 * ║  Every entry below is a TEMPLATE (placeholder: true).                ║
 * ║  Replace the ⟦…⟧ text with your real words, then delete              ║
 * ║  `placeholder: true`. Copy a block to add more. Nothing here was     ║
 * ║  invented — fill in only what is true for you two.                   ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * unlock: when the entry appears (any Condition – minLevel, secret, occasion, time,
 *         location, flag, questDone…). No unlock = available from the start.
 * image:  'assets/photos/file.jpg' (put file in public/assets/photos/) or
 *         Photos are bundled from public/assets/photos/ and stay on this device.
 */
export const PERSONAL_TEMPLATES: PersonalEntry[] = [
  // ---------------- Letters (mailbox in backyard) ----------------
  // Finished letters from him, one for every achievement (see letters.ts). A letter written in the Author tool with
  // the same id replaces the one there.
  ...LETTERS,

  // ---------------- Messages (bedroom laptop / daily) ----------------
  { id: 'message-1', kind: 'message', title: '⟦Daily message 1⟧', placeholder: true, body: '⟦A short sweet message. One is shown each day.⟧' },
  { id: 'message-2', kind: 'message', title: '⟦Daily message 2⟧', placeholder: true, body: '⟦Another short message.⟧' },
  { id: 'message-3', kind: 'message', title: '⟦Daily message 3⟧', placeholder: true, body: '⟦Another short message.⟧' },

  // ---------------- Memories (bedroom memory board) ----------------
  { id: 'memory-first-meet', kind: 'memory', title: '⟦How we met⟧', date: '⟦YYYY-MM-DD⟧', placeholder: true,
    body: '⟦Describe the moment you met.⟧', image: '' },
  { id: 'memory-first-date', kind: 'memory', title: '⟦Our first date⟧', date: '⟦YYYY-MM-DD⟧', placeholder: true,
    unlock: { minLevel: 3 }, body: '⟦Where you went, what happened, what you remember most.⟧' },
  { id: 'memory-favorite', kind: 'memory', title: '⟦A favorite memory⟧', placeholder: true,
    unlock: { minLevel: 7 }, body: '⟦…⟧' },

  // ---------------- Photos (memory game + photo puzzle use these) ----------------
  { id: 'photo-1', kind: 'photo', title: '⟦Photo caption⟧', placeholder: true, image: '' },
  { id: 'photo-2', kind: 'photo', title: '⟦Photo caption⟧', placeholder: true, image: '', unlock: { minLevel: 4 } },
  { id: 'photo-3', kind: 'photo', title: '⟦Photo caption⟧', placeholder: true, image: '', unlock: { minLevel: 8 } },

  // ---------------- Inside jokes (kitchen fridge) ----------------
  { id: 'joke-1', kind: 'joke', title: '⟦Inside joke⟧', placeholder: true, body: '⟦The joke, and maybe the story behind it.⟧' },
  { id: 'joke-2', kind: 'joke', title: '⟦Inside joke⟧', placeholder: true, body: '⟦…⟧', unlock: { minLevel: 6 } },

  // ---------------- Dates (living-room calendar, picnic table) ----------------
  { id: 'date-1', kind: 'date', title: '⟦A date we went on⟧', date: '⟦YYYY-MM-DD⟧', placeholder: true, body: '⟦Where & what.⟧' },
  { id: 'date-idea-1', kind: 'date', title: '⟦A date I want to take you on⟧', placeholder: true, tags: ['someday'], body: '⟦Idea.⟧' },

  // ---------------- Challenges (school challenge board) ----------------
  { id: 'challenge-1', kind: 'challenge', title: '⟦A real-life challenge⟧', placeholder: true, rewardXp: 100,
    body: '⟦e.g. something sweet to do together this week. She can tick it off for XP.⟧' },
  { id: 'challenge-2', kind: 'challenge', title: '⟦Another challenge⟧', placeholder: true, rewardXp: 100, unlock: { minLevel: 5 }, body: '⟦…⟧' },

  // ---------------- Surprises (secrets & occasions) ----------------
  { id: 'surprise-under-bed', kind: 'surprise', title: '⟦Surprise under the bed⟧', placeholder: true,
    unlock: { secret: 'secret-under-bed' }, body: '⟦What’s in the tiny ribbon box?⟧' },
  { id: 'surprise-bookshelf', kind: 'surprise', title: '⟦Hidden in the hollow book⟧', placeholder: true,
    unlock: { secret: 'secret-bookshelf' }, body: '⟦…⟧' },
  { id: 'surprise-sofa', kind: 'surprise', title: '⟦The paper heart⟧', placeholder: true,
    unlock: { secret: 'secret-sofa' }, body: '⟦…⟧' },
  { id: 'surprise-fridge', kind: 'surprise', title: '⟦Sticky note behind the magnet⟧', placeholder: true,
    unlock: { secret: 'secret-fridge' }, body: '⟦…⟧' },
  { id: 'surprise-tree', kind: 'surprise', title: '⟦The carving in the tree⟧', placeholder: true,
    unlock: { secret: 'secret-tree' }, body: '⟦Your initials and why.⟧' },
  { id: 'surprise-fence', kind: 'surprise', title: '⟦The tin box⟧', placeholder: true,
    unlock: { secret: 'secret-fence' }, body: '⟦…⟧' },
  { id: 'surprise-desk', kind: 'surprise', title: '⟦The date on the desk⟧', placeholder: true,
    unlock: { secret: 'secret-desk' }, body: '⟦…⟧' },
  { id: 'surprise-anniversary', kind: 'surprise', title: '⟦Anniversary surprise⟧', placeholder: true,
    unlock: { occasion: 'anniversary' }, body: '⟦…⟧' },
  { id: 'surprise-birthday', kind: 'surprise', title: '⟦Birthday surprise⟧', placeholder: true,
    unlock: { occasion: 'her-birthday' }, body: '⟦…⟧' },
  { id: 'surprise-valentines', kind: 'surprise', title: '⟦Valentine’s surprise⟧', placeholder: true,
    unlock: { occasion: 'valentines' }, body: '⟦…⟧' },
];

/** What the game uses: the templates above, with anything written in the Author tool (authored.json) on top. */
export const PERSONAL: PersonalEntry[] = mergeEntries(PERSONAL_TEMPLATES, AUTHORED);

/** Extra words for the chalkboard puzzle – add your inside-joke words here (UPPERCASE, letters only). */
export const CUSTOM_WORDS: string[] = [...AUTHORED.words];

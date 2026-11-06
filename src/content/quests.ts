import type { CollectibleKind, LocationId, MinigameId, ObjectiveDef, QuestDef } from './types';

/*
 * Story quests form gentle "chapters". When the authored chain runs out the game keeps going
 * with generated daily & weekly quests, occasion quests and new content you add later.
 */
export const STORY_QUESTS: QuestDef[] = [
  {
    id: 'ch1-wake', kind: 'story', title: 'Chapter 1 · Good Morning',
    description: 'A brand-new day in Evermore. Say hi to {him} and look around your room.',
    autoStart: { flag: 'intro-done' },
    objectives: [
      { type: 'talk', label: 'Talk to {him}' },
      { type: 'interact', hotspot: 'bedroom-window', label: 'Look out the window' },
      { type: 'collect', kind: 'any', count: 3, label: 'Collect 3 floating charms' },
    ],
    rewards: [{ type: 'xp', amount: 60 }, { type: 'tokens', amount: 10 }],
    next: 'ch1-breakfast',
  },
  {
    id: 'ch1-breakfast', kind: 'story', title: 'Chapter 1 · Breakfast for Two',
    description: 'Something smells good… or it will once you cook it. Head to the kitchen.',
    objectives: [
      { type: 'visit', location: 'kitchen', label: 'Go to the kitchen' },
      { type: 'minigame', id: 'cooking', label: 'Cook something together at the stove' },
    ],
    rewards: [{ type: 'xp', amount: 80 }, { type: 'item', id: 'cocoa' }],
    next: 'ch1-outside',
  },
  {
    id: 'ch1-outside', kind: 'story', title: 'Chapter 1 · Fresh Air',
    description: 'The backyard is calling. Pick some flowers and check the mailbox.',
    objectives: [
      { type: 'visit', location: 'backyard', label: 'Step into the backyard' },
      { type: 'interact', hotspot: 'yard-flowers', label: 'Pick flowers' },
      { type: 'interact', hotspot: 'yard-mailbox', label: 'Check the mailbox' },
    ],
    rewards: [{ type: 'xp', amount: 90 }, { type: 'tokens', amount: 15 }],
    next: 'ch2-school',
  },
  {
    id: 'ch2-school', kind: 'story', title: 'Chapter 2 · Walking to School',
    description: 'Grab your bag — you’re walking to school together today.',
    objectives: [
      { type: 'visit', location: 'school', label: 'Go to school through the front door' },
      { type: 'interact', hotspot: 'school-locker', label: 'Open your locker' },
      { type: 'minigame', id: 'scramble', label: 'Solve the chalkboard puzzle' },
    ],
    rewards: [{ type: 'xp', amount: 120 }, { type: 'tokens', amount: 20 }],
    next: 'ch2-secrets',
  },
  {
    id: 'ch2-secrets', kind: 'story', title: 'Chapter 2 · Hidden Things',
    description: '{him} says he hid things around the house and school. Walk close to odd spots — secrets reveal themselves.',
    objectives: [
      { type: 'flag', id: 'secret-count-2', label: 'Find 2 secrets' },
    ],
    rewards: [{ type: 'xp', amount: 150 }, { type: 'item', id: 'ribbon' }],
    next: 'ch3-stars',
  },
  {
    id: 'ch3-stars', kind: 'story', title: 'Chapter 3 · Wish Upon a Star',
    description: 'Wait for the night (or nap until then) and stargaze on the blanket in the backyard.',
    objectives: [
      { type: 'minigame', id: 'stars', label: 'Connect a constellation at night' },
      { type: 'talk', label: 'Tell {him} what you wished for' },
    ],
    rewards: [{ type: 'xp', amount: 180 }, { type: 'tokens', amount: 30 }],
    next: 'ch3-photo',
  },
  {
    id: 'ch3-photo', kind: 'story', title: 'Chapter 3 · Picture Perfect',
    description: 'The big frame in the living room is all jumbled. Fix it, then play the keepsake game in the bedroom.',
    objectives: [
      { type: 'minigame', id: 'slider', label: 'Solve the photo puzzle' },
      { type: 'minigame', id: 'memory', label: 'Play the keepsake memory game' },
    ],
    rewards: [{ type: 'xp', amount: 220 }, { type: 'item', id: 'polaroid' }],
    next: 'ch4-gifts',
  },
  {
    id: 'ch4-gifts', kind: 'story', title: 'Chapter 4 · Little Gestures',
    description: 'Love is in small things. Give {him} a few gifts and share some hugs.',
    objectives: [
      { type: 'gift', count: 3, label: 'Give 3 gifts to {him}' },
      { type: 'talk', count: 3, label: 'Talk with {him} 3 times' },
    ],
    rewards: [{ type: 'xp', amount: 260 }, { type: 'tokens', amount: 40 }],
    next: 'ch5-evermore',
  },
  {
    id: 'ch5-evermore', kind: 'story', title: 'Chapter 5 · Evermore',
    description: 'There is no last chapter. Find every secret and keep collecting — new pages appear as your story grows.',
    objectives: [
      { type: 'flag', id: 'secret-count-6', label: 'Find all 6 house & school secrets' },
      { type: 'collect', kind: 'any', count: 50, label: 'Collect 50 charms' },
    ],
    rewards: [{ type: 'xp', amount: 500 }, { type: 'tokens', amount: 80 }, { type: 'flag', id: 'chapter5-done' }],
  },
  {
    id: 'pizza-grand-opening', kind: 'story', title: 'Our Pizza Shop · Grand Opening',
    description: 'The little pizza shop in town is yours now. Stock up at the Market, open the doors and make your first customers happy.',
    autoStart: { minLevel: 10 },
    objectives: [
      { type: 'flag', id: 'pizza-opened', label: 'Open the shop (Map → Pizza Shop)' },
      { type: 'flag', id: 'pizza-served', label: 'Serve your first pizza' },
      { type: 'flag', id: 'pizza-five', label: 'Earn a five-star rating' },
    ],
    rewards: [{ type: 'xp', amount: 600 }, { type: 'tokens', amount: 60 }],
  },
];

// ---------------------------------------------------------------- generators

type R = { int: (a: number, b: number) => number; pick: <T>(a: readonly T[]) => T };

const LOC_NAMES: Record<LocationId, string> = {
  bedroom: 'the bedroom', livingroom: 'the living room', kitchen: 'the kitchen', backyard: 'the backyard', school: 'school',
};
const KIND_NAMES: Record<CollectibleKind, string> = {
  heart: 'heart charms', petal: 'petals', star: 'star shards', note: 'folded notes', sparkle: 'sparkles',
};
const MG_NAMES: Record<MinigameId, string> = {
  memory: 'Keepsake Memory (bedroom)', cooking: 'Cooking Together (kitchen)', stars: 'Stargazing (backyard, night)',
  scramble: 'Chalkboard Words (school)', slider: 'Photo Puzzle (living room)',
};

const DAILY_TITLES = ['Sweet Errand', 'Little Adventure', 'Cozy Task', 'Heart Hunt', 'Daily Spark', 'Tiny Mission'];

export function dailyTemplates(r: R): ObjectiveDef[] {
  const loc = r.pick(['bedroom', 'livingroom', 'kitchen', 'backyard', 'school'] as LocationId[]);
  const kind = r.pick(['heart', 'petal', 'star', 'note'] as CollectibleKind[]);
  const mg = r.pick(['memory', 'cooking', 'scramble', 'slider'] as MinigameId[]);
  return [
    { type: 'collect', kind: 'any', count: r.int(4, 8), location: loc, label: `Collect charms in ${LOC_NAMES[loc]}` },
    { type: 'collect', kind, count: r.int(2, 4), label: `Collect ${KIND_NAMES[kind]}` },
    { type: 'minigame', id: mg, label: `Play ${MG_NAMES[mg]}` },
    { type: 'talk', count: r.int(1, 3), label: 'Spend time talking with {him}' },
    { type: 'gift', count: r.int(1, 2), label: 'Give {him} a little gift' },
    { type: 'visit', location: loc, label: `Visit ${LOC_NAMES[loc]}` },
  ];
}

export function makeDaily(r: R, day: string, index: number): QuestDef {
  const pool = dailyTemplates(r);
  const a = pool.splice(r.int(0, pool.length - 1), 1)[0];
  const b = pool.splice(r.int(0, pool.length - 1), 1)[0];
  const objectives = [a, b];
  return {
    id: `daily-${day}-${index}`,
    kind: 'daily',
    title: r.pick(DAILY_TITLES),
    description: 'A fresh little goal for today. New ones arrive every day.',
    objectives,
    rewards: [{ type: 'xp', amount: 70 + r.int(0, 4) * 10 }, { type: 'tokens', amount: 8 + r.int(0, 4) * 2 }],
  };
}

export function makeWeekly(r: R, week: string): QuestDef {
  const mgs = ['memory', 'cooking', 'stars', 'scramble', 'slider'] as MinigameId[];
  const mg = r.pick(mgs);
  return {
    id: `weekly-${week}`,
    kind: 'weekly',
    title: 'Weekly Love Letter',
    description: 'A bigger goal for this week. Finish it before the week ends for a special reward.',
    objectives: [
      { type: 'collect', kind: 'any', count: r.int(30, 45), label: 'Collect charms anywhere' },
      { type: 'minigame', id: mg, minScore: 60, label: `Score 60+ in ${MG_NAMES[mg]}` },
      { type: 'gift', count: 5, label: 'Give {him} 5 gifts' },
    ],
    rewards: [{ type: 'xp', amount: 400 }, { type: 'tokens', amount: 60 }, { type: 'item', id: 'ribbon' }],
  };
}

/** Occasion quests – referenced by occasions.ts. */
export const OCCASION_QUESTS: QuestDef[] = [
  {
    id: 'occ-generic', kind: 'occasion', title: 'A Special Day',
    description: 'Today is special. Celebrate together!',
    objectives: [
      { type: 'talk', label: 'Celebrate with {him}' },
      { type: 'collect', kind: 'heart', count: 5, label: 'Collect 5 heart charms' },
      { type: 'gift', count: 1, label: 'Give {him} a gift' },
    ],
    rewards: [{ type: 'xp', amount: 300 }, { type: 'tokens', amount: 50 }],
  },
];

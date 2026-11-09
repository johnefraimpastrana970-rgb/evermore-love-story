import type { Condition, DialogueNode } from './types';

/*
 * Dialogue nodes. Tokens: {her} {him}. Speakers: 'her' | 'him' | 'narrator'.
 * These are GENERIC in-world lines – no real memories are invented here.
 * Replace or extend them freely with your own words (see CONTENT_GUIDE.md).
 */
export const DIALOGUE: Record<string, DialogueNode> = {
  intro: {
    lines: [
      { speaker: 'narrator', text: 'Welcome to Evermore — a little world made just for {her}.' },
      { speaker: 'narrator', text: 'There is no last level here, and no final page. Only more days together.' },
      { speaker: 'him', text: 'Hey, sleepyhead. You’re finally awake!', mood: 'happy' },
      { speaker: 'her', text: 'Mmh… five more minutes?', mood: 'idle' },
      { speaker: 'him', text: 'Come on — I’ve got a whole day planned. Look around, find little surprises… and maybe some I hid for you.', mood: 'love' },
      { speaker: 'narrator', text: 'Tip: walk with WASD / arrow keys, tap the floor, or use the joystick. Press E or tap things to interact.' },
    ],
    effects: [{ type: 'flag', id: 'intro-done' }],
  },

  'sofa-day': {
    lines: [
      { speaker: 'narrator', text: 'The sofa is soft and sunny. It would be very easy to stay here forever.' },
    ],
    choices: [
      { text: 'Cuddle up with {him}', next: 'sofa-cuddle', if: { minAffection: 0 } },
      { text: 'Just rest a moment', effects: [{ type: 'xp', amount: 5 }] },
    ],
  },
  'sofa-cuddle': {
    lines: [
      { speaker: 'him', text: 'Scoot over — there’s exactly enough room for two.', mood: 'happy' },
      { speaker: 'her', text: 'Exactly enough, huh?', mood: 'shy' },
    ],
    effects: [{ type: 'affection', amount: 2 }, { type: 'xp', amount: 15 }, { type: 'stat', id: 'cuddles' }],
  },
  'sofa-night': {
    lines: [
      { speaker: 'him', text: 'Movie night? I’ll get the blanket, you pick the movie.', mood: 'happy' },
    ],
    choices: [
      { text: 'Something romantic', next: 'movie-romance' },
      { text: 'Something scary', next: 'movie-scary' },
      { text: 'Something funny', next: 'movie-funny' },
    ],
  },
  'movie-romance': {
    lines: [
      { speaker: 'her', text: 'Something romantic, obviously.', mood: 'love' },
      { speaker: 'him', text: 'Obviously. I’ll pretend I’m not the one who cries at the end.', mood: 'shy' },
    ],
    effects: [{ type: 'affection', amount: 3 }, { type: 'xp', amount: 25 }, { type: 'stat', id: 'movies' }],
  },
  'movie-scary': {
    lines: [
      { speaker: 'her', text: 'A scary one! You have to protect me.', mood: 'happy' },
      { speaker: 'him', text: 'Deal. And if I get scared, you protect me.', mood: 'surprised' },
    ],
    effects: [{ type: 'affection', amount: 3 }, { type: 'xp', amount: 25 }, { type: 'stat', id: 'movies' }],
  },
  'movie-funny': {
    lines: [
      { speaker: 'her', text: 'Something funny. I want to hear you laugh.', mood: 'happy' },
      { speaker: 'him', text: 'Too late, I’m already laughing — you’ve got popcorn in your hair.', mood: 'happy' },
    ],
    effects: [{ type: 'affection', amount: 3 }, { type: 'xp', amount: 25 }, { type: 'stat', id: 'movies' }],
  },

  tv: {
    lines: [{ speaker: 'narrator', text: 'The TV hums. The remote is — of course — lost somewhere.' }],
    choices: [
      { text: 'Search for the remote', effects: [{ type: 'xp', amount: 5 }], next: 'tv-remote' },
      { text: 'Leave it off', },
    ],
  },
  'tv-remote': {
    lines: [{ speaker: 'him', text: 'Found it! It was in the fridge. Don’t ask.', mood: 'surprised' }],
  },

  swing: {
    lines: [
      { speaker: 'him', text: 'Want a push? I promise not to send you to the moon. Probably.', mood: 'happy' },
    ],
    choices: [
      { text: 'Higher!', next: 'swing-high', effects: [{ type: 'affection', amount: 1 }, { type: 'xp', amount: 10 }] },
      { text: 'Gently, please', next: 'swing-soft', effects: [{ type: 'affection', amount: 2 }, { type: 'xp', amount: 10 }] },
    ],
  },
  'swing-high': { lines: [{ speaker: 'her', text: 'Wheee! I can see the whole neighborhood!', mood: 'happy' }] },
  'swing-soft': { lines: [{ speaker: 'her', text: 'This is nice. Just like this.', mood: 'love' }] },

  grill: {
    lines: [{ speaker: 'him', text: 'Grill master reporting for duty. Want to help me cook?', mood: 'happy' }],
    choices: [
      { text: 'Let’s cook together!', action: 'minigame', arg: 'cooking' },
      { text: 'Flip the skewers!', action: 'minigame', arg: 'grill-flip' },
      { text: 'Build a colorful skewer!', action: 'minigame', arg: 'skewer-memory' },
      { text: 'I’ll supervise', effects: [{ type: 'xp', amount: 5 }], next: 'grill-supervise' },
    ],
  },
  'grill-supervise': {
    lines: [{ speaker: 'him', text: 'A very important job. Please supervise with snacks.', mood: 'happy' }],
  },

  'table-breakfast': {
    lines: [
      { speaker: 'him', text: 'Breakfast for my favorite person. Well… it will be, once one of us cooks it.', mood: 'happy' },
    ],
    choices: [
      { text: 'Let’s cook!', action: 'minigame', arg: 'cooking' },
      { text: 'Just coffee for now', effects: [{ type: 'item', id: 'cocoa' }] },
    ],
  },
  'table-tea': {
    lines: [{ speaker: 'narrator', text: 'Two mugs sit side by side on the little table.' }],
    choices: [
      { text: 'Make something warm to drink', effects: [{ type: 'xp', amount: 5 }, { type: 'item', id: 'cocoa' }], next: 'tea-made', if: { notFlag: 'tea-{day}' } },
      { text: 'Sit for a moment', effects: [{ type: 'xp', amount: 3 }] },
    ],
  },
  'tea-made': {
    lines: [{ speaker: 'him', text: 'Mm. You make it better than I do. Don’t tell anyone.', mood: 'love' }],
    effects: [{ type: 'flag', id: 'tea-{day}' }],
  },

  // --- Companion ---------------------------------------------------------
  'him-root': {
    lines: [{ speaker: 'him', text: '{greeting}', mood: 'happy' }],
    choices: [
      { text: 'Talk', next: 'him-talk' },
      { text: 'Give a gift', action: 'gift' },
      { text: 'Hug', next: '__hug' },
      { text: 'Never mind' },
    ],
  },
  'him-hug': {
    lines: [
      { speaker: 'narrator', text: '{him} wraps {her} up in a warm hug.' },
      { speaker: 'him', text: 'Recharged. You?', mood: 'love' },
    ],
    effects: [{ type: 'affection', amount: 3 }, { type: 'xp', amount: 20 }, { type: 'stat', id: 'hugs' }],
  },
  'him-hug-again': {
    lines: [{ speaker: 'him', text: 'Another one? …Okay, okay. You can have infinite hugs. But the XP only counts once per part of the day.', mood: 'shy' }],
    effects: [{ type: 'stat', id: 'hugs' }],
  },
  'sleep-menu': {
    lines: [{ speaker: 'narrator', text: 'The bed looks incredibly cozy. Rest until…' }],
    choices: [
      { text: 'Morning', action: 'sleep', arg: 'morning' },
      { text: 'Daytime', action: 'sleep', arg: 'day' },
      { text: 'Sunset', action: 'sleep', arg: 'sunset' },
      { text: 'Night', action: 'sleep', arg: 'night' },
      { text: 'Follow the real clock', action: 'sleep', arg: 'real' },
      { text: 'Not tired yet' },
    ],
  },
};

/** Greeting lines for the companion root menu, chosen by condition. */
export const HIM_GREETINGS: { if?: Condition; text: string }[] = [
  { if: { time: ['morning'] }, text: 'Good morning, {her}. You look cute when you’re still half asleep.' },
  { if: { time: ['day'] }, text: 'Hey you. What are we doing today?' },
  { if: { time: ['sunset'] }, text: 'The sky’s pretty right now. Still not as pretty as you, though.' },
  { if: { time: ['night'] }, text: 'It’s late… want to stay up a little longer with me?' },
  { if: { occasion: '*' }, text: 'Today feels special, doesn’t it?' },
  { text: 'Hi, {her}. I was just thinking about you.' },
];

/** Small talk – one is picked at random from those whose condition passes. */
export const HIM_CHATS: { if?: Condition; node: DialogueNode }[] = [
  { node: { lines: [
    { speaker: 'him', text: 'If you could go anywhere right now, where would we go?', mood: 'neutral' },
    { speaker: 'her', text: 'Somewhere with good food and you in it.', mood: 'happy' },
  ] } },
  { node: { lines: [
    { speaker: 'him', text: 'I hid a few surprises around here. Have you checked under things? Behind things? Inside things?', mood: 'happy' },
  ] } },
  { if: { location: 'kitchen' }, node: { lines: [
    { speaker: 'him', text: 'I’m in charge of taste-testing. It’s a very serious responsibility.', mood: 'happy' },
  ] } },
  { if: { location: 'school' }, node: { lines: [
    { speaker: 'him', text: 'Should we pass notes in class? Old-school style?', mood: 'shy' },
    { speaker: 'her', text: 'Only if you draw little hearts on them.', mood: 'love' },
  ] } },
  { if: { location: 'backyard', time: ['night'] }, node: { lines: [
    { speaker: 'him', text: 'Look up. If you connect those stars just right… I think they make a heart.', mood: 'love' },
  ] } },
  { if: { location: 'bedroom' }, node: { lines: [
    { speaker: 'him', text: 'That memory board is getting full. We should make more memories to pin up.', mood: 'happy' },
  ] } },
  { if: { minLevel: 5 }, node: { lines: [
    { speaker: 'him', text: 'You know there’s no last level here, right? That’s on purpose.', mood: 'love' },
    { speaker: 'her', text: 'Because we don’t have an ending?', mood: 'shy' },
    { speaker: 'him', text: 'Exactly.', mood: 'love' },
  ] } },
  { if: { minAffection: 30 }, node: { lines: [
    { speaker: 'him', text: 'Hey. Thanks for spending your time here with me.', mood: 'love' },
  ] } },
  { node: { lines: [
    { speaker: 'him', text: 'Rate my day so far: 10 out of 10. Mostly because you were in it.', mood: 'happy' },
  ] } },
  { node: { lines: [
    { speaker: 'him', text: 'Did you drink water today? Hydrated girlfriend, happy boyfriend.', mood: 'neutral' },
  ] } },
];

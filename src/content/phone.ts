// Editable text for the in-game phone. Nothing here is a real memory: it's general, sweet small talk.
// Add your own lines anywhere. {her} = whoever plays, {him} = the partner (they swap when playing as him).

/** Quick replies she can tap in Messages, and the partner's possible answers to each. */
export const QUICK_REPLIES: { text: string; replies: string[] }[] = [
  { text: '♥', replies: ['♥♥', 'Right back at you ♡', '♥'] },
  { text: 'Good morning!', replies: ['Good morning, {her} ☀️', 'Morning! Did you sleep well?', 'Good morning ♡ Have breakfast, okay?'] },
  { text: 'Miss you', replies: ['Miss you more.', 'Come here then ♡', 'I was literally just thinking about you.'] },
  { text: 'What are you doing?', replies: ['Thinking about you. Obviously.', 'Nothing important. Talk to me ♡', 'Waiting for you to text me, apparently.'] },
  { text: 'Goodnight ♡', replies: ['Goodnight, {her}. Sweet dreams ♡', 'Night night. Sleep well ♡', 'Goodnight! Don’t stay up too late.'] },
  { text: 'Haha', replies: ['😄', 'I’m hilarious, I know.', 'Hehe'] },
];

/** When she types her own text there's no AI: the partner answers with one of these. */
export const GENERIC_REPLIES = ['♡', 'Aww.', 'Hehe ♡', 'Noted ♡', 'Okay! ♡', 'You’re cute.'];

/**
 * Scheduled texts from the partner. Each slot sends at most one message a day, at a time picked inside its
 * window (so it doesn't always arrive at the same minute). If the game was closed for the whole window, that
 * day's message is skipped, so you never get "good morning" in the evening.
 * `chance` (0–1) makes a slot occasional. Add your own lines freely.
 */
export interface GreetingSlot { id: string; from: string; to: string; chance?: number; lines: string[] }
export const PHONE_GREETINGS: GreetingSlot[] = [
  {
    id: 'morning', from: '07:00', to: '11:00',
    lines: [
      'Good morning, {her} ☀️',
      'Morning! Did you sleep well?',
      'Good morning ♡ Don’t forget breakfast.',
      'Rise and shine, sleepyhead.',
      'Good morning! I hope today is gentle with you.',
    ],
  },
  {
    id: 'afternoon', from: '13:00', to: '17:00', chance: 0.6,
    lines: [
      'Drink some water, okay? ♡',
      'Just checking in. How’s your day going?',
      'Thinking about you.',
      'Don’t forget to take a little break.',
    ],
  },
  {
    id: 'night', from: '21:00', to: '23:45',
    lines: [
      'Goodnight, {her}. Sweet dreams ♡',
      'Get some rest, okay? Goodnight ♡',
      'Night night. Talk tomorrow ♡',
      'Don’t stay up too late. Goodnight ♡',
    ],
  },
];

/** How the partner words a calendar reminder. {title}, {time} and {note} are filled in. */
export const REMINDER_LINES = [
  'Hey {her}, reminder: {title} ♡',
  'It’s {time}! {title}.',
  'Don’t forget: {title} ♡',
  'Psst… {title}.',
];
/** Added when a reminder came due while the game was closed. */
export const MISSED_SUFFIX = ' (this was for {time})';

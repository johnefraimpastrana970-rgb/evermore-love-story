// His work day: bento foods, cravings, the lines he says, and what he brings home. Plain data, edit freely.

export type BentoSlot = 'rice' | 'main' | 'side' | 'veggie' | 'sweet';
export const BENTO_SLOTS: { slot: BentoSlot; label: string }[] = [
  { slot: 'rice', label: 'Rice' },
  { slot: 'main', label: 'Main' },
  { slot: 'side', label: 'Side' },
  { slot: 'veggie', label: 'Veggies' },
  { slot: 'sweet', label: 'Something sweet' },
];

export interface BentoFood {
  id: string;
  slot: BentoSlot;
  name: string;
  emoji: string;
  /** Background colour of the food in the drawn box. */
  color: string;
  /** Made with produce from the garden (uses one from the basket). */
  garden?: string;
  /** What he says about it in his lunch message. */
  says: string;
}

export const FOODS: BentoFood[] = [
  { id: 'rice-plain', slot: 'rice', name: 'Rice & umeboshi', emoji: '🍚', color: '#fffaf0', says: 'the little plum on the rice' },
  { id: 'rice-heart', slot: 'rice', name: 'Heart onigiri', emoji: '🍙', color: '#fffdf6', says: 'the HEART-shaped onigiri' },
  { id: 'rice-bear', slot: 'rice', name: 'Bear-face rice', emoji: '🐻', color: '#f7e7c8', says: 'a bear made of rice?! It’s looking at me' },
  { id: 'rice-furikake', slot: 'rice', name: 'Furikake rice', emoji: '🍘', color: '#fff2c8', says: 'the furikake rice' },
  { id: 'main-tamago', slot: 'main', name: 'Tamagoyaki', emoji: '🍳', color: '#ffe066', says: 'the fluffy tamagoyaki' },
  { id: 'main-karaage', slot: 'main', name: 'Karaage', emoji: '🍗', color: '#d99a4e', says: 'crispy karaage, my favourite' },
  { id: 'main-octopus', slot: 'main', name: 'Octopus sausages', emoji: '🐙', color: '#ff8a7a', says: 'octopus sausages. Little legs and everything' },
  { id: 'main-salmon', slot: 'main', name: 'Grilled salmon', emoji: '🐟', color: '#ffad8a', says: 'the grilled salmon' },
  { id: 'main-burger', slot: 'main', name: 'Mini hamburg steak', emoji: '🍔', color: '#8a5a3a', says: 'a tiny hamburg steak' },
  { id: 'side-potato', slot: 'side', name: 'Potato salad', emoji: '🥔', color: '#fff1c4', says: 'the potato salad' },
  { id: 'side-edamame', slot: 'side', name: 'Edamame', emoji: '🫛', color: '#8fd17a', says: 'edamame to snack on' },
  { id: 'side-gyoza', slot: 'side', name: 'Gyoza', emoji: '🥟', color: '#f4dcb0', says: 'gyoza!!' },
  { id: 'side-corn', slot: 'side', name: 'Buttered corn', emoji: '🌽', color: '#f6d36b', garden: 'corn', says: 'sweet corn from OUR garden' },
  { id: 'veg-broccoli', slot: 'veggie', name: 'Broccoli trees', emoji: '🥦', color: '#5fb36b', says: 'the little broccoli trees' },
  { id: 'veg-tomato', slot: 'veggie', name: 'Cherry tomatoes', emoji: '🍅', color: '#e5413d', says: 'cherry tomatoes' },
  { id: 'veg-carrot', slot: 'veggie', name: 'Carrot flowers', emoji: '🥕', color: '#f08a4b', says: 'carrots cut into flowers 🥹' },
  { id: 'veg-chives', slot: 'veggie', name: 'Chive omelette roll', emoji: '🌱', color: '#a8d878', garden: 'chives', says: 'chives from our garden' },
  { id: 'sweet-apple', slot: 'sweet', name: 'Apple bunnies', emoji: '🍎', color: '#ffd6d6', says: 'APPLE BUNNIES' },
  { id: 'sweet-pudding', slot: 'sweet', name: 'Mini pudding', emoji: '🍮', color: '#f6c343', says: 'pudding for dessert' },
  { id: 'sweet-cookie', slot: 'sweet', name: 'Heart cookie', emoji: '🍪', color: '#d9a066', says: 'a heart cookie' },
  { id: 'sweet-strawberry', slot: 'sweet', name: 'Strawberries', emoji: '🍓', color: '#ff7a8a', garden: 'strawberry', says: 'strawberries we grew ♡' },
  { id: 'sweet-blueberry', slot: 'sweet', name: 'Blueberries', emoji: '🫐', color: '#6b7fd8', garden: 'blueberry', says: 'our garden blueberries' },
];
export const food = (id: string) => FOODS.find((f) => f.id === id);

export const WRAPS = [
  { id: 'pink', name: 'Sakura cloth', color: '#ffb3c8' },
  { id: 'gingham', name: 'Red gingham', color: '#e5533d' },
  { id: 'mint', name: 'Mint dots', color: '#7fd1b9' },
  { id: 'navy', name: 'Starry navy', color: '#2f3a66' },
  { id: 'cream', name: 'Cream lace', color: '#f6ead2' },
];

/** A craving he mentions each day; packing it makes him extra happy. */
export const CRAVINGS: { slot: BentoSlot; foods: string[]; line: string }[] = [
  { slot: 'main', foods: ['main-karaage'], line: 'I’ve been thinking about karaage all morning…' },
  { slot: 'sweet', foods: ['sweet-apple', 'sweet-pudding', 'sweet-cookie', 'sweet-strawberry', 'sweet-blueberry'], line: 'I could really go for something sweet today.' },
  { slot: 'main', foods: ['main-octopus'], line: 'Remember those octopus sausages? …Just saying.' },
  { slot: 'rice', foods: ['rice-heart', 'rice-bear'], line: 'Cute rice makes my whole day better.' },
  { slot: 'side', foods: ['side-gyoza'], line: 'Gyoza. That’s it. That’s the message.' },
  { slot: 'veggie', foods: ['veg-carrot', 'veg-broccoli'], line: 'I should eat more veggies… make me?' },
];

export const SHIFT_MINUTES = 15;
export const SHIFTS_PER_DAY = 3;
export const UNLOCK_LEVEL = 2;
export const NOTE_MAX = 60;

/** Messages while he's away: minute into the shift → lines. {food} = something from the bento. */
export const WORK_MESSAGES: { at: number; lines: string[] }[] = [
  { at: 4, lines: ['Lunch break! Opening it now… you packed {food}?! 🥹', 'Okay, everyone at work is jealous. I have {food}!', 'Just opened my lunch. {food}. I’m so lucky.'] },
  { at: 9, lines: ['Back to work… I miss you already.', 'Counting down the minutes ♡', 'Thinking about you instead of working. Don’t tell my boss.'] },
  { at: 13, lines: ['Wrapping up! Coming home soon ♡', 'On my way home now. Want anything?', 'Leaving now. See you in a bit, my love.'] },
];
export const NOTE_REPLY = ['And the note… I read it like five times. ♡', 'Your note is going in my wallet forever.', 'The note made me smile in the middle of a meeting.'];

/** What he can bring home (more and nicer for a lovingly packed bento). */
export const SOUVENIRS: { id: string; item?: string; tokens?: number; text: string; weight: number; minScore: number }[] = [
  { id: 'tokens-s', tokens: 12, text: 'a few heart tokens', weight: 4, minScore: 0 },
  { id: 'cookie', item: 'cookie', text: 'a cookie from the bakery', weight: 3, minScore: 0 },
  { id: 'bouquet', item: 'bouquet', text: 'a little bouquet', weight: 2, minScore: 2 },
  { id: 'tokens-m', tokens: 25, text: 'a bonus (heart tokens!)', weight: 2, minScore: 3 },
  { id: 'tokens-l', tokens: 45, text: 'a big bonus', weight: 1, minScore: 5 },
];

export const HOME_LINES = {
  /** Her thought when he arrives. */
  arrive: 'My boyfriend is home, I should open the door!',
  arriveAsHim: 'My girlfriend is home, I should open the door!',
  hint: 'Go open the front door (Living Room) ♡',
  him: 'I’m home, my love ♡',
  her: 'Welcome home, my love ♡',
};
export const LEAVE_LINES = [
  'Thank you for lunch ♡ I’ll be back in {min} minutes!',
  'You packed this for me? Okay, best day already. See you in {min} minutes ♡',
  'I’ll miss you. Back soon, okay? ({min} minutes!)',
];

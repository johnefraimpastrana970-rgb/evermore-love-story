// Pizza shop content: ingredients, recipes, customers. Plain data, edit freely.
// Customers are made up for the game (not real people); their art can be dropped into
// public/assets/customers/<id>.webp later and it is picked up automatically.

export type Tier = 1 | 2 | 3;
export const TIERS: Tier[] = [1, 2, 3];
export const TIER_LABEL: Record<Tier, string> = { 1: 'Basic', 2: 'Good', 3: 'Premium' };
/** Price multiplier per tier. Better ingredients cost more but raise price, stars and tips. */
export const TIER_COST: Record<Tier, number> = { 1: 1, 2: 2.2, 3: 3.8 };

export type IngKind =
  | 'dough' | 'tomato' | 'cream' | 'mozzarella'
  | 'basil' | 'pepperoni' | 'mushroom' | 'pepper' | 'onion' | 'olive' | 'ham' | 'pineapple' | 'truffle'
  | 'box';
export type IngCategory = 'base' | 'sauce' | 'cheese' | 'topping' | 'packaging';

export interface IngredientDef {
  kind: IngKind;
  category: IngCategory;
  /** Name per tier, cheapest first. */
  names: [string, string, string];
  basePrice: number;
  /** Colour per tier (stylish tiers look richer). */
  colors: [string, string, string];
  /** Topping piece shape drawn on the pizza. */
  piece?: 'disc' | 'leaf' | 'ring' | 'chunk' | 'drop' | 'cap' | 'olive';
  emoji: string;
}

export const INGREDIENTS: Record<IngKind, IngredientDef> = {
  dough: { kind: 'dough', category: 'base', names: ['Plain Dough', 'Hand-Tossed Dough', 'Stone-Milled Sourdough'], basePrice: 2, colors: ['#f3dcae', '#efd09a', '#e8c48a'], emoji: '🫓' },
  tomato: { kind: 'tomato', category: 'sauce', names: ['Tomato Sauce', 'Herbed Marinara', 'Slow-Roasted Tomato'], basePrice: 2, colors: ['#d8432f', '#c9352a', '#b8261f'], emoji: '🍅' },
  cream: { kind: 'cream', category: 'sauce', names: ['White Sauce', 'Garlic Cream', 'Parmesan Velouté'], basePrice: 3, colors: ['#f6efe0', '#f4ead2', '#f1e3c0'], emoji: '🥛' },
  mozzarella: { kind: 'mozzarella', category: 'cheese', names: ['Shredded Cheese', 'Fresh Mozzarella', 'Buffalo Mozzarella'], basePrice: 3, colors: ['#fff1b8', '#fff6d2', '#fffbe9'], emoji: '🧀' },
  basil: { kind: 'basil', category: 'topping', names: ['Dried Basil', 'Fresh Basil', 'Garden Basil Tips'], basePrice: 1, colors: ['#4f8a3a', '#3f9a3a', '#2fae4a'], piece: 'leaf', emoji: '🌿' },
  pepperoni: { kind: 'pepperoni', category: 'topping', names: ['Pepperoni', 'Spicy Pepperoni', 'Cup & Char Pepperoni'], basePrice: 3, colors: ['#c0392b', '#b02a22', '#9e1f1a'], piece: 'disc', emoji: '🍕' },
  mushroom: { kind: 'mushroom', category: 'topping', names: ['Button Mushrooms', 'Cremini Mushrooms', 'Wild Forest Mushrooms'], basePrice: 2, colors: ['#d9c3a5', '#b89878', '#8f6d4f'], piece: 'cap', emoji: '🍄' },
  pepper: { kind: 'pepper', category: 'topping', names: ['Green Pepper', 'Sweet Bell Pepper', 'Fire-Roasted Pepper'], basePrice: 1, colors: ['#4caf50', '#e74c3c', '#e67e22'], piece: 'ring', emoji: '🫑' },
  onion: { kind: 'onion', category: 'topping', names: ['White Onion', 'Red Onion', 'Caramelised Onion'], basePrice: 1, colors: ['#f2e6f0', '#b05a9a', '#b07a3a'], piece: 'ring', emoji: '🧅' },
  olive: { kind: 'olive', category: 'topping', names: ['Black Olives', 'Kalamata Olives', 'Castelvetrano Olives'], basePrice: 2, colors: ['#2b2b33', '#5a2b4a', '#7aa04a'], piece: 'olive', emoji: '🫒' },
  ham: { kind: 'ham', category: 'topping', names: ['Ham', 'Honey Ham', 'Prosciutto'], basePrice: 3, colors: ['#f2a7a7', '#ef9696', '#e47c86'], piece: 'chunk', emoji: '🥓' },
  pineapple: { kind: 'pineapple', category: 'topping', names: ['Canned Pineapple', 'Fresh Pineapple', 'Grilled Pineapple'], basePrice: 2, colors: ['#ffe066', '#ffd23f', '#f6b93b'], piece: 'chunk', emoji: '🍍' },
  truffle: { kind: 'truffle', category: 'topping', names: ['Truffle Oil', 'Black Truffle Oil', 'Shaved Black Truffle'], basePrice: 6, colors: ['#6b5a2e', '#4a3b1e', '#2e2416'], piece: 'drop', emoji: '✨' },
  box: { kind: 'box', category: 'packaging', names: ['Plain Box', 'Printed Box', 'Ribbon Gift Box'], basePrice: 1, colors: ['#d8b98a', '#f4c2d2', '#f7d6e4'], emoji: '📦' },
};
export const ING_ORDER: IngKind[] = ['dough', 'tomato', 'cream', 'mozzarella', 'basil', 'pepperoni', 'mushroom', 'pepper', 'onion', 'olive', 'ham', 'pineapple', 'truffle', 'box'];

export interface RecipeDef {
  id: string;
  /** 1 = cheapest … 6 = most expensive. */
  rank: number;
  name: string;
  desc: string;
  sauce: 'tomato' | 'cream';
  toppings: { kind: IngKind; count: number }[];
  /** Base selling price in shop coins (before quality). */
  price: number;
  /** Shop level needed before it can go on the menu. */
  shopLevel: number;
  color: string;
}

export const RECIPES: RecipeDef[] = [
  { id: 'cheese', rank: 1, name: 'Classic Cheese', desc: 'Tomato sauce and a blanket of cheese. Simple and comforting.', sauce: 'tomato', toppings: [], price: 12, shopLevel: 1, color: '#ffd76a' },
  { id: 'basil', rank: 2, name: 'Tomato Basil', desc: 'Bright tomato, melty cheese and fresh basil leaves.', sauce: 'tomato', toppings: [{ kind: 'basil', count: 6 }], price: 16, shopLevel: 1, color: '#7bc96f' },
  { id: 'pepperoni', rank: 3, name: 'Pepperoni Party', desc: 'Crispy-edged pepperoni in every bite.', sauce: 'tomato', toppings: [{ kind: 'pepperoni', count: 8 }], price: 21, shopLevel: 2, color: '#e5533d' },
  { id: 'garden', rank: 4, name: 'Garden Veggie', desc: 'Peppers, onions and olives over tomato and cheese.', sauce: 'tomato', toppings: [{ kind: 'pepper', count: 5 }, { kind: 'onion', count: 5 }, { kind: 'olive', count: 6 }], price: 27, shopLevel: 3, color: '#5fb36b' },
  { id: 'sunny', rank: 5, name: 'Sunny Hawaiian', desc: 'Ham and pineapple: sweet, salty and a little bit controversial.', sauce: 'tomato', toppings: [{ kind: 'ham', count: 6 }, { kind: 'pineapple', count: 6 }], price: 33, shopLevel: 4, color: '#f6b93b' },
  { id: 'royale', rank: 6, name: 'Truffle Mushroom Royale', desc: 'Our signature: cream sauce, wild mushrooms and truffle. The fanciest pizza in town.', sauce: 'cream', toppings: [{ kind: 'mushroom', count: 7 }, { kind: 'truffle', count: 4 }], price: 52, shopLevel: 5, color: '#8f6d4f' },
];

/** Shop XP needed for each shop level (index = level - 1). Keeps going after the list. */
export const SHOP_LEVELS = [0, 60, 160, 320, 560, 900, 1350, 1900, 2600, 3500];
/** Ingredient tiers sold at the market by shop level. */
export const TIER_UNLOCK: Record<Tier, number> = { 1: 1, 2: 2, 3: 4 };

export interface CustomerDef {
  id: string;
  name: string;
  /** Placeholder colours until real art is added. */
  skin: string;
  hair: string;
  shirt: string;
  /** Seconds they'll wait before leaving. */
  patience: number;
  /** Recipe ids they order more often. */
  favorites: string[];
  /** 0–1: how generous their tips are. */
  generosity: number;
  /** Notices (and pays for) premium ingredients. */
  likesPremium: boolean;
  lines: { order: string[]; happy: string[]; ok: string[]; sad: string[]; leave: string };
}

export const CUSTOMERS: CustomerDef[] = [
  { id: 'mika', name: 'Mika', skin: '#f6d3b8', hair: '#3b2a2a', shirt: '#ff9ab8', patience: 95, favorites: ['basil', 'cheese'], generosity: 0.6, likesPremium: false,
    lines: { order: ['Hi hi! Can I get a {pizza}?', 'One {pizza}, please ♡'], happy: ['This is SO good!', 'Best pizza ever!'], ok: ['Yummy, thanks!'], sad: ['Hmm… it’s okay.'], leave: 'I’ll come back later…' } },
  { id: 'theo', name: 'Theo', skin: '#e8b996', hair: '#7a4a2a', shirt: '#5b8def', patience: 70, favorites: ['pepperoni'], generosity: 0.4, likesPremium: false,
    lines: { order: ['{pizza}. I’m starving.', 'Quick, a {pizza}!'], happy: ['Okay, that’s amazing.'], ok: ['Not bad!'], sad: ['That’s… not what I hoped.'], leave: 'Too slow, sorry!' } },
  { id: 'rosa', name: 'Nana Rosa', skin: '#f1cfb4', hair: '#d9d4d0', shirt: '#b56fc2', patience: 130, favorites: ['basil', 'royale'], generosity: 0.85, likesPremium: true,
    lines: { order: ['A {pizza}, dear, when you have a moment.', 'I’d love a {pizza}, sweetheart.'], happy: ['Just like the old days. Wonderful!'], ok: ['Very nice, dear.'], sad: ['Oh, well. You’ll get it next time.'], leave: 'I’ll come back another day, dear.' } },
  { id: 'jun', name: 'Jun', skin: '#f3d6be', hair: '#1f1a1e', shirt: '#2fb5a3', patience: 85, favorites: ['garden'], generosity: 0.5, likesPremium: true,
    lines: { order: ['Could I get the {pizza}?', '{pizza}, please. Extra love.'], happy: ['Wow. The details on this!'], ok: ['Tastes good, thanks.'], sad: ['The toppings are a bit off…'], leave: 'Gotta run, sorry!' } },
  { id: 'leila', name: 'Leila', skin: '#c99272', hair: '#2a1a14', shirt: '#f2c14e', patience: 100, favorites: ['sunny'], generosity: 0.7, likesPremium: false,
    lines: { order: ['Pineapple time! One {pizza}!', 'I’ll take a {pizza} ☀️'], happy: ['Perfection. I’m telling everyone.'], ok: ['Yum!'], sad: ['It’s fine, I guess.'], leave: 'Maybe another time!' } },
  { id: 'bruno', name: 'Bruno', skin: '#e2b08c', hair: '#5a3a24', shirt: '#c0392b', patience: 75, favorites: ['pepperoni', 'sunny'], generosity: 0.35, likesPremium: false,
    lines: { order: ['Big appetite today. {pizza}!', 'Gimme a {pizza}.'], happy: ['Now THAT is a pizza!'], ok: ['Hits the spot.'], sad: ['Could be better, chef.'], leave: 'I’m outta here.' } },
  { id: 'sora', name: 'Sora', skin: '#f7dcc6', hair: '#6c8cd5', shirt: '#9ad0f5', patience: 110, favorites: ['cheese', 'garden'], generosity: 0.55, likesPremium: false,
    lines: { order: ['Um… a {pizza}, please?', 'Could I have a {pizza}?'], happy: ['It’s so pretty I almost don’t want to eat it.'], ok: ['Thank you!'], sad: ['Oh… that’s okay.'], leave: 'I’ll… go now.' } },
  { id: 'ivy', name: 'Ivy', skin: '#efc3a4', hair: '#b5523b', shirt: '#7bc96f', patience: 90, favorites: ['royale', 'garden'], generosity: 0.75, likesPremium: true,
    lines: { order: ['I heard the {pizza} is the one to get.', 'One {pizza}, make it fancy!'], happy: ['Restaurant quality. Bravo!'], ok: ['Nice work.'], sad: ['Not quite the fancy one I wanted.'], leave: 'I can’t wait any longer.' } },
  { id: 'kofi', name: 'Kofi', skin: '#8d5a3b', hair: '#1a1210', shirt: '#f08a4b', patience: 80, favorites: ['pepperoni', 'royale'], generosity: 0.6, likesPremium: true,
    lines: { order: ['Hey! One {pizza}, please.', 'Feeling like a {pizza} today.'], happy: ['Chef’s kiss. Seriously.'], ok: ['Solid pizza!'], sad: ['Hmm, needs work.'], leave: 'Catch you later!' } },
  { id: 'pemberton', name: 'Mr. Pemberton', skin: '#f0d0b8', hair: '#8a8a8a', shirt: '#4a4a6a', patience: 65, favorites: ['royale'], generosity: 0.9, likesPremium: true,
    lines: { order: ['I shall have the {pizza}.', 'Your finest {pizza}, if you please.'], happy: ['Exquisite. Truly exquisite.'], ok: ['Acceptable.'], sad: ['Disappointing, I’m afraid.'], leave: 'I do not have all day.' } },
];

// ------------------------------------------------------------------ shop decor & matching aprons (bought with shop coins)

export type DecorSlot = 'wall' | 'lights' | 'tables' | 'sign' | 'plant' | 'apron';
export interface DecorDef {
  id: string;
  slot: DecorSlot;
  name: string;
  price: number;
  /** CSS background used for the preview swatch in the decorate menu. */
  swatch: string;
}
export const DECOR_SLOTS: { slot: DecorSlot; label: string; icon: string }[] = [
  { slot: 'wall', label: 'Wallpaper', icon: '🧱' },
  { slot: 'lights', label: 'Lights', icon: '💡' },
  { slot: 'tables', label: 'Tables', icon: '🪑' },
  { slot: 'sign', label: 'Sign', icon: '🪧' },
  { slot: 'plant', label: 'Plants', icon: '🪴' },
  { slot: 'apron', label: 'Aprons', icon: '👕' },
];
export const DECOR: DecorDef[] = [
  { id: 'wall-cream', slot: 'wall', name: 'Cream dots', price: 0, swatch: '#ffe9d6' },
  { id: 'wall-stripes', slot: 'wall', name: 'Strawberry stripes', price: 70, swatch: 'repeating-linear-gradient(90deg,#ffd6e2 0 14px,#fff0f4 14px 28px)' },
  { id: 'wall-checks', slot: 'wall', name: 'Trattoria checks', price: 90, swatch: 'repeating-conic-gradient(#f4b6b0 0 25%,#fff6f0 0 50%) 0 0/24px 24px' },
  { id: 'wall-brick', slot: 'wall', name: 'Cozy brick', price: 120, swatch: '#c9785a' },
  { id: 'wall-stars', slot: 'wall', name: 'Starry night', price: 160, swatch: 'radial-gradient(circle at 30% 40%,#fff 1px,transparent 2px) 0 0/18px 18px,#2b2d5a' },
  { id: 'lights-none', slot: 'lights', name: 'No lights', price: 0, swatch: '#f3ede8' },
  { id: 'lights-fairy', slot: 'lights', name: 'Fairy lights', price: 80, swatch: 'radial-gradient(circle,#ffd36b 3px,transparent 4px) 0 0/16px 16px,#3b2b2e' },
  { id: 'lights-lanterns', slot: 'lights', name: 'Paper lanterns', price: 130, swatch: 'radial-gradient(circle,#ff8fb1 7px,transparent 8px) 0 0/22px 22px,#fff4e8' },
  { id: 'lights-neon', slot: 'lights', name: 'Neon heart', price: 200, swatch: '#ff4f8b' },
  { id: 'tables-plain', slot: 'tables', name: 'Wooden counter', price: 0, swatch: '#8a5a3a' },
  { id: 'tables-checked', slot: 'tables', name: 'Checkered cloth', price: 70, swatch: 'repeating-conic-gradient(#d8432f 0 25%,#fff 0 50%) 0 0/20px 20px' },
  { id: 'tables-marble', slot: 'tables', name: 'Pink marble', price: 140, swatch: 'linear-gradient(135deg,#fbe3ea,#fff 45%,#f4c9d6 55%,#fff)' },
  { id: 'tables-mint', slot: 'tables', name: 'Mint diner', price: 110, swatch: '#7fd1b9' },
  { id: 'sign-wood', slot: 'sign', name: 'Classic sign', price: 0, swatch: '#3fae76' },
  { id: 'sign-chalk', slot: 'sign', name: 'Chalkboard sign', price: 60, swatch: '#2f3a36' },
  { id: 'sign-heart', slot: 'sign', name: 'Heart sign', price: 100, swatch: '#ff8fb1' },
  { id: 'sign-gold', slot: 'sign', name: 'Golden sign', price: 180, swatch: 'linear-gradient(135deg,#f6d36b,#d9a730)' },
  { id: 'plant-none', slot: 'plant', name: 'No plants', price: 0, swatch: '#f3ede8' },
  { id: 'plant-fern', slot: 'plant', name: 'Basil pots', price: 40, swatch: '#5fb36b' },
  { id: 'plant-sunflower', slot: 'plant', name: 'Sunflowers', price: 70, swatch: '#f6c343' },
  { id: 'plant-roses', slot: 'plant', name: 'Rose bouquet', price: 110, swatch: '#e8577d' },
  { id: 'apron-white', slot: 'apron', name: 'Plain aprons', price: 0, swatch: '#ffffff' },
  { id: 'apron-pink', slot: 'apron', name: 'Matching pink', price: 40, swatch: '#ff9ab8' },
  { id: 'apron-red', slot: 'apron', name: 'Pizzeria red', price: 50, swatch: '#d8432f' },
  { id: 'apron-mint', slot: 'apron', name: 'Matching mint', price: 50, swatch: '#7fd1b9' },
  { id: 'apron-hearts', slot: 'apron', name: 'Little hearts', price: 90, swatch: 'radial-gradient(circle,#e8577d 3px,transparent 4px) 0 0/12px 12px,#fff0f4' },
  { id: 'apron-stripes', slot: 'apron', name: 'Chef stripes', price: 90, swatch: 'repeating-linear-gradient(90deg,#3b4a7a 0 6px,#fff 6px 12px)' },
];
export const DECOR_DEFAULT: Record<DecorSlot, string> = {
  wall: 'wall-cream', lights: 'lights-none', tables: 'tables-plain', sign: 'sign-wood', plant: 'plant-none', apron: 'apron-white',
};

/** What the partner says while helping in the shop. {her} = the player. */
export const PARTNER_LINES = {
  open: ['We’re open! Let’s do this ♡', 'Sign’s flipped. Ready, chef?', 'Our little shop ♡'],
  closed: ['Want to open up today?', 'I’ll wipe the counter while we wait ♡'],
  customer: ['Someone’s here!', 'Customer at the counter ♡', 'Ooh, a new face!'],
  dough: ['I’ll grab the flour!', 'Carrying the dough… don’t laugh at my apron.', 'Here, I got the ingredients ♡'],
  bake: ['I’ll watch the oven with you.', 'Smells amazing already…', 'Don’t let it burn! …I believe in you.'],
  box: ['Here’s a box ♡', 'I’ll hand it over!', 'Boxed with love.'],
  five: ['FIVE STARS! That’s my {her}!', 'Did you see that?! Five stars!', 'Best chef in town ♡'],
  good: ['They loved it!', 'Nice one, chef ♡'],
  low: ['Hey, next one will be perfect.', 'We’re still learning. I’m proud of you.'],
  wait: ['No rush, they’re happy to wait ♡', 'Take your time, chef.'],
  decor: ['Ooh, that looks so good in here!', 'Our shop is getting so cute ♡', 'You have the best taste.', 'Wow… customers are going to love this.'],
  apron: ['Matching aprons?! Okay, we look adorable.', 'Look at us. A real team ♡'],
  custom: ['Our very own pizza… I’m so proud of you ♡', 'Can I be the first to taste it?', 'That one’s going to be famous.'],
  customOrder: ['They ordered YOUR pizza!', 'Someone wants the pizza of the day ♡'],
  restock: ['We’re running low. Market trip?', 'Let’s restock soon, okay?'],
  away: ['I’ll keep an eye on the shop.', 'Go on, I’ll hang the “back soon” sign.'],
};

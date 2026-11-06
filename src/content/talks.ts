import type { Condition, DialogueNode } from './types';

/*
 * Playful jokes & emotional talks between {her} and {him}.
 *
 * Her moods map to her illustrated expressions (content/characters.ts):
 *   natural · idle · happy · cute · laughing · pouty · irritated · sad · crying
 * His moods (chibi until you add his art): neutral · happy · shy · surprised · love · sleepy · sad
 *
 * These are generic, playful/comforting conversations — not real memories. Edit freely, or add your own
 * inside jokes in the same shape. A talk is picked at random, preferring ones she hasn't seen yet.
 */

const R = (aff: number, xp: number, stat: string) => [
  { type: 'affection' as const, amount: aff },
  { type: 'xp' as const, amount: xp },
  { type: 'stat' as const, id: stat },
];

export const TALK_NODES: Record<string, DialogueNode> = {
  // ================================================================ talk menu
  'him-talk': {
    lines: [{ speaker: 'him', text: 'Talk to me. I’m all yours.', mood: 'happy' }],
    choices: [
      { text: 'Just chat', next: '__chat' },
      { text: 'Tell me a joke', next: '__joke' },
      { text: 'Let’s be silly', next: '__tease' },
      { text: 'How I’m feeling…', next: 'feel-root' },
      { text: 'Something deeper', next: '__deep' },
      { text: 'Back', next: 'him-root' },
    ],
  },

  // ================================================================ feelings check-in
  'feel-root': {
    lines: [{ speaker: 'him', text: 'Hey. Not the polite answer — how are you really feeling today?', mood: 'love' }],
    choices: [
      { text: 'Happy! ✨', next: 'feel-happy' },
      { text: 'Kinda tired…', next: 'feel-tired' },
      { text: 'Sad, honestly', next: 'feel-sad' },
      { text: 'Annoyed 😤', next: 'feel-annoyed' },
      { text: 'I just want cuddles', next: 'feel-cuddle' },
    ],
  },
  'feel-happy': {
    lines: [
      { speaker: 'her', text: 'Honestly? Pretty good today!', mood: 'happy' },
      { speaker: 'him', text: 'Look at that smile. I want to bottle it and keep it in my pocket.', mood: 'happy' },
      { speaker: 'her', text: 'That’s weird. …Keep it anyway.', mood: 'laughing' },
    ],
    effects: R(2, 15, 'checkins'),
  },
  'feel-tired': {
    lines: [
      { speaker: 'her', text: 'My brain is a loading screen today.', mood: 'idle' },
      { speaker: 'him', text: 'Then let’s do absolutely nothing together. Nothing is my specialty.', mood: 'happy' },
      { speaker: 'her', text: 'You’re really good at nothing.', mood: 'cute' },
      { speaker: 'him', text: 'Professional level. Come rest on my shoulder.', mood: 'love' },
    ],
    effects: R(2, 15, 'checkins'),
  },
  'feel-sad': {
    lines: [
      { speaker: 'her', text: '…Not really okay today.', mood: 'sad' },
      { speaker: 'him', text: 'Come here. You don’t have to explain anything if you don’t want to.', mood: 'love' },
    ],
    choices: [
      { text: 'Can I just vent?', next: 'feel-vent' },
      { text: 'I just need a hug', next: 'feel-hug' },
      { text: 'Distract me, please', next: 'feel-distract' },
    ],
  },
  'feel-vent': {
    lines: [
      { speaker: 'him', text: 'Go ahead. I’m listening — no fixing, no advice unless you ask for it.', mood: 'neutral' },
      { speaker: 'narrator', text: '{her} talks. {him} listens — really listens — without looking away once.' },
      { speaker: 'her', text: 'Sorry… I didn’t mean to cry.', mood: 'crying' },
      { speaker: 'him', text: 'Never apologise for feelings. Cry on me as long as you need. I’m not going anywhere.', mood: 'love' },
      { speaker: 'her', text: '…Thank you. Really.', mood: 'sad' },
      { speaker: 'him', text: 'Always. Today, tomorrow, every bad day after that.', mood: 'love' },
      { speaker: 'her', text: 'Okay. I feel a little lighter.', mood: 'cute' },
    ],
    effects: R(5, 40, 'deep-talks'),
  },
  'feel-hug': {
    lines: [
      { speaker: 'narrator', text: '{him} pulls {her} into a long, quiet hug.' },
      { speaker: 'her', text: '…', mood: 'crying' },
      { speaker: 'him', text: 'I’ve got you. Take your time.', mood: 'love' },
      { speaker: 'her', text: 'Okay… a little better now.', mood: 'cute' },
    ],
    effects: [...R(5, 35, 'deep-talks'), { type: 'stat', id: 'hugs' }],
  },
  'feel-distract': {
    lines: [
      { speaker: 'him', text: 'Distraction mode: ON. Did you know otters hold hands when they sleep so they don’t drift apart?', mood: 'happy' },
      { speaker: 'her', text: '…That’s actually really cute.', mood: 'sad' },
      { speaker: 'him', text: 'So. Give me your hand. Wouldn’t want you drifting away.', mood: 'shy' },
      { speaker: 'her', text: 'You’re such a sap.', mood: 'laughing' },
    ],
    effects: R(4, 30, 'deep-talks'),
  },
  'feel-annoyed': {
    lines: [
      { speaker: 'her', text: 'Everything is annoying today. Including you. A little.', mood: 'irritated' },
      { speaker: 'him', text: 'Me?! What did I do?', mood: 'pouty' },
      { speaker: 'her', text: 'You breathed. Loudly.', mood: 'pouty' },
      { speaker: 'him', text: '…Fair. I’ll breathe quieter. Snacks as a peace offering?', mood: 'shy' },
    ],
    choices: [
      { text: 'Snacks accepted', next: 'feel-annoyed-snack' },
      { text: 'Still annoyed', next: 'feel-annoyed-still' },
    ],
  },
  'feel-annoyed-snack': {
    lines: [
      { speaker: 'her', text: 'Fine. You’re forgiven. This time.', mood: 'cute' },
      { speaker: 'him', text: 'I’ll write it on the calendar: “forgiven, snack-based”.', mood: 'happy' },
      { speaker: 'her', text: 'Stop making me laugh, I’m supposed to be mad!', mood: 'laughing' },
    ],
    effects: R(3, 20, 'checkins'),
  },
  'feel-annoyed-still': {
    lines: [
      { speaker: 'her', text: 'Hmph.', mood: 'pouty' },
      { speaker: 'him', text: 'Okay. I’ll just sit right here until you’re un-annoyed. I’m very patient. And cute.', mood: 'love' },
      { speaker: 'her', text: '…', mood: 'irritated' },
      { speaker: 'him', text: '…Still here. Still cute.', mood: 'happy' },
      { speaker: 'her', text: 'Ugh. Okay, that was a little funny.', mood: 'laughing' },
    ],
    effects: R(3, 20, 'checkins'),
  },
  'feel-cuddle': {
    lines: [
      { speaker: 'her', text: 'No talking. Just cuddles.', mood: 'cute' },
      { speaker: 'him', text: 'Cuddle delivery, coming right up. No talking. …Can I hum?', mood: 'love' },
      { speaker: 'her', text: 'You can hum.', mood: 'happy' },
    ],
    effects: R(3, 20, 'checkins'),
  },

  // ================================================================ jokes (he tells, she reacts)
  'joke-parking': { lines: [
    { speaker: 'him', text: 'Are you a parking ticket? Because you’ve got “fine” written all over you.', mood: 'happy' },
    { speaker: 'her', text: 'That was so bad. Why am I laughing?', mood: 'laughing' },
  ], effects: R(1, 10, 'jokes') },
  'joke-mouse': { lines: [
    { speaker: 'him', text: 'Why did the cat sit on the computer?', mood: 'neutral' },
    { speaker: 'her', text: 'Why?', mood: 'natural' },
    { speaker: 'him', text: 'To keep an eye on the mouse.', mood: 'happy' },
    { speaker: 'her', text: 'The cat on my shirt approves. Barely.', mood: 'cute', asHim: 'My hoodie approves. Barely.' },
  ], effects: R(1, 10, 'jokes') },
  'joke-glasses': { lines: [
    { speaker: 'him', text: 'Do you need glasses? Because I see a future with you.', mood: 'love' },
    { speaker: 'her', text: '…I’m literally wearing glasses right now.', mood: 'irritated' },
    { speaker: 'him', text: 'And they’re working great, because you’re looking at me.', mood: 'happy' },
    { speaker: 'her', text: 'Okay, that one actually got me.', mood: 'laughing' },
  ], effects: R(2, 12, 'jokes') },
  'joke-impasta': { lines: [
    { speaker: 'him', text: 'What do you call a fake noodle?', mood: 'neutral' },
    { speaker: 'her', text: 'Don’t.', mood: 'irritated' },
    { speaker: 'him', text: 'An impasta.', mood: 'happy' },
    { speaker: 'her', text: 'I’m annoyed that I laughed.', mood: 'laughing' },
  ], effects: R(1, 10, 'jokes') },
  'joke-purr': { lines: [
    { speaker: 'him', text: 'I asked the cat on your shirt how I’m doing as a boyfriend.', mood: 'neutral', asHim: 'I asked your hoodie how I’m doing as a girlfriend.' },
    { speaker: 'her', text: 'And?', mood: 'natural' },
    { speaker: 'him', text: 'It said “purr-fect”.', mood: 'happy' },
    { speaker: 'her', text: 'You can’t just interview my shirt!', mood: 'pouty', asHim: 'You can’t just interview my hoodie!' },
  ], effects: R(1, 10, 'jokes') },
  'joke-cute': { lines: [
    { speaker: 'him', text: 'Are you made of copper and tellurium?', mood: 'neutral' },
    { speaker: 'her', text: '…What?', mood: 'idle' },
    { speaker: 'him', text: 'Because you’re Cu-Te.', mood: 'shy' },
    { speaker: 'her', text: 'Nerd. …Cute nerd.', mood: 'laughing' },
  ], effects: R(2, 12, 'jokes') },
  'joke-skeleton': { lines: [
    { speaker: 'him', text: 'Why don’t skeletons fight each other? They don’t have the guts.', mood: 'happy' },
    { speaker: 'her', text: '…Was that supposed to be romantic?', mood: 'idle' },
    { speaker: 'him', text: 'No, that was just a skeleton joke. Romance is scheduled for later.', mood: 'shy' },
    { speaker: 'her', text: 'I’ll hold you to that.', mood: 'cute' },
  ], effects: R(1, 10, 'jokes') },
  'joke-reaction': { lines: [
    { speaker: 'him', text: 'I’d tell you a chemistry joke, but I know I wouldn’t get a reaction.', mood: 'neutral' },
    { speaker: 'her', text: '…', mood: 'natural' },
    { speaker: 'him', text: 'SEE?!', mood: 'surprised' },
    { speaker: 'her', text: 'Okay okay, that’s a reaction.', mood: 'laughing' },
  ], effects: R(1, 10, 'jokes') },
  'joke-menu': { lines: [
    { speaker: 'him', text: 'Guess what’s on the menu tonight?', mood: 'happy' },
    { speaker: 'her', text: 'What?', mood: 'natural' },
    { speaker: 'him', text: 'Me-n-u.', mood: 'love' },
    { speaker: 'her', text: 'I’m leaving.', mood: 'pouty' },
    { speaker: 'him', text: 'Nooo come back, I have better ones!', mood: 'crying' },
    { speaker: 'her', text: 'You really don’t.', mood: 'laughing' },
  ], effects: R(1, 10, 'jokes') },
  'joke-wifi': { lines: [
    { speaker: 'him', text: 'You must be the Wi-Fi.', mood: 'neutral' },
    { speaker: 'her', text: 'Because I’m always there for you?', mood: 'cute' },
    { speaker: 'him', text: 'Because I feel a connection. And also I get lost without you.', mood: 'love' },
    { speaker: 'her', text: 'That was two jokes taped together.', mood: 'laughing' },
  ], effects: R(1, 10, 'jokes') },
  'joke-bear': { lines: [
    { speaker: 'him', text: 'What do you call a bear with no teeth?', mood: 'neutral' },
    { speaker: 'her', text: 'A gummy bear. Everyone knows that one.', mood: 'irritated' },
    { speaker: 'him', text: '…You stole my punchline.', mood: 'pouty' },
    { speaker: 'her', text: 'Aww, don’t pout. That’s my job.', mood: 'pouty' },
  ], effects: R(1, 10, 'jokes') },
  'joke-time': { lines: [
    { speaker: 'him', text: 'I’m terrible with time, you know.', mood: 'neutral' },
    { speaker: 'her', text: 'Very true.', mood: 'irritated' },
    { speaker: 'him', text: 'Because every minute with you feels like a second.', mood: 'love' },
    { speaker: 'her', text: 'Smooth. Still doesn’t excuse you being late.', mood: 'pouty' },
  ], effects: R(1, 10, 'jokes') },

  // ================================================================ silly / teasing
  'tease-fog': { lines: [
    { speaker: 'narrator', text: '{her} takes a sip of something warm. Her glasses fog up completely.' },
    { speaker: 'her', text: 'Don’t laugh. I can’t see anything.', mood: 'pouty' },
    { speaker: 'him', text: 'I’m not laughing. You just look like a very cute little fog machine.', mood: 'laughing' },
    { speaker: 'her', text: '{him}.', mood: 'irritated' },
    { speaker: 'him', text: 'Sorry! Here — let me wipe them for you.', mood: 'shy' },
    { speaker: 'her', text: '…Thanks.', mood: 'cute' },
  ], effects: R(2, 12, 'teases') },
  'tease-more': {
    lines: [
      { speaker: 'her', text: 'I love you more.', mood: 'cute' },
      { speaker: 'him', text: 'Impossible. I love you most.', mood: 'love' },
      { speaker: 'her', text: 'Most-est.', mood: 'pouty' },
      { speaker: 'him', text: 'Infinity.', mood: 'happy' },
      { speaker: 'her', text: 'Infinity plus one.', mood: 'irritated' },
      { speaker: 'him', text: 'Infinity plus two. Final answer.', mood: 'happy' },
    ],
    choices: [
      { text: '“Fine. You win.”', next: 'tease-more-lose' },
      { text: '“I win. End of discussion.”', next: 'tease-more-win' },
    ],
  },
  'tease-more-lose': { lines: [
    { speaker: 'her', text: 'Fine. You win this one.', mood: 'pouty' },
    { speaker: 'him', text: '…Actually, I feel bad now. You win. You always win.', mood: 'shy' },
    { speaker: 'her', text: 'I know.', mood: 'happy' },
  ], effects: R(2, 12, 'teases') },
  'tease-more-win': { lines: [
    { speaker: 'her', text: 'I win. End of discussion.', mood: 'happy' },
    { speaker: 'him', text: 'Can’t argue with that face.', mood: 'love' },
  ], effects: R(2, 12, 'teases') },
  'tease-stare': { lines: [
    { speaker: 'her', text: 'Why are you staring at me?', mood: 'irritated' },
    { speaker: 'him', text: 'Can’t help it. You’re distracting.', mood: 'love' },
    { speaker: 'her', text: '…Stop it.', mood: 'cute' },
    { speaker: 'him', text: 'You’re smiling though.', mood: 'happy' },
    { speaker: 'her', text: 'I am NOT.', mood: 'laughing' },
  ], effects: R(2, 12, 'teases') },
  'tease-cookie': { lines: [
    { speaker: 'narrator', text: 'There is exactly one cookie left. {him} is holding it.' },
    { speaker: 'her', text: '…', mood: 'pouty' },
    { speaker: 'him', text: 'Don’t look at me like that.', mood: 'surprised' },
    { speaker: 'her', text: '…', mood: 'sad' },
    { speaker: 'him', text: 'Okay! Okay. Half for you. …Fine, the bigger half.', mood: 'sad' },
    { speaker: 'her', text: 'Works every time.', mood: 'laughing' },
  ], effects: R(2, 12, 'teases') },
  'tease-rate': {
    lines: [
      { speaker: 'her', text: 'Rate my outfit. Be honest.', mood: 'natural' },
      { speaker: 'him', text: 'Eleven out of ten. The cat on your shirt is a twelve, though.', mood: 'happy', asHim: 'Eleven out of ten. The hoodie is a twelve, though.' },
      { speaker: 'her', text: 'Why is the cat winning?!', mood: 'pouty', asHim: 'Why is the hoodie winning?!' },
    ],
    choices: [
      { text: 'Take the shirt’s side', asHim: 'Take the hoodie’s side', next: 'tease-rate-cat' },
      { text: 'Demand a recount', next: 'tease-rate-recount' },
    ],
  },
  'tease-rate-cat': { lines: [
    { speaker: 'her', text: 'Okay, honestly, the cat is very cute.', mood: 'cute', asHim: 'Okay, honestly, the hoodie is very comfy.' },
    { speaker: 'him', text: 'See? We agree. Cutest duo in the house: you and the cat.', mood: 'love', asHim: 'See? We agree. Coziest duo in the house: you and that hoodie.' },
  ], effects: R(2, 12, 'teases') },
  'tease-rate-recount': { lines: [
    { speaker: 'her', text: 'I demand a recount.', mood: 'irritated' },
    { speaker: 'him', text: 'Recounting… new score: infinity. The cat has been disqualified.', mood: 'happy', asHim: 'Recounting… new score: infinity. The hoodie has been disqualified.' },
    { speaker: 'her', text: 'Justice!', mood: 'happy' },
  ], effects: R(2, 12, 'teases') },
  'tease-silent': { lines: [
    { speaker: 'her', text: 'I’m giving you the silent treatment.', mood: 'pouty' },
    { speaker: 'him', text: 'That’s not very silent.', mood: 'neutral' },
    { speaker: 'her', text: '…', mood: 'irritated' },
    { speaker: 'him', text: 'I’ll just narrate then. “She was cute, and also a little dramatic.”', mood: 'happy' },
    { speaker: 'her', text: 'HEY.', mood: 'irritated' },
    { speaker: 'him', text: 'Silent treatment over! I win.', mood: 'laughing' },
    { speaker: 'her', text: 'You’re the worst. I like you.', mood: 'laughing' },
  ], effects: R(2, 12, 'teases') },
  'tease-sleepy': { lines: [
    { speaker: 'her', text: 'Five more minutes…', mood: 'idle' },
    { speaker: 'him', text: 'You said that twenty minutes ago.', mood: 'neutral' },
    { speaker: 'her', text: 'And they were twenty great minutes.', mood: 'cute' },
    { speaker: 'him', text: '…Can’t argue with that.', mood: 'sleepy' },
  ], effects: R(1, 10, 'teases') },
  'tease-photo': { lines: [
    { speaker: 'him', text: 'Hold still, I want a picture.', mood: 'happy' },
    { speaker: 'her', text: 'Wait, my hair—', mood: 'pouty' },
    { speaker: 'narrator', text: '*click*' },
    { speaker: 'him', text: 'Perfect. Going straight to my wallpaper.', mood: 'love' },
    { speaker: 'her', text: 'Delete it! …Okay, send it to me first.', mood: 'laughing' },
  ], effects: R(2, 12, 'teases') },

  // ================================================================ deeper / emotional
  'deep-scared': {
    lines: [{ speaker: 'him', text: 'Can I ask you something real? What are you scared of?', mood: 'neutral' }],
    choices: [
      { text: 'Losing the people I love', next: 'deep-scared-lose' },
      { text: 'Not being enough', next: 'deep-scared-enough' },
      { text: 'Spiders. Obviously.', next: 'deep-scared-spider' },
    ],
  },
  'deep-scared-lose': { lines: [
    { speaker: 'her', text: 'Losing the people I love. Waking up one day and everyone’s gone.', mood: 'sad' },
    { speaker: 'him', text: 'I can’t promise the world won’t change. But I can promise I’ll keep choosing to stay.', mood: 'love' },
    { speaker: 'her', text: '…That’s a good promise.', mood: 'crying' },
    { speaker: 'him', text: 'It’s my favourite one.', mood: 'love' },
  ], effects: R(5, 40, 'deep-talks') },
  'deep-scared-enough': { lines: [
    { speaker: 'her', text: 'That I’m not enough. Not smart enough, not pretty enough, not… enough.', mood: 'sad' },
    { speaker: 'him', text: 'You are more than enough. Not “enough for now”. Enough, period.', mood: 'love' },
    { speaker: 'her', text: 'You have to say that.', mood: 'crying' },
    { speaker: 'him', text: 'I don’t have to say anything. I say it because it’s true.', mood: 'love' },
    { speaker: 'her', text: '…Okay. I’ll try to believe you.', mood: 'cute' },
  ], effects: R(5, 40, 'deep-talks') },
  'deep-scared-spider': { lines: [
    { speaker: 'her', text: 'Spiders. Obviously.', mood: 'laughing' },
    { speaker: 'him', text: 'Valid. I’ll be your official spider-remover.', mood: 'laughing' },
    { speaker: 'him', text: '…But if there’s ever something heavier, you can tell me too. Okay?', mood: 'love' },
    { speaker: 'her', text: 'Okay. I know.', mood: 'cute' },
  ], effects: R(3, 25, 'deep-talks') },
  'deep-thanks': { lines: [
    { speaker: 'him', text: 'Can I tell you something? Thank you.', mood: 'shy' },
    { speaker: 'her', text: 'For what?', mood: 'natural' },
    { speaker: 'him', text: 'For choosing me. Not once — every single day.', mood: 'love' },
    { speaker: 'her', text: 'Why are you trying to make me cry?', mood: 'crying' },
    { speaker: 'him', text: 'Good tears only. I checked.', mood: 'happy' },
  ], effects: R(5, 40, 'deep-talks') },
  'deep-failing': { lines: [
    { speaker: 'her', text: 'Do you ever feel like you’re failing at everything?', mood: 'sad' },
    { speaker: 'him', text: 'Sometimes. But you’re not failing — you’re tired. Those are different things.', mood: 'idle' },
    { speaker: 'her', text: '…They feel the same.', mood: 'crying' },
    { speaker: 'him', text: 'Then let me hold the heavy parts for a while. You rest.', mood: 'love' },
    { speaker: 'her', text: 'Okay.', mood: 'cute' },
  ], effects: R(5, 40, 'deep-talks') },
  'deep-future': {
    lines: [{ speaker: 'him', text: 'Where do you see us, someday?', mood: 'love' }],
    choices: [
      { text: 'Somewhere cozy. With a cat.', next: 'deep-future-cat' },
      { text: 'Anywhere, as long as it’s with you', next: 'deep-future-you' },
      { text: 'Ask me again tomorrow', next: 'deep-future-tomorrow' },
    ],
  },
  'deep-future-cat': { lines: [
    { speaker: 'her', text: 'Somewhere cozy. Warm lights. A cat that looks exactly like my shirt.', mood: 'happy', asHim: 'Somewhere cozy. Warm lights. A big, lazy cat that sleeps on my hoodie.' },
    { speaker: 'him', text: 'Deal. I’ll start saving for cat food today.', mood: 'happy' },
  ], effects: R(4, 30, 'deep-talks') },
  'deep-future-you': { lines: [
    { speaker: 'her', text: 'Anywhere. As long as it’s with you.', mood: 'cute' },
    { speaker: 'him', text: '…You can’t just say things like that out loud.', mood: 'shy' },
    { speaker: 'her', text: 'I just did.', mood: 'laughing' },
  ], effects: R(5, 35, 'deep-talks') },
  'deep-future-tomorrow': { lines: [
    { speaker: 'her', text: 'Ask me again tomorrow. And the day after.', mood: 'cute' },
    { speaker: 'him', text: 'I will. Every day. That’s kind of the plan.', mood: 'love' },
  ], effects: R(4, 30, 'deep-talks') },
  'deep-sorry': { lines: [
    { speaker: 'her', text: 'I’m still a little upset, you know.', mood: 'irritated' },
    { speaker: 'him', text: 'I know. And you’re allowed to be.', mood: 'neutral' },
    { speaker: 'him', text: 'I’m sorry — not just to make it end, but because I mean it.', mood: 'sad' },
    { speaker: 'her', text: '…You mean it?', mood: 'pouty' },
    { speaker: 'him', text: 'I do. Tell me what I can do better.', mood: 'love' },
    { speaker: 'her', text: 'Just… listen like this. Like right now.', mood: 'natural' },
    { speaker: 'him', text: 'Like right now. I promise.', mood: 'love' },
    { speaker: 'her', text: 'Okay. Come here.', mood: 'cute' },
  ], effects: R(5, 40, 'deep-talks') },
  'deep-miss': { lines: [
    { speaker: 'her', text: 'Sometimes I miss you even when you’re right next to me. Is that weird?', mood: 'sad' },
    { speaker: 'him', text: 'Not weird. Then I’ll hold your hand until the missing goes away.', mood: 'love' },
    { speaker: 'narrator', text: 'He does. It goes away.' },
    { speaker: 'her', text: 'Better.', mood: 'cute' },
  ], effects: R(5, 35, 'deep-talks') },
  'deep-proud': { lines: [
    { speaker: 'him', text: 'I don’t say this enough: I’m really proud of you.', mood: 'love' },
    { speaker: 'her', text: 'For what?', mood: 'natural' },
    { speaker: 'him', text: 'For getting up every day and trying. Even on the hard days. Especially on the hard days.', mood: 'love' },
    { speaker: 'her', text: '…You’re going to make me cry again.', mood: 'crying' },
    { speaker: 'him', text: 'Then I’ll stay until you’re laughing again.', mood: 'happy' },
    { speaker: 'her', text: 'Dummy.', mood: 'laughing' },
  ], effects: R(5, 40, 'deep-talks') },
  'deep-tired-of-me': { lines: [
    { speaker: 'her', text: 'Do you ever get tired of me?', mood: 'sad' },
    { speaker: 'him', text: 'Never. I get tired of traffic. Of waiting in line. Of losing my keys.', mood: 'neutral' },
    { speaker: 'him', text: 'Not of you. Not once.', mood: 'love' },
    { speaker: 'her', text: '…', mood: 'crying' },
    { speaker: 'her', text: 'Okay. I needed to hear that.', mood: 'cute' },
  ], effects: R(5, 40, 'deep-talks') },
  'deep-stars': { lines: [
    { speaker: 'him', text: 'When it’s quiet like this, I just think about how lucky I am.', mood: 'love' },
    { speaker: 'her', text: 'Lucky how?', mood: 'natural' },
    { speaker: 'him', text: 'Out of everyone in the whole world, I get to be the one sitting next to you.', mood: 'shy' },
    { speaker: 'her', text: 'Same. Exactly the same.', mood: 'cute' },
  ], effects: R(5, 35, 'deep-talks') },
};

/** Pools picked from by the talk menu. Conditions are optional. */
export const JOKES: { id: string; if?: Condition }[] = [
  { id: 'joke-parking' }, { id: 'joke-mouse' }, { id: 'joke-glasses' }, { id: 'joke-impasta' },
  { id: 'joke-purr' }, { id: 'joke-cute' }, { id: 'joke-skeleton' }, { id: 'joke-reaction' },
  { id: 'joke-menu' }, { id: 'joke-wifi' }, { id: 'joke-bear' }, { id: 'joke-time' },
];

export const TEASES: { id: string; if?: Condition }[] = [
  { id: 'tease-fog' }, { id: 'tease-more' }, { id: 'tease-stare' }, { id: 'tease-cookie' },
  { id: 'tease-rate' }, { id: 'tease-silent' }, { id: 'tease-photo' },
  { id: 'tease-sleepy', if: { time: ['morning', 'night'] } },
];

export const DEEP_TALKS: { id: string; if?: Condition }[] = [
  { id: 'deep-scared' }, { id: 'deep-thanks' }, { id: 'deep-failing' }, { id: 'deep-future' },
  { id: 'deep-sorry' }, { id: 'deep-miss' }, { id: 'deep-proud' }, { id: 'deep-tired-of-me' },
  { id: 'deep-stars', if: { time: ['sunset', 'night'] } },
];

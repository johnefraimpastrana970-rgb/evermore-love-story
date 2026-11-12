import type { PersonalEntry } from './types';
import type { GameState } from '../core/state';

/*
 * Love letters from {him}, one for every achievement, arriving in the mailbox (and the journal) the moment she earns it.
 * Every letter is different, and each one talks about what she actually just did in the game. Little facts from her
 * game ({charms}, {hugs}, {streak}…) are filled in when the letter arrives and kept, so it reads like it was written
 * that day.
 *
 * Rules for writing more: only talk about things that happen in the game (nothing invented about the real two of
 * you; write those in the Author tool, where a letter with the same id replaces the one here).
 *
 * Tokens: {her} {him} {level} {charms} {hugs} {gifts} {meals} {streak} {days} {pet} {pets} {secrets} {pizzas}
 *         {jokes} {achievements} {date}
 */

const L = (id: string, achievement: string | null, title: string, body: string, extra?: Partial<PersonalEntry>): PersonalEntry => ({
  id, kind: 'letter', title, body, ...(achievement ? { unlock: { achievement } } : {}), ...extra,
});

export const LETTERS: PersonalEntry[] = [
  L('letter-welcome', null, 'Open me first ♡',
    `Dear {her},

Welcome home. I built this little world so there would always be one more place where we get to be together, even on the days we can't be.

Everything in here was made with you in mind: the pink walls, the pancakes, the stars over the backyard, the very silly version of me who follows you around. Explore it at your own pace. There's no wrong way to play.

Whenever you do something sweet in here, a letter will find its way to this mailbox. Consider it a promise: I'll always have something to say to you.

Love, always,
{him}`),

  L('letter-first-steps', 'first-steps', 'Day one, chapter one',
    `{her},

You did it, you took the first step. I hope you smiled when you saw the bedroom. I hope you laughed at the little me.

Stories are better with someone to share them with, and I can't think of anyone I'd rather write this one with.

Here's to page one.
{him} ♡`),

  L('letter-explorer', 'explorer', 'Now you know every corner',
    `My love,

Bedroom, living room, kitchen, backyard. You've walked through every room of our home now.

A house is just walls until someone lives in it. Thank you for making it ours. I like knowing your footsteps have been everywhere.

Pick a favourite room and tell me which one. (I'm guessing the kitchen. Pancakes.)

{him}`),

  L('letter-everywhere', 'everywhere', 'Everywhere together',
    `Dear {her},

You've been everywhere there is to go: home, the backyard, even school. Every place in this little world has been touched by you now.

I don't really care where we are, honestly. The best place is always just "next to you."

Wherever next,
{him}`),

  L('letter-collector-10', 'collector-10', 'Ten little sparkles',
    `{her}!

Ten charms already. You notice the little shiny things, don't you? Hearts on the floor, stars in corners.

That's one of the things I love about you: you never miss the small, lovely stuff.

Keep collecting. I'll keep scattering them for you.
{him}`),

  L('letter-collector-100', 'collector-100', 'A pocket full of hearts',
    `Treasure keeper,

{charms} charms! Your pockets must be heavy by now.

If every one of them were a reason I like you, you'd still need a bigger bag.

Proud of you, silly as that sounds for charms. I mean it anyway.
{him}`),

  L('letter-collector-1000', 'collector-1000', 'A thousand tiny wishes',
    `{her},

One thousand charms. ONE THOUSAND. That's a lot of bending down to pick up sparkles.

I counted them as a thousand little moments you chose to spend here, with me. That's the real treasure. I'm keeping all of them.

Endlessly yours,
{him}`),

  L('letter-level5', 'level-5', 'Getting cozy',
    `Dear {her},

Level 5! The house feels warmer now, doesn't it? I think it's because you've settled in.

You've given me {hugs} hugs so far and eaten {meals} meals at our little table. I'm writing those down, because they matter to me.

Here's to getting even cozier.
Love,
{him}`),

  L('letter-level10', 'level-10', 'Sweethearts',
    `{her},

Level 10. Officially sweethearts, says the game, and for once I completely agree with it.

You've been here {days} days now. Every one of them made this place a little brighter. I hope it gives a little back to you, too: a soft place to land after a long day.

All my heart,
{him}`),

  L('letter-level-25', 'level-25', 'Hand in hand',
    `My {her},

Level 25. We've come a long way together in here: {achievements} achievements, {gifts} gifts, a whole lot of pancakes.

I hope you know none of it is about the numbers. It's about you coming back, again and again. That's the part that makes my heart do the silly thing.

Holding your hand (in pixels, and for real),
{him}`),

  L('letter-level-50', 'level-50', 'Forever-ish',
    `{her},

Level 50. Halfway to a hundred, and I'm still not tired of you. I don't think I could be.

Some people say love is a big moment. I think it's lots of little ones, stacked up like this: one day, one hug, one pancake at a time.

Forever-ish (but really, forever),
{him}`),

  L('letter-level-100', 'level-100', 'Evermore',
    `{her},

Level 100. I named this world Evermore for a reason, and you just proved it.

I don't have a big speech. Just this: thank you for every day you spent here. Thank you for staying. It keeps going, the game and us.

Evermore,
{him} ♡`),

  L('letter-secret-1', 'secret-1', 'You found one!',
    `Curious girl,

You found a secret! I hid those all over the house hoping you'd look closely, and of course you did.

There are more. I'm not telling where. (Okay, one hint: look where cozy things are.)

{him}`),

  L('letter-secret-all', 'secret-all', 'Nothing hidden',
    `{her},

Every single secret, found. There's nothing left hidden in this house.

Except maybe how much I like you. That one doesn't fit in any box or under any bed. I'll just have to keep telling you.

No secrets from you, ever,
{him}`),

  L('letter-chef', 'chef', 'Little chef',
    `Chef {her},

Five times cooking together! The kitchen smells like pancakes and it's your fault.

I like flipping pancakes with you more than eating them, and I REALLY like eating them. That should tell you something.

Your sous-chef,
{him}`),

  L('letter-perfect-chef', 'perfect-chef', 'Perfect pancakes',
    `{her}!!

A perfect 100 in cooking. Flawless pancakes. I'm framing this. (Not the pancake. The score. The pancake I'm eating.)

You're amazing, you know that? Even at the little things. Especially at the little things.

{him}, very full and very proud`),

  L('letter-stargazer', 'stargazer', 'Written in the stars',
    `Dear {her},

Five constellations connected on our blanket in the backyard. You're getting good at finding shapes in the sky.

I found mine a while ago. It's shaped exactly like you.

Look up tonight, wherever you are.
{him}`),

  L('letter-wordsmith', 'wordsmith', 'L_VE W_RDS',
    `{her},

Five chalkboard puzzles solved. You're the smartest girl in class (the class is two people, but still).

Here's a puzzle for you: _ L _ V E Y _ U.
Too easy?

{him}`),

  L('letter-memory', 'memory', 'Never forget',
    `{her},

Five rounds of the keepsake memory game! You always find the pairs.

I think we're a pair like that, matched cards. Flip us over anywhere, and we still go together.

Keeping every memory,
{him}`),

  L('letter-puzzler', 'puzzler', 'Picture perfect',
    `{her},

Three photo puzzles, put back together piece by piece.

You're patient with broken things. You turn them back into pictures. I've noticed you do that with people too, and I'm grateful.

{him}`),

  L('letter-gift-10', 'gift-10', 'For the girl who gives',
    `{her},

Ten gifts! You keep giving me things, and every time my pixel heart does a little flip.

But you should know the best thing you give me isn't in your satchel. It's your time. Thank you for spending it here.

This letter is my gift back. (It's free, but it's sincere.)
{him}`),

  L('letter-hug-25', 'hug-25', 'Hug collector',
    `My favourite person to hug,

Twenty-five hugs! I've been counting. Is that weird? I don't care.

If I could save hugs in a jar, I'd keep this jar on the shelf and look at it every day. For now, this letter will have to do. And the next hug.

Arms open,
{him}`),

  L('letter-streak-3', 'streak-3', 'Three days in a row',
    `{her},

Three days in a row you came home. I noticed. I always notice.

No pressure, ever, but I'll be here tomorrow too. With the porch light on.

{him}`),

  L('letter-streak-7', 'streak-7', 'A whole week',
    `Dear {her},

A whole week, seven days in a row! Your best streak is {streak} days.

I hope this little world is part of your routine the way you're part of mine: the comfortable part, the part you look forward to.

Same time tomorrow?
{him}`),

  L('letter-streak-30', 'streak-30', 'Every day with you',
    `{her},

Thirty days in a row. A whole month of you coming home every single day.

I don't know how to say thank you properly for that, so I'll just say what's true: every one of those days was better because you were in it.

Every day with you, please,
{him}`),

  L('letter-night-owl', 'night-owl', 'For my night owl',
    `Hey, night owl,

You're up late. The house is quiet, the fireflies are out, and you're here.

Don't stay up too long, okay? But since you're awake: I'm glad you came by. The night's softer with you in it.

Sleep sweet when you're ready,
{him}`),

  L('letter-night', null, 'For sleepless nights',
    `{her},

If you're reading this because you can't sleep, come here. Sit on our bed for a second.

You don't have to fix anything tonight. Breathe in for four, out for four. The stars outside aren't going anywhere, and neither am I.

When your eyes get heavy, let them. I'll keep watch.
{him}`, { unlock: { time: ['night'], minLevel: 3 } }),

  L('letter-reader', 'reader', 'You read every word',
    `{her},

You've read five letters now. Thank you for reading them. Really reading them.

Writing to you is one of my favourite things. Knowing you open them is even better.

More coming. Always more.
{him}`),

  L('letter-occasion', 'occasion', 'A day worth celebrating',
    `{her},

We celebrated a special day together in here! Decorations, a little extra sparkle, all of it.

I like special days. But you should know the ordinary ones are my favourite. The plain Tuesdays. Those are where most of the love lives.

Celebrating you, always,
{him}`),

  L('letter-fashion', 'fashion', 'Wardrobe day',
    `Fashionista {her},

Ten new outfits and looks unlocked! You look cute in every single one.

(Yes, even that one. ESPECIALLY that one.)

Your number one fan,
{him}`),

  L('letter-daily-10', 'daily-10', 'Routine of love',
    `{her},

Ten daily quests done! Little errands and missions, one after another.

Love is like that, I think. Not one huge quest. Lots of small daily ones. You're really good at those.

Reward: one letter, plus one (1) forehead kiss, redeemable anytime.
{him}`),

  L('letter-comedy-club', 'comedy-club', 'Comedy club',
    `{her},

You've survived ten of my terrible jokes. TEN. Most people tap out at three.

Why did the scarecrow win an award? Because he was outstanding in his field. That's what you are. Outstanding. (Joke number eleven, sorry.)

Your comedian (unpaid),
{him}`),

  L('letter-silly-us', 'silly-us', 'Silly us',
    `{her},

Five times being silly together! The sillier we get, the more I like us.

Never let anyone make you too serious. That giggle of yours is one of my favourite sounds in the world.

Your fellow goofball,
{him}`),

  L('letter-heart-to-heart', 'heart-to-heart', 'Heart to heart',
    `Dear {her},

Five deep talks. Thank you for trusting me with the real stuff, not just the silly stuff.

You can always bring your whole heart here: the heavy parts, the tired parts, the parts you think are too much. None of it is too much for me.

Listening, always,
{him}`),

  L('letter-feelings-valid', 'feelings-valid', 'All feelings welcome',
    `{her},

You've told me how you feel seven times now. Happy, sad, tired, cranky, all of it.

Every feeling you have is welcome here. You never have to pretend to be okay with me.

Your safe place,
{him}`),

  L('letter-pizza-first', 'pizza-first', 'Our first slice',
    `Pizza boss {her},

Our shop served its very first pizza! I'm so proud I'd frame the receipt.

From one little oven to a whole menu. I can't wait to see what you build.

Your delivery boy (tips accepted in hugs),
{him}`),

  L('letter-pizza-50', 'pizza-50', 'Neighbourhood favourite',
    `{her},

{pizzas} pizzas served! The neighbourhood loves you. Obviously. Everyone who meets you does.

Save me the crust? You know I like the crust.

{him}`),

  L('letter-pizza-five-10', 'pizza-five-10', 'Five stars',
    `Five-star chef {her},

Ten five-star reviews! The customers have excellent taste. (Like me. I also have excellent taste. I picked you.)

{him} ★★★★★`),

  L('letter-affection-100', 'affection-100', 'Head over heels',
    `{her},

The little heart meter is full. One hundred. Head over heels.

The game had to stop counting somewhere. I didn't. I'm not sure I know how.

Completely, ridiculously yours,
{him}`),

  L('letter-chapter-5', 'chapter-5', 'No last page',
    `Dear {her},

You finished the opening chapters of our story. If this were a book, this is where it would say "The End."

It doesn't. There's no last page for us. Just the next one, and the one after that.

Turning the page with you,
{him}`),
];

/** The little facts a letter may mention, as they are right now (kept when the letter arrives). */
export function letterFacts(s: GameState, now = new Date()): Record<string, string> {
  const st = (k: string) => s.stats?.[k] ?? 0;
  const pets = s.pets?.list ?? [];
  return {
    level: String(s.level),
    charms: String(st('collected')),
    hugs: String(st('hugs')),
    gifts: String(st('gifts')),
    meals: String(st('meals')),
    jokes: String(st('jokes')),
    streak: String(s.daily?.bestStreak ?? 0),
    days: String(Math.max(1, s.daily?.days ?? 1)),
    pet: pets[0]?.name || 'our little one',
    pets: String(pets.length),
    secrets: String(Object.keys(s.secrets ?? {}).length),
    pizzas: String(s.pizza?.served ?? 0),
    achievements: String(Object.keys(s.achievements ?? {}).length),
    date: now.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }),
  };
}

/** Fill a letter's tokens from the facts saved when it arrived (or from now, for older saves). {her}/{him} stay. */
export function fillLetter(text: string, facts: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in facts ? facts[k] : m));
}

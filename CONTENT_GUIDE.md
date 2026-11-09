# Adding your own content

Everything personal is a **template** right now. Any text shown in the game with a yellow striped chip like
⟦this⟧ is a placeholder waiting for your words. Nothing personal was invented.

## 0. The easy way: Author mode (no code)

Run `npm run author` on your computer. A page opens where you can write letters, messages, memories, jokes, dates,
challenges and surprises, add photos, switch on special days (anniversary, birthdays, monthsary) with your own
message, pre-fill both names, and add chalkboard words. It saves by itself to `src/content/authored.json`, with
photos in `public/assets/photos/authored/` (resized to max 1600 px). The last 30 versions are kept in `.author-backups/`.
**Backup → Download backup** gives you one file with everything, and **Import** brings it back.

- Author mode only runs on your computer while that command runs. It is never part of her app.
- Turn on **Names & words → Hide every template I haven’t written yet** before you build her APK, so she never sees ⟦…⟧.
- Then build as usual: `npm run android:sync`, then build the APK in Android Studio.
- Anything inside the app can be extracted by someone technical, so keep truly private things out of it.

The sections below describe editing the files by hand, which still works. Author mode content is layered on top.

After editing, run `npm run dev` and the game reloads instantly. Run `npm test` to check every reference is still valid.

Tokens you can use anywhere in text: `{her}` and `{him}` become the names she typed.

---

## 1. Letters, memories, photos & more — `src/content/personal.ts`

Each entry looks like this:

```ts
{ id: 'letter-level5', kind: 'letter', title: 'For when you reach level 5',
  unlock: { minLevel: 5 },
  body: 'Dear {her},\n\nYour words here…\n\n— {him}' },
```

- Replace the `⟦…⟧` text and **delete `placeholder: true`**. Placeholders still show, but with a “template” ribbon.
- `kind`: `letter` (backyard mailbox), `message` (one shown each day on the welcome card), `memory` (bedroom board),
  `photo`, `joke` (kitchen fridge), `date` (living-room calendar / picnic table), `challenge` (school board — she
  can tick it off for XP), `surprise` (found through secrets or special days).
- `unlock` decides when it appears. Combine any of these:
  `minLevel: 10`, `secret: 'secret-under-bed'`, `occasion: 'valentines'`, `time: ['night']`,
  `location: 'school'`, `questDone: 'ch3-stars'`, `minAffection: 50`, `flag: 'something'`.
  No `unlock` = available from the start.
- Copy a block to add as many as you like. Each `id` must be unique.

### Photos
Put image files in `public/assets/photos/` and set `image: 'assets/photos/first-date.jpg'`.
Photos marked as non-placeholder are also used in the Memory mini-game and Photo Puzzle.

> **Privacy:** photos bundled with the game can be extracted from the APK. Do not include photos you need to keep private.

### Inside-joke words for the chalkboard puzzle
Add uppercase words to `CUSTOM_WORDS` at the bottom of `personal.ts`.

## 2. Special days — `src/content/occasions.ts`

Personal days are disabled templates. To turn on your anniversary:

```ts
{ id: 'anniversary', name: 'Our Anniversary', enabled: true, priority: 100,
  rule: { type: 'yearly', month: 6, day: 14 },   // ← your real date
  ... }
```

Rule types: `yearly` (month/day, optional `durationDays`, `leadDays`), `monthly` (day — great for monthsaries),
`fixed` (`'2027-06-01'`), `range` (`'12-20'` to `'01-01'`), `nthWeekday` (e.g. 2nd Sunday of May), `manual` (no automatic calendar date).

While active, an occasion changes decorations (`hearts`, `lights`, `snow`, `balloons`, `pumpkins`, `confetti`,
`petals`), screen tint, music, shows a banner, plays a greeting once that day (edit `OCCASION_DIALOGUE`),
starts a special quest, gives bonus XP and unlocks its `surpriseId`.

Special days activate from the device’s real local date. Their room color, decoration, and music variation is chosen
deterministically for that date, so it remains the same while moving between rooms or restarting the game.

## 3. Conversations — `src/content/dialogue.ts`

```ts
'my-scene': {
  lines: [
    { speaker: 'him', text: 'Hey {her}…', mood: 'shy' },
    { speaker: 'her', text: 'Yes?', mood: 'happy' },
  ],
  choices: [
    { text: 'Hug him', next: 'my-scene-hug', effects: [{ type: 'affection', amount: 3 }] },
    { text: 'Tease him', next: 'my-scene-tease' },
  ],
},
```

Moods: `neutral`, `happy`, `shy`, `surprised`, `love`, `sleepy`. Effects: `xp`, `tokens`, `item`, `flag`,
`affection`, `startQuest`, `unlock` (a personal entry). His random small talk lives in `HIM_CHATS`, and his greetings
in `HIM_GREETINGS`. Each takes an optional `if` condition (time, location, level, occasion…).

## 4. Objects in rooms — `src/content/locations.ts`

Each hotspot is a clickable rectangle in a room. The `action` can be `inspect` (text, with variants per time of day),
`dialogue`, `door`, `minigame`, `secret`, `panel` (opens a journal tab, wardrobe, etc.) or `sleep`.

## 5. Quests — `src/content/quests.ts`

Add story chapters to `STORY_QUESTS` and link them with `next`. Objectives: `visit`, `interact` (hotspot id),
`collect`, `minigame` (with optional `minScore`), `talk`, `gift`, `flag`. Daily and weekly quests are generated
automatically, forever.

## 6. Replacing art & music

- **Room art:** in `locations.ts` add
  `backgroundImage: { day: 'assets/rooms/bedroom-day.png', night: 'assets/rooms/bedroom-night.png' }`.
  The image should be the room's full width (e.g. 1600×720 for the bedroom) with the floor line at y≈500. Times you
  leave out keep the painted version. Hotspot rectangles may need nudging to match your art.
- **Music:** put files in `public/assets/audio/music/` and map moods in `src/content/config.ts → MUSIC_FILES`
  (`title`, `cozy`, `kitchen`, `school`, `outdoor`, `night`, `festive`).
- **Characters:** colours come from the wardrobe (`cosmetics.ts`). The procedural sprite lives in
  `src/art/characters.ts` if you want to change the hairstyle or outfit shapes.

## 7. Character art & expressions — `src/content/characters.ts`

Her illustrated portraits live in `public/assets/characters/her/` (made from `gf assets/`). Each dialogue
`mood` maps to a picture: `natural`, `idle`, `happy`, `cute`, `laughing`, `pouty`, `irritated`, `sad`, `crying`
(plus older moods like `shy`/`love` that reuse the closest one). Use them in any line:
`{ speaker: 'her', text: 'Hmph.', mood: 'pouty' }`.

**Adding new drawings:** put the raw image in `gf assets/` and run `npm run art:her`. It removes the lavender
background, the label pill, the doodles and the white sticker border, then saves a transparent portrait and avatar.
Add `--debug` (`node tools/process-art.mjs . --debug`) to get previews on a dark background in `tools/shots/` so you
can check the edges. It works best on art with the same flat pastel background. Or drop a ready-made WebP/PNG into `public/assets/characters/her/` and map
a mood to it in `HER_PORTRAITS`.

**His art:** made the same way from `bf assets/` (`npm run art:him`), mapped in `HIS_PORTRAITS`. File names may end
in `bf` (e.g. `cryingbf.jpg` → mood `crying`). His profile uses stricter background rules so his pale grey hoodie
sleeves aren't mistaken for background.

## 8. Playful & emotional talks — `src/content/talks.ts`

Talk to him → **Talk** gives: *Just chat*, *Tell me a joke* (`JOKES`), *Let’s be silly* (`TEASES`),
*How I’m feeling…* (a check-in that branches into happy / tired / sad / annoyed / cuddles) and *Something
deeper* (`DEEP_TALKS`). Each pool picks a talk she hasn’t seen yet first. Add your own inside jokes by copying a
node and adding its id to a pool.

## 8b. Pizza shop — `src/pizza/data.ts`

Unlocks at level 10 (`UNLOCK_LEVEL` in `src/pizza/logic.ts`; Map → Pizza Shop / Market). Relaxed: customers never
leave, a long wait only trims the tip. Waiting customers and a half-made pizza are saved with the game. At shop level 3
she can create her own **pizza of the day** (sauce, up to 3 toppings, name, price). Shop coins also buy **decor**
(`DECOR` in `data.ts`: wallpaper, lights, tables, sign, plants and matching aprons). Everything is plain data:
- `INGREDIENTS`: 14 ingredients, each in 3 tiers (Basic → Good → Premium) with names, colours and prices.
  Better tiers unlock at shop levels 2 and 4 (`TIER_UNLOCK`).
- `RECIPES`: the 6 pizzas (1 = cheapest … 6 = the Truffle Mushroom Royale), with toppings, price and the shop level that adds them.
- `CUSTOMERS`: 10 made-up customers with patience, favourite pizzas, tipping and their lines. **Customer art:** drop a
  square image at `public/assets/customers/<id>.webp` (e.g. `mika.webp`) and it replaces the placeholder face automatically.
- `PARTNER_LINES`: what the partner says while helping in the shop.

## 8c. Couple moments — `src/scenes/couple.ts`

The swing (she sits, the partner pushes; "Higher!" or "Gently" changes how hard), sitting together (`SEATS`: sofa,
bed edge, stargazing blanket), the partner joining any other activity, idle moments after 10 seconds of standing
still, and small random actions. Add a seat for another object by copying an entry in `SEATS` (hip positions for both,
a scale, and optionally `crop` for sitting on the ground or a `front` drawing for furniture that hides the legs).

## 9. Names & who you play as
Both names are typed when starting a new story (change them later in Settings → Gameplay). To pre-fill them,
set `DEFAULT_NAMES` in `src/content/config.ts`.

New Story also asks **who you're playing as**: Girlfriend or Boyfriend. Everything is still written once, from her
side: in story text `speaker: 'her'` and `{her}` mean *the player*, and `'him'` / `{him}` mean *the partner*. When the
story is played as him the roles flip automatically. His sprite becomes the one you walk with, she follows you, and
names, faces and he/she/his/her words swap (`src/core/roles.ts`).

- If a line only makes sense for her (e.g. her cat shirt), add `asHim: '…'` with the exact text to show instead.
- Personal entries (letters, messages, memories…) are **never** swapped: `{her}` there is always her, `{him}` always him.
- Occasions about one real person (birthdays) have `literal: true`, so the banner and greeting keep the real names.

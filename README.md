# Evermore

An endless, personalised 2D love-story adventure. She explores a cozy home and school with her boyfriend,
collects charms, finds secrets, plays mini-games, levels up forever, and unlocks letters, memories and
surprises over time. There is no final level and no ending.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (also reachable from your phone on the same Wi-Fi)
npm test           # logic tests (progression, quests, occasions, saves, content links)
npm run build      # production build into dist/
```

## Controls
| Action | Keyboard | Mouse | Touch |
|---|---|---|---|
| Walk | WASD / arrows | click the floor | joystick (bottom-left) |
| Interact | E / Space / Enter | click an object | ♥ button, or tap the object |
| Menus | C (her story) · I (satchel) · Q (quests) · J (journal) · M (map) · Esc (settings) | top-right buttons | top-right buttons |

## What's inside
- **5 locations:** bedroom, living room, kitchen, backyard, school. Each changes with morning / day / sunset / night (real clock, or nap in the bed to change it), weather (backyard rain), lights, particles and music.
- **Characters:** she is the player; he follows her (or waits in rooms, or stays hidden — Settings → Gameplay). Talk, hug, give gifts.
- **Progression:** endless levels (gentle XP curve), titles, heart tokens, a cosmetics wardrobe, affection hearts, daily streaks.
- **Quests:** a 5-chapter opening story, then 3 new daily quests every day, a weekly quest, and special-day quests.
- **Mini-games:** Keepsake Memory (bedroom), Cooking Together (kitchen / grill), Stargazing (backyard at night), Chalkboard Words (school), Photo Puzzle (living room).
- **Secrets:** 6 hidden spots that sparkle when she walks close.
- **Journal:** letters, daily messages, memories, photos, inside jokes, dates, real-life challenges, surprises, achievements (31) and secrets.
- **Special days:** Valentine's, Christmas, New Year, Halloween, "Just Because", plus templates for your anniversary, birthdays and monthsary.
- **Saves:** autosave + 3 slots, backup export/import, optional cloud sync.
- **Audio:** generative music per mood plus ambience and sound effects. Real tracks can replace any of it.

## Where things live
```
src/content/      ← all editable content (see CONTENT_GUIDE.md)
  personal.ts       letters, memories, photos, jokes, dates, challenges, surprises  ← YOUR WORDS
  occasions.ts      special days (set your real dates here)
  dialogue.ts       conversations      locations.ts  rooms & hotspots
  quests.ts         story + generators items.ts / cosmetics.ts / achievements.ts / config.ts
src/systems/      game rules (quests, progression, occasions, conditions)
src/scenes/       Phaser scenes (World = reusable location template)
src/art/          procedural painting (rooms, anime-style characters, icons)
src/ui/           HTML overlay UI (HUD, dialogue, panels, mini-games, menus)
src/backend/      optional Supabase cloud sync
supabase/         database migration with RLS
android/          Capacitor Android project
```

## Android APK
1. Install **Android Studio** (it includes the Android SDK and the Java 21 runtime Capacitor 7 needs).
2. `npm run android:sync` (builds the web app and copies it into `android/`).
3. `npm run android:open`, then in Android Studio: **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
4. The APK lands in `android/app/build/outputs/apk/`. For a signed release use **Build → Generate Signed Bundle / APK**.

## Art & music
Everything is painted in code so the game works immediately. To use illustrated art, see “Replacing art” in
CONTENT_GUIDE.md — each room accepts per-time-of-day background images, and moods accept music files.

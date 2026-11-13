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

## Deploy to GitHub Pages

The GitHub Actions workflow in `.github/workflows/deploy-pages.yml` builds and deploys the game and Android APK on pushes to `main` or `master`. In the repository's **Settings → Pages**, set the source to **GitHub Actions**. You can also start a deployment from the **Actions** tab. After deployment, the APK is available at `<site-url>/downloads/evermore-android.apk` and from **About Evermore** in the game.

## Install Evermore

Evermore can be installed from its HTTPS site as a web app. On Android, open the site in a supported browser and choose **Install app** or **Add to Home screen**. On iPhone or iPad, open it in Safari, tap **Share**, then **Add to Home Screen**. The app uses the pink heart mark as its icon and caches the game shell for offline reopening after the first visit.

## Controls
| Action | Keyboard | Mouse | Touch |
|---|---|---|---|
| Walk | WASD / arrows | click the floor | joystick (bottom-left) |
| Interact | E / Space / Enter | click an object | ♥ button, or tap the object |
| Menus | C (her story) · I (satchel) · Q (quests) · J (journal) · M (map) · Esc (settings) | top-right buttons | top-right buttons |

## What's inside
- **7 locations:** bedroom, living room, kitchen, bathroom, comfort room, backyard, school. Each changes with morning / day / sunset / night (real clock, or nap in the bed to change it), weather (backyard rain), lights, particles and music.
- **Character needs:** hunger gently decreases during active play; eat at the kitchen table, or use the bottom-left shower and toilet shortcuts for animated bathroom activities.
- **Characters:** she is the player; he follows her (or waits in rooms, or stays hidden — Settings → Gameplay). Talk, hug, give gifts.
- **Progression:** endless levels (gentle XP curve), titles, heart tokens, a cosmetics wardrobe, affection hearts, daily streaks.
- **Quests:** a 5-chapter opening story, then 3 new daily quests every day, a weekly quest, and special-day quests.
- **Mini-games:** Keepsake Memory (bedroom), Cooking Together (kitchen / grill), Grill Flip and Colorful Skewer challenges (backyard grill), Stargazing (backyard at night), Chalkboard Words (school), Photo Puzzle (living room).
- **Secrets:** 6 hidden spots that sparkle when she walks close.
- **Journal:** letters, daily messages, memories, photos, inside jokes, dates, real-life challenges, surprises, achievements (31) and secrets. First home moments (a meal, bedroom makeover, and pet playdate) are saved to the phone's Home gallery.
- **Special days:** Valentine's, Christmas, New Year, Halloween, "Just Because", plus templates for your anniversary, birthdays and monthsary.
- **Saves:** autosave + 3 local slots, backup export/import. No account or internet connection is required to play.
- **Decorating:** collect room themes, patterned wallpapers, colorful floors, furniture palettes, and movable furniture for the bedroom, living room, and kitchen.
- **Messages:** scripted replies run locally; the game does not use online AI.
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
android/          Capacitor Android project
```

## Android APK
The Pages deployment publishes a debug-signed APK at `<site-url>/downloads/evermore-android.apk`. For local builds, install **Android Studio** (including its Android SDK and Java 21), run `npm run android:sync`, then `npm run android:open` and choose **Build → Build App Bundle(s) / APK(s) → Build APK(s)**. The local APK lands in `android/app/build/outputs/apk/`. For a Play Store release, generate a separately signed release APK or bundle in Android Studio.

## Art & music
Everything is painted in code so the game works immediately. To use illustrated art, see “Replacing art” in
CONTENT_GUIDE.md — each room accepts per-time-of-day background images, and moods accept music files.

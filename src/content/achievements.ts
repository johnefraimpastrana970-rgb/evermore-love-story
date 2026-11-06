import type { AchievementDef } from './types';
import { LOCATION_ORDER } from './locations';
import { HER_DEFAULT_OWNED, HIS_DEFAULT_OWNED } from '../core/state';

/** Looks every new story starts with; they don't count towards wardrobe achievements. */
const STARTER_LOOKS = new Set([...HER_DEFAULT_OWNED, ...HIS_DEFAULT_OWNED]);

const stat = (s: { stats: Record<string, number> }, k: string) => s.stats[k] ?? 0;
const SECRET_COUNT = 6;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-steps', name: 'First Steps', description: 'Begin your story in Evermore.', icon: 'heart', check: (s) => !!s.flags['intro-done'] },
  { id: 'explorer', name: 'Home Explorer', description: 'Visit every room of the house.', icon: 'map',
    check: (s) => ['bedroom', 'livingroom', 'kitchen', 'backyard'].every((l) => (s.visited as any)[l]) },
  { id: 'everywhere', name: 'Everywhere Together', description: 'Visit every location, including school.', icon: 'map',
    check: (s) => LOCATION_ORDER.every((l) => s.visited[l]) },
  { id: 'collector-10', name: 'Pocketful', description: 'Collect 10 charms.', icon: 'sparkle', check: (s) => stat(s, 'collected') >= 10 },
  { id: 'collector-100', name: 'Treasure Keeper', description: 'Collect 100 charms.', icon: 'sparkle', check: (s) => stat(s, 'collected') >= 100 },
  { id: 'collector-1000', name: 'Endless Sparkle', description: 'Collect 1,000 charms.', icon: 'star', check: (s) => stat(s, 'collected') >= 1000 },
  { id: 'level-5', name: 'Getting Cozy', description: 'Reach level 5.', icon: 'heart', check: (s) => s.level >= 5 },
  { id: 'level-10', name: 'Sweethearts', description: 'Reach level 10.', icon: 'heart', check: (s) => s.level >= 10 },
  { id: 'level-25', name: 'Hand in Hand', description: 'Reach level 25.', icon: 'heart', check: (s) => s.level >= 25 },
  { id: 'level-50', name: 'Forever-ish', description: 'Reach level 50.', icon: 'ring', check: (s) => s.level >= 50 },
  { id: 'level-100', name: 'Evermore', description: 'Reach level 100. (It keeps going.)', icon: 'ring', check: (s) => s.level >= 100 },
  { id: 'secret-1', name: 'Curious Heart', description: 'Find your first secret.', icon: 'key', check: (s) => Object.keys(s.secrets).length >= 1 },
  { id: 'secret-all', name: 'Nothing Hidden', description: 'Find every secret.', icon: 'key', check: (s) => Object.keys(s.secrets).length >= SECRET_COUNT },
  { id: 'chef', name: 'Little Chef', description: 'Cook together 5 times.', icon: 'pancake', check: (s) => stat(s, 'mg-cooking') >= 5 },
  { id: 'perfect-chef', name: 'Perfect Pancakes', description: 'Score 100 in cooking.', icon: 'pancake', check: (s) => (s.minigameBest['cooking'] ?? 0) >= 100 },
  { id: 'stargazer', name: 'Stargazer', description: 'Connect 5 constellations.', icon: 'star', check: (s) => stat(s, 'mg-stars') >= 5 },
  { id: 'wordsmith', name: 'Wordsmith', description: 'Solve 5 chalkboard puzzles.', icon: 'book', check: (s) => stat(s, 'mg-scramble') >= 5 },
  { id: 'memory', name: 'Never Forget', description: 'Finish the keepsake memory game 5 times.', icon: 'polaroid', check: (s) => stat(s, 'mg-memory') >= 5 },
  { id: 'puzzler', name: 'Picture Perfect', description: 'Solve the photo puzzle 3 times.', icon: 'polaroid', check: (s) => stat(s, 'mg-slider') >= 3 },
  { id: 'gift-10', name: 'Thoughtful', description: 'Give 10 gifts.', icon: 'bouquet', check: (s) => stat(s, 'gifts') >= 10 },
  { id: 'hug-25', name: 'Hug Collector', description: 'Share 25 hugs.', icon: 'heart', check: (s) => stat(s, 'hugs') >= 25 },
  { id: 'streak-3', name: 'Three Days Running', description: 'Play 3 days in a row.', icon: 'calendar', check: (s) => s.daily.bestStreak >= 3 },
  { id: 'streak-7', name: 'A Whole Week', description: 'Play 7 days in a row.', icon: 'calendar', check: (s) => s.daily.bestStreak >= 7 },
  { id: 'streak-30', name: 'Every Day With You', description: 'Play 30 days in a row.', icon: 'calendar', check: (s) => s.daily.bestStreak >= 30 },
  { id: 'night-owl', name: 'Night Owl', description: 'Explore at night.', icon: 'moon', check: (s) => stat(s, 'night-visits') >= 1 },
  { id: 'reader', name: 'Love Letters', description: 'Read 5 letters or memories.', icon: 'letter', check: (s) => Object.keys(s.read).length >= 5 },
  { id: 'occasion', name: 'Special Day', description: 'Celebrate an occasion.', icon: 'gift', check: (s) => Object.keys(s.occasionsSeen).length >= 1 },
  { id: 'fashion', name: 'Wardrobe Day', description: 'Unlock 10 new cosmetics.', icon: 'ribbon',
    check: (s) => s.cosmetics.owned.filter((id) => !STARTER_LOOKS.has(id)).length >= 10 },
  { id: 'daily-10', name: 'Routine of Love', description: 'Complete 10 daily quests.', icon: 'scroll', check: (s) => stat(s, 'dailies') >= 10 },
  { id: 'comedy-club', name: 'Comedy Club', description: 'Hear 10 of his terrible jokes.', icon: 'star', check: (s) => stat(s, 'jokes') >= 10 },
  { id: 'silly-us', name: 'Silly Us', description: 'Be silly together 5 times.', icon: 'cookie', check: (s) => stat(s, 'teases') >= 5 },
  { id: 'heart-to-heart', name: 'Heart to Heart', description: 'Have 5 deep talks.', icon: 'heart', check: (s) => stat(s, 'deep-talks') >= 5 },
  { id: 'feelings-valid', name: 'All Feelings Welcome', description: 'Tell him how you feel 7 times.', icon: 'letter', check: (s) => stat(s, 'checkins') + stat(s, 'deep-talks') >= 7 },
  { id: 'pizza-first', name: 'First Slice', description: 'Serve your first pizza in your shop.', icon: 'heart', check: (s) => (s.pizza?.served ?? 0) >= 1 },
  { id: 'pizza-50', name: 'Neighbourhood Favourite', description: 'Serve 50 pizzas.', icon: 'star', check: (s) => (s.pizza?.served ?? 0) >= 50 },
  { id: 'pizza-five-10', name: 'Five-Star Chef', description: 'Earn 10 five-star ratings.', icon: 'star', check: (s) => (s.pizza?.fiveStars ?? 0) >= 10 },
  { id: 'affection-100', name: 'Head Over Heels', description: 'Reach 100 affection.', icon: 'heart', hidden: true, check: (s) => s.affection >= 100 },
  { id: 'chapter-5', name: 'No Last Page', description: 'Finish the opening chapters.', icon: 'book', hidden: true, check: (s) => !!s.flags['chapter5-done'] },
];

export { SECRET_COUNT };

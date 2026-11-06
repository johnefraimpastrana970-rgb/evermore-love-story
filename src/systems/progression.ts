import type { GameState } from '../core/state';
import { COSMETICS } from '../content/cosmetics';

/** XP required to go from `level` to `level + 1`. Grows gently, never ends. */
export function xpToNext(level: number): number {
  const l = Math.max(1, level);
  const curve = 60 + 40 * Math.pow(l, 1.3);
  // Soften far-future growth so high levels stay reachable.
  const soft = l > 120 ? 40 * Math.pow(120, 1.3) + 400 * (l - 120) + 60 : curve;
  return Math.round(Math.min(curve, soft) / 5) * 5;
}

const TITLES = [
  'Sleepyhead', 'Daydreamer', 'Sweetheart', 'Cozy Companion', 'Heart Collector', 'Little Chef',
  'Stargazer', 'Secret Finder', 'Sunshine', 'Moonlit Muse', 'Darling', 'Keeper of Memories',
  'Queen of Hugs', 'Wishmaker', 'Forever Girl', 'Evermore',
];

export function titleFor(level: number): string {
  const idx = Math.floor((level - 1) / 3);
  if (idx < TITLES.length) return TITLES[idx];
  const tier = idx - TITLES.length + 2;
  return `Evermore ${'✦'.repeat(Math.min(5, tier))}${tier > 5 ? ' ' + tier : ''}`;
}

export interface LevelResult {
  levelsGained: number;
  rewards: string[];
}

/** Rewards given on reaching `level`. Pure apart from mutating `s`. */
export function grantLevelRewards(s: GameState, level: number): string[] {
  const out: string[] = [];
  const tokens = 10 + Math.floor(level / 2) * 2;
  s.tokens += tokens;
  out.push(`+${tokens} heart tokens`);
  for (const c of COSMETICS) {
    if (c.unlockLevel === level && !s.cosmetics.owned.includes(c.id)) {
      s.cosmetics.owned.push(c.id);
      out.push(`New look: ${c.name}`);
    }
  }
  if ((level - 1) % 3 === 0 && level > 1) out.push(`New title: ${titleFor(level)}`);
  if (level % 5 === 0) {
    s.inventory['ribbon'] = (s.inventory['ribbon'] ?? 0) + 1;
    out.push('Silk Ribbon');
  }
  return out;
}

/** Add XP and process any level-ups. */
export function addXp(s: GameState, amount: number): LevelResult {
  const res: LevelResult = { levelsGained: 0, rewards: [] };
  if (!(amount > 0)) return res;
  s.xp += Math.round(amount);
  s.totalXp += Math.round(amount);
  let guard = 0;
  while (s.xp >= xpToNext(s.level) && guard++ < 1000) {
    s.xp -= xpToNext(s.level);
    s.level += 1;
    res.levelsGained++;
    res.rewards.push(...grantLevelRewards(s, s.level));
  }
  return res;
}

export function affectionHearts(aff: number): number {
  // Every 20 affection is one more heart, endless.
  return Math.floor(aff / 20);
}

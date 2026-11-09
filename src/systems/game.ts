import type { CollectibleKind, Effect, LocationId, MinigameId, OccasionDef, PersonalEntry, CosmeticDef } from '../content/types';
import { store } from '../core/store';
import { bus } from '../core/events';
import { daysBetween, weekKey } from '../core/time';
import { addXp } from './progression';
import { checkCondition, CondCtx, dayFlag } from './conditions';
import { GameEvent, notifyQuests, refreshGenerated, startQuest, STORY_QUESTS, questDef } from './quests';
import { activeOccasions } from './occasions';
import { OCCASIONS } from '../content/occasions';
import { ACHIEVEMENTS } from '../content/achievements';
import { PERSONAL } from '../content/personal';
import { ITEMS, COLLECTIBLE_ITEM, COLLECTIBLE_XP } from '../content/items';
import { COSMETICS } from '../content/cosmetics';

const S = () => store.state;

export function ctx(): CondCtx {
  return {
    state: S(),
    time: store.timeOfDay(),
    occasions: currentOccasions().map((o) => o.id),
    location: S().location,
    day: store.today(),
  };
}

export function currentOccasions(date: Date = store.now()): OccasionDef[] {
  return activeOccasions(OCCASIONS, date);
}
export function topOccasion(date?: Date): OccasionDef | undefined {
  return currentOccasions(date)[0];
}

export function toast(text: string, icon = 'sparkle', kind: 'info' | 'good' | 'quest' | 'ach' = 'info') {
  bus.emit('toast', { text: store.fmt(text), icon, kind });
}

export function gainXp(amount: number, source = '') {
  const s = S();
  const res = addXp(s, amount);
  bus.emit('xp', { amount, source });
  if (res.levelsGained > 0) {
    bus.emit('levelup', { level: s.level, rewards: res.rewards });
    afterChange();
  }
}

export function giveItem(id: string, amount = 1) {
  const s = S();
  s.inventory[id] = (s.inventory[id] ?? 0) + amount;
  if (s.inventory[id] <= 0) delete s.inventory[id];
}

export function setFlag(id: string, value = true) {
  const s = S();
  const key = dayFlag(id, store.today());
  if (value) s.flags[key] = true;
  else delete s.flags[key];
  notify({ type: 'flag' });
}

export function bumpStat(id: string, amount = 1) {
  const s = S();
  s.stats[id] = (s.stats[id] ?? 0) + amount;
}

export function applyEffects(effects: Effect[] | undefined) {
  if (!effects) return;
  for (const e of effects) {
    switch (e.type) {
      case 'xp': gainXp(e.amount); break;
      case 'tokens': S().tokens += e.amount; toast(`+${e.amount} heart tokens`, 'coin'); break;
      case 'item': {
        giveItem(e.id, e.amount ?? 1);
        const it = ITEMS[e.id];
        if (it) toast(`Got ${it.name}${(e.amount ?? 1) > 1 ? ' ×' + e.amount : ''}`, it.icon, 'good');
        break;
      }
      case 'flag': setFlag(e.id, e.value ?? true); break;
      case 'affection': S().affection += e.amount; break;
      case 'startQuest': if (startQuest(S(), e.id)) { const q = questDef(S(), e.id); if (q) toast(`New quest: ${q.title}`, 'scroll', 'quest'); } break;
      case 'stat': bumpStat(e.id, e.amount ?? 1); break;
      case 'unlock': unlockEntry(e.id); break;
    }
  }
  afterChange();
}

/** Feed a gameplay event to quests, then re-check everything. */
export function notify(ev: GameEvent) {
  const s = S();
  const { progressed, completed } = notifyQuests(s, ev);
  for (const id of progressed) bus.emit('quest:progress', { id });
  for (const q of completed) {
    if (q.kind === 'daily') bumpStat('dailies');
    if (q.kind === 'weekly') bumpStat('weeklies');
    bus.emit('quest:complete', { id: q.id, title: q.title });
    toast(`Quest complete: ${q.title}`, 'scroll', 'quest');
    applyEffects(q.rewards);
    if (q.next) {
      const nq = questDef(s, q.next);
      if (nq) toast(`New quest: ${nq.title}`, 'scroll', 'quest');
    }
  }
  afterChange();
}

let checking = false;
/** Achievements, unlocks and auto-start quests. Safe to call often. */
export function afterChange() {
  if (checking || !store.hasGame) return;
  checking = true;
  try {
    const s = S();
    const c = ctx();
    for (const a of ACHIEVEMENTS) {
      if (!s.achievements[a.id] && a.check(s)) {
        s.achievements[a.id] = Date.now();
        bus.emit('achievement', { id: a.id });
        toast(`Achievement: ${a.name}`, a.icon, 'ach');
        s.tokens += 15;
      }
    }
    for (const q of STORY_QUESTS) {
      if (q.autoStart && !s.quests.active[q.id] && !s.quests.completed[q.id] && checkCondition(q.autoStart, c)) {
        if (startQuest(s, q.id)) toast(`New quest: ${q.title}`, 'scroll', 'quest');
      }
    }
    for (const e of PERSONAL) {
      if (!s.unlocked[e.id] && checkCondition(e.unlock, c)) unlockEntry(e.id, !!e.unlock);
    }
  } finally {
    checking = false;
  }
  bus.emit('state');
}

export function unlockEntry(id: string, announce = true) {
  const s = S();
  if (s.unlocked[id]) return;
  s.unlocked[id] = Date.now();
  const e = PERSONAL.find((p) => p.id === id);
  if (e && announce) {
    bus.emit('unlock', { id, title: e.title, kind: e.kind });
    toast(`New ${KIND_LABEL[e.kind].toLowerCase()} in your journal`, 'letter', 'good');
  }
}

export const KIND_LABEL: Record<PersonalEntry['kind'], string> = {
  letter: 'Letter', message: 'Message', memory: 'Memory', photo: 'Photo', joke: 'Inside Joke',
  date: 'Date', challenge: 'Challenge', surprise: 'Surprise',
};

export function isUnlocked(e: PersonalEntry) {
  return !!S().unlocked[e.id];
}

// ---------------------------------------------------------------- actions

export function visit(location: LocationId) {
  const s = S();
  s.location = location;
  s.visited[location] = (s.visited[location] ?? 0) + 1;
  if (store.timeOfDay() === 'night') bumpStat('night-visits');
  notify({ type: 'visit', location });
}

export function interact(hotspot: string) {
  bumpStat('interactions');
  notify({ type: 'interact', hotspot });
}

export function collect(kind: CollectibleKind, spotId: string) {
  const s = S();
  if (s.collected.ids.includes(spotId)) return;
  s.collected.ids.push(spotId);
  giveItem(COLLECTIBLE_ITEM[kind]);
  bumpStat('collected');
  bumpStat(`collected-${kind}`);
  const occ = topOccasion();
  const bonus = occ ? 1.5 : 1;
  gainXp(Math.round(COLLECTIBLE_XP[kind] * bonus), 'collect');
  if (kind === 'heart') s.tokens += 1;
  notify({ type: 'collect', kind, location: s.location });
}

export function findSecret(id: string): boolean {
  const s = S();
  if (s.secrets[id]) return false;
  s.secrets[id] = Date.now();
  const n = Object.keys(s.secrets).length;
  for (let i = 1; i <= n; i++) s.flags[`secret-count-${i}`] = true;
  giveItem('ribbon');
  gainXp(60, 'secret');
  s.tokens += 10;
  toast('Secret found! +60 XP', 'key', 'good');
  notify({ type: 'flag' });
  return true;
}

export function talk() {
  bumpStat('talks');
  S().affection += 1;
  gainXp(8, 'talk');
  notify({ type: 'talk' });
}

export function hugAvailable(): boolean {
  return S().hugKey !== `${store.today()}:${store.timeOfDay()}`;
}
export function hug(): boolean {
  if (!hugAvailable()) return false;
  S().hugKey = `${store.today()}:${store.timeOfDay()}`;
  return true;
}

export function giveGift(itemId: string): boolean {
  const s = S();
  const it = ITEMS[itemId];
  if (!it || !it.giftable || !(s.inventory[itemId] > 0)) return false;
  giveItem(itemId, -1);
  s.affection += it.affection ?? 1;
  bumpStat('gifts');
  gainXp(10 + (it.affection ?? 1) * 4, 'gift');
  notify({ type: 'gift' });
  return true;
}

export function minigameResult(id: MinigameId, score: number) {
  const s = S();
  const sc = Math.max(0, Math.min(100, Math.round(score)));
  bumpStat(`mg-${id}`);
  bumpStat('minigames');
  const best = s.minigameBest[id] ?? 0;
  const isBest = sc > best;
  if (isBest) s.minigameBest[id] = sc;
  const xp = 25 + Math.round(sc * 0.9);
  const tokens = 3 + Math.floor(sc / 10);
  gainXp(xp, 'minigame');
  s.tokens += tokens;
  if (id === 'cooking' && sc >= 50) giveItem('pancake');
  if (id === 'slider') giveItem('polaroid');
  notify({ type: 'minigame', id, score: sc });
  return { score: sc, xp, tokens, isBest };
}

export function markRead(id: string) {
  const s = S();
  if (!s.read[id]) {
    s.read[id] = Date.now();
    gainXp(15, 'read');
    afterChange();
  }
}

export function completeChallenge(e: PersonalEntry) {
  const s = S();
  if (s.challengesDone[e.id]) return;
  s.challengesDone[e.id] = Date.now();
  gainXp(e.rewardXp ?? 100, 'challenge');
  toast(`Challenge complete! +${e.rewardXp ?? 100} XP`, 'star', 'good');
  afterChange();
}

export function cosmeticAvailable(c: CosmeticDef): 'owned' | 'buy' | 'locked' {
  const s = S();
  if (s.cosmetics.owned.includes(c.id)) return 'owned';
  if (c.cost) return 'buy';
  return 'locked';
}
export function buyCosmetic(id: string): boolean {
  const s = S();
  const c = COSMETICS.find((x) => x.id === id);
  if (!c || !c.cost || s.cosmetics.owned.includes(id) || s.tokens < c.cost) return false;
  s.tokens -= c.cost;
  s.cosmetics.owned.push(id);
  afterChange();
  return true;
}
export function equipCosmetic(id: string) {
  const s = S();
  const c = COSMETICS.find((x) => x.id === id);
  if (!c || !s.cosmetics.owned.includes(id)) return;
  s.cosmetics.equipped[c.slot] = id;
  bus.emit('cosmetics');
  bus.emit('state');
}

/** Today's daily message (cycles through unlocked, non-placeholder messages). */
export function dailyMessage(): PersonalEntry | null {
  const msgs = PERSONAL.filter((p) => p.kind === 'message' && !p.placeholder && isUnlocked(p));
  if (!msgs.length) return null;
  return msgs[S().daily.days % msgs.length];
}

export interface SessionStart {
  newDay: boolean;
  streak: number;
  loginTokens: number;
  greetings: string[]; // occasion dialogue ids to play
}

/** Run when a game is loaded and whenever the day may have changed. */
export function startSession(): SessionStart {
  const s = S();
  const today = store.today();
  const out: SessionStart = { newDay: false, streak: s.daily.streak, loginTokens: 0, greetings: [] };
  if (s.daily.lastDay !== today) {
    const gap = s.daily.lastDay ? daysBetween(s.daily.lastDay, today) : Infinity;
    s.daily.streak = gap === 1 ? s.daily.streak + 1 : 1;
    s.daily.bestStreak = Math.max(s.daily.bestStreak, s.daily.streak);
    s.daily.days += 1;
    s.daily.lastDay = today;
    out.loginTokens = 5 + Math.min(10, s.daily.streak) * 2;
    s.tokens += out.loginTokens;
    out.newDay = true;
    out.streak = s.daily.streak;
  }
  refreshGenerated(s, today, weekKey(store.now()));
  for (const occ of currentOccasions()) {
    if (s.occasionsSeen[occ.id] !== today) {
      s.occasionsSeen[occ.id] = today;
      if (occ.greeting) out.greetings.push(occ.greeting);
      if (occ.bonusXp) gainXp(occ.bonusXp, 'occasion');
      if (occ.questId) {
        // Occasion quests can repeat each time the occasion comes around.
        delete s.quests.completed[occ.questId];
        startQuest(s, occ.questId);
      }
    }
  }
  afterChange();
  return out;
}

export function itemCount(id: string) {
  return S().inventory[id] ?? 0;
}

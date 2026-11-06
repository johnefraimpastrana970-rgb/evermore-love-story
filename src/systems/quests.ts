import type { CollectibleKind, LocationId, MinigameId, ObjectiveDef, QuestDef } from '../content/types';
import type { GameState } from '../core/state';
import { STORY_QUESTS, OCCASION_QUESTS, makeDaily, makeWeekly } from '../content/quests';
import { rng } from '../core/rng';

export type GameEvent =
  | { type: 'visit'; location: LocationId }
  | { type: 'interact'; hotspot: string }
  | { type: 'collect'; kind: CollectibleKind; location: LocationId }
  | { type: 'minigame'; id: MinigameId; score: number }
  | { type: 'talk' }
  | { type: 'gift' }
  | { type: 'flag' };

const STATIC: Record<string, QuestDef> = Object.fromEntries(
  [...STORY_QUESTS, ...OCCASION_QUESTS].map((q) => [q.id, q]),
);

export function questDef(s: GameState, id: string): QuestDef | undefined {
  return STATIC[id] ?? s.quests.generated[id];
}

export function objectiveTarget(o: ObjectiveDef): number {
  switch (o.type) {
    case 'collect': return o.count;
    case 'gift': return o.count;
    case 'talk': return o.count ?? 1;
    default: return 1;
  }
}

function flagProgress(s: GameState, o: ObjectiveDef): number | null {
  return o.type === 'flag' ? (s.flags[o.id] ? 1 : 0) : null;
}

export function startQuest(s: GameState, id: string): boolean {
  const def = questDef(s, id);
  if (!def || s.quests.active[id]) return false;
  // Story/occasion quests run once; generated ids are unique per day/week anyway.
  if (s.quests.completed[id]) return false;
  s.quests.active[id] = {
    progress: def.objectives.map((o) => flagProgress(s, o) ?? 0),
    startedAt: Date.now(),
  };
  if (!s.quests.tracked || !s.quests.active[s.quests.tracked]) s.quests.tracked = id;
  return true;
}

function matches(o: ObjectiveDef, ev: GameEvent): number {
  switch (o.type) {
    case 'visit': return ev.type === 'visit' && ev.location === o.location ? 1 : 0;
    case 'interact': return ev.type === 'interact' && ev.hotspot === o.hotspot ? 1 : 0;
    case 'collect':
      return ev.type === 'collect' && (o.kind === 'any' || o.kind === ev.kind) && (!o.location || o.location === ev.location) ? 1 : 0;
    case 'minigame': return ev.type === 'minigame' && ev.id === o.id && ev.score >= (o.minScore ?? 0) ? 1 : 0;
    case 'talk': return ev.type === 'talk' ? 1 : 0;
    case 'gift': return ev.type === 'gift' ? 1 : 0;
    case 'flag': return 0;
  }
}

export function isComplete(s: GameState, id: string): boolean {
  const def = questDef(s, id);
  const p = s.quests.active[id];
  if (!def || !p) return false;
  return def.objectives.every((o, i) => p.progress[i] >= objectiveTarget(o));
}

/** Apply an event to all active quests. Returns completed quest defs (already moved to completed). */
export function notifyQuests(s: GameState, ev: GameEvent): { progressed: string[]; completed: QuestDef[] } {
  const progressed: string[] = [];
  const completed: QuestDef[] = [];
  for (const id of Object.keys(s.quests.active)) {
    const def = questDef(s, id);
    const p = s.quests.active[id];
    if (!def) {
      delete s.quests.active[id];
      continue;
    }
    let changed = false;
    def.objectives.forEach((o, i) => {
      const target = objectiveTarget(o);
      const fp = flagProgress(s, o);
      const next = fp !== null ? fp : Math.min(target, p.progress[i] + matches(o, ev));
      if (next !== p.progress[i]) {
        p.progress[i] = next;
        changed = true;
      }
    });
    if (changed) progressed.push(id);
    if (isComplete(s, id)) {
      delete s.quests.active[id];
      s.quests.completed[id] = Date.now();
      completed.push(def);
      if (s.quests.tracked === id) s.quests.tracked = null;
      if (def.next) startQuest(s, def.next);
    }
  }
  if (!s.quests.tracked) s.quests.tracked = Object.keys(s.quests.active)[0] ?? null;
  return { progressed, completed };
}

/** Create today's daily quests and this week's weekly quest, dropping expired ones. */
export function refreshGenerated(s: GameState, day: string, week: string): string[] {
  const added: string[] = [];
  if (s.quests.dailyKey !== day) {
    for (const id of Object.keys(s.quests.generated)) {
      if (id.startsWith('daily-')) {
        delete s.quests.generated[id];
        delete s.quests.active[id];
        delete s.quests.completed[id];
      }
    }
    const r = rng(`daily:${day}:${s.createdAt}`);
    for (let i = 0; i < 3; i++) {
      const q = makeDaily(r, day, i);
      s.quests.generated[q.id] = q;
      if (startQuest(s, q.id)) added.push(q.id);
    }
    s.quests.dailyKey = day;
  }
  if (s.quests.weeklyKey !== week) {
    for (const id of Object.keys(s.quests.generated)) {
      if (id.startsWith('weekly-')) {
        delete s.quests.generated[id];
        delete s.quests.active[id];
        delete s.quests.completed[id];
      }
    }
    const q = makeWeekly(rng(`weekly:${week}:${s.createdAt}`), week);
    s.quests.generated[q.id] = q;
    if (startQuest(s, q.id)) added.push(q.id);
    s.quests.weeklyKey = week;
  }
  if (s.quests.tracked && !s.quests.active[s.quests.tracked]) s.quests.tracked = null;
  return added;
}

export function storyQuestIds(): string[] {
  return STORY_QUESTS.map((q) => q.id);
}
export { STORY_QUESTS };

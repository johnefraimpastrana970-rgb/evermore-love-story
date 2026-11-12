// Shared content types. Everything in /src/content is plain data you can edit.

export type TimeOfDay = 'morning' | 'day' | 'sunset' | 'night';
export const TIMES: TimeOfDay[] = ['morning', 'day', 'sunset', 'night'];

export type LocationId = 'bedroom' | 'livingroom' | 'kitchen' | 'bathroom' | 'backyard' | 'school';
export type NeedAction = 'eat' | 'shower';
export type MinigameId = 'memory' | 'cooking' | 'grill-flip' | 'skewer-memory' | 'stars' | 'scramble' | 'slider';
export type CollectibleKind = 'heart' | 'petal' | 'star' | 'note' | 'sparkle';
export type MusicMood = 'title' | 'cozy' | 'kitchen' | 'school' | 'outdoor' | 'night' | 'festive';
export type AmbienceKind = 'room' | 'kitchen' | 'school' | 'outdoor' | 'none';
export type DecorationKind = 'hearts' | 'lights' | 'snow' | 'balloons' | 'pumpkins' | 'confetti' | 'petals';
export type Mood =
  | 'neutral' | 'happy' | 'shy' | 'surprised' | 'love' | 'sleepy'
  // Expressions from her illustrated art (see content/characters.ts)
  | 'natural' | 'idle' | 'cute' | 'laughing' | 'pouty' | 'irritated' | 'sad' | 'crying';
export type PersonalKind =
  | 'letter' | 'message' | 'memory' | 'photo' | 'joke' | 'date' | 'challenge' | 'surprise';

/** All fields are optional; every given field must be satisfied. */
export interface Condition {
  minLevel?: number;
  maxLevel?: number;
  flag?: string;
  notFlag?: string;
  time?: TimeOfDay[];
  /** An occasion id that must be active, or '*' for "any occasion". */
  occasion?: string;
  location?: LocationId;
  questDone?: string;
  questActive?: string;
  minAffection?: number;
  secret?: string;
  /** An achievement she has earned (achievement letters arrive with it). */
  achievement?: string;
  /** 0..1 – evaluated once per call, use sparingly. */
  chance?: number;
}

export type Effect =
  | { type: 'xp'; amount: number }
  | { type: 'tokens'; amount: number }
  | { type: 'item'; id: string; amount?: number }
  | { type: 'flag'; id: string; value?: boolean }
  | { type: 'affection'; amount: number }
  | { type: 'startQuest'; id: string }
  | { type: 'stat'; id: string; amount?: number }
  | { type: 'unlock'; id: string };

/**
 * Speakers are roles: 'her' = the character the player controls, 'him' = the partner. When the story is played
 * as the boyfriend the roles swap automatically (names, faces and he/she words). See src/core/roles.ts.
 */
export interface DialogueLine {
  speaker: 'her' | 'him' | 'narrator';
  text: string;
  mood?: Mood;
  /** Optional exact text to show instead when playing as him (for lines about her outfit etc.). Not pronoun-swapped. */
  asHim?: string;
}
export interface DialogueChoice {
  text: string;
  /** Optional exact text to show instead when playing as him. */
  asHim?: string;
  next?: string;
  effects?: Effect[];
  if?: Condition;
  /** Special built-in actions. */
  action?: 'gift' | 'minigame' | 'sleep' | 'travel';
  arg?: string;
}
export interface DialogueNode {
  lines: DialogueLine[];
  choices?: DialogueChoice[];
  next?: string;
  effects?: Effect[];
  /** Speakers and {her}/{him} mean the real people, never swapped (e.g. a birthday greeting). */
  literal?: boolean;
}

export type PanelId = 'character' | 'journal' | 'inventory' | 'quests' | 'map' | 'settings';

export interface TextVariant { if?: Condition; text: string }

export type HotspotAction =
  /** onceFlag may contain "{day}" to make the reward once-per-day. */
  | { kind: 'inspect'; texts: TextVariant[]; effects?: Effect[]; onceFlag?: string; repeatText?: string }
  | { kind: 'dialogue'; options: { if?: Condition; id: string }[] }
  | { kind: 'door'; to: LocationId; spawnX?: number; travelText?: string }
  | { kind: 'minigame'; id: MinigameId }
  | { kind: 'need'; action: NeedAction }
  | { kind: 'secret'; id: string; text: string }
  | { kind: 'panel'; panel: PanelId; tab?: string }
  | { kind: 'sleep' }
  | { kind: 'photo'; slot: number };

export interface Hotspot {
  id: string;
  label: string;
  /** Clickable rect in world coordinates. */
  x: number; y: number; w: number; h: number;
  /** Where the player stands to use it (defaults to rect centre). */
  standX?: number;
  action: HotspotAction;
  /** Secrets are invisible until the player is close. */
  hidden?: boolean;
  if?: Condition;
}

export interface LightDef { x: number; y: number; r: number; color: number; on: TimeOfDay[] }

export interface LocationDef {
  id: LocationId;
  name: string;
  subtitle: string;
  width: number;
  floorTop: number;
  floorBottom: number;
  indoor: boolean;
  music: MusicMood;
  ambience: AmbienceKind;
  spawnX: number;
  hotspots: Hotspot[];
  collectibleSpots: { x: number; y: number }[];
  collectibleKinds: CollectibleKind[];
  lights: LightDef[];
  /** Optional illustrated art. If set, replaces the procedural painting (1280x720 per screen, full location width). */
  backgroundImage?: Partial<Record<TimeOfDay, string>>;
  /** Optional music file override for this location. */
  musicFile?: string;
  mapPos: { x: number; y: number };
  icon: string;
}

export type ObjectiveDef =
  | { type: 'visit'; location: LocationId; label: string }
  | { type: 'interact'; hotspot: string; label: string }
  | { type: 'collect'; kind: CollectibleKind | 'any'; count: number; location?: LocationId; label: string }
  | { type: 'minigame'; id: MinigameId; minScore?: number; label: string }
  | { type: 'talk'; count?: number; label: string }
  | { type: 'gift'; count: number; label: string }
  | { type: 'flag'; id: string; label: string };

export interface QuestDef {
  id: string;
  title: string;
  description: string;
  kind: 'story' | 'daily' | 'weekly' | 'occasion';
  objectives: ObjectiveDef[];
  rewards: Effect[];
  next?: string;
  /** Story quest auto-starts when this becomes true. */
  autoStart?: Condition;
}

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  icon: string; // icon painter key
  giftable?: boolean;
  affection?: number;
  /** Readable items open a personal entry. */
  readable?: string;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  hidden?: boolean;
  /** Return true when earned. Receives a read-only state. */
  check: (s: import('../core/state').GameState) => boolean;
}

export type OccasionRule =
  | { type: 'fixed'; date: string } // YYYY-MM-DD
  | { type: 'yearly'; month: number; day: number; durationDays?: number; leadDays?: number }
  | { type: 'monthly'; day: number }
  | { type: 'range'; start: string; end: string } // MM-DD, may wrap the year
  | { type: 'nthWeekday'; month: number; weekday: number; nth: number } // nth -1 = last
  | { type: 'manual' };

export interface OccasionDef {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  rule: OccasionRule;
  theme: {
    tint?: number;
    decorations: DecorationKind[];
    music?: MusicMood;
    banner?: string;
  };
  /** Dialogue id played once per occasion day. */
  greeting?: string;
  questId?: string;
  /** Personal entry id unlocked while active. */
  surpriseId?: string;
  bonusXp?: number;
  placeholder?: boolean;
  /** About one real person (a birthday): banner and greeting keep the real names whoever is played. */
  literal?: boolean;
  /** Birth year (birthdays): the banner's {age} becomes "19th" etc. */
  sinceYear?: number;
}

export interface PersonalEntry {
  id: string;
  kind: PersonalKind;
  title: string;
  body?: string;
  /** Free text, e.g. "2024-02-14". Never invented — fill in yourself. */
  date?: string;
  /** Local image URL, e.g. "assets/photos/x.jpg". */
  image?: string;
  location?: LocationId;
  unlock?: Condition;
  /** For challenges: XP when she marks it done. */
  rewardXp?: number;
  placeholder?: boolean;
  tags?: string[];
}

export interface CosmeticDef {
  id: string;
  name: string;
  slot: 'herHair' | 'herOutfit' | 'herAccent' | 'hisHair' | 'hisOutfit';
  color: number;
  /** Outfit shape for the in-world sprite. Her: 'dress' (default) | 'tee'. Him: 'raglan' = hoodie with pale sleeves. */
  /** Outfit cut (see art/chibi/spec.ts): her tee/dress/pajama/sweater/cardigan/gown, his raglan/hoodie/shirt/pajama/sweater/formal. */
  style?: 'tee' | 'dress' | 'pajama' | 'sweater' | 'cardigan' | 'gown' | 'raglan' | 'hoodie' | 'shirt' | 'formal';
  unlockLevel?: number;
  cost?: number;
  /** Only given when a special garden plant first blooms. */
  garden?: boolean;
}

import type { TimeOfDay } from '../content/types';
import { bus } from './events';
import { GameState, Settings } from './state';
import { loadSettings, saveSettings, writeSlot, SlotId } from './save';
import { dayKey, timeOfDayForHour } from './time';
import { other, swapGender, Who } from './roles';

/** Global runtime store. One active game at a time. */
class Store {
  private _state: GameState | null = null;
  settings: Settings = loadSettings();
  slot: SlotId = 'auto';
  /** Number of open blocking UI layers (dialogue, panels, minigames). */
  private blockers = 0;
  /** Shared analogue input from the on-screen joystick. */
  joy = { x: 0, y: 0, action: false };
  /** Clock override for tests. */
  clock: () => Date = () => new Date();

  get state(): GameState {
    if (!this._state) throw new Error('No game loaded');
    return this._state;
  }
  get hasGame() {
    return this._state !== null;
  }
  load(s: GameState, slot: SlotId = 'auto') {
    this._state = s;
    this.slot = slot;
    bus.emit('state');
  }
  unload() {
    this._state = null;
  }

  /** Current device-local date and time. */
  now(): Date {
    return this.clock();
  }
  today(): string {
    return dayKey(this.now());
  }
  timeOfDay(): TimeOfDay {
    if (this.settings.timeMode === 'manual') return this.settings.manualTime;
    return timeOfDayForHour(this.now().getHours());
  }

  updateSettings(patch: Partial<Settings>) {
    const before = this.timeOfDay();
    Object.assign(this.settings, patch);
    saveSettings(this.settings);
    bus.emit('settings', patch);
    if (before !== this.timeOfDay()) bus.emit('time');
  }

  save(slot: SlotId = this.slot): boolean {
    if (!this._state) return false;
    const ok = writeSlot(slot, this._state);
    if (slot !== 'auto') writeSlot('auto', this._state);
    bus.emit('saved', { slot, ok });
    return ok;
  }

  block() {
    this.blockers++;
    bus.emit('blocking', this.blockers);
  }
  unblock() {
    this.blockers = Math.max(0, this.blockers - 1);
    bus.emit('blocking', this.blockers);
  }
  get blocked() {
    return this.blockers > 0;
  }

  herName() {
    return this._state?.profile.herName || 'Her';
  }
  hisName() {
    return this._state?.profile.hisName || 'Him';
  }
  nameOf(who: Who) {
    return who === 'her' ? this.herName() : this.hisName();
  }

  /** Which character the player controls. */
  playAs(): Who {
    return this._state?.profile.playAs === 'him' ? 'him' : 'her';
  }
  /** The companion. */
  partner(): Who {
    return other(this.playAs());
  }
  get swapped() {
    return this.playAs() === 'him';
  }
  /** Map a content role ('her' = player, 'him' = partner) to the real character. */
  cast(role: Who): Who {
    return this.swapped ? other(role) : role;
  }
  playerName() {
    return this.nameOf(this.playAs());
  }
  partnerName() {
    return this.nameOf(this.partner());
  }

  /**
   * Format story text: {her} = the player, {him} = the partner, and he/she words follow whoever is played.
   * `asHim` is an exact replacement used when playing as him.
   */
  fmt(text: string, asHim?: string): string {
    let t = text;
    if (this.swapped) t = asHim ?? swapGender(text);
    return t.replace(/\{her\}/g, this.playerName()).replace(/\{him\}/g, this.partnerName());
  }
  /** Format text about the real people (personal letters, birthdays): {her} is always her, {him} always him. */
  fmtLiteral(text: string): string {
    return text.replace(/\{her\}/g, this.herName()).replace(/\{him\}/g, this.hisName());
  }
}

export const store = new Store();

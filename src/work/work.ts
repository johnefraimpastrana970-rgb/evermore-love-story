import { store } from '../core/store';
import { bus } from '../core/events';
import { audio } from '../audio/audio';
import { toast, giveItem, afterChange, gainXp, bumpStat } from '../systems/game';
import { playDialogue } from '../ui/dialogue';
import { deliver } from '../phone/scheduler/scheduler';
import { setHoldingHands } from '../systems/hands';
import { ITEMS } from '../content/items';
import { HOME_LINES, LEAVE_LINES, NOTE_REPLY, SHIFT_MINUTES } from './data';
import { arrive, dueMessages, greet, messageText, startShift, status, type Bento, type Souvenir } from './logic';
import { useProduce } from '../garden/logic';
import { food } from './data';

/*
 * His work day at runtime: sending him off, his messages while away, and the homecoming at the front door.
 * Everything is driven from timestamps, so it carries on while the game is closed: when she comes back,
 * missed messages are in the chat and he's waiting at the door.
 */

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** He's out (at work or waiting outside the front door): not in the house. */
export const partnerAway = () => store.hasGame && status(store.state.work) !== 'home';
export const waitingAtDoor = () => store.hasGame && status(store.state.work) === 'waiting';

/** She hands him the bento: he says goodbye and heads out. Returns false if he can't go. */
export async function sendOff(b: Bento): Promise<boolean> {
  const s = store.state;
  const shift = startShift(s.work, b, Date.now(), store.today(), s.level);
  if (!shift) return false;
  // Garden foods use up produce from the basket.
  for (const id of Object.values(b.slots)) { const g = food(id ?? '')?.garden; if (g) useProduce(s.garden, g); }
  setHoldingHands(false);
  bumpStat('bentos');
  gainXp(10 + shift.score * 3, 'bento');
  store.save();
  await playDialogue({ lines: [
    { speaker: 'him', text: pick(LEAVE_LINES).replace('{min}', String(SHIFT_MINUTES)), mood: shift.score >= 6 ? 'love' : 'happy' },
    { speaker: 'her', text: pick(['Have a good day ♡', 'Don’t work too hard!', 'Come home safe, okay?']), mood: 'cute' },
  ] });
  bus.emit('work:leave');
  const back = new Date(shift.returnAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  toast(`{him} left for work. Back around ${back} ♡`, 'heart');
  afterChange();
  return true;
}

// ------------------------------------------------------------------ the timer

let homecomingShown = false;
let worldReady = false;

/** One pass: deliver due messages, and notice when he gets home. */
export function runWorkPass(now = Date.now()) {
  if (!store.hasGame) return;
  const w = store.state.work;
  const shift = w.away ?? w.waiting;
  const due = dueMessages(w, now);
  if (due.length && shift) {
    const name = store.partnerName();
    const deliveries = due.map((m) => {
      let text = store.fmt(messageText(shift, m.index));
      if (m.index === 0 && shift.bento.note.trim()) text += `\n${pick(NOTE_REPLY)}`;
      return deliver(text, m.at, 'work', `shift-${shift.leftAt}`, name, 'chat');
    });
    store.save();
    bus.emit('phone:notify', deliveries.slice(-1)); // one banner, even after a long time away
  }
  if (arrive(w, now)) {
    store.save();
    homecomingShown = false;
  }
  if (status(w) === 'waiting' && !homecomingShown && worldReady && !store.blocked) {
    homecomingShown = true;
    void homecoming();
  }
}

/** He's at the door: her thought, a knock, and she hurries to the living room. */
async function homecoming() {
  audio.sfx('door');
  setTimeout(() => audio.sfx('door'), 380);
  await playDialogue({ lines: [{ speaker: 'her', text: store.swapped ? HOME_LINES.arriveAsHim : HOME_LINES.arrive, mood: 'happy' }] });
  if (store.state.location !== 'livingroom') {
    bus.emit('travel', { to: 'livingroom', spawnX: 1910 }); // in front of the front door
  }
  toast(HOME_LINES.hint, 'heart');
  bus.emit('work:waiting');
}

/** She opens the front door: he's home. Plays the greeting and hands over the souvenirs. */
export async function openDoor(): Promise<void> {
  const res = greet(store.state.work);
  if (!res) return;
  bus.emit('work:home');
  audio.sfx('door');
  store.save();
  const got = applySouvenirs(res.souvenirs);
  await playDialogue({ lines: [
    { speaker: 'him', text: HOME_LINES.him, mood: 'love' },
    { speaker: 'her', text: HOME_LINES.her, mood: 'happy' },
    { speaker: 'him', text: res.shift.craved ? 'And thank you for lunch. You remembered what I was craving… ♡' : pick(['Lunch was perfect. Thank you ♡', 'I thought about you all day.', 'Best part of my day? Coming home to you.']), mood: 'cute' },
    { speaker: 'him', text: `I brought you something: ${got.join(', ')} ♡`, mood: 'happy' },
  ] });
  bus.emit('dialogue:node', '__hug'); // a welcome-home hug
  afterChange();
  store.save();
}

function applySouvenirs(list: Souvenir[]): string[] {
  const s = store.state;
  const out: string[] = [];
  for (const x of list) {
    if (x.tokens) { s.tokens += x.tokens; out.push(`${x.tokens} heart tokens`); }
    if (x.item && ITEMS[x.item]) { giveItem(x.item); out.push(ITEMS[x.item].name.toLowerCase()); }
  }
  bumpStat('welcome-homes');
  return out.length ? out : ['a big smile'];
}

let timer: number | undefined;
export function initWork() {
  // world-ready fires on every room change; only a freshly loaded game shows the "he's home" moment again.
  bus.on('world-ready', () => { if (!worldReady) homecomingShown = false; worldReady = true; setTimeout(() => runWorkPass(), 1500); });
  bus.on('to-title', () => { worldReady = false; });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(() => runWorkPass(), 1200); });
  clearInterval(timer);
  timer = window.setInterval(() => runWorkPass(), 5000);
}

import { store } from '../core/store';
import { cloud } from '../backend/cloud';
import { LOCATIONS } from '../content/locations';
import { currentOccasions } from '../systems/game';
import { status as workStatus } from '../work/logic';
import { food } from '../work/data';
import { breed } from '../pets/data';
import { mood } from '../pets/logic';
import { stage } from '../garden/logic';

/*
 * AI replies in the phone chat (Groq, through the `ai-chat` Supabase Edge Function – the key never ships in the app).
 * Used only when cloud sync is set up and she's signed in; otherwise, or when today's replies are used up or the
 * network fails, the chat falls back to the scripted replies.
 */

export const AI_DAILY_CAP = 50;

/** What's going on in the game right now, in a few short lines (sent along with each message). */
export function gameContext(): string {
  const s = store.state;
  const now = new Date();
  const lines: string[] = [];
  lines.push(`It is ${now.toLocaleDateString([], { weekday: 'long' })}, ${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} (${store.timeOfDay()}).`);
  lines.push(`${store.playerName()} is in the ${LOCATIONS[s.location]?.name ?? s.location}, level ${s.level}, ${s.daily.streak}-day visit streak.`);
  const occ = currentOccasions().filter((o) => !o.placeholder).map((o) => o.name.replace(/[⟦⟧]/g, ''));
  if (occ.length) lines.push(`Today is special: ${occ.join(', ')}.`);
  const w = workStatus(s.work);
  const shift = s.work.away ?? s.work.waiting;
  if (w === 'away' && shift) {
    const lunch = Object.values(shift.bento.slots).map((id) => food(id ?? '')?.name).filter(Boolean).join(', ');
    lines.push(`You are at work right now (back around ${new Date(shift.returnAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}). She packed your lunch: ${lunch || 'a bento'}${shift.bento.note ? `, with a note: "${shift.bento.note}"` : ''}.`);
  } else if (w === 'waiting') lines.push('You just got home from work and are at the front door waiting for her to open it.');
  else if (s.work.day === store.today() && s.work.shifts) lines.push(`You already went to work ${s.work.shifts} time(s) today; she packed your lunches.`);
  if (s.pets.list.length) {
    lines.push(`Your pets: ${s.pets.list.slice(0, 6).map((p) => `${p.name} (${breed(p.breed)?.name ?? 'pet'}, ${mood(p)})`).join(', ')}.`);
  } else if (s.pets.stray) lines.push('A shy stray orange cat has been visiting your backyard; she is trying to befriend it.');
  if (s.garden.unlocked) {
    const ready = s.garden.plots.filter((p) => p.plantId && stage(p, Date.now()) === 3).length;
    lines.push(`You two have a backyard garden${ready ? ` (${ready} plant${ready > 1 ? 's' : ''} ready to pick)` : ''}.`);
  }
  if (s.pizza.unlocked) lines.push(`You run a little pizza shop together${s.pizza.open ? ' (it is open right now)' : ''}.`);
  return lines.join('\n').slice(0, 2400);
}

/** The last bits of the chat, as the AI sees it. */
function history() {
  return store.state.phone.messages
    .filter((m) => m.from === 'me' || m.from === 'partner')
    .slice(-14)
    .map((m) => ({ role: m.from === 'me' ? 'user' as const : 'assistant' as const, content: m.text.slice(0, 400) }));
}

/** His reply from the AI, or null to use a scripted one. */
export async function aiReply(): Promise<string | null> {
  if (!cloud.configured || !cloud.userEmail()) return null;
  const p = store.state.phone;
  const today = store.today();
  if (p.ai.day !== today) p.ai = { day: today, count: 0 };
  if (p.ai.count >= AI_DAILY_CAP) return null;
  const res = await Promise.race([
    cloud.aiChat({ messages: history(), context: gameContext(), him: store.partnerName(), her: store.playerName(), partnerIs: store.swapped ? 'girlfriend' : 'boyfriend' }),
    new Promise<{ error: string }>((r) => setTimeout(() => r({ error: 'timeout' }), 15_000)),
  ]);
  if ('reply' in res) { p.ai.count++; return res.reply; }
  if (res.error === 'cap') p.ai.count = AI_DAILY_CAP; // the server says today's replies are used up
  return null;
}

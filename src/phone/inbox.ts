import { store } from '../core/store';
import { bus } from '../core/events';
import { uid, type PhoneMessage } from './types';

const KEEP = 400;

/** Add a message to the partner thread (keeps the newest KEEP). */
export function addMessage(m: Omit<PhoneMessage, 'id' | 'at'> & { at?: number }): PhoneMessage {
  const p = store.state.phone;
  const msg: PhoneMessage = { id: uid('m'), at: m.at ?? Date.now(), ...m } as PhoneMessage;
  p.messages.push(msg);
  p.messages.sort((a, b) => a.at - b.at);
  if (p.messages.length > KEEP) p.messages.splice(0, p.messages.length - KEEP);
  store.state.updatedAt = Date.now();
  bus.emit('phone');
  return msg;
}

export function markThreadRead() {
  const p = store.state.phone;
  const unread = p.messages.filter((m) => m.from !== 'me' && m.at > p.readAt);
  if (!unread.length) return; // nothing to do (also avoids a redraw loop)
  p.readAt = Math.max(...unread.map((m) => m.at));
  bus.emit('phone');
}

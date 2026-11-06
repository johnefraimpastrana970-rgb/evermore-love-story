import { registerApp, partnerAvatar } from '../phone';
import { store } from '../../core/store';
import { bus } from '../../core/events';
import { audio } from '../../audio/audio';
import { esc } from '../../ui/dom';
import { GENERIC_REPLIES, QUICK_REPLIES } from '../../content/phone';
import { addMessage, markThreadRead } from '../inbox';
import type { PhoneMessage } from '../types';
import { dayLabel, timeLabel } from './util';

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
let typingUntil = 0;

/** The partner answers locally with a scripted reply. */
let answering: Promise<void> = Promise.resolve();
function partnerAnswer(text: string) {
  // Replies arrive in order even if she sends a few messages quickly.
  answering = answering.then(async () => {
    typingUntil = Date.now() + 60_000; // "typing…" until the reply is ready
    bus.emit('phone:typing');
    const started = Date.now();
    const q = QUICK_REPLIES.find((r) => r.text === text);
    const reply = store.fmt(pick(q ? q.replies : GENERIC_REPLIES));
    // Feel like a person typing: at least a moment, longer for longer messages.
    const wait = Math.max(0, 900 + Math.min(2200, reply.length * 40) - (Date.now() - started));
    await new Promise((r) => setTimeout(r, wait));
    typingUntil = 0;
    if (!store.hasGame) return;
    addMessage({ from: 'partner', text: reply, kind: 'chat' });
    audio.sfx('heart');
    store.save();
  });
}

registerApp({
  id: 'messages',
  name: 'Messages',
  open(ctx) {
    const unsub: (() => void)[] = [];

    const threads = () => {
      ctx.title('Messages');
      ctx.action(null);
      ctx.onBack(null);
      const msgs = store.state.phone.messages;
      const last = msgs[msgs.length - 1];
      const unread = msgs.filter((m) => m.from !== 'me' && m.at > store.state.phone.readAt).length;
      ctx.host.innerHTML = `<ul class="ph-list"><li><button class="ph-row thread" data-thread>
        <img class="ph-ava" src="${partnerAvatar()}" alt="">
        <span><b>${esc(store.partnerName())}</b><small>${last ? esc((last.from === 'me' ? 'You: ' : '') + last.text) : 'Say hi ♡'}</small></span>
        <span class="thread-meta"><small>${last ? esc(dayLabel(last.at) === 'Today' ? timeLabel(last.at) : dayLabel(last.at)) : ''}</small>${unread ? `<i class="badge">${unread}</i>` : ''}</span>
      </button></li></ul>`;
      ctx.host.querySelector('[data-thread]')!.addEventListener('click', chat);
    };

    const chat = () => {
      ctx.title(store.partnerName());
      ctx.action(null);
      ctx.onBack(() => { threads(); return true; });
      ctx.host.innerHTML = `<div class="chat">
        <div class="chat-log" role="log" aria-live="polite"></div>
        <div class="chat-quick">${QUICK_REPLIES.map((q, i) => `<button data-q="${i}">${esc(q.text)}</button>`).join('')}</div>
        <form class="chat-input"><input placeholder="Message" maxlength="300" aria-label="Message" enterkeyhint="send"><button aria-label="Send">➤</button></form>
      </div>`;
      const log = ctx.host.querySelector('.chat-log') as HTMLElement;
      const input = ctx.host.querySelector('.chat-input input') as HTMLInputElement;
      const draw = () => {
        const msgs = store.state.phone.messages;
        let day = '';
        let prev: PhoneMessage | null = null;
        const parts: string[] = [];
        if (!msgs.length) parts.push(`<div class="chat-hint">Messages from ${esc(store.partnerName())} show up here: good mornings, reminders you set in Calendar, and little check-ins.</div>`);
        for (const m of msgs) {
          const d = dayLabel(m.at);
          if (d !== day) { parts.push(`<div class="chat-day">${esc(d)}</div>`); day = d; prev = null; }
          const mine = m.from === 'me';
          const first = !prev || prev.from !== m.from || m.at - prev.at > 5 * 60_000;
          if (m.from === 'evermore') parts.push(`<div class="chat-sys">${esc(m.text)}</div>`);
          else parts.push(`<div class="bubble-row ${mine ? 'me' : 'them'} ${first ? 'first' : ''}">
            ${!mine ? (first ? `<img src="${partnerAvatar()}" alt="">` : '<span class="ava-gap"></span>') : ''}
            <div class="bubble ${m.kind === 'reminder' ? 'reminder' : ''}">${m.kind === 'reminder' ? '<b>🔔 Reminder</b>' : ''}${esc(m.text)}<time>${timeLabel(m.at)}</time></div></div>`);
          prev = m;
        }
        if (Date.now() < typingUntil) parts.push(`<div class="bubble-row them"><img src="${partnerAvatar()}" alt=""><div class="bubble typing"><i></i><i></i><i></i></div></div>`);
        log.innerHTML = parts.join('');
        log.scrollTop = log.scrollHeight;
        markThreadRead();
      };
      const send = (text: string) => {
        const t = text.trim();
        if (!t) return;
        addMessage({ from: 'me', text: t, kind: 'chat' });
        audio.sfx('click');
        partnerAnswer(t);
      };
      ctx.host.querySelector('.chat-input')!.addEventListener('submit', (e) => { e.preventDefault(); send(input.value); input.value = ''; });
      ctx.host.querySelectorAll<HTMLElement>('[data-q]').forEach((b) => b.addEventListener('click', () => send(QUICK_REPLIES[Number(b.dataset.q)].text)));
      unsub.push(bus.on('phone', draw), bus.on('phone:typing', draw));
      draw();
    };

    if (ctx.params.get('thread') !== 'list') chat(); else threads();
    return () => unsub.forEach((u) => u());
  },
});

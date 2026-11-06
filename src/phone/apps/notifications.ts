import { registerApp } from '../phone';
import { store } from '../../core/store';
import { esc } from '../../ui/dom';
import { changed, confirmSheet, dayLabel, timeLabel } from './util';

/** Notification history: every greeting and reminder that was sent (or missed), newest first. */
registerApp({
  id: 'notifications',
  name: 'Notifications',
  open(ctx) {
    const render = () => {
      const h = [...store.state.phone.history].sort((a, b) => b.at - a.at);
      ctx.action(h.length ? 'Clear' : null, async () => {
        if (!(await confirmSheet(ctx.host, 'Clear notification history? Messages stay in the chat.', 'Clear'))) return;
        store.state.phone.history = [];
        changed();
        render();
      }, 'Clear history');
      let day = '';
      ctx.host.innerHTML = h.length ? `<ul class="ph-list notif-list">${h.map((n) => {
        const d = dayLabel(n.at);
        const head = d !== day ? `<li class="ph-letter">${esc((day = d))}</li>` : '';
        const icon = n.source === 'reminder' ? '🔔' : '💌';
        const tags = [n.missed ? '<i class="tag miss">missed</i>' : '', n.opened ? '<i class="tag">opened</i>' : '', n.channel !== 'game' ? `<i class="tag">${n.channel}</i>` : ''].join('');
        return `${head}<li><button class="ph-row" data-src="${n.source}" data-ref="${esc(n.refId ?? '')}"><span class="notif-ico">${icon}</span>
          <span><b>${esc(n.title)}</b><small>${esc(n.body.split('\n')[0])}</small></span><span class="notif-meta"><small>${timeLabel(n.at)}</small>${tags}</span></button></li>`;
      }).join('')}</ul>` : '<div class="ph-empty"><b>🔕</b>No notifications yet.<br>Good mornings and reminders will be listed here.</div>';
      ctx.host.querySelectorAll<HTMLElement>('[data-src]').forEach((b) => b.addEventListener('click', () => {
        const ref = b.dataset.ref;
        if (b.dataset.src === 'reminder' && ref && store.state.phone.reminders.some((r) => r.id === ref && !r.deleted)) ctx.go(`calendar?reminder=${encodeURIComponent(ref)}`);
        else ctx.go('messages');
      }));
    };
    render();
  },
});

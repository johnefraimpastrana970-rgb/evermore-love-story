import { registerApp } from '../phone';
import { store } from '../../core/store';
import { audio } from '../../audio/audio';
import { esc } from '../../ui/dom';
import { plantDef } from '../../garden/data';
import { gardenLevel, readyAt, stage, water } from '../../garden/logic';
import { plantSvg } from '../../garden/draw';
import { openGarden, timeLeft } from '../../garden/garden';
import { changed } from './util';

/** Garden app: peek at the plots and their timers, water from afar, jump into the garden. */
registerApp({
  id: 'garden',
  name: 'Garden',
  open(ctx) {
    const render = () => {
      const g = store.state.garden;
      ctx.title('Our Garden');
      if (!g.unlocked) { ctx.host.innerHTML = '<div class="ph-empty"><b>🌱</b>Nothing planted yet.</div>'; return; }
      const now = Date.now();
      const growing = g.plots.filter((p) => p.plantId);
      const ready = growing.filter((p) => stage(p, now) === 3).length;
      const next = growing.map((p) => readyAt(p) ?? 0).filter((t) => t > now).sort((a, b) => a - b)[0];
      const thirsty = growing.filter((p) => p.wateredAt === null && stage(p, now) < 3).length;
      const basket = Object.values(g.basket).reduce((a, b) => a + b, 0);
      ctx.host.innerHTML = `<div class="gdp">
        <div class="gdp-sum"><span><b>${ready}</b><small>ready</small></span><span><b>${next ? timeLeft(next - now) : '—'}</b><small>next</small></span>
          <span><b>${basket}</b><small>in basket</small></span><span><b>Lv ${gardenLevel(g.xp)}</b><small>garden</small></span></div>
        <div class="gdp-grid">${g.plots.map((p) => {
          const d = p.plantId ? plantDef(p.plantId) : null;
          const st = stage(p, now);
          const known = d && (d.kind !== 'special' || g.bloomed[d.id]);
          return `<div class="gdp-plot ${st === 3 ? 'ready' : ''}">${plantSvg(p.plantId, st, 48, st === 3)}
            <small>${!d ? 'empty' : st === 3 ? 'Ready!' : `${known ? esc(d.name) : '???'} · ${timeLeft((readyAt(p) ?? now) - now)}`}${d && p.wateredAt !== null && st < 3 ? ' 💧' : ''}</small></div>`;
        }).join('')}</div>
        ${g.mystery ? `<p class="gdp-note">✨ ${g.mystery} mystery seed${g.mystery > 1 ? 's' : ''} waiting to be planted</p>` : ''}
        <div class="ph-row-btns">${thirsty ? `<button class="ph-btn ghost" data-water>💧 Water all (${thirsty})</button>` : ''}<button class="ph-btn" data-open>Go to the garden</button></div>
      </div>`;
      ctx.host.querySelector('[data-water]')?.addEventListener('click', () => {
        g.plots.forEach((_, i) => water(g, i, Date.now()));
        audio.sfx('water');
        changed();
        store.save();
        render();
      });
      ctx.host.querySelector('[data-open]')!.addEventListener('click', () => {
        ctx.close();
        setTimeout(() => { if (!store.blocked) void openGarden(); }, 350);
      });
    };
    render();
    const t = window.setInterval(render, 5000);
    return () => clearInterval(t);
  },
});

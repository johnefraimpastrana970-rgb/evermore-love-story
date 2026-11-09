import { registerApp } from '../phone';
import { store } from '../../core/store';
import { esc, richText } from '../../ui/dom';
import { HER_PORTRAITS, HIS_PORTRAITS } from '../../content/characters';
import { PERSONAL } from '../../content/personal';
import { isUnlocked } from '../../systems/game';
import { resolveImage } from '../../ui/panels';
import type { Mood } from '../../content/types';
import { photoUrl } from '../../garden/draw';
import { plantDef } from '../../garden/data';
import { petPhotoUrl } from '../../pets/draw';
import { breed } from '../../pets/data';
import { homeMemoryImage } from '../../home/memories';

interface Pic { src: string; caption: string; date?: string; template?: boolean }

const MOODS: Mood[] = ['natural', 'happy', 'cute', 'laughing', 'idle', 'pouty', 'irritated', 'sad', 'crying'];

function albums(): { id: string; name: string; pics: Pic[]; note?: string }[] {
  // Memories: the real photos from personal.ts (cloud photos resolve on open). Templates show as empty frames.
  const photos = PERSONAL.filter((e) => e.kind === 'photo');
  const memories: Pic[] = photos.filter((e) => e.placeholder || isUnlocked(e)).map((e) => ({
    src: e.placeholder || !e.image ? '' : e.image,
    caption: store.fmtLiteral(e.title),
    date: e.date,
    template: e.placeholder || !e.image,
  }));
  const art = (who: 'her' | 'him') => {
    const table = who === 'her' ? HER_PORTRAITS : HIS_PORTRAITS;
    return MOODS.filter((m) => table[m]).map((m) => ({ src: table[m]!, caption: `${store.nameOf(who)} · ${m}` }));
  };
  const g = store.state.garden;
  const garden: Pic[] = [...g.photos].reverse().map((ph) => ({
    src: photoUrl(ph),
    caption: ph.kind === 'bouquet' ? `A bouquet of ${[...new Set(ph.flowers ?? [])].map((f) => plantDef(f)?.name.toLowerCase() ?? f).join(', ')}` : 'Our garden ♡',
    date: new Date(ph.at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }),
  }));
  const homeMemories: Pic[] = [...store.state.home.memories].reverse().map((memory) => ({
    src: homeMemoryImage(memory),
    caption: memory.caption,
    date: new Date(memory.at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }),
  }));
  return [
    { id: 'memories', name: 'Memories', pics: memories, note: 'Your real photos appear here once they’re added (see CONTENT_GUIDE.md → Photos).' },
    { id: 'us', name: 'Us', pics: [...art(store.playAs()), ...art(store.partner())] },
    ...(homeMemories.length ? [{ id: 'home', name: 'Home', pics: homeMemories }] : []),
    ...(store.state.pets.list.length || store.state.pets.photos.length ? [{ id: 'pets', name: 'Pets', pics: [...store.state.pets.photos].reverse().map((ph) => ({
      src: petPhotoUrl({ room: ph.room, pets: ph.pets.map((x) => ({ ...x, breed: breed(x.breed) ?? breed('cat-orange')! })) }),
      caption: ph.pets.map((x) => x.name).join(' & '),
      date: new Date(ph.at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }),
    })), note: store.state.pets.photos.length ? undefined : 'Tap a pet and press 📷 Photo to fill this album.' }] : []),
    ...(g.unlocked ? [{ id: 'garden', name: 'Garden', pics: garden, note: garden.length ? undefined : 'Take photos of your garden and bouquets with the 📷 button in the garden.' }] : []),
  ];
}

registerApp({
  id: 'gallery',
  name: 'Gallery',
  open(ctx) {
    let album = ctx.params.get('album') ?? 'us';
    let cleanupViewer: (() => void) | null = null;

    const grid = () => {
      cleanupViewer?.();
      ctx.title('Gallery');
      ctx.onBack(null);
      const all = albums();
      const cur = all.find((a) => a.id === album) ?? all[0];
      ctx.host.innerHTML = `<div class="gal-tabs">${all.map((a) => `<button class="${a.id === cur.id ? 'on' : ''}" data-album="${a.id}">${esc(a.name)} <small>${a.pics.filter((p) => !p.template).length}</small></button>`).join('')}</div>
        ${cur.pics.length ? `<div class="gal-grid">${cur.pics.map((p, i) => `<button class="gal-cell ${p.template ? 'tpl' : ''}" data-i="${i}" aria-label="${esc(p.caption)}">
          ${p.template ? '<span>✿<small>template</small></span>' : `<img loading="lazy" data-src="${esc(p.src)}" alt="">`}</button>`).join('')}</div>` : ''}
        ${cur.note ? `<p class="gal-note">${esc(cur.note)}</p>` : ''}`;
      ctx.host.querySelectorAll<HTMLElement>('[data-album]').forEach((b) => b.addEventListener('click', () => { album = b.dataset.album!; grid(); }));
      ctx.host.querySelectorAll<HTMLImageElement>('img[data-src]').forEach((img) => void resolveImage(img.dataset.src).then((u) => { if (u) img.src = u; }));
      ctx.host.querySelectorAll<HTMLElement>('[data-i]').forEach((b) => b.addEventListener('click', () => viewer(cur.pics, Number(b.dataset.i))));
    };

    const viewer = (pics: Pic[], start: number) => {
      let i = start;
      ctx.onBack(() => { grid(); return true; });
      ctx.host.innerHTML = `<div class="gal-view"><div class="gal-stage"><img alt=""></div>
        <div class="gal-cap"><b></b><small></small></div>
        <button class="gal-nav prev" aria-label="Previous">‹</button><button class="gal-nav next" aria-label="Next">›</button></div>`;
      const img = ctx.host.querySelector('.gal-stage img') as HTMLImageElement;
      const show = async (dir = 0) => {
        const p = pics[i];
        ctx.title(`${i + 1} of ${pics.length}`);
        (ctx.host.querySelector('.gal-cap b') as HTMLElement).innerHTML = richText(p.caption);
        (ctx.host.querySelector('.gal-cap small') as HTMLElement).innerHTML = p.date ? richText(p.date) : '';
        img.classList.remove('in-l', 'in-r');
        void img.offsetWidth;
        if (dir) img.classList.add(dir > 0 ? 'in-r' : 'in-l');
        if (p.template) { img.removeAttribute('src'); img.alt = 'Template: no photo yet'; return; }
        const u = await resolveImage(p.src);
        if (u) img.src = u;
      };
      const step = (d: number) => { i = (i + d + pics.length) % pics.length; void show(d); };
      ctx.host.querySelector('.prev')!.addEventListener('click', () => step(-1));
      ctx.host.querySelector('.next')!.addEventListener('click', () => step(1));
      let sx = 0;
      const stage = ctx.host.querySelector('.gal-view') as HTMLElement;
      stage.addEventListener('pointerdown', (e) => { sx = e.clientX; });
      stage.addEventListener('pointerup', (e) => { const dx = e.clientX - sx; if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1); });
      const onKey = (e: KeyboardEvent) => { if (e.code === 'ArrowLeft') step(-1); if (e.code === 'ArrowRight') step(1); };
      window.addEventListener('keydown', onKey);
      cleanupViewer = () => { window.removeEventListener('keydown', onKey); cleanupViewer = null; };
      void show();
    };

    grid();
    return () => cleanupViewer?.();
  },
});

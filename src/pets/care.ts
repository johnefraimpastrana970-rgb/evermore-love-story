import './care.css';
import { store } from '../core/store';
import { audio } from '../audio/audio';
import { el, esc } from '../ui/dom';
import { burstHearts } from '../ui/fx';
import { gainXp, bumpStat, afterChange } from '../systems/game';
import { overlay, confetti } from '../pizza/ui';
import { PERSONALITIES, breed, type ActivityId, type BreedDef } from './data';
import { applyActivity, bondLevel, speciesOf, type Pet } from './logic';
import { PET_FRAMES, PET_H, PET_W, buildPetSheet } from './draw';
import { captureHomeMemory } from '../home/memories';

/*
 * Care & play: six short, relaxed activities. None can be failed; a better score just makes the pet happier.
 * The pet is shown with its own sprite sheet (as a CSS sprite), so it can sit, walk, eat and be happy on screen.
 */

export const ACTIVITIES: { id: ActivityId; name: string; emoji: string; how: string; need?: 'clean' | 'nails' | 'joy' }[] = [
  { id: 'bath', name: 'Bath time', emoji: '🛁', how: 'Scrub every muddy spot with the sponge, then hold the shower to rinse the bubbles away.', need: 'clean' },
  { id: 'nails', name: 'Nail trim', emoji: '✂️', how: 'Tap ✂️ when the clipper is in the green part of each claw. Not too close!', need: 'nails' },
  { id: 'brush', name: 'Brushing', emoji: '🪮', how: 'Brush back and forth over the fur until it’s silky and the fluff flies.', need: 'clean' },
  { id: 'pet', name: 'Pet time', emoji: '💗', how: 'Find the sweet spots that glow and rub them. Some pets don’t like belly rubs…', need: 'joy' },
  { id: 'fetch', name: 'Fetch', emoji: '🎾', how: 'Swipe to throw. Land it in the glowing spot for a happy fetch!', need: 'joy' },
  { id: 'treat', name: 'Treat catch', emoji: '🦴', how: 'Tap when the treat is right above your pet’s head.', need: 'joy' },
];

// ------------------------------------------------------------------ the pet as a CSS sprite
const sheets = new Map<string, string>();
function sheetUrl(b: BreedDef) {
  let u = sheets.get(b.id);
  if (!u) { u = buildPetSheet(b).toDataURL('image/png'); sheets.set(b.id, u); }
  return u;
}
class PetView {
  el: HTMLElement;
  private raf = 0;
  private anim: number[] = [];
  private fps = 4;
  constructor(private b: BreedDef, private scale: number) {
    this.el = el('div', 'cv-pet');
    Object.assign(this.el.style, {
      width: `${PET_W * scale}px`, height: `${PET_H * scale}px`,
      backgroundImage: `url(${sheetUrl(b)})`, backgroundSize: `${PET_W * PET_FRAMES.total * scale}px ${PET_H * scale}px`,
    });
    this.play('sit');
  }
  frame(i: number) { this.el.style.backgroundPosition = `-${i * PET_W * this.scale}px 0`; }
  play(a: 'idle' | 'walk' | 'sit' | 'happy' | 'eat' | 'sleep') {
    this.anim = a === 'idle' ? PET_FRAMES.idle : PET_FRAMES[a];
    this.fps = a === 'walk' ? 11 : a === 'happy' ? 5 : a === 'eat' ? 4 : 1.6;
    cancelAnimationFrame(this.raf);
    const t0 = performance.now();
    const loop = (t: number) => { this.frame(this.anim[Math.floor(((t - t0) / 1000) * this.fps) % this.anim.length]); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }
  face(dir: number) { this.el.style.transform = dir < 0 ? 'scaleX(-1)' : ''; }
  stop() { cancelAnimationFrame(this.raf); }
}

// ------------------------------------------------------------------ shell

interface Ctx { stage: HTMLElement; status(html: string): void; pet: Pet; b: BreedDef; view: PetView; quit: Promise<void>; done: boolean }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** Pick an activity for a pet (or play one directly). Resolves when she closes it. */
export function openCare(pet: Pet, first?: ActivityId): Promise<void> {
  return new Promise((resolve) => {
    const b = breed(pet.breed)!;
    const { root, close } = overlay('cv-layer');
    root.innerHTML = `<div class="pz-frame cv-frame">
      <header class="pz-top cv-top"><h2>🐾 ${esc(pet.name)}’s care & play</h2><span class="cv-sub"></span><button class="pz-exit" aria-label="Close">Done ✕</button></header>
      <main class="cv-main"></main></div>`;
    const main = root.querySelector('.cv-main') as HTMLElement;
    let quitFn: () => void = () => {};
    const leave = () => { quitFn(); window.removeEventListener('keydown', onKey, true); close(); afterChange(); resolve(); };
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); leave(); } };
    window.addEventListener('keydown', onKey, true);
    root.querySelector('.pz-exit')!.addEventListener('click', leave);

    const menu = () => {
      quitFn = () => {};
      const n = pet.needs;
      (root.querySelector('.cv-sub') as HTMLElement).textContent = `${PERSONALITIES[pet.personality].emoji} Loves: ${ACTIVITIES.find((a) => a.id === PERSONALITIES[pet.personality].loves)?.name ?? ''}`;
      main.innerHTML = `<div class="cv-menu">${ACTIVITIES.map((a) => {
        const low = a.need === 'clean' ? n.clean < 50 : a.need === 'nails' ? n.nails < 50 : a.need === 'joy' ? n.joy < 50 : false;
        const fav = PERSONALITIES[pet.personality].loves === a.id;
        return `<button class="cv-act" data-act="${a.id}"><span>${a.emoji}</span><b>${esc(a.name)}</b>${fav ? '<em>favourite ♡</em>' : low ? '<em class="need">needs it</em>' : ''}</button>`;
      }).join('')}</div>`;
      main.querySelectorAll<HTMLElement>('[data-act]').forEach((x) => x.addEventListener('click', () => { audio.sfx('click'); void run(x.dataset.act as ActivityId); }));
    };

    const run = async (id: ActivityId) => {
      const a = ACTIVITIES.find((x) => x.id === id)!;
      main.innerHTML = `<div class="cv-play"><p class="cv-how">${a.emoji} ${esc(a.how)}</p><div class="cv-status"></div><div class="cv-stage"></div></div>`;
      const stage = main.querySelector('.cv-stage') as HTMLElement;
      const view = new PetView(b, 2.4);
      let quitRes!: () => void;
      const quit = new Promise<void>((r) => (quitRes = r));
      const ctx: Ctx = { stage, status: (h) => { (main.querySelector('.cv-status') as HTMLElement).innerHTML = h; }, pet, b, view, quit, done: false };
      quitFn = () => { ctx.done = true; quitRes(); view.stop(); };
      const score = await Promise.race([GAMES[id](ctx), quit.then(() => -1)]);
      view.stop();
      if (score < 0 || ctx.done) return;
      ctx.done = true;
      const before = bondLevel(pet.bond);
      applyActivity(pet, id, score, Date.now());
      bumpStat(`care-${id}`);
      if (id === 'fetch') captureHomeMemory('first-pet-play');
      gainXp(10 + Math.round(score * 20), 'pet');
      store.save();
      result(a.emoji, a.name, score, bondLevel(pet.bond) > before);
    };

    const result = (emoji: string, name: string, score: number, heartUp: boolean) => {
      const stars = Math.max(1, Math.round(score * 3));
      const view = new PetView(b, 1.6);
      view.play('happy');
      main.innerHTML = `<div class="cv-result"><div class="cv-res-pet"></div><h3>${emoji} ${esc(name)}: ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</h3>
        <p>${esc(pick(score > 0.75 ? [`${pet.name} loved that!`, 'Best day ever!', `${pet.name} looks so proud.`] : [`${pet.name} had fun with you ♡`, 'That was nice. Again later?']))}</p>
        ${heartUp ? `<p class="cv-bond">💗 Your bond with ${esc(pet.name)} grew!</p>` : ''}
        <div class="pz-row"><button class="pz-btn ghost" data-more>Another activity</button><button class="pz-btn" data-end>Done</button></div></div>`;
      main.querySelector('.cv-res-pet')!.appendChild(view.el);
      if (score > 0.75 || heartUp) confetti(root);
      audio.sfx(heartUp ? 'levelup' : 'success');
      main.querySelector('[data-more]')!.addEventListener('click', () => { view.stop(); menu(); });
      main.querySelector('[data-end]')!.addEventListener('click', () => { view.stop(); leave(); });
    };

    if (first) void run(first); else menu();
  });
}

// ------------------------------------------------------------------ the activities (each resolves a 0..1 score)

type Game = (c: Ctx) => Promise<number>;
const pos = (e: PointerEvent, host: HTMLElement) => { const r = host.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }; };

const bath: Game = async (c) => {
  c.stage.classList.add('cv-bath');
  c.stage.innerHTML = '<div class="cv-tub"></div>';
  c.stage.appendChild(c.view.el);
  c.view.play('sit');
  const spots: HTMLElement[] = [];
  const box = () => c.view.el.getBoundingClientRect();
  for (let i = 0; i < 7; i++) {
    const s = el('i', 'cv-mud');
    s.style.left = `${24 + Math.random() * 52}%`; s.style.top = `${30 + Math.random() * 50}%`;
    c.view.el.appendChild(s); spots.push(s);
  }
  const sponge = el('div', 'cv-tool', '🧽');
  c.stage.appendChild(sponge);
  let phase: 'scrub' | 'rinse' = 'scrub';
  let rubbed = 0, bubbles = 0;
  const t0 = performance.now();
  c.status('Scrub the mud spots: <b>0</b> / 7');
  await new Promise<void>((done) => {
    let down = false;
    const move = (e: PointerEvent) => {
      const p = pos(e, c.stage);
      sponge.style.transform = `translate(${p.x - 24}px, ${p.y - 24}px)`;
      if (!down) return;
      const r = box();
      if (phase === 'scrub') {
        for (const s of spots) {
          if (s.dataset.clean) continue;
          const sr = s.getBoundingClientRect();
          if (Math.hypot(e.clientX - (sr.left + sr.width / 2), e.clientY - (sr.top + sr.height / 2)) < 34) {
            const hp = Number(s.dataset.hp ?? 6) - 1;
            s.dataset.hp = String(hp);
            s.style.opacity = String(hp / 6);
            if (hp <= 0) { s.dataset.clean = '1'; rubbed++; audio.sfx('squish'); c.status(`Scrub the mud spots: <b>${rubbed}</b> / 7`); }
          }
        }
        if (e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom && Math.random() < 0.35 && bubbles < 40) {
          const bub = el('i', 'cv-bubble'); bub.style.left = `${p.x - 10 + Math.random() * 20}px`; bub.style.top = `${p.y - 10 + Math.random() * 20}px`;
          bub.style.setProperty('--s', String(0.6 + Math.random() * 0.9)); c.stage.appendChild(bub); bubbles++;
        }
        if (rubbed >= 7) {
          phase = 'rinse'; sponge.textContent = '🚿'; audio.sfx('chime');
          c.status('Now hold and move the shower over the bubbles to rinse!');
        }
      } else {
        c.stage.querySelectorAll<HTMLElement>('.cv-bubble').forEach((bub) => {
          const br = bub.getBoundingClientRect();
          if (Math.hypot(e.clientX - (br.left + br.width / 2), e.clientY - (br.top + br.height / 2)) < 46) { bub.classList.add('pop'); setTimeout(() => bub.remove(), 250); }
        });
        if (Math.random() < 0.5) { const d = el('i', 'cv-drop'); d.style.left = `${p.x + Math.random() * 30 - 15}px`; d.style.top = `${p.y + 20}px`; c.stage.appendChild(d); setTimeout(() => d.remove(), 600); }
        if (Math.random() < 0.08) audio.sfx('water');
        if (!c.stage.querySelector('.cv-bubble:not(.pop)')) done();
      }
    };
    c.stage.addEventListener('pointerdown', (e) => { down = true; c.stage.setPointerCapture(e.pointerId); move(e); });
    c.stage.addEventListener('pointermove', move);
    c.stage.addEventListener('pointerup', () => { down = false; });
    void c.quit.then(done);
  });
  if (c.done) return 0;
  // Shake dry!
  sponge.remove();
  c.status(`${esc(c.pet.name)} shakes dry! 💦`);
  c.view.el.classList.add('cv-shake');
  for (let i = 0; i < 10; i++) { const d = el('i', 'cv-drop fly'); d.style.left = '50%'; d.style.top = '50%'; d.style.setProperty('--a', `${i * 36}deg`); c.stage.appendChild(d); }
  audio.sfx('water');
  await sleep(1300);
  c.view.el.classList.remove('cv-shake');
  c.view.play('happy');
  await sleep(500);
  const secs = (performance.now() - t0) / 1000;
  return Math.max(0.4, Math.min(1, 1.25 - secs / 60));
};

const nails: Game = async (c) => {
  c.stage.classList.add('cv-nails');
  const paw = el('div', 'cv-paw', `<div class="cv-pad"></div>${[0, 1, 2, 3].map((i) => `<div class="cv-claw" data-i="${i}"><i class="safe"></i><i class="quick"></i></div>`).join('')}`);
  c.stage.appendChild(paw);
  const clip = el('div', 'cv-clip');
  paw.appendChild(clip);
  const btn = el('button', 'pz-btn big cv-snip', '✂️ Snip!');
  c.stage.appendChild(btn);
  const wiggly = c.pet.personality === 'playful' || c.pet.personality === 'shy' ? 1.3 : 1;
  const scores: number[] = [];
  for (let i = 0; i < 4 && !c.done; i++) {
    c.status(`Claw <b>${i + 1}</b> of 4`);
    const claw = paw.querySelector<HTMLElement>(`[data-i="${i}"]`)!;
    claw.classList.add('on');
    const hit = await new Promise<number>((res) => {
      const t0 = performance.now();
      let raf = 0, posv = 0;
      const loop = (t: number) => {
        posv = (Math.sin(((t - t0) / 1000) * (2.2 + i * 0.35) * wiggly) + 1) / 2; // 0 = tip, 1 = too close
        // Ride along the claw itself: same scale as its green (25–55%) and pink (75%+) zones.
        clip.style.top = `${claw.offsetTop + posv * claw.offsetHeight - 3}px`;
        clip.style.left = `${claw.offsetLeft + claw.offsetWidth / 2 - 22}px`;
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      const snip = () => { cancelAnimationFrame(raf); btn.removeEventListener('click', snip); window.removeEventListener('keydown', key); res(posv); };
      const key = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); snip(); } };
      btn.addEventListener('click', snip);
      window.addEventListener('keydown', key);
      void c.quit.then(() => { cancelAnimationFrame(raf); res(0); });
    });
    // Green zone 0.25–0.55 is perfect; the very end (quick) makes them flinch.
    const s = hit >= 0.25 && hit <= 0.55 ? 1 : hit < 0.25 ? 0.55 : hit < 0.75 ? 0.6 : 0.2;
    scores.push(s);
    claw.classList.remove('on');
    claw.classList.add(s === 1 ? 'done' : 'meh');
    audio.sfx(s >= 0.6 ? 'chop' : 'fail');
    c.status(s === 1 ? 'Perfect snip ✨' : s > 0.5 ? 'A little long, but okay!' : `Eep! ${esc(c.pet.name)} flinched… gently next time.`);
    if (s < 0.5) { paw.classList.add('flinch'); setTimeout(() => paw.classList.remove('flinch'), 400); }
    await sleep(700);
  }
  return scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);
};

const brush: Game = async (c) => {
  c.stage.classList.add('cv-brushing');
  c.stage.appendChild(c.view.el);
  c.view.play('sit');
  const tool = el('div', 'cv-tool', '🪮');
  c.stage.appendChild(tool);
  const meter = el('div', 'cv-meter', '<b></b>');
  c.stage.appendChild(meter);
  let fill = 0, lastX = 0, dir = 0, strokes = 0;
  const t0 = performance.now();
  c.status('Brush back and forth over the fur');
  await new Promise<void>((done) => {
    let down = false;
    const move = (e: PointerEvent) => {
      const p = pos(e, c.stage);
      tool.style.transform = `translate(${p.x - 24}px, ${p.y - 24}px) rotate(${dir * 15}deg)`;
      if (!down) { lastX = p.x; return; }
      const r = c.view.el.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      const dx = p.x - lastX;
      lastX = p.x;
      const d = Math.sign(dx);
      if (d && d !== dir) { dir = d; strokes++; }
      fill = Math.min(1, fill + Math.abs(dx) / 2600);
      (meter.querySelector('b') as HTMLElement).style.width = `${fill * 100}%`;
      if (Math.random() < Math.abs(dx) / 120) {
        const f = el('i', 'cv-fluff'); f.style.left = `${p.x}px`; f.style.top = `${p.y}px`; f.style.setProperty('--dx', `${dx * 2}px`);
        f.style.background = `#${c.b.coat.toString(16).padStart(6, '0')}`;
        c.stage.appendChild(f); setTimeout(() => f.remove(), 900);
      }
      if (strokes % 6 === 5 && Math.random() < 0.05) { c.view.play('happy'); burstHearts(c.view.el, 3); setTimeout(() => c.view.play('sit'), 900); }
      if (fill >= 1) done();
    };
    c.stage.addEventListener('pointerdown', (e) => { down = true; c.stage.setPointerCapture(e.pointerId); lastX = pos(e, c.stage).x; });
    c.stage.addEventListener('pointermove', move);
    c.stage.addEventListener('pointerup', () => { down = false; });
    void c.quit.then(done);
  });
  c.view.play('happy');
  await sleep(700);
  const secs = (performance.now() - t0) / 1000;
  return Math.max(0.45, Math.min(1, 1.3 - secs / 40));
};

const petting: Game = async (c) => {
  c.stage.classList.add('cv-petting');
  c.stage.appendChild(c.view.el);
  c.view.play('sit');
  const cat = speciesOf(c.pet) === 'cat';
  // Sweet spots relative to the sitting pet (percent of its box); cats may have a belly trap.
  const spots = [{ x: 62, y: 30, n: 'head' }, { x: 74, y: 46, n: 'cheek' }, { x: 70, y: 58, n: 'chin' }, { x: 44, y: 52, n: 'back' }];
  const trap = cat && c.pet.personality !== 'cuddly' ? { x: 56, y: 76 } : null;
  let joy = 0, oops = 0, cur = 0;
  const glow = el('i', 'cv-glow');
  c.view.el.appendChild(glow);
  const place = () => { const s = spots[cur % spots.length]; glow.style.left = `${s.x}%`; glow.style.top = `${s.y}%`; };
  place();
  const meter = el('div', 'cv-meter purr', '<b></b>');
  c.stage.appendChild(meter);
  c.status(trap ? 'Rub the glowing spot… and maybe avoid the belly 👀' : 'Rub the glowing spot!');
  const end = performance.now() + 25_000;
  await new Promise<void>((done) => {
    let down = false;
    const move = (e: PointerEvent) => {
      if (!down) return;
      const r = c.view.el.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * 100, py = ((e.clientY - r.top) / r.height) * 100;
      const s = spots[cur % spots.length];
      if (Math.hypot(px - s.x, py - s.y) < 11) {
        joy += 0.012;
        if (Math.random() < 0.08) { const h = el('i', 'cv-heart', '♡'); h.style.left = `${e.clientX - c.stage.getBoundingClientRect().left}px`; h.style.top = `${e.clientY - c.stage.getBoundingClientRect().top}px`; c.stage.appendChild(h); setTimeout(() => h.remove(), 900); }
        if (joy > (cur + 1) * 0.25) { cur++; place(); audio.sfx('heart'); c.view.play('happy'); setTimeout(() => !c.done && c.view.play('sit'), 700); }
      } else if (trap && Math.hypot(px - trap.x, py - trap.y) < 12 && performance.now() > oops) {
        oops = performance.now() + 1200;
        joy = Math.max(0, joy - 0.08);
        audio.sfx('fail');
        c.status('BELLY TRAP! 😼 …okay, okay, no belly.');
        c.view.el.classList.add('cv-swat'); setTimeout(() => c.view.el.classList.remove('cv-swat'), 400);
      }
      (meter.querySelector('b') as HTMLElement).style.width = `${Math.min(1, joy) * 100}%`;
      if (joy >= 1 || performance.now() > end) done();
    };
    c.stage.addEventListener('pointerdown', (e) => { down = true; c.stage.setPointerCapture(e.pointerId); });
    c.stage.addEventListener('pointermove', move);
    c.stage.addEventListener('pointerup', () => { down = false; });
    const t = setInterval(() => { if (performance.now() > end) { clearInterval(t); done(); } }, 500);
    void c.quit.then(() => { clearInterval(t); done(); });
  });
  c.view.play('happy');
  audio.sfx('success');
  await sleep(700);
  return Math.min(1, 0.35 + joy * 0.65);
};

const fetchGame: Game = async (c) => {
  c.stage.classList.add('cv-fetch');
  const dog = speciesOf(c.pet) === 'dog';
  c.stage.appendChild(c.view.el);
  c.view.el.classList.add('cv-runner');
  const ball = el('div', 'cv-ball', dog ? '🎾' : '🧶');
  const target = el('div', 'cv-target');
  c.stage.append(target, ball);
  let total = 0;
  for (let i = 0; i < 4 && !c.done; i++) {
    const W = c.stage.clientWidth, H = c.stage.clientHeight;
    const homeX = 40;
    const tx = W * (0.45 + Math.random() * 0.4);
    target.style.left = `${tx - 40}px`;
    c.view.el.style.left = `${homeX}px`;
    c.view.face(1);
    c.view.play('sit');
    ball.style.transition = 'none';
    ball.style.left = `${homeX + 120}px`; ball.style.top = `${H - 140}px`;
    c.status(`Throw <b>${i + 1}</b> of 4: swipe toward the glowing spot →`);
    // Swipe to throw: longer swipes go further.
    const landX = await new Promise<number>((res) => {
      let start: { x: number; t: number } | null = null;
      const down = (e: PointerEvent) => { start = { x: pos(e, c.stage).x, t: performance.now() }; };
      const up = (e: PointerEvent) => {
        if (!start) return;
        const dx = pos(e, c.stage).x - start.x;
        if (dx < 20) { start = null; return; }
        c.stage.removeEventListener('pointerdown', down); c.stage.removeEventListener('pointerup', up);
        res(Math.min(W - 40, homeX + 120 + dx * 1.6));
      };
      c.stage.addEventListener('pointerdown', down);
      c.stage.addEventListener('pointerup', up);
      void c.quit.then(() => res(0));
    });
    if (c.done) break;
    audio.sfx('click');
    ball.style.transition = 'left .7s cubic-bezier(.3,.6,.4,1), top .7s cubic-bezier(.3,-0.9,.6,1)';
    ball.style.left = `${landX}px`; ball.style.top = `${H - 60}px`;
    await sleep(700);
    const d = Math.abs(landX - tx);
    const s = d < 45 ? 1 : d < 110 ? 0.7 : 0.4;
    total += s;
    c.status(s === 1 ? 'Perfect throw! ✨' : s > 0.5 ? 'Nice!' : 'Woops, a bit off. Still fun!');
    // Run, grab, run back.
    c.view.play('walk');
    c.view.el.style.transition = 'left .8s ease-in-out';
    c.view.el.style.left = `${landX - PET_W * 1.2}px`;
    await sleep(820);
    ball.style.transition = 'none';
    ball.style.opacity = '0';
    c.view.face(-1);
    c.view.el.style.left = `${homeX}px`;
    await sleep(820);
    ball.style.opacity = '1';
    c.view.el.style.transition = '';
    c.view.face(1);
    c.view.play('happy');
    audio.sfx(s === 1 ? 'success' : 'hit');
    if (s === 1) burstHearts(c.view.el, 5);
    await sleep(700);
  }
  return total / 4;
};

const treat: Game = async (c) => {
  c.stage.classList.add('cv-treats');
  c.stage.appendChild(c.view.el);
  c.view.play('sit');
  const t = el('div', 'cv-treat', speciesOf(c.pet) === 'dog' ? '🦴' : '🐟');
  c.stage.appendChild(t);
  const btn = el('button', 'pz-btn big cv-snip', 'Now! 🐾');
  c.stage.appendChild(btn);
  let total = 0;
  for (let i = 0; i < 5 && !c.done; i++) {
    c.status(`Treat <b>${i + 1}</b> of 5`);
    const hit = await new Promise<number>((res) => {
      const t0 = performance.now();
      const speed = 1.1 + i * 0.18;
      let raf = 0, x = 0;
      const W = c.stage.clientWidth;
      const loop = (now: number) => {
        x = ((now - t0) / 1000) * speed;            // 0..1 across the arc, wraps
        const u = x % 2 < 1 ? x % 1 : 1 - (x % 1);
        t.style.left = `${u * (W - 60)}px`;
        t.style.top = `${30 + Math.sin(u * Math.PI) * -10 + 30}px`;
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      const go = () => {
        cancelAnimationFrame(raf);
        btn.removeEventListener('click', go); window.removeEventListener('keydown', key);
        const pr = c.view.el.getBoundingClientRect(), tr = t.getBoundingClientRect();
        res(Math.abs((tr.left + tr.width / 2) - (pr.left + pr.width * 0.62)));
      };
      const key = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); go(); } };
      btn.addEventListener('click', go);
      window.addEventListener('keydown', key);
      void c.quit.then(() => { cancelAnimationFrame(raf); res(999); });
    });
    if (c.done) break;
    const s = hit < 30 ? 1 : hit < 70 ? 0.7 : 0.3;
    total += s;
    if (s >= 0.7) { c.view.play('eat'); audio.sfx('plop'); c.status(s === 1 ? 'Caught it mid-air! ✨' : 'Got it!'); }
    else { audio.sfx('fail'); c.status('Missed… it found it on the floor anyway 😋'); }
    await sleep(900);
    c.view.play('sit');
  }
  return total / 5;
};

const GAMES: Record<ActivityId, Game> = { bath, nails, brush, pet: petting, fetch: fetchGame, treat };

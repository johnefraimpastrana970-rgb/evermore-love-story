import type { DialogueChoice, DialogueLine, DialogueNode, MinigameId, Mood } from '../content/types';
import { DIALOGUE, HIM_CHATS, HIM_GREETINGS } from '../content/dialogue';
import { TALK_NODES, JOKES, TEASES, DEEP_TALKS } from '../content/talks';
import { hasArt } from '../art/characters';
import { OCCASION_DIALOGUE, OCCASIONS } from '../content/occasions';
import { store } from '../core/store';
import { bus } from '../core/events';
import { audio } from '../audio/audio';
import { applyEffects, ctx, hug, talk } from '../systems/game';
import { checkCondition, pickVariant } from '../systems/conditions';
import { portraitURL } from '../art/characters';
import { lookFor } from '../art/textures';
import { el, esc, richText, uiRoot } from './dom';
import { openGiftPicker } from './panels';
import { runMinigame } from './minigames';

let box: HTMLElement;
let active = false;

export function initDialogue() {
  box = el('div', 'dlg hidden');
  box.innerHTML = `
    <div class="dlg-portrait"><div class="breath"><img class="layer show" alt=""><img class="layer" alt=""></div></div>
    <div class="dlg-card">
      <div class="dlg-name"></div>
      <div class="dlg-text"></div>
      <div class="dlg-choices"></div>
      <div class="dlg-next">▼</div>
    </div>`;
  uiRoot().appendChild(box);
}

export function dialogueActive() {
  return active;
}

/** Cross-fade the portrait to a new picture (two stacked layers). */
function setPortrait(portrait: HTMLElement, src: string, instant: boolean) {
  const layers = portrait.querySelectorAll<HTMLImageElement>('.layer');
  const front = layers[0].classList.contains('show') ? layers[0] : layers[1];
  const back = front === layers[0] ? layers[1] : layers[0];
  if (front.getAttribute('src') === src) return;
  if (instant || !front.getAttribute('src')) {
    front.src = src;
    back.removeAttribute('src');
    return;
  }
  back.src = src;
  const swap = () => { back.classList.add('show'); front.classList.remove('show'); };
  // Wait for the new picture to decode so the fade never flashes empty.
  if (back.decode) back.decode().then(swap, swap); else swap();
}

/** Keep the portrait sitting on top of the card, whatever its height. */
function placePortrait() {
  const card = box.querySelector('.dlg-card') as HTMLElement;
  const portrait = box.querySelector('.dlg-portrait') as HTMLElement;
  const r = card.getBoundingClientRect();
  // Framed art overlaps the card a little; the chibi is clipped 22% at the bottom, so sink it by that much.
  // Cut-out art stands behind the card from the chest down; the chibi is clipped 22% at the bottom.
  const h = portrait.getBoundingClientRect().height;
  const sink = portrait.classList.contains('art') ? h * 0.36 : h * 0.22 + 4;
  portrait.style.bottom = `${Math.max(0, window.innerHeight - r.top - sink)}px`;
}

/** The real character behind a line (roles swap when playing as him, unless the node is literal). */
function whoFor(sp: DialogueLine['speaker'], literal: boolean): 'her' | 'him' | 'narrator' {
  if (sp === 'narrator') return sp;
  return literal ? sp : store.cast(sp);
}

/** Show a single line, resolves when the player advances. */
function showLine(line: DialogueLine, literal = false): Promise<void> {
  return new Promise((resolve) => {
    const portrait = box.querySelector('.dlg-portrait') as HTMLElement;
    const name = box.querySelector('.dlg-name') as HTMLElement;
    const text = box.querySelector('.dlg-text') as HTMLElement;
    const next = box.querySelector('.dlg-next') as HTMLElement;
    (box.querySelector('.dlg-choices') as HTMLElement).innerHTML = '';
    const who = whoFor(line.speaker, literal);
    box.dataset.speaker = who;
    box.dataset.side = who !== 'narrator' && who === store.partner() ? 'right' : 'left';
    if (who === 'narrator') {
      portrait.classList.add('hidden');
      portrait.dataset.who = '';
      portrait.dataset.src = '';
    } else {
      portrait.classList.remove('hidden');
      const mood = (line.mood ?? 'neutral') as Mood;
      bus.emit('dialogue:mood', { who, mood }); // the chibi in the world makes the same face
      const changedSpeaker = portrait.dataset.who !== who;
      portrait.dataset.who = who;
      portrait.dataset.mood = mood;
      // The player stands on the left, the partner on the right.
      portrait.classList.toggle('right', who === store.partner());
      portrait.classList.toggle('art', hasArt(who, mood));
      const src = portraitURL(lookFor(who), mood);
      const sameFace = !changedSpeaker && portrait.dataset.src === src;
      portrait.dataset.src = src;
      setPortrait(portrait, src, changedSpeaker);
      if (!sameFace) {
        portrait.classList.remove('pop', 'react');
        void portrait.offsetWidth;
        portrait.classList.add(changedSpeaker ? 'pop' : 'react');
      }
    }
    name.textContent = who === 'narrator' ? '' : store.nameOf(who);
    name.classList.toggle('hidden', who === 'narrator');
    const full = literal ? store.fmtLiteral(line.text) : store.fmt(line.text, line.asHim);
    const speed = store.settings.textSpeed;
    let shown = speed <= 0 ? full.length : 0;
    let timer: number | undefined;
    const render = () => { text.innerHTML = richText(full.slice(0, shown)); };
    const done = () => shown >= full.length;
    next.classList.toggle('hidden', !done());
    render();
    requestAnimationFrame(placePortrait);
    if (!done()) {
      timer = window.setInterval(() => {
        shown = Math.min(full.length, shown + 1);
        if (shown % 3 === 0 && line.speaker !== 'narrator') audio.sfx('type');
        render();
        if (done()) {
          clearInterval(timer);
          next.classList.remove('hidden');
        }
      }, 1000 / speed);
    }
    const t0 = performance.now();
    const advance = (e?: Event) => {
      e?.preventDefault();
      // Ignore the tail of the click/keypress that opened the dialogue.
      if (performance.now() - t0 < 220) return;
      if (!done()) {
        shown = full.length;
        clearInterval(timer);
        render();
        next.classList.remove('hidden');
        return;
      }
      cleanup();
      audio.sfx('click');
      resolve();
    };
    const onKey = (e: KeyboardEvent) => {
      if (['Space', 'Enter', 'KeyE', 'NumpadEnter'].includes(e.code)) advance(e);
    };
    const card = box; // the whole dialogue layer: tap anywhere to continue
    const cleanup = () => {
      card.removeEventListener('pointerup', advance);
      window.removeEventListener('keydown', onKey, true);
    };
    card.addEventListener('pointerup', advance);
    window.addEventListener('keydown', onKey, true);
  });
}

function showChoices(choices: DialogueChoice[]): Promise<DialogueChoice> {
  return new Promise((resolve) => {
    const host = box.querySelector('.dlg-choices') as HTMLElement;
    (box.querySelector('.dlg-next') as HTMLElement).classList.add('hidden');
    host.innerHTML = '';
    let idx = 0;
    const buttons = choices.map((c, i) => {
      const b = el('button', 'dlg-choice', `<span class="n">${i + 1}</span>${esc(store.fmt(c.text, c.asHim))}`);
      b.addEventListener('click', (e) => { e.stopPropagation(); pick(i); });
      b.addEventListener('pointerenter', () => focus(i));
      host.appendChild(b);
      return b;
    });
    const focus = (i: number) => {
      idx = (i + buttons.length) % buttons.length;
      buttons.forEach((b, j) => b.classList.toggle('focus', j === idx));
    };
    focus(0);
    requestAnimationFrame(placePortrait);
    const onKey = (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= buttons.length) { e.preventDefault(); pick(n - 1); }
      else if (['ArrowDown', 'KeyS'].includes(e.code)) { e.preventDefault(); focus(idx + 1); audio.sfx('click'); }
      else if (['ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); focus(idx - 1); audio.sfx('click'); }
      else if (['Enter', 'Space', 'KeyE'].includes(e.code)) { e.preventDefault(); pick(idx); }
    };
    const pick = (i: number) => {
      window.removeEventListener('keydown', onKey, true);
      audio.sfx('click');
      host.innerHTML = '';
      resolve(choices[i]);
    };
    window.addEventListener('keydown', onKey, true);
  });
}

/** Pick from a talk pool, preferring talks she hasn't seen yet. */
function pickTalk(pool: { id: string; if?: import('../content/types').Condition }[]): DialogueNode | null {
  const c = ctx();
  const s = store.state;
  const avail = pool.filter((p) => checkCondition(p.if, c) && TALK_NODES[p.id]);
  if (!avail.length) return null;
  const unseen = avail.filter((p) => !s.flags[`seen-${p.id}`]);
  const list = unseen.length ? unseen : avail;
  const pick = list[Math.floor(Math.random() * list.length)];
  s.flags[`seen-${pick.id}`] = true;
  return TALK_NODES[pick.id];
}

function resolveNode(id: string): DialogueNode | null {
  if (id === '__joke') return pickTalk(JOKES);
  if (id === '__tease') return pickTalk(TEASES);
  if (id === '__deep') return pickTalk(DEEP_TALKS);
  if (TALK_NODES[id]) return TALK_NODES[id];
  if (id === '__chat') {
    const c = ctx();
    const opts = HIM_CHATS.filter((x) => checkCondition(x.if, c));
    return opts.length ? opts[Math.floor(Math.random() * opts.length)].node : null;
  }
  if (id === '__hug') return hug() ? DIALOGUE['him-hug'] : DIALOGUE['him-hug-again'];
  if (OCCASION_DIALOGUE[id]) return { lines: OCCASION_DIALOGUE[id], literal: OCCASIONS.some((o) => o.literal && o.greeting === id) };
  return DIALOGUE[id] ?? null;
}

let hideTimer: number | undefined;
async function open() {
  if (!active) {
    active = true;
    store.block();
    clearTimeout(hideTimer);
    box.classList.remove('hidden', 'closing');
    requestAnimationFrame(() => box.classList.add('in'));
  }
}
function close() {
  active = false;
  store.unblock();
  // Fade out instead of vanishing.
  box.classList.remove('in');
  box.classList.add('closing');
  clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    box.classList.add('hidden');
    box.classList.remove('closing');
    const p = box.querySelector('.dlg-portrait') as HTMLElement;
    p.dataset.who = '';
    p.dataset.src = '';
  }, 240);
  bus.emit('dialogue:end');
}

/** Play a dialogue by id (or a node). Follows `next` chains and choices. */
export async function playDialogue(start: string | DialogueNode): Promise<void> {
  if (active) return;
  await open();
  try {
    let node: DialogueNode | null = typeof start === 'string' ? resolveNode(start) : start;
    let guard = 0;
    while (node && guard++ < 50) {
      for (const line of node.lines) {
        const greeting = line.text === '{greeting}';
        const text = greeting ? pickVariant(HIM_GREETINGS, ctx())?.text ?? 'Hey.' : line.text;
        await showLine(greeting ? { ...line, text, asHim: undefined } : line, !!node.literal);
      }
      applyEffects(node.effects);
      let nextId = node.next;
      if (node.choices?.length) {
        const c = ctx();
        const avail = node.choices.filter((ch) => checkCondition(ch.if, c));
        if (avail.length) {
          const choice = await showChoices(avail);
          applyEffects(choice.effects);
          if (choice.action) {
            close();
            await runChoiceAction(choice.action, choice.arg);
            return;
          }
          nextId = choice.next;
        }
      }
      node = nextId ? resolveNode(nextId) : null;
      // Lets world animations react to story choices (e.g. "Higher!" on the swing).
      if (nextId && node) bus.emit('dialogue:node', nextId);
    }
  } finally {
    if (active) close();
  }
}

async function runChoiceAction(action: NonNullable<DialogueChoice['action']>, arg?: string) {
  switch (action) {
    case 'gift': await openGiftPicker(); break;
    case 'minigame': await runMinigame(arg as MinigameId); break;
    case 'sleep': sleepUntil(arg ?? 'real'); break;
    case 'travel': bus.emit('travel', { to: arg }); break;
  }
}

export function sleepUntil(arg: string) {
  if (arg === 'real') store.updateSettings({ timeMode: 'real' });
  else store.updateSettings({ timeMode: 'manual', manualTime: arg as any });
  bus.emit('sleep');
}

export function narrate(text: string) {
  return playDialogue({ lines: [{ speaker: 'narrator', text }] });
}

export async function talkToHim() {
  talk();
  await playDialogue('him-root');
}

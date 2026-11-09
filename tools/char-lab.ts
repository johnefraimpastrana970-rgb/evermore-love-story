/* Dev-only character lab: every face, outfit and animation of the chibi rig on one page (never part of a build). */
import { buildHeadSheet, buildSpriteSheet, drawCharacter, FRAME_H, FRAME_W, FRAMES, type Look, type Pose } from '../src/art/characters';
import { FACES, HEAD_RES, HER_STYLES, HIS_STYLES, type Face } from '../src/art/chibi/spec';

const root = document.getElementById('root')!;
const params = new URLSearchParams(location.search);
const zoom = Number(params.get('zoom') ?? 1.6);

const HER: Look = { who: 'her', hair: 0x2c1b22, outfit: 0xfbf3f4, accent: 0xf4a3bb, style: 'tee', acc: 'bow' };
const HIM: Look = { who: 'him', hair: 0x1b1418, outfit: 0x2a252e, accent: 0xffffff, style: 'raglan' };
const OUTFIT_COLOR: Record<string, number> = {
  tee: 0xfbf3f4, dress: 0xe8738f, pajama: 0xcfe0f6, sweater: 0xf3e3c6, cardigan: 0xd99a5b, gown: 0x3a2f6e,
  raglan: 0x2a252e, hoodie: 0x34466e, shirt: 0xeef0f4, formal: 0x3a3046,
};

function section(title: string) {
  const h = document.createElement('h2');
  h.textContent = title;
  const row = document.createElement('div');
  row.className = 'row';
  root.append(h, row);
  return row;
}

function figure(row: HTMLElement, caption: string, draw: (ctx: CanvasRenderingContext2D) => void, w = FRAME_W, h = FRAME_H, z = zoom) {
  const f = document.createElement('figure');
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * z); c.height = Math.ceil(h * z);
  const ctx = c.getContext('2d')!;
  ctx.scale(z, z);
  draw(ctx);
  const cap = document.createElement('figcaption');
  cap.textContent = caption;
  f.append(c, cap);
  row.append(f);
}

const only = params.get('only');
const want = (k: string) => !only || only.split(',').includes(k);

if (want('faces')) {
  for (const look of [HER, HIM]) {
    const row = section(`${look.who === 'her' ? 'Her' : 'His'} faces`);
    for (const face of FACES) {
      figure(row, face, (ctx) => { ctx.translate(0, 10); drawCharacter(ctx, look, { face }); }, FRAME_W, 120, zoom * 1.3);
    }
  }
}

if (want('outfits')) {
  for (const [base, styles] of [[HER, HER_STYLES], [HIM, HIS_STYLES]] as const) {
    const row = section(`${base.who === 'her' ? 'Her' : 'His'} outfits`);
    for (const style of styles) {
      const look = { ...base, style, outfit: OUTFIT_COLOR[style] } as Look;
      figure(row, style, (ctx) => drawCharacter(ctx, look, { face: 'smiling' }));
    }
    if (base.who === 'her') figure(row, 'crown + honey hair', (ctx) => drawCharacter(ctx, { ...base, style: 'dress', outfit: 0x9fd8a4, acc: 'crown', accent: 0xc8324a, hair: 0xc08a4a }, { face: 'happy' }));
  }
}

if (want('anims')) {
  for (const look of [HER, HIM]) {
    const sheet = buildSpriteSheet(look);
    const strips: [string, number[], Face][] = [['walk', FRAMES.walk, 'smiling'], ['run', FRAMES.run, 'happy'], ['sit', FRAMES.sit, 'blushing'], ['eat', FRAMES.eat, 'eating']];
    for (const [name, frames, face] of strips) {
      const row = section(`${look.who} ${name}`);
      for (const i of frames) {
        const a = sheet.anchors[i];
        figure(row, `${i}`, (ctx) => {
          ctx.drawImage(sheet.canvas, (i % sheet.cols) * sheet.w, Math.floor(i / sheet.cols) * FRAME_H, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H);
          // head on its anchor, like the HeadRig does in the world
          const head = buildHeadSheet(look, face);
          const hw = head.width / 3;
          ctx.save();
          ctx.translate(60 + a.x, FRAME_H + a.y);
          ctx.rotate(a.rot);
          ctx.drawImage(head, a.bite ? hw * 2 : 0, 0, hw, head.height, -60, -104, FRAME_W, head.height / HEAD_RES);
          ctx.restore();
        }, FRAME_W, FRAME_H, 1);
      }
    }
  }
}

if (want('pose')) {
  const row = section('Composite poses');
  const poses: [string, Look, Pose][] = [
    ['hold hands', HER, { armR: 0.4, face: 'shy' }],
    ['hug', HIM, { armR: 1.15, face: 'happy' }],
    ['sit (pajama)', { ...HER, style: 'pajama', outfit: 0xcfe0f6 }, { sit: true, face: 'asleep' }],
    ['sit (dress)', { ...HER, style: 'dress', outfit: 0xe8738f }, { sit: true, face: 'blushing' }],
    ['sit (him)', HIM, { sit: true, face: 'smiling' }],
  ];
  for (const [cap, look, pose] of poses) figure(row, cap, (ctx) => drawCharacter(ctx, look, pose));
}

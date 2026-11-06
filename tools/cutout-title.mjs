// Usage: node tools/cutout-title.mjs <projectDir> [--debug]
// Cuts the couple illustration ("art src/title-couple.jpg") out of its lavender gradient background and writes a
// transparent WebP to public/assets/art/title-couple.webp for the title screen.
// How: the background is a soft vertical gradient and the figures have dark outlines, so we flood-fill the
// background in from the image border (matching the gradient row by row; the outlines stop the fill), clear enclosed
// background pockets, then soften the edge and remove the lavender halo from edge pixels ("un-mixing" the colour).
// Uses the Microsoft Edge already on Windows (via playwright-core) for canvas work, like tools/process-art.mjs.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const projectDir = path.resolve(args.find((a) => !a.startsWith('--')) ?? '.');
const debug = args.includes('--debug');
const require = createRequire(path.join(projectDir, 'package.json'));
const { chromium } = require('playwright-core');

const src = path.join(projectDir, 'art src', 'title-couple.jpg');
const outDir = path.join(projectDir, 'public', 'assets', 'art');
fs.mkdirSync(outDir, { recursive: true });
const b64 = fs.readFileSync(src).toString('base64');

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
const res = await page.evaluate(async ({ b64, debug }) => {
  const img = new Image();
  img.src = 'data:image/jpeg;base64,' + b64;
  await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight, N = W * H;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, W, H);
  const d = data.data;

  // Background colour per row (the gradient), from the left and right borders.
  const bgRow = [];
  for (let y = 0; y < H; y++) {
    const acc = [0, 0, 0]; let n = 0;
    for (const x0 of [2, W - 14]) for (let x = x0; x < x0 + 12; x++) { const i = (y * W + x) * 4; acc[0] += d[i]; acc[1] += d[i + 1]; acc[2] += d[i + 2]; n++; }
    bgRow.push(acc.map((v) => v / n));
  }
  // Smooth it vertically (JPEG noise).
  const bg = bgRow.map((_, y) => { const a = [0, 0, 0]; let n = 0; for (let k = Math.max(0, y - 6); k <= Math.min(H - 1, y + 6); k++) { a[0] += bgRow[k][0]; a[1] += bgRow[k][1]; a[2] += bgRow[k][2]; n++; } return a.map((v) => v / n); });
  const dist = (p) => { const i = p * 4, b = bg[(p / W) | 0]; return Math.hypot(d[i] - b[0], d[i + 1] - b[1], d[i + 2] - b[2]); };

  // 1) Flood fill from the border over background-coloured pixels.
  const T = 20;
  const isBg = new Uint8Array(N);
  const q = new Int32Array(N);
  let qh = 0, qt = 0;
  const push = (p) => { if (!isBg[p] && dist(p) < T) { isBg[p] = 1; q[qt++] = p; } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (qh < qt) {
    const p = q[qh++], x = p % W;
    if (x > 0) push(p - 1); if (x < W - 1) push(p + 1);
    if (p >= W) push(p - W); if (p < N - W) push(p + W);
  }
  // 2) Enclosed pockets (e.g. between an arm and the body): large components of near-exact background colour.
  const seen = new Uint8Array(N);
  let pockets = 0;
  for (let p0 = 0; p0 < N; p0++) {
    if (isBg[p0] || seen[p0] || dist(p0) >= 10) continue;
    const comp = []; const st = [p0]; seen[p0] = 1;
    while (st.length) {
      const p = st.pop(); comp.push(p);
      const x = p % W;
      for (const n of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
        if (n < 0 || n >= N || seen[n] || isBg[n] || dist(n) >= 12) continue;
        seen[n] = 1; st.push(n);
      }
    }
    if (comp.length > 350) { for (const p of comp) isBg[p] = 1; pockets++; }
  }

  // 3) Alpha with a soft edge, and un-mix the lavender out of edge pixels.
  const out = ctx.createImageData(W, H);
  const o = out.data;
  // Distance (in px, up to 3) from the background, for foreground pixels.
  const near = new Uint8Array(N).fill(9);
  for (let p = 0; p < N; p++) if (isBg[p]) near[p] = 0;
  for (let pass = 1; pass <= 3; pass++) for (let p = 0; p < N; p++) {
    if (near[p] !== 9) continue;
    const x = p % W;
    if ((x > 0 && near[p - 1] === pass - 1) || (x < W - 1 && near[p + 1] === pass - 1) || (p >= W && near[p - W] === pass - 1) || (p < N - W && near[p + W] === pass - 1)) near[p] = pass;
  }
  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (let p = 0; p < N; p++) {
    const i = p * 4;
    if (isBg[p]) { o[i + 3] = 0; continue; }
    let a = 1;
    if (near[p] <= 2) {
      // Edge: how far the colour is from the background decides how opaque it is.
      a = Math.max(0, Math.min(1, (dist(p) - 9) / 72));
      if (near[p] === 2) a = Math.max(a, 0.9);
      // A pale, colourless rim right at the edge is a JPEG/sticker halo, not part of the drawing: fade it out.
      const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
      if (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2] > 205 && mx - mn < 30) a *= near[p] === 1 ? 0.15 : 0.45;
    }
    const b = bg[(p / W) | 0];
    for (let k = 0; k < 3; k++) {
      const v = a > 0.02 ? (d[i + k] - (1 - a) * b[k]) / a : d[i + k];
      o[i + k] = Math.max(0, Math.min(255, Math.round(v)));
    }
    o[i + 3] = Math.round(a * 255);
    if (a > 0.1) { const x = p % W, y = (p / W) | 0; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  // Remove specks: tiny opaque islands surrounded by transparency.
  ctx.putImageData(out, 0, 0);
  const pad = 6;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad); maxX = Math.min(W - 1, maxX + pad); maxY = Math.min(H - 1, maxY + pad);
  const cw = maxX - minX + 1, chh = maxY - minY + 1;
  const crop = document.createElement('canvas'); crop.width = cw; crop.height = chh;
  crop.getContext('2d').drawImage(c, minX, minY, cw, chh, 0, 0, cw, chh);
  const webp = crop.toDataURL('image/webp', 0.94);
  // Debug previews on dark and light backgrounds.
  const prev = (bgc) => { const pc = document.createElement('canvas'); pc.width = cw; pc.height = chh; const g = pc.getContext('2d'); g.fillStyle = bgc; g.fillRect(0, 0, cw, chh); g.drawImage(crop, 0, 0); return pc.toDataURL('image/png'); };
  return { webp, W, H, cw, chh, pockets, dark: debug ? prev('#2b1e3a') : null, pink: debug ? prev('#ff7aa2') : null };
}, { b64, debug });
await browser.close();

const save = (file, url) => fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
save(path.join(outDir, 'title-couple.webp'), res.webp);
if (debug) {
  const dbg = path.join(projectDir, 'tools', 'shots');
  fs.mkdirSync(dbg, { recursive: true });
  save(path.join(dbg, 'title-couple-dark.png'), res.dark);
  save(path.join(dbg, 'title-couple-pink.png'), res.pink);
}
console.log(`source ${res.W}×${res.H} → cutout ${res.cw}×${res.chh}, ${res.pockets} enclosed pocket(s) cleared → public/assets/art/title-couple.webp`);

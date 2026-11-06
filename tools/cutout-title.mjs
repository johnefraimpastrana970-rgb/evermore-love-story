// Usage: node tools/cutout-title.mjs <projectDir> [--debug]
// Cuts the couple illustration ("art src/title-couple.jpg") out of its lavender gradient background and writes a
// transparent WebP to src/assets/art/title-couple.webp for the title screen (imported, so builds get a fresh hashed name).
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
const outDir = path.join(projectDir, 'src', 'assets', 'art');
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

  // 3) Matting. Hair is dark, the background is lavender: a pixel whose colour lies on the line between black and
  //    the background is a mix of the two, and t = how much background is in it. That gives a soft, halo-free edge.
  const out = ctx.createImageData(W, H);
  const o = out.data;
  const mix = (p) => {
    const i = p * 4, b = bg[(p / W) | 0];
    const t = (d[i] * b[0] + d[i + 1] * b[1] + d[i + 2] * b[2]) / (b[0] * b[0] + b[1] * b[1] + b[2] * b[2]);
    const res = Math.hypot(d[i] - t * b[0], d[i + 1] - t * b[1], d[i + 2] - t * b[2]);
    return { t, res };
  };
  // Distance (in px, up to 48) from the background, for foreground pixels.
  const MAXD = 48;
  const near = new Uint8Array(N).fill(255);
  {
    let cur = [];
    for (let p = 0; p < N; p++) if (isBg[p]) { near[p] = 0; cur.push(p); }
    for (let k = 1; k <= MAXD && cur.length; k++) {
      const next = [];
      for (const p of cur) {
        const x = p % W;
        for (const n of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) if (n >= 0 && n < N && near[n] === 255) { near[n] = k; next.push(n); }
      }
      cur = next;
    }
  }
  // Pale gaps between hair strands: small light components (close to the background colour) near the outline.
  // Big light areas (her tee, his sleeves) are one large component each and are left alone.
  const gap = new Uint8Array(N);
  const lightLike = (p) => {
    if (isBg[p]) return false;
    const i = p * 4;
    if (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2] < 115) return false;
    const m = mix(p);
    return m.res < 22 && m.t > 0.45 && m.t < 1.12;
  };
  const vis = new Uint8Array(N);
  let gaps = 0;
  // Is n part of the component being examined? (light pixels reached from it are all in comp)
  const gapOf = (n) => lightLike(n) && vis[n] === 1;
  for (let p0 = 0; p0 < N; p0++) {
    if (vis[p0] || near[p0] > MAXD || !lightLike(p0)) continue;
    const comp = []; const st = [p0]; vis[p0] = 1;
    let minNear = 255;
    // Explore the whole region (a big one like the tee or a sleeve must be seen whole, or its leftovers look like gaps).
    while (st.length) {
      const p = st.pop(); comp.push(p); if (near[p] < minNear) minNear = near[p];
      const x = p % W;
      for (const n of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) if (n >= 0 && n < N && !vis[n] && lightLike(n)) { vis[n] = 1; st.push(n); }
    }
    if (comp.length < 1200 && minNear <= 40) {
      // A real hair gap is surrounded by dark hair (or background); a plaid square or a highlight is not.
      let edge = 0, darkish = 0;
      for (const p of comp) {
        const x = p % W;
        for (const n of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
          if (n < 0 || n >= N || gapOf(n, comp)) continue;
          edge++;
          const j = n * 4;
          if (isBg[n] || 0.3 * d[j] + 0.59 * d[j + 1] + 0.11 * d[j + 2] < 85) darkish++;
        }
      }
      if (edge && darkish / edge >= 0.6) { for (const p of comp) gap[p] = 1; gaps++; }
    }
  }

  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (let p = 0; p < N; p++) {
    const i = p * 4;
    if (isBg[p]) { o[i + 3] = 0; continue; }
    const b = bg[(p / W) | 0];
    let a = 1;
    let unmixDark = false;
    const m = mix(p);
    const L = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    const sat = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
    if (near[p] <= 3 && L > 185 && sat < 45) {
      // A pale, colourless speck right at the outline is leftover background/halo, not drawing.
      a = 0;
    } else if (gap[p] || (near[p] <= 3 && m.res < 16 && m.t > 0.08)) {
      // Hair (or any dark line) mixed with background: keep only the dark part.
      a = Math.max(0, Math.min(1, (1 - m.t) * 1.08));
      if (gap[p] && m.t > 0.82) a = 0;
      unmixDark = true;
    } else if (near[p] <= 2) {
      // Other edges (skin, clothes): how far the colour is from the background decides how opaque it is.
      a = Math.max(0, Math.min(1, (dist(p) - 9) / 72));
      if (near[p] === 2) a = Math.max(a, 0.9);
    }
    for (let k = 0; k < 3; k++) {
      let v;
      if (unmixDark) v = a > 0.02 ? (d[i + k] - m.t * b[k]) / Math.max(0.05, 1 - m.t) : 0;
      else v = a > 0.02 ? (d[i + k] - (1 - a) * b[k]) / a : d[i + k];
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
  return { webp, W, H, cw, chh, pockets: `${pockets} enclosed pocket(s), ${gaps} hair gap(s)`, dark: debug ? prev('#2b1e3a') : null, pink: debug ? prev('#ff7aa2') : null };
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
console.log(`source ${res.W}×${res.H} → cutout ${res.cw}×${res.chh}, ${res.pockets} enclosed pocket(s) cleared → src/assets/art/title-couple.webp`);

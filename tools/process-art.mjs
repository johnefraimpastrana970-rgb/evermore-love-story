// Usage: node tools/process-art.mjs <projectDir> [her|him] [--debug]
// Reads "gf assets/" (her) or "bf assets/" (him), removes the lavender background (plus doodles, label pills and the
// white sticker border), crops a portrait + avatar, and writes transparent WebP files into
// public/assets/characters/<her|him>/. File names like "cryingbf.jpg" become "crying.webp".
// Uses the Microsoft Edge already installed on Windows (via playwright-core) for fast canvas processing.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const args = process.argv.slice(2);
const projectDir = path.resolve(args.find((a) => !a.startsWith('--') && a !== 'her' && a !== 'him') ?? '.');
const who = args.includes('him') ? 'him' : 'her';
const debug = args.includes('--debug');
const require = createRequire(path.join(projectDir, 'package.json'));
const { chromium } = require('playwright-core');

/*
 * Per-character colour profile.
 *  her: background (246,236,247) is almost neutral lavender; her tee is warm (r > b) – loose thresholds are safe.
 *  him: background (239,234,254) is clearly blue; his hoodie sleeves are pale grey-mauve (216,203,214, b ≈ r),
 *       so "background" must be distinctly blue-shifted or the sleeves would be erased.
 */
const PROFILES = {
  her: { src: 'gf assets', lavBR: -4, lavL: 212, tintBR: -2, rimL: 222, rimGR: 9, rimLike: { L: 212, br: 6, gr: 12 } },
  him: { src: 'bf assets', lavBR: 6, lavL: 214, tintBR: 8, rimL: 232, rimGR: 6, rimLike: { L: 230, br: 5, gr: 7 } },
};
const prof = PROFILES[who];

const srcDir = path.join(projectDir, prof.src);
const outDir = path.join(projectDir, 'public', 'assets', 'characters', who);
const dbgDir = path.join(projectDir, 'tools', 'shots');
fs.mkdirSync(outDir, { recursive: true });
if (debug) fs.mkdirSync(dbgDir, { recursive: true });
const files = fs.readdirSync(srcDir).filter((f) => /\.(jpe?g|png)$/i.test(f));

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
const report = [];
for (const f of files) {
  const mood = f.split('.')[0].toLowerCase().replace(/[-_ ]?(bf|gf)$/, '');
  const b64 = fs.readFileSync(path.join(srcDir, f)).toString('base64');
  const mime = /png$/i.test(f) ? 'image/png' : 'image/jpeg';
  const res = await page.evaluate(async ({ b64, mime, debug, prof }) => {
    const img = new Image();
    img.src = `data:${mime};base64,` + b64;
    await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, W, H);
    const d = data.data;
    const N = W * H;
    const luma = (i) => 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];

    // --- Panel bounds (the lavender sticker sits inside a white page).
    const colNonWhite = (x) => { let n = 0; for (let y = 200; y < H - 50; y += 8) { const i = (y * W + x) * 4; if (d[i] < 246 || d[i + 1] < 246 || d[i + 2] < 246) n++; } return n; };
    let left = 0, right = W - 1;
    while (left < W && colNonWhite(left) < 20) left++;
    while (right > 0 && colNonWhite(right) < 20) right--;

    // --- Background colour: median-ish of panel border samples.
    const samples = [];
    for (let y = 40; y < H - 40; y += 20) for (const x of [left + 6, right - 6]) { const i = (y * W + x) * 4; samples.push([d[i], d[i + 1], d[i + 2]]); }
    samples.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
    const BG = samples[Math.floor(samples.length / 2)];
    const dist = (i) => Math.hypot(d[i] - BG[0], d[i + 1] - BG[1], d[i + 2] - BG[2]);

    // --- Classify pixels.
    // 0 = keep, 1 = removable (bg family / doodles), 2 = strict bg (for enclosed holes)
    const cls = new Uint8Array(N);
    for (let p = 0; p < N; p++) {
      const x = p % W;
      const i = p * 4;
      if (x < left || x > right) { cls[p] = 2; continue; }               // white page outside the panel
      const r = d[i], g = d[i + 1], b = d[i + 2], L = luma(i);
      const lavender = b - r >= prof.lavBR && b - g >= 5 && L >= prof.lavL;  // background & its soft shading
      const white = r > 240 && g > 240 && b > 240 && b - r >= -3;            // speech bubbles / pill text / sticker rim
      const tinted = b - g >= 12 && b - r >= prof.tintBR && L > 88;          // doodles, hearts, label pills and their glow
      const rim = L >= prof.rimL && Math.abs(b - r) <= 4 && Math.abs(g - r) <= prof.rimGR; // die-cut sticker border
      if (lavender || white || tinted || rim) cls[p] = dist(i) < 9 ? 2 : 1;
    }

    // --- Flood fill from top / left / right edges (not bottom: the crop cuts through her shirt there).
    const removed = new Uint8Array(N);
    const stack = new Int32Array(N);
    let sp = 0;
    const seed = (p) => { if (cls[p] && !removed[p]) { removed[p] = 1; stack[sp++] = p; } };
    for (let x = 0; x < W; x++) seed(x);
    for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); seed(y * W + left); seed(y * W + right); }
    while (sp > 0) {
      const p = stack[--sp];
      const x = p % W, y = (p - x) / W;
      if (x > 0) seed(p - 1);
      if (x < W - 1) seed(p + 1);
      if (y > 0) seed(p - W);
      if (y < H - 1) seed(p + W);
    }

    // --- Sticker border: a thin dark cut-line, then a white band, then the figure.
    // Second flood: start from light-neutral pixels within 6px of removed area and spread through the white band.
    const rimLike = (p) => {
      const i = p * 4, r = d[i], g = d[i + 1], b = d[i + 2], L = luma(i);
      return L >= prof.rimLike.L && Math.abs(b - r) <= prof.rimLike.br && Math.abs(g - r) <= prof.rimLike.gr;
    };
    const band = new Uint8Array(N);
    {
      // distance-limited dilation of the removed mask (6 iterations of 4-neighbour growth)
      let frontier = [];
      for (let p = 0; p < N; p++) if (removed[p]) { band[p] = 1; }
      for (let p = 0; p < N; p++) if (removed[p]) frontier.push(p);
      for (let it = 0; it < 6; it++) {
        const next = [];
        for (const p of frontier) {
          const x = p % W, y = (p - x) / W;
          for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
            if (q >= 0 && !band[q]) { band[q] = 1; next.push(q); }
          }
        }
        frontier = next;
      }
    }
    const removed2 = new Uint8Array(N);
    sp = 0;
    for (let p = 0; p < N; p++) if (band[p] && !removed[p] && rimLike(p)) { removed2[p] = 1; stack[sp++] = p; }
    while (sp > 0) {
      const p = stack[--sp];
      const x = p % W, y = (p - x) / W;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
        if (q >= 0 && !removed[q] && !removed2[q] && rimLike(q)) { removed2[q] = 1; stack[sp++] = q; }
      }
    }
    for (let p = 0; p < N; p++) if (removed2[p]) removed[p] = 1;
    // White slivers trapped between outer hair strands: small light-neutral pockets near the edge.
    {
      const near = new Uint8Array(N);
      let frontier = [];
      for (let p = 0; p < N; p++) if (removed[p]) { near[p] = 1; frontier.push(p); }
      for (let it = 0; it < 22; it++) {
        const next = [];
        for (const p of frontier) {
          const x = p % W, y = (p - x) / W;
          for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
            if (q >= 0 && !near[q]) { near[q] = 1; next.push(q); }
          }
        }
        frontier = next;
      }
      const seenR = new Uint8Array(N);
      for (let p0 = 0; p0 < N; p0++) {
        if (!near[p0] || removed[p0] || seenR[p0] || !rimLike(p0)) continue;
        const comp = [];
        let s4 = 0;
        stack[s4++] = p0; seenR[p0] = 1;
        let inside = true;
        while (s4 > 0) {
          const p = stack[--s4];
          comp.push(p);
          if (!near[p]) inside = false;
          const x = p % W, y = (p - x) / W;
          for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
            if (q >= 0 && !removed[q] && !seenR[q] && rimLike(q)) { seenR[q] = 1; stack[s4++] = q; }
          }
        }
        if (inside && comp.length < 4000) for (const p of comp) removed[p] = 1;
      }
    }
    // Erase the thin cut-line left sandwiched between removed areas (medium tones only; hair is darker).
    for (let pass = 0; pass < 2; pass++) {
      const kill = [];
      for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
        const p = y * W + x;
        if (removed[p] || luma(p * 4) < 95) continue;
        let n = 0;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) n += removed[p + dy * W + dx];
        if (n >= 30) kill.push(p);
      }
      for (const p of kill) removed[p] = 1;
    }

    // --- Enclosed background pockets (e.g. between arm and head): strict-bg components above a size.
    const seen = new Uint8Array(N);
    let pockets = 0;
    for (let p0 = 0; p0 < N; p0++) {
      if (!cls[p0] || removed[p0] || seen[p0]) continue;
      const comp = [];
      let s2 = 0;
      stack[s2++] = p0; seen[p0] = 1;
      while (s2 > 0) {
        const p = stack[--s2];
        comp.push(p);
        const x = p % W, y = (p - x) / W;
        for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
          if (q >= 0 && !seen[q] && cls[q] >= 1 && !removed[q]) { seen[q] = 1; stack[s2++] = q; }
        }
      }
      // Only remove pockets that are mostly true background colour (not shirt highlights).
      let strict = 0, br = 0, lum = 0;
      for (const p of comp) { if (cls[p] === 2) strict++; br += d[p * 4 + 2] - d[p * 4]; lum += luma(p * 4); }
      const ratio = strict / comp.length, avgBR = br / comp.length, avgL = lum / comp.length;
      // Mostly exact background colour, OR shaded background that is still clearly blue and light on average
      // (never sleeves, skin, shirt or hair).
      if (comp.length > 350 && (ratio > 0.6 || (avgBR >= prof.lavBR + 1 && avgL >= 205))) { for (const p of comp) removed[p] = 1; pockets++; }
    }

    // Stray strip of the neighbouring sticker at the very top of some images.
    for (let p = 0; p < W * 12; p++) removed[p] = 1;

    // Drop small floating islands (doodle specks); keep only big pieces (the figure).
    const lab = new Uint8Array(N);
    for (let p0 = 0; p0 < N; p0++) {
      if (removed[p0] || lab[p0]) continue;
      const comp = [];
      let s3 = 0;
      stack[s3++] = p0; lab[p0] = 1;
      while (s3 > 0) {
        const p = stack[--s3];
        comp.push(p);
        const x = p % W, y = (p - x) / W;
        if (x > 0 && !removed[p - 1] && !lab[p - 1]) { lab[p - 1] = 1; stack[s3++] = p - 1; }
        if (x < W - 1 && !removed[p + 1] && !lab[p + 1]) { lab[p + 1] = 1; stack[s3++] = p + 1; }
        if (y > 0 && !removed[p - W] && !lab[p - W]) { lab[p - W] = 1; stack[s3++] = p - W; }
        if (y < H - 1 && !removed[p + W] && !lab[p + W]) { lab[p + W] = 1; stack[s3++] = p + W; }
      }
      if (comp.length < 2500) for (const p of comp) removed[p] = 1;
    }

    // --- Alpha with soft, defringed edges.
    const alpha = new Float32Array(N);
    for (let p = 0; p < N; p++) alpha[p] = removed[p] ? 0 : 1;
    const Lbg = 0.3 * BG[0] + 0.59 * BG[1] + 0.11 * BG[2];
    // Pixels touching the removed area: opacity comes from how dark (outline) or how warm (skin/shirt) they are,
    // so light lavender/white fringe fades out instead of becoming a white rim.
    for (let p = 0; p < N; p++) {
      if (removed[p]) continue;
      const x = p % W, y = (p - x) / W;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && xx < W && yy >= 0 && yy < H && removed[yy * W + xx]) { near = true; break; }
      }
      if (!near) continue;
      const i = p * 4;
      const dark = (Lbg - luma(i)) / (Lbg - 70);
      const warm = (d[i] - d[i + 2] - 4) / 16;
      const a = Math.max(0, Math.min(1, Math.max(dark, warm)));
      alpha[p] = a;
      if (a > 0.02 && a < 1) {
        // Un-mix the lavender so edges don't glow purple.
        d[i] = Math.max(0, Math.min(255, (d[i] - (1 - a) * BG[0]) / a));
        d[i + 1] = Math.max(0, Math.min(255, (d[i + 1] - (1 - a) * BG[1]) / a));
        d[i + 2] = Math.max(0, Math.min(255, (d[i + 2] - (1 - a) * BG[2]) / a));
      }
    }
    // 3x3 smoothing of the alpha edge only.
    const a2 = new Float32Array(alpha);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const p = y * W + x;
      if (alpha[p] === 1 || alpha[p] === 0) {
        // only smooth where neighbours differ
        const n = alpha[p - 1] + alpha[p + 1] + alpha[p - W] + alpha[p + W];
        if (n === 0 || n === 4) continue;
      }
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += alpha[p + dy * W + dx];
      a2[p] = Math.min(alpha[p] === 0 ? 0.35 : 1, s / 9 + (alpha[p] === 1 ? 0.25 : 0));
    }
    for (let p = 0; p < N; p++) d[p * 4 + 3] = Math.round(a2[p] * 255);
    ctx.putImageData(data, 0, 0);

    // --- Head centre from hair pixels.
    let sx = 0, sn = 0;
    for (let y = 30; y < 520; y += 2) for (let x = left; x <= right; x += 2) {
      const i = (y * W + x) * 4;
      if (d[i + 3] > 200 && luma(i) < 70) { sx += x; sn++; }
    }
    const cx = Math.round(sx / sn);
    // Top of figure.
    let top = 0;
    outer: for (let y = 0; y < H; y++) for (let x = left; x <= right; x += 2) if (d[(y * W + x) * 4 + 3] > 200) { top = y; break outer; }

    const out = (sx0, sy0, sw, sh, ow, oh, bgFill) => {
      const o = document.createElement('canvas'); o.width = ow; o.height = oh;
      const octx = o.getContext('2d');
      octx.imageSmoothingQuality = 'high';
      if (bgFill) { octx.fillStyle = bgFill; octx.fillRect(0, 0, ow, oh); }
      octx.drawImage(c, sx0, sy0, sw, sh, 0, 0, ow, oh);
      return o.toDataURL('image/webp', 0.9);
    };
    const pw = 760, ph = H - Math.max(0, top - 10);
    const px0 = Math.max(0, Math.min(W - pw, Math.round(cx - pw / 2)));
    const py0 = Math.max(0, top - 10);
    const oh = Math.round(560 * ph / pw);
    const portrait = out(px0, py0, pw, ph, 560, oh);
    const asz = 380;
    const avatar = out(Math.max(0, Math.min(W - asz, cx - asz / 2)), Math.max(0, Math.min(H - asz, top + 120)), asz, asz, 160, 160);
    const preview = debug ? out(px0, py0, pw, ph, 560, oh, '#2a2238') : null;
    return { portrait, avatar, preview, info: { BG, left, right, cx, top, pockets, size: [560, oh] } };
  }, { b64, mime, debug, prof });
  const write = (dir, name, url) => fs.writeFileSync(path.join(dir, name), Buffer.from(url.split(',')[1], 'base64'));
  write(outDir, `${mood}.webp`, res.portrait);
  write(outDir, `${mood}-avatar.webp`, res.avatar);
  if (res.preview) write(dbgDir, `cutout-${who}-${mood}.webp`, res.preview);
  report.push(`${mood}: ${JSON.stringify(res.info)}`);
}
console.log(report.join('\n'));
await browser.close();

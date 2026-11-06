import { GARDEN_DECOR, WRAPS, plantDef } from './data';
import type { GardenPhoto } from './logic';

/*
 * Garden drawings as small SVG strings: a plant at each growth stage, a bouquet, and a garden snapshot.
 * Photos are stored as arrangements and redrawn here, so they cost almost nothing in the save.
 */

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** One plant in a plot. stage: 0 seed · 1 sprout · 2 bud · 3 ready. */
export function plantSvg(plantId: string | null, stage: number, size = 72, glow = false): string {
  const d = plantId ? plantDef(plantId) : undefined;
  const soil = `<ellipse cx="50" cy="84" rx="40" ry="12" fill="#7a5236"/><ellipse cx="50" cy="81" rx="36" ry="9" fill="#946645"/>`;
  let body = '';
  if (d) {
    if (stage === 0) body = `<ellipse cx="50" cy="78" rx="9" ry="5" fill="#5e3c25"/><circle cx="46" cy="76" r="2" fill="#c9a77a"/><circle cx="54" cy="77" r="1.6" fill="#c9a77a"/>`;
    else if (stage === 1) body = `<path d="M50 80 Q50 66 50 60" stroke="#4f9a3f" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M50 66 Q38 58 34 64 Q42 70 50 66Z M50 62 Q62 52 67 58 Q58 66 50 62Z" fill="#6cc45a"/>`;
    else if (stage === 2) body = `<path d="M50 80 Q48 58 50 38" stroke="#3f8a35" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M50 64 Q34 56 28 64 Q40 72 50 64Z M50 56 Q66 46 72 54 Q60 62 50 56Z" fill="#5fb36b"/>
      <ellipse cx="50" cy="34" rx="9" ry="12" fill="${d.color}" stroke="#3f8a35" stroke-width="3"/>`;
    else body = `${glow ? `<circle cx="50" cy="40" r="34" fill="${d.color}" opacity=".35"/>` : ''}
      <path d="M50 82 Q48 62 50 46" stroke="#3f8a35" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M50 68 Q34 60 28 68 Q40 76 50 68Z" fill="#5fb36b"/>
      <text x="50" y="50" font-size="44" text-anchor="middle" dominant-baseline="middle">${xml(d.emoji)}</text>`;
  }
  return `<svg class="gd-plant" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${soil}${body}</svg>`;
}

/** A bouquet: flowers fanned out over a paper cone. */
export function bouquetSvg(flowers: string[], wrap: string, size = 160): string {
  const paper = WRAPS.find((w) => w.id === wrap)?.color ?? '#d8b98a';
  const n = flowers.length;
  const heads = flowers.map((f, i) => {
    const d = plantDef(f);
    const t = n === 1 ? 0.5 : i / (n - 1);
    const ang = (t - 0.5) * 1.5;
    const row = i % 2;
    const x = 100 + Math.sin(ang) * (48 - row * 14);
    const y = 78 - Math.cos(ang) * (44 - row * 14) + row * 6;
    return `<path d="M100 150 Q${(100 + x) / 2} ${y + 40} ${x} ${y + 10}" stroke="#3f8a35" stroke-width="3" fill="none"/>
      <text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="34" text-anchor="middle" dominant-baseline="middle">${xml(d?.emoji ?? '🌼')}</text>`;
  }).join('');
  return `<svg class="gd-bouquet" viewBox="0 0 200 220" width="${size}" height="${(size * 220) / 200}" aria-hidden="true">
    ${heads}
    <path d="M58 118 L100 206 L142 118 Z" fill="${paper}" stroke="rgba(0,0,0,.12)" stroke-width="2"/>
    <path d="M58 118 L100 132 L142 118" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3"/>
    <path d="M86 168 Q100 160 114 168 Q100 176 86 168Z" fill="#e8577d"/><circle cx="100" cy="168" r="4" fill="#c8324a"/></svg>`;
}

/** A snapshot of the whole garden for the photo album. */
export function gardenPhotoSvg(ph: GardenPhoto, size = 320): string {
  const plots = ph.plots ?? [];
  const cols = 4;
  const rows = Math.max(1, Math.ceil(plots.length / cols));
  const W = 400, H = 120 + rows * 90;
  const swatch = (id?: string) => GARDEN_DECOR.find((d) => d.id === id)?.swatch ?? '#b07a4a';
  const fence = swatch(ph.decor?.fence);
  const fenceColor = fence.startsWith('#') ? fence : '#b07a4a';
  const deco = (slot: 'bench' | 'ornament' | 'lights') => GARDEN_DECOR.find((d) => d.id === ph.decor?.[slot]);
  const cells = plots.map((p, i) => {
    const x = 20 + (i % cols) * 92, y = 96 + Math.floor(i / cols) * 90;
    return `<g transform="translate(${x} ${y})"><rect width="84" height="80" rx="12" fill="#8a5c3c"/>
      ${plantSvg(p.plantId, p.stage, 80).replace('<svg', '<svg x="2" y="-4"')}</g>`;
  }).join('');
  const lights = deco('lights');
  const extras = [deco('bench'), deco('ornament')].filter((d) => d && !d.id.endsWith('none'))
    .map((d, i) => `<text x="${i ? 350 : 50}" y="${H - 14}" font-size="30" text-anchor="middle">${xml(d!.emoji)}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="${size}" height="${(size * H) / W}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="#bfe8ff"/><rect y="70" width="${W}" height="${H - 70}" fill="#8fd17a"/>
    ${lights && !lights.id.endsWith('none') ? Array.from({ length: 9 }, (_, i) => `<circle cx="${20 + i * 45}" cy="${18 + (i % 2) * 6}" r="5" fill="#ffd36b"/>`).join('') : ''}
    ${Array.from({ length: 14 }, (_, i) => `<rect x="${i * 30}" y="44" width="16" height="40" rx="4" fill="${fenceColor}" stroke="rgba(0,0,0,.15)"/>`).join('')}
    <rect y="58" width="${W}" height="7" fill="${fenceColor}"/>
    ${cells}${extras}</svg>`;
}

/** Turn an SVG string into an image URL (for <img> tags and the phone's gallery). */
export function svgUrl(svg: string): string {
  const full = svg.includes('xmlns=') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(full)}`;
}

export function photoUrl(ph: GardenPhoto): string {
  if (ph.kind === 'bouquet') {
    // Nest the bouquet drawing inside a framed card (a nested <svg> keeps its own viewBox).
    const inner = bouquetSvg(ph.flowers ?? [], ph.wrap ?? 'kraft', 200).replace('<svg', '<svg x="20" y="20"');
    return svgUrl(`<svg viewBox="0 0 240 260" width="240" height="260"><rect width="240" height="260" rx="16" fill="#fff4f7"/>${inner}</svg>`);
  }
  return svgUrl(gardenPhotoSvg(ph, 400));
}

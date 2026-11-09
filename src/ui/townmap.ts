import type { TimeOfDay } from '../content/types';

/*
 * The illustrated town map: an overhead view of Evermore with each place drawn as its own little building.
 * Pure SVG markup (crisp at any size, cheap on older phones). Clickable parts carry data-spot="…".
 * The house opens a small card to pick a room; the fenced yard is the backyard (and the garden once it's open).
 */

export interface MapStatus {
  time: TimeOfDay;
  here: string;
  garden: boolean;
  gardenReady: number;
  pizzaOpen: boolean;
  pizzaLevel: number;
  petOpen: boolean;
  petLevel: number;
  shopOpenNow: boolean;
}

const W = 1600, H = 900;
const night = (t: TimeOfDay) => t === 'night';

function windows(x: number, y: number, cols: number, rows: number, w: number, h: number, gap: number, lit: boolean, frame = '#ffffff') {
  let s = '';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const wx = x + c * (w + gap), wy = y + r * (h + gap);
    s += `<rect x="${wx}" y="${wy}" width="${w}" height="${h}" rx="5" fill="${lit ? '#ffe9a8' : '#bfe3ff'}" stroke="${frame}" stroke-width="4"/>`;
    s += `<line x1="${wx + w / 2}" y1="${wy}" x2="${wx + w / 2}" y2="${wy + h}" stroke="${frame}" stroke-width="3"/>`;
    if (lit) s += `<rect x="${wx - 6}" y="${wy - 6}" width="${w + 12}" height="${h + 12}" rx="8" fill="#ffd36b" opacity=".25"/>`;
  }
  return s;
}

function tree(x: number, y: number, s = 1, blossom = false) {
  const c = blossom ? ['#f7b6c8', '#ffcfdc'] : ['#7cc46e', '#9ad884'];
  return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="34" rx="34" ry="9" fill="#000" opacity=".1"/>
    <rect x="-6" y="0" width="12" height="34" rx="4" fill="#a8744c"/>
    <circle cx="0" cy="-18" r="34" fill="${c[0]}"/><circle cx="-18" cy="-4" r="22" fill="${c[0]}"/><circle cx="18" cy="-6" r="24" fill="${c[0]}"/>
    <circle cx="-8" cy="-28" r="14" fill="${c[1]}"/></g>`;
}
const flowers = (x: number, y: number, n: number, seed: number) => Array.from({ length: n }, (_, i) => {
  const a = (seed * 37 + i * 61) % 360, d = 8 + ((seed + i * 13) % 26);
  const fx = x + Math.cos(a) * d * 1.6, fy = y + Math.sin(a) * d * 0.7;
  const col = ['#ff8fb0', '#ffd36b', '#ffffff', '#b9a2ec'][(seed + i) % 4];
  return `<circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="5" fill="${col}"/><circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="2" fill="#f6b93b"/>`;
}).join('');

/** A sign under a building: name and a little status line. */
function plaque(cx: number, y: number, name: string, sub: string, tone: 'normal' | 'closed' | 'here' | 'good' = 'normal') {
  const w = Math.max(150, name.length * 15 + 40);
  const subCol = tone === 'closed' ? '#b0566a' : tone === 'here' ? '#e8577d' : tone === 'good' ? '#3f9a53' : '#8a7080';
  return `<g class="tm-plaque" transform="translate(${cx} ${y})"><rect x="${-w / 2}" y="0" width="${w}" height="58" rx="18" fill="#fffaf6" stroke="${tone === 'here' ? '#e8577d' : '#ffffff'}" stroke-width="${tone === 'here' ? 4 : 3}"/>
    <text x="0" y="26" text-anchor="middle" class="tm-name">${name}</text><text x="0" y="47" text-anchor="middle" class="tm-sub" fill="${subCol}">${sub}</text></g>`;
}

function closedSign(cx: number, y: number) {
  return `<g transform="translate(${cx} ${y}) rotate(-6)"><rect x="-62" y="-20" width="124" height="40" rx="8" fill="#8a5a44"/><rect x="-56" y="-14" width="112" height="28" rx="5" fill="#a8744c"/>
    <text x="0" y="7" text-anchor="middle" class="tm-closed">CLOSED</text></g>`;
}

export function townMapSvg(st: MapStatus): string {
  const lit = night(st.time) || st.time === 'sunset';
  const here = (id: string) => st.here === id;
  const homeRoom = ['bedroom', 'livingroom', 'kitchen', 'bathroom', 'comfortroom'].includes(st.here);
  const yardHere = st.here === 'backyard';
  const sky = { morning: '#fff2d8', day: '#ffffff', sunset: '#ffd2b0', night: '#2b2d5a' }[st.time];

  // ---- ground: grass, paths, river, park
  let g = `<rect width="${W}" height="${H}" fill="#bfe6a8"/>
    <g opacity=".5">${Array.from({ length: 70 }, (_, i) => `<ellipse cx="${(i * 233) % W}" cy="${(i * 137) % H}" rx="${18 + (i % 5) * 6}" ry="${8 + (i % 4) * 3}" fill="#cdeeb6"/>`).join('')}</g>
    <path d="M1180 0 C1240 120 1420 150 1600 200 L1600 0 Z" fill="#9ad3f0"/><path d="M1200 0 C1260 110 1430 135 1600 182" fill="none" stroke="#ffffff" stroke-width="4" stroke-dasharray="14 18" opacity=".6"/>
    <rect x="0" y="540" width="${W}" height="62" fill="#ead9c4"/><line x1="0" y1="571" x2="${W}" y2="571" stroke="#fff" stroke-width="5" stroke-dasharray="26 22"/>
    <rect x="890" y="0" width="58" height="540" fill="#ead9c4"/><line x1="919" y1="0" x2="919" y2="540" stroke="#fff" stroke-width="5" stroke-dasharray="26 22"/>
    <rect x="530" y="602" width="44" height="${H - 602}" fill="#ead9c4"/><rect x="1040" y="602" width="44" height="${H - 602}" fill="#ead9c4"/>
    <path d="M430 482 L430 540 L470 540 L470 482 Z" fill="#ead9c4"/>`;

  // ---- trees & flowers
  g += [tree(80, 150, 1.1), tree(150, 470, 0.9, true), tree(780, 110, 1), tree(1040, 140, 0.9, true), tree(1480, 500, 1), tree(1530, 330, 0.8, true),
    tree(60, 760, 0.9), tree(1520, 800, 1.1, true), tree(830, 760, 0.8), tree(1380, 120, 0.7)].join('');
  g += flowers(790, 300, 10, 1) + flowers(1460, 680, 8, 2) + flowers(110, 330, 9, 3) + flowers(980, 460, 7, 4);

  // ---- home: the house (tap for rooms) and the fenced backyard
  const wall = '#ffe8d6', roof = '#e8778f';
  g += `<g class="tm-spot ${homeRoom ? 'is-here' : ''}" data-spot="home" tabindex="0" role="button" aria-label="Home">
    <ellipse cx="330" cy="470" rx="190" ry="20" fill="#000" opacity=".1"/>
    <rect x="160" y="250" width="340" height="220" rx="14" fill="${wall}" stroke="#fff" stroke-width="5"/>
    <path d="M140 262 L330 140 L520 262 Z" fill="${roof}" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>
    <rect x="420" y="160" width="34" height="62" rx="4" fill="#c86078"/>
    <circle cx="330" cy="208" r="20" fill="#fff6ea"/><path d="M330 216 C322 210 318 205 318 200 a6 6 0 0 1 12 -2 a6 6 0 0 1 12 2 c0 5 -4 10 -12 16z" fill="#e8577d"/>
    ${windows(186, 290, 2, 1, 56, 52, 18, lit)}${windows(390, 290, 1, 1, 70, 52, 0, lit)}
    <rect x="300" y="370" width="60" height="100" rx="10" fill="#c88a5a" stroke="#fff" stroke-width="4"/><circle cx="348" cy="420" r="4" fill="#ffd36b"/>
    <rect x="190" y="390" width="80" height="16" rx="6" fill="#ff9ab8"/>${flowers(230, 382, 5, 9)}</g>`;
  g += plaque(330, 482 + 0, 'Home', homeRoom ? 'You are here ♡' : 'Tap to pick a room', homeRoom ? 'here' : 'normal');
  // Backyard (fenced, with the swing tree and, once open, garden beds).
  g += `<g class="tm-spot ${yardHere ? 'is-here' : ''}" data-spot="backyard" tabindex="0" role="button" aria-label="Backyard">
    <rect x="530" y="230" width="320" height="250" rx="22" fill="#a8dc90"/>
    <rect x="530" y="230" width="320" height="250" rx="22" fill="none" stroke="#fff" stroke-width="8" stroke-dasharray="4 14" stroke-linecap="round"/>
    ${tree(610, 300, 0.9, true)}<line x1="644" y1="312" x2="644" y2="350" stroke="#d8c0a0" stroke-width="3"/><line x1="672" y1="312" x2="672" y2="350" stroke="#d8c0a0" stroke-width="3"/>
    <rect x="636" y="348" width="44" height="9" rx="3" fill="#b07a52"/>
    <rect x="720" y="400" width="96" height="40" rx="10" fill="#7a8ad8" opacity=".85"/><rect x="726" y="406" width="84" height="28" rx="7" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="6 6"/>
    <rect x="780" y="268" width="14" height="44" fill="#a8744c"/><rect x="766" y="250" width="44" height="26" rx="8" fill="#ff8fb0"/></g>`;
  if (st.garden) {
    g += `<g class="tm-spot ${st.here === 'garden' ? 'is-here' : ''}" data-spot="garden" tabindex="0" role="button" aria-label="Garden">
      ${[0, 1, 2].map((i) => `<rect x="${560 + i * 52}" y="414" width="44" height="40" rx="8" fill="#9a6a44"/>${flowers(582 + i * 52, 430, 4, 20 + i)}`).join('')}
      ${st.gardenReady ? `<g class="tm-badge"><circle cx="716" cy="404" r="16" fill="#e8577d"/><text x="716" y="410" text-anchor="middle" class="tm-badge-t">${st.gardenReady}</text></g>` : ''}</g>`;
  }
  g += plaque(690, 494, st.garden ? 'Backyard & Garden' : 'Backyard', yardHere ? 'You are here ♡' : st.garden && st.gardenReady ? `${st.gardenReady} ready to pick 🌷` : 'Under the open sky', yardHere ? 'here' : st.garden && st.gardenReady ? 'good' : 'normal');

  // ---- school (bottom left)
  g += `<g class="tm-spot ${here('school') ? 'is-here' : ''}" data-spot="school" tabindex="0" role="button" aria-label="School">
    <ellipse cx="300" cy="826" rx="210" ry="18" fill="#000" opacity=".1"/>
    <rect x="110" y="660" width="380" height="166" rx="12" fill="#e0e8f6" stroke="#fff" stroke-width="5"/>
    <path d="M100 668 L300 610 L500 668 Z" fill="#7a8ad8" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>
    <circle cx="300" cy="652" r="18" fill="#fff"/><line x1="300" y1="652" x2="300" y2="641" stroke="#4a3a5a" stroke-width="3"/><line x1="300" y1="652" x2="309" y2="656" stroke="#4a3a5a" stroke-width="3"/>
    <line x1="470" y1="560" x2="470" y2="660" stroke="#c8c8d4" stroke-width="4"/><path d="M470 562 L510 574 L470 588 Z" fill="#ff8fb0"/>
    ${windows(132, 700, 2, 1, 54, 44, 16, lit)}${windows(366, 700, 2, 1, 54, 44, 16, lit)}
    <rect x="270" y="740" width="60" height="86" rx="8" fill="#a8744c" stroke="#fff" stroke-width="4"/></g>`;
  g += plaque(300, 834, 'School', here('school') ? 'You are here ♡' : 'Lessons & little notes', here('school') ? 'here' : 'normal');

  // ---- market (bottom middle): striped stalls
  g += `<g class="tm-spot ${st.pizzaOpen ? '' : 'is-locked'}" data-spot="market" tabindex="0" role="button" aria-label="Market">
    <ellipse cx="800" cy="806" rx="200" ry="16" fill="#000" opacity=".1"/>
    ${[0, 1, 2].map((i) => {
      const x = 630 + i * 118, col = ['#ff8f9f', '#7fd1b9', '#ffd36b'][i];
      return `<rect x="${x}" y="720" width="104" height="86" rx="8" fill="#fff6ea" stroke="#fff" stroke-width="4"/>
        <path d="M${x - 6} 724 L${x + 110} 724 L${x + 104} 690 L${x} 690 Z" fill="${col}"/>
        ${[0, 1, 2, 3].map((k) => `<path d="M${x - 6 + k * 29} 724 l14 0 l-2 -34 l-12 0 z" fill="#fff" opacity=".7"/>`).join('')}
        <circle cx="${x + 30}" cy="760" r="11" fill="${['#e5413d', '#5fb36b', '#f6b93b'][i]}"/><circle cx="${x + 62}" cy="764" r="10" fill="${['#f6b93b', '#e5413d', '#9ad884'][(i + 1) % 3]}"/>`;
    }).join('')}</g>`;
  g += st.pizzaOpen ? plaque(800, 816, 'Market', 'Fresh ingredients') : closedSign(800, 760) + plaque(800, 816, 'Market', `Opens at Lv ${st.pizzaLevel}`, 'closed');

  // ---- pet shop (bottom right): pink, paw sign
  g += `<g class="tm-spot ${st.petOpen ? '' : 'is-locked'}" data-spot="petshop" tabindex="0" role="button" aria-label="Pet Shop">
    <ellipse cx="1250" cy="812" rx="170" ry="16" fill="#000" opacity=".1"/>
    <rect x="1100" y="670" width="300" height="142" rx="16" fill="#ffe1ea" stroke="#fff" stroke-width="5"/>
    <path d="M1090 682 Q1250 600 1410 682 Z" fill="#7fd1b9" stroke="#fff" stroke-width="5"/>
    ${Array.from({ length: 8 }, (_, i) => `<path d="M${1100 + i * 37.5} 690 q18 22 37.5 0" fill="${i % 2 ? '#fff' : '#ff9ab8'}"/>`).join('')}
    <circle cx="1250" cy="648" r="26" fill="#fff"/>
    <g fill="#e8577d"><ellipse cx="1250" cy="656" rx="11" ry="9"/><circle cx="1236" cy="640" r="5"/><circle cx="1246" cy="634" r="5"/><circle cx="1256" cy="634" r="5"/><circle cx="1266" cy="640" r="5"/></g>
    ${windows(1124, 716, 1, 1, 90, 56, 0, lit)}${windows(1290, 716, 1, 1, 90, 56, 0, lit)}
    <rect x="1222" y="732" width="56" height="80" rx="10" fill="#c88a5a" stroke="#fff" stroke-width="4"/></g>`;
  g += st.petOpen ? plaque(1250, 822, 'Pet Shop', 'Paws & Whiskers') : closedSign(1250, 760) + plaque(1250, 822, 'Pet Shop', `Opens at Lv ${st.petLevel}`, 'closed');

  // ---- pizza shop (right, by the river): red awning
  g += `<g class="tm-spot ${st.pizzaOpen ? '' : 'is-locked'}" data-spot="pizza" tabindex="0" role="button" aria-label="Pizza Shop">
    <ellipse cx="1180" cy="486" rx="180" ry="16" fill="#000" opacity=".1"/>
    <rect x="1020" y="300" width="320" height="186" rx="14" fill="#fff4e6" stroke="#fff" stroke-width="5"/>
    <rect x="1010" y="270" width="340" height="40" rx="8" fill="#e5533d"/>
    ${Array.from({ length: 9 }, (_, i) => `<path d="M${1010 + i * 37.8} 310 q19 26 37.8 0" fill="${i % 2 ? '#fff' : '#e5533d'}"/>`).join('')}
    <circle cx="1180" cy="250" r="30" fill="#ffd76a" stroke="#fff" stroke-width="5"/>${[0, 1, 2, 3, 4].map((i) => `<circle cx="${1180 + Math.cos(i * 1.25) * 14}" cy="${250 + Math.sin(i * 1.25) * 14}" r="5" fill="#d8432f"/>`).join('')}
    ${windows(1046, 352, 1, 1, 100, 64, 0, lit || st.shopOpenNow)}${windows(1214, 352, 1, 1, 100, 64, 0, lit || st.shopOpenNow)}
    <rect x="1152" y="400" width="56" height="86" rx="10" fill="#8a5a3a" stroke="#fff" stroke-width="4"/>
    ${st.pizzaOpen ? `<rect x="1160" y="412" width="40" height="18" rx="4" fill="${st.shopOpenNow ? '#5fb36b' : '#fff'}"/><text x="1180" y="426" text-anchor="middle" class="tm-tiny" fill="${st.shopOpenNow ? '#fff' : '#a07080'}">${st.shopOpenNow ? 'OPEN' : 'CLOSED'}</text>` : ''}</g>`;
  g += st.pizzaOpen ? plaque(1180, 494, 'Pizza Shop', st.shopOpenNow ? 'Open now ♡' : 'Our little shop', st.shopOpenNow ? 'good' : 'normal') : closedSign(1180, 420) + plaque(1180, 494, 'Pizza Shop', `Opens at Lv ${st.pizzaLevel}`, 'closed');

  // ---- you are here (a heart pin over where she is)
  const pin = st.here === 'school' ? [190, 690] : st.here === 'backyard' ? [690, 220] : homeRoom ? [330, 120] : null;
  if (pin) g += `<g class="tm-here" transform="translate(${pin[0]} ${pin[1]})"><g class="tm-here-b"><path d="M0 0 C-30 -22 -40 -40 -40 -54 a20 20 0 0 1 40 -10 a20 20 0 0 1 40 10 c0 14 -10 32 -40 54z" fill="#e8577d" stroke="#fff" stroke-width="5"/>
    <circle cx="0" cy="-44" r="9" fill="#fff"/></g></g>`;

  // Time of day: warm morning, golden sunset, a starry night.
  const tint = st.time === 'night' ? `<rect width="${W}" height="${H}" fill="#1e2048" opacity=".42" pointer-events="none"/>${Array.from({ length: 30 }, (_, i) => `<circle cx="${(i * 197) % W}" cy="${(i * 89) % 260}" r="2" fill="#fff" opacity=".8" pointer-events="none"/>`).join('')}`
    : st.time === 'sunset' ? `<rect width="${W}" height="${H}" fill="#ff9a62" opacity=".16" pointer-events="none"/>` : st.time === 'morning' ? `<rect width="${W}" height="${H}" fill="#ffe4b0" opacity=".12" pointer-events="none"/>` : '';
  return `<svg class="tm-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Map of Evermore" style="--sky:${sky}">${g}${tint}</svg>`;
}

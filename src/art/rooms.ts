import type { LocationId, TimeOfDay } from '../content/types';
import {
  Ctx, hex, shade, rr, fillRR, vgrad, glow, ellipse, floorShadow, heartPath, starPath,
  drawSky, drawWall, drawFloor, drawWindow, drawPlant, drawBooks, drawFrame, paintLandscape,
  drawDoor, drawRug, drawStringLights,
} from './paint';
import { rng } from '../core/rng';

/*
 * Procedural room paintings. Each painter draws a full-width 720px tall background.
 * `sky` (optional) is drawn on a fixed screen-size layer and `far` scrolls with parallax.
 * Replace any room with illustrated art by setting backgroundImage in content/locations.ts.
 */
export const FLOOR_Y = 500;

export interface RoomPainter {
  bg: (ctx: Ctx, time: TimeOfDay, w: number) => void;
  sky?: (ctx: Ctx, time: TimeOfDay) => void;
  far?: (ctx: Ctx, time: TimeOfDay, w: number) => void;
  fg?: (ctx: Ctx, time: TimeOfDay, w: number) => void;
}

const evening = (t: TimeOfDay) => t === 'sunset' || t === 'night';

function lamp(ctx: Ctx, x: number, baseY: number, h: number, shadeColor: number, lit: boolean) {
  ctx.strokeStyle = '#b89870';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x, baseY - h);
  ctx.stroke();
  ellipse(ctx, x, baseY, 22, 6, '#a88860');
  if (lit) glow(ctx, x, baseY - h + 10, 120, 0xffd9a0, 0.55);
  ctx.beginPath();
  ctx.moveTo(x - 20, baseY - h - 40);
  ctx.lineTo(x + 20, baseY - h - 40);
  ctx.lineTo(x + 34, baseY - h + 8);
  ctx.lineTo(x - 34, baseY - h + 8);
  ctx.closePath();
  ctx.fillStyle = vgrad(ctx, baseY - h - 40, baseY - h + 8, [[0, shade(shadeColor, lit ? 0.35 : 0.05)], [1, shade(shadeColor, lit ? 0.15 : -0.1)]]);
  ctx.fill();
}

function polaroid(ctx: Ctx, x: number, y: number, rot: number, seed: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = 'rgba(50,30,30,0.2)';
  ctx.fillRect(-20, -22, 44, 52);
  ctx.fillStyle = '#fffdf8';
  ctx.fillRect(-22, -24, 44, 52);
  const r = rng(seed);
  const c = r.pick([0xf4b6c8, 0xa8d0f0, 0xffd89a, 0xb8e0c0, 0xd0b8f0]);
  ctx.fillStyle = vgrad(ctx, -20, 14, [[0, shade(c, 0.2)], [1, shade(c, -0.15)]]);
  ctx.fillRect(-18, -20, 36, 34);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  heartPath(ctx, 0, -10, 12);
  ctx.fill();
  ellipse(ctx, 0, -24, 3.5, 3.5, '#e05070');
  ctx.restore();
}

// ====================================================================== BEDROOM
const bedroom: RoomPainter = {
  bg(ctx, time, w) {
    drawWall(ctx, w, FLOOR_Y, { base: 0xfbe4e8, accent: 0xe79cb0, pattern: 'dots', wainscot: 0xf9eef0 });
    drawFloor(ctx, w, FLOOR_Y, 720 - FLOOR_Y, 'wood', 0xc99c78);
    drawRug(ctx, 760, 620, 300, 58, 0xf3b7c6, 0xffffff);

    drawDoor(ctx, 40, 170, 120, 330, 0xf3e3d3);
    drawWindow(ctx, 210, 120, 220, 210, time, { curtain: 0xf4a6b8, seed: 'bedwin' });

    // Memory board with string lights above the bed.
    drawStringLights(ctx, 540, 840, 140, 14, evening(time), 'bedlights');
    fillRR(ctx, 570, 160, 240, 122, 6, '#c8956a');
    fillRR(ctx, 578, 168, 224, 106, 4, vgrad(ctx, 168, 274, [[0, 0xd9ad80], [1, 0xc99c70]]));
    polaroid(ctx, 612, 210, -0.12, 'p1');
    polaroid(ctx, 670, 220, 0.08, 'p2');
    polaroid(ctx, 730, 205, -0.05, 'p3');
    polaroid(ctx, 780, 230, 0.14, 'p4');
    ctx.fillStyle = '#fff3a8';
    ctx.save(); ctx.translate(645, 252); ctx.rotate(0.1); ctx.fillRect(-12, -10, 26, 22); ctx.restore();

    // Bed (side view, headboard on the left).
    floorShadow(ctx, 700, 500, 440, 0.3);
    ctx.fillStyle = '#3a2228';
    ctx.fillRect(520, 455, 360, 45);
    fillRR(ctx, 500, 300, 50, 200, 18, vgrad(ctx, 300, 500, [[0, 0xf6f0ea], [1, 0xd8c8bc]]));
    heartPath(ctx, 525, 325, 18); ctx.fillStyle = '#f19ab0'; ctx.fill();
    fillRR(ctx, 860, 385, 34, 115, 10, vgrad(ctx, 385, 500, [[0, 0xf6f0ea], [1, 0xd8c8bc]]));
    fillRR(ctx, 540, 410, 330, 50, 10, '#fffaf4');
    // pillows
    fillRR(ctx, 552, 372, 92, 40, 18, vgrad(ctx, 372, 412, [[0, 0xffffff], [1, 0xeee4ea]]));
    fillRR(ctx, 600, 380, 70, 32, 14, vgrad(ctx, 380, 412, [[0, 0xffd6e0], [1, 0xf4b6c8]]));
    // blanket with folds
    ctx.beginPath();
    ctx.moveTo(640, 400);
    ctx.quadraticCurveTo(740, 385, 870, 398);
    ctx.lineTo(875, 470);
    ctx.quadraticCurveTo(760, 478, 640, 466);
    ctx.closePath();
    ctx.fillStyle = vgrad(ctx, 390, 475, [[0, 0xc9b2ec], [1, 0x9f84d0]]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(670 + i * 42, 400); ctx.quadraticCurveTo(680 + i * 42, 430, 668 + i * 42, 468); ctx.stroke();
    }
    for (let i = 0; i < 7; i++) { heartPath(ctx, 660 + i * 32, 420 + (i % 2) * 18, 9); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill(); }
    // plush bear
    ellipse(ctx, 812, 380, 20, 22, '#c89870');
    ellipse(ctx, 812, 352, 16, 15, '#d4a47c');
    ellipse(ctx, 800, 340, 6, 6, '#c89870'); ellipse(ctx, 824, 340, 6, 6, '#c89870');
    ellipse(ctx, 812, 356, 6, 4, '#f3dcc0');
    ellipse(ctx, 806, 350, 1.8, 1.8, '#3a2228'); ellipse(ctx, 818, 350, 1.8, 1.8, '#3a2228');
    ctx.fillStyle = '#e04a6a'; heartPath(ctx, 812, 372, 12); ctx.fill();
    // something under the bed (secret)
    fillRR(ctx, 610, 478, 40, 18, 3, '#f4b6c8');
    ctx.fillStyle = '#d8344f'; ctx.fillRect(627, 478, 6, 18);

    // Desk
    floorShadow(ctx, 1100, 500, 300, 0.25);
    ctx.fillStyle = '#b07a52';
    ctx.fillRect(975, 412, 10, 88); ctx.fillRect(1225, 412, 10, 88);
    fillRR(ctx, 1150, 412, 85, 80, 4, vgrad(ctx, 412, 492, [[0, 0xc8946a], [1, 0xa87452]]));
    ctx.fillStyle = '#e8c070'; ctx.fillRect(1185, 435, 16, 4); ctx.fillRect(1185, 465, 16, 4);
    fillRR(ctx, 960, 398, 290, 16, 4, vgrad(ctx, 398, 414, [[0, 0xdcae84], [1, 0xb8885e]]));
    // laptop
    ctx.save();
    ctx.translate(1000, 398);
    ctx.fillStyle = '#d8dce6';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(90, 0); ctx.lineTo(84, -6); ctx.lineTo(6, -6); ctx.fill();
    ctx.fillStyle = '#c4c8d4';
    ctx.beginPath(); ctx.moveTo(10, -6); ctx.lineTo(28, -70); ctx.lineTo(96, -70); ctx.lineTo(80, -6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = evening(time) ? '#bfe0ff' : '#5a6a8a';
    ctx.beginPath(); ctx.moveTo(16, -10); ctx.lineTo(31, -64); ctx.lineTo(90, -64); ctx.lineTo(76, -10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff8fb0'; heartPath(ctx, 54, -48, 18); ctx.fill();
    ctx.restore();
    if (evening(time)) glow(ctx, 1052, 360, 90, 0xbfe0ff, 0.35);
    // keepsake box
    fillRR(ctx, 1115, 418 - 50, 82, 50, 6, vgrad(ctx, 368, 418, [[0, 0xf7c2d2], [1, 0xe48aa6]]));
    fillRR(ctx, 1110, 360, 92, 16, 5, '#f9d2de');
    ctx.fillStyle = '#d8344f'; ctx.fillRect(1152, 360, 8, 58);
    ellipse(ctx, 1146, 358, 10, 6, '#d8344f'); ellipse(ctx, 1166, 358, 10, 6, '#d8344f');
    // lamp
    lamp(ctx, 1222, 398, 70, 0xffd3a8, evening(time));
    // Shelf with books and a small plant
    fillRR(ctx, 975, 228, 250, 10, 3, '#c8946a');
    drawBooks(ctx, 985, 172, 130, 56, 'bedbooks');
    drawPlant(ctx, 1170, 228, 0.55, 0xf0a0b8);
    // Wardrobe
    floorShadow(ctx, 1375, 500, 240, 0.3);
    fillRR(ctx, 1280, 150, 190, 350, 8, vgrad(ctx, 150, 500, [[0, 0xfaf3ec], [1, 0xe6d8ca]]));
    fillRR(ctx, 1272, 140, 206, 18, 4, '#f3e6da');
    ctx.strokeStyle = '#d4c0ae'; ctx.lineWidth = 3;
    ctx.strokeRect(1292, 170, 80, 300); ctx.strokeRect(1378, 170, 80, 300);
    ellipse(ctx, 1364, 320, 4, 10, '#e8c070'); ellipse(ctx, 1386, 320, 4, 10, '#e8c070');
    ctx.fillStyle = 'rgba(200,230,255,0.5)';
    rr(ctx, 1300, 185, 64, 110, 30); ctx.fill();
    // hatbox on top
    fillRR(ctx, 1320, 112, 60, 30, 8, '#a8d0f0');
    // poster & tall plant
    fillRR(ctx, 1500, 180, 80, 110, 4, '#fffaf2');
    ctx.save(); ctx.beginPath(); ctx.rect(1506, 186, 68, 98); ctx.clip();
    paintLandscape(ctx, 1506, 186, 68, 98, 'poster'); ctx.restore();
    drawPlant(ctx, 1540, 500, 1.1, 0xe8a98a);
  },
};

// ====================================================================== LIVING ROOM
const livingroom: RoomPainter = {
  bg(ctx, time, w) {
    drawWall(ctx, w, FLOOR_Y, { base: 0xf7ecdc, accent: 0xe2c7a0, pattern: 'stripes' });
    drawFloor(ctx, w, FLOOR_Y, 720 - FLOOR_Y, 'wood', 0xb3825e);
    drawRug(ctx, 760, 620, 380, 66, 0xa9c3e6, 0xfff6e8);
    drawRug(ctx, 1880, 560, 90, 16, 0xc88a5a, 0xfff6e8);

    drawDoor(ctx, 40, 170, 120, 330, 0xe8d4bc);
    // Bookshelf
    floorShadow(ctx, 305, 500, 260, 0.3);
    fillRR(ctx, 200, 140, 210, 360, 6, vgrad(ctx, 140, 500, [[0, 0x9a6a48], [1, 0x7a5236]]));
    for (let i = 0; i < 5; i++) {
      const sy = 150 + i * 70;
      ctx.fillStyle = '#6a442c';
      ctx.fillRect(210, sy, 190, 60);
      drawBooks(ctx, 214, sy + 4, i === 1 ? 110 : 180, 56, 'lr' + i);
      ctx.fillStyle = '#a87650';
      ctx.fillRect(206, sy + 60, 198, 8);
    }
    // the hollow book (gold, slightly out)
    fillRR(ctx, 338, 252, 18, 58, 2, vgrad(ctx, 252, 310, [[0, 0xf8d878], [1, 0xd8a840]]));
    fillRR(ctx, 360, 256, 14, 54, 2, '#e88aa8');

    // Big frame (photo puzzle)
    drawFrame(ctx, 590, 140, 240, 170, 0xe8c070, (c, x, y, ww, hh) => paintLandscape(c, x, y, ww, hh, 'bigframe'));
    // Sofa
    floorShadow(ctx, 710, 500, 470, 0.32);
    const sofa = 0x8aa6d6;
    fillRR(ctx, 520, 350, 380, 90, 22, vgrad(ctx, 350, 440, [[0, shade(sofa, 0.12)], [1, shade(sofa, -0.05)]]));
    fillRR(ctx, 510, 425, 400, 60, 14, vgrad(ctx, 425, 485, [[0, shade(sofa, 0.05)], [1, shade(sofa, -0.18)]]));
    fillRR(ctx, 498, 390, 44, 100, 18, hex(shade(sofa, -0.05)));
    fillRR(ctx, 878, 390, 44, 100, 18, hex(shade(sofa, -0.05)));
    for (const cx of [580, 700, 820]) fillRR(ctx, cx - 54, 420, 108, 26, 10, hex(shade(sofa, 0.15)));
    fillRR(ctx, 560, 380, 54, 46, 14, '#f4b6c8');
    fillRR(ctx, 820, 382, 50, 44, 14, '#fff0c8');
    ctx.fillStyle = '#ffffff'; heartPath(ctx, 587, 392, 18); ctx.fill();
    ctx.fillStyle = '#3a2a32'; ctx.fillRect(530, 485, 8, 15); ctx.fillRect(882, 485, 8, 15);
    // throw blanket
    ctx.beginPath(); ctx.moveTo(860, 360); ctx.quadraticCurveTo(900, 420, 880, 480); ctx.lineTo(840, 470); ctx.quadraticCurveTo(850, 410, 830, 362); ctx.closePath();
    ctx.fillStyle = '#e8d0f0'; ctx.fill();
    // sofa cushion secret: paper heart peeking
    ctx.fillStyle = '#ff6f91'; heartPath(ctx, 812, 438, 10); ctx.fill();

    // floor lamp
    lamp(ctx, 945, 500, 250, 0xfff0d6, evening(time));

    // TV & console
    floorShadow(ctx, 1110, 500, 300, 0.25);
    fillRR(ctx, 980, 430, 260, 70, 6, vgrad(ctx, 430, 500, [[0, 0xe6d6c4], [1, 0xc8b49c]]));
    ctx.strokeStyle = '#b09a80'; ctx.lineWidth = 2; ctx.strokeRect(992, 442, 115, 46); ctx.strokeRect(1113, 442, 115, 46);
    fillRR(ctx, 1000, 270, 220, 140, 8, '#24242c');
    const tvOn = time === 'night';
    ctx.fillStyle = tvOn ? vgrad(ctx, 278, 402, [[0, 0x8fc8ff], [1, 0xd0a0f0]]) : vgrad(ctx, 278, 402, [[0, 0x3a3a48], [1, 0x2a2a34]]);
    ctx.fillRect(1008, 278, 204, 124);
    if (tvOn) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; heartPath(ctx, 1110, 315, 40); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.moveTo(1008, 360); ctx.lineTo(1090, 278); ctx.lineTo(1120, 278); ctx.lineTo(1008, 390); ctx.fill();
    ctx.fillStyle = '#24242c'; ctx.fillRect(1100, 410, 20, 20);
    drawPlant(ctx, 1210, 430, 0.45, 0x8ab0d8);

    // Window with plant
    drawWindow(ctx, 1300, 130, 190, 210, time, { curtain: 0xe8c890, seed: 'lrwin', cols: 2, rows: 3 });
    drawPlant(ctx, 1395, 342, 0.5, 0xd98c6a);
    // Calendar
    ctx.fillStyle = 'rgba(60,30,40,0.15)'; ctx.fillRect(1518, 200, 70, 100);
    fillRR(ctx, 1514, 195, 70, 100, 3, '#fffdf8');
    fillRR(ctx, 1514, 195, 70, 24, 3, '#e05a78');
    ctx.fillStyle = '#d8c8c0';
    for (let r2 = 0; r2 < 4; r2++) for (let c2 = 0; c2 < 5; c2++) ctx.fillRect(1520 + c2 * 12.5, 226 + r2 * 16, 9, 11);
    ctx.strokeStyle = '#e05a78'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(1557, 263, 9, 0, Math.PI * 2); ctx.stroke();
    // Archway & front door
    drawDoor(ctx, 1620, 180, 140, 320, 0, { arch: true });
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(1650, 300, 60, 6);
    drawDoor(ctx, 1840, 180, 110, 320, 0x9a5a4a, { glass: true });
    // coat hooks
    ctx.fillStyle = '#b48a5a'; ctx.fillRect(1790, 230, 36, 6);
    ellipse(ctx, 1800, 250, 10, 22, '#e88aa8'); ellipse(ctx, 1818, 255, 9, 26, '#6a8fd4');
  },
};

// ====================================================================== KITCHEN
const kitchen: RoomPainter = {
  bg(ctx, time, w) {
    drawWall(ctx, w, FLOOR_Y, { base: 0xfff4e2, accent: 0xf2cfa0, pattern: 'plain' });
    // backsplash tiles
    ctx.save();
    ctx.fillStyle = '#dff1ec';
    ctx.fillRect(400, 270, 760, 130);
    ctx.strokeStyle = 'rgba(120,170,160,0.35)'; ctx.lineWidth = 1.5;
    for (let y = 270; y < 400; y += 26) { ctx.beginPath(); ctx.moveTo(400, y); ctx.lineTo(1160, y); ctx.stroke(); }
    for (let y = 270, row = 0; y < 400; y += 26, row++) for (let x = 400 + (row % 2) * 20; x < 1160; x += 40) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 26); ctx.stroke(); }
    ctx.restore();
    drawFloor(ctx, w, FLOOR_Y, 720 - FLOOR_Y, 'tile', 0xe6d6c2);

    drawDoor(ctx, 40, 170, 150, 330, 0, { arch: true });
    // Fridge
    floorShadow(ctx, 310, 500, 200, 0.3);
    fillRR(ctx, 240, 160, 140, 340, 16, vgrad(ctx, 160, 500, [[0, 0xd4eee6], [1, 0xa8d4c6]]));
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(240, 290, 140, 3);
    fillRR(ctx, 362, 200, 8, 70, 4, '#f4f4f4'); fillRR(ctx, 362, 310, 8, 90, 4, '#f4f4f4');
    const mags: [number, number, number][] = [[268, 200, 0xff8fa8], [300, 230, 0xffd36a], [270, 250, 0x7fb4e8], [300, 330, 0xb48ae0], [330, 360, 0xff8fa8]];
    for (const [mx, my, mc] of mags) ellipse(ctx, mx, my, 8, 8, hex(mc));
    ctx.save(); ctx.translate(290, 360); ctx.rotate(-0.08); ctx.fillStyle = '#fffbea'; ctx.fillRect(-22, -20, 44, 54);
    ctx.fillStyle = '#e05a78'; heartPath(ctx, 0, -8, 16); ctx.fill(); ctx.restore();
    // crooked magnet (secret)
    ctx.save(); ctx.translate(348, 222); ctx.rotate(0.5); fillRR(ctx, -10, -8, 20, 16, 3, '#f0c050'); ctx.restore();

    // Upper cabinets
    for (let x = 420; x < 880; x += 115) {
      if (x > 590 && x < 760) continue;
      fillRR(ctx, x, 150, 108, 110, 6, vgrad(ctx, 150, 260, [[0, 0xfffaf2], [1, 0xeee2d2]]));
      ctx.strokeStyle = '#e0d0bc'; ctx.lineWidth = 2; ctx.strokeRect(x + 10, 160, 88, 90);
      ellipse(ctx, x + 54, 240, 8, 3, '#d8b070');
    }
    // range hood
    ctx.beginPath(); ctx.moveTo(630, 150); ctx.lineTo(730, 150); ctx.lineTo(760, 250); ctx.lineTo(600, 250); ctx.closePath();
    ctx.fillStyle = vgrad(ctx, 150, 250, [[0, 0xe8e8ee], [1, 0xc8c8d4]]); ctx.fill();
    ctx.fillStyle = '#b8b8c4'; ctx.fillRect(600, 246, 160, 8);
    if (evening(time)) glow(ctx, 680, 290, 80, 0xffe2b0, 0.4);

    // Counters
    floorShadow(ctx, 780, 500, 760, 0.25);
    ctx.fillStyle = vgrad(ctx, 410, 500, [[0, 0xfaf4ea], [1, 0xe6dccc]]);
    ctx.fillRect(420, 410, 720, 90);
    for (let x = 430; x < 1130; x += 90) {
      if (x >= 590 && x < 770) continue;
      ctx.strokeStyle = '#d8ccb8'; ctx.lineWidth = 2; ctx.strokeRect(x, 420, 80, 72);
      ellipse(ctx, x + 40, 432, 10, 3, '#d8b070');
    }
    // Oven
    fillRR(ctx, 600, 410, 160, 90, 4, vgrad(ctx, 410, 500, [[0, 0xf0f0f4], [1, 0xd0d0d8]]));
    fillRR(ctx, 615, 435, 130, 55, 6, '#3a3440');
    if (evening(time)) { ctx.fillStyle = 'rgba(255,170,80,0.35)'; ctx.fillRect(620, 440, 120, 45); }
    for (let i = 0; i < 4; i++) ellipse(ctx, 625 + i * 37, 422, 6, 6, '#5a5460');
    fillRR(ctx, 410, 398, 740, 14, 4, vgrad(ctx, 398, 412, [[0, 0xa8d4c6], [1, 0x88b4a6]]));
    // pan with steam
    fillRR(ctx, 640, 386, 80, 12, 5, '#3a3440');
    ctx.fillStyle = '#3a3440'; ctx.fillRect(718, 389, 50, 5);
    ellipse(ctx, 680, 386, 28, 4, '#f8d898');
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(662 + i * 18, 376); ctx.bezierCurveTo(652 + i * 18, 356, 676 + i * 18, 346, 664 + i * 18, 326); ctx.stroke(); }
    // cookie jar
    fillRR(ctx, 465, 340, 62, 58, 14, 'rgba(230,245,255,0.75)');
    for (const [cx, cy] of [[482, 380], [505, 372], [490, 360], [510, 386]]) ellipse(ctx, cx, cy, 10, 6, '#d8a060');
    fillRR(ctx, 470, 328, 52, 14, 6, '#f4a6b8');
    ellipse(ctx, 496, 326, 7, 5, '#f4a6b8');
    // utensils
    fillRR(ctx, 545, 360, 26, 38, 4, '#e88aa8');
    ctx.strokeStyle = '#a0a0a8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(552, 360); ctx.lineTo(546, 330); ctx.moveTo(560, 360); ctx.lineTo(562, 326); ctx.moveTo(566, 360); ctx.lineTo(576, 334); ctx.stroke();

    // Lunch box on the counter, wrapped in a pink cloth with a knot on top (his bento).
    floorShadow(ctx, 830, 399, 80, 0.18);
    fillRR(ctx, 796, 366, 68, 32, 7, '#ff9ab8');
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) ellipse(ctx, 806 + i * 16 + j * 8, 374 + j * 12, 2.4, 2.4, 'rgba(255,255,255,0.7)');
    ctx.fillStyle = '#ff7fa3';
    ctx.beginPath(); ctx.moveTo(818, 368); ctx.quadraticCurveTo(808, 344, 826, 352); ctx.quadraticCurveTo(830, 360, 830, 368); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(842, 368); ctx.quadraticCurveTo(852, 344, 834, 352); ctx.quadraticCurveTo(830, 360, 830, 368); ctx.closePath(); ctx.fill();
    ellipse(ctx, 830, 366, 6, 5, '#e8577d');
    // chopsticks
    ctx.strokeStyle = '#c08a5e'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(872, 396); ctx.lineTo(884, 360); ctx.moveTo(878, 397); ctx.lineTo(892, 362); ctx.stroke();

    // Window & sink
    drawWindow(ctx, 900, 150, 200, 170, time, { seed: 'kwin', frame: 0xffffff, view: (c) => {
      c.fillStyle = time === 'night' ? '#1e3a30' : '#7cc08a';
      c.fillRect(900, 280, 200, 40);
      ellipse(c, 960, 285, 40, 26, time === 'night' ? '#1a3028' : '#5fae6a');
    } });
    // checked valance
    for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : '#ff9ab0'; ctx.fillRect(885 + i * 19.2, 140, 19.2, 26); }
    for (const px of [925, 1000, 1075]) drawPlant(ctx, px, 334, 0.28, 0xffffff);
    fillRR(ctx, 930, 396, 140, 8, 3, '#b8c4cc');
    ctx.strokeStyle = '#b8c4cc'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(1000, 396); ctx.lineTo(1000, 360); ctx.quadraticCurveTo(1000, 348, 1016, 350); ctx.stroke();

    // Table, chairs, pendant
    ctx.strokeStyle = '#7a6a60'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(1285, 0); ctx.lineTo(1285, 170); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1250, 200); ctx.quadraticCurveTo(1285, 150, 1320, 200); ctx.closePath();
    ctx.fillStyle = '#e8a06a'; ctx.fill();
    if (evening(time)) glow(ctx, 1285, 205, 90, 0xffd08a, 0.6);
    floorShadow(ctx, 1285, 500, 300, 0.28);
    for (const cx of [1200, 1370]) {
      fillRR(ctx, cx - 22, 330, 44, 110, 10, '#d4a47c');
      fillRR(ctx, cx - 26, 430, 52, 12, 4, '#c08a5e');
      ctx.fillStyle = '#a87452'; ctx.fillRect(cx - 20, 442, 6, 58); ctx.fillRect(cx + 14, 442, 6, 58);
    }
    fillRR(ctx, 1190, 398, 190, 14, 4, '#c8946a');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(1196, 400, 178, 30);
    for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? '#ffd6e0' : '#ffffff'; ctx.fillRect(1196 + i * 19.8, 412, 19.8, 18); }
    ctx.fillStyle = '#a87452'; ctx.fillRect(1220, 430, 8, 70); ctx.fillRect(1344, 430, 8, 70);
    fillRR(ctx, 1240, 374, 22, 26, 5, '#ffffff'); fillRR(ctx, 1300, 374, 22, 26, 5, '#ffb3c8');
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(1264, 386, 6, -1.2, 1.2); ctx.stroke();
    fillRR(ctx, 1275, 360, 12, 38, 5, 'rgba(200,230,255,0.8)');
    ellipse(ctx, 1281, 352, 9, 9, '#ff7f9f');

    drawDoor(ctx, 1450, 180, 110, 320, 0x7fae9a, { glass: true });
  },
};

// ====================================================================== BACKYARD
const BY_HORIZON = 470;
const backyard: RoomPainter = {
  sky(ctx, time) {
    drawSky(ctx, 0, 0, 1280, 720, time, 'yardsky');
  },
  far(ctx, time, w) {
    const night = time === 'night';
    const far = night ? 0x2a3360 : time === 'sunset' ? 0x8a6a9a : 0x9cc4b8;
    const near = night ? 0x1f2a4a : time === 'sunset' ? 0x6a4a7a : 0x7ab09a;
    ctx.fillStyle = hex(far);
    ctx.beginPath(); ctx.moveTo(0, 400);
    for (let x = 0; x <= w; x += 120) ctx.quadraticCurveTo(x + 60, 330 + Math.sin(x * 0.01) * 30, x + 120, 390);
    ctx.lineTo(w, 520); ctx.lineTo(0, 520); ctx.fill();
    // rooftops
    const r = rng('roofs');
    for (let x = 80; x < w; x += 220 + r.next() * 120) {
      const hw = 60 + r.next() * 40, hy = 380 + r.next() * 20;
      ctx.fillStyle = hex(near);
      ctx.fillRect(x, hy, hw * 2, 140);
      ctx.beginPath(); ctx.moveTo(x - 10, hy); ctx.lineTo(x + hw, hy - 50); ctx.lineTo(x + hw * 2 + 10, hy); ctx.fill();
      if (night || time === 'sunset') { ctx.fillStyle = 'rgba(255,220,140,0.85)'; ctx.fillRect(x + 20, hy + 20, 18, 16); ctx.fillRect(x + hw * 2 - 40, hy + 20, 18, 16); }
    }
    for (let x = 0; x < w; x += 70 + r.next() * 60) ellipse(ctx, x, 440 + r.next() * 20, 40 + r.next() * 30, 50, hex(shade(near, -0.1)));
  },
  bg(ctx, time, w) {
    const night = time === 'night';
    const grass = night ? 0x2f5a48 : time === 'sunset' ? 0x6a8a58 : 0x7cc274;
    drawFloor(ctx, w, BY_HORIZON, 720 - BY_HORIZON, 'grass', grass);
    // path stones
    for (let x = 200; x < w; x += 110) ellipse(ctx, x, 640 + Math.sin(x) * 8, 34, 10, night ? '#5a6070' : '#d8d0c4');
    // fence
    const fence = night ? 0xb8bcd0 : 0xfffaf4;
    ctx.fillStyle = hex(shade(fence, -0.08));
    ctx.fillRect(200, 410, w - 200, 10); ctx.fillRect(200, 460, w - 200, 10);
    for (let x = 210; x < w; x += 34) {
      if (x >= 2110 && x <= 2170) continue;
      ctx.beginPath(); ctx.moveTo(x, 500); ctx.lineTo(x, 392); ctx.lineTo(x + 12, 380); ctx.lineTo(x + 24, 392); ctx.lineTo(x + 24, 500); ctx.closePath();
      ctx.fillStyle = vgrad(ctx, 380, 500, [[0, fence], [1, shade(fence, -0.12)]]); ctx.fill();
    }
    // loose board
    ctx.save(); ctx.translate(2130, 500); ctx.rotate(0.14);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -108); ctx.lineTo(12, -120); ctx.lineTo(24, -108); ctx.lineTo(24, 0); ctx.closePath();
    ctx.fillStyle = hex(shade(fence, -0.15)); ctx.fill(); ctx.restore();

    // house wall
    ctx.fillStyle = vgrad(ctx, 0, 500, [[0, night ? 0x8a7a8a : 0xf3d9c4], [1, night ? 0x6a5a6a : 0xe2c0a8]]);
    ctx.fillRect(0, 0, 210, 500);
    ctx.fillStyle = 'rgba(120,70,60,0.15)';
    for (let y = 20; y < 500; y += 26) ctx.fillRect(0, y, 210, 3);
    drawDoor(ctx, 70, 200, 120, 300, 0x7fae9a, { glass: true });
    fillRR(ctx, 50, 490, 160, 14, 3, '#c8b8a8');
    lamp(ctx, 40, 200, 0, 0xffe2a8, evening(time));
    if (evening(time)) glow(ctx, 30, 190, 120, 0xffd9a0, 0.6);

    // fairy lights
    drawStringLights(ctx, 210, w - 60, 130, 26, evening(time), 'yardlights');

    // flower bed
    fillRR(ctx, 230, 470, 300, 34, 10, night ? '#4a3a34' : '#8a5a3e');
    const fr = rng('flowers');
    for (let i = 0; i < 26; i++) {
      const fx = 245 + fr.next() * 270, fy = 440 + fr.next() * 40;
      ctx.strokeStyle = '#4c8a55'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, 485); ctx.stroke();
      const fc = fr.pick([0xff8fb0, 0xffd36a, 0xffffff, 0xc8a0f0, 0xff6f7f]);
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        ellipse(ctx, fx + Math.cos(a) * 5, fy + Math.sin(a) * 5, 4.5, 4.5, hex(night ? shade(fc, -0.4) : fc));
      }
      ellipse(ctx, fx, fy, 3, 3, '#ffd050');
    }

    // Cherry blossom tree + swing
    floorShadow(ctx, 640, 505, 420, 0.35);
    ctx.fillStyle = vgrad(ctx, 200, 505, [[0, 0x8a5a48], [1, 0x6a4232]]);
    ctx.beginPath(); ctx.moveTo(585, 505); ctx.quadraticCurveTo(600, 350, 590, 200); ctx.lineTo(650, 200); ctx.quadraticCurveTo(640, 350, 660, 505); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 16; ctx.strokeStyle = '#7a4c3a'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(630, 240); ctx.quadraticCurveTo(720, 215, 800, 225); ctx.stroke();
    ctx.lineCap = 'butt';
    // carving
    ctx.strokeStyle = 'rgba(60,30,20,0.7)'; ctx.lineWidth = 2; heartPath(ctx, 612, 320, 22); ctx.stroke();
    const blossom = night ? 0xb07a9a : 0xf7b8cc;
    const br = rng('blossom');
    for (let i = 0; i < 38; i++) {
      const bx = 470 + br.next() * 360, by = 60 + br.next() * 200;
      ellipse(ctx, bx, by, 40 + br.next() * 34, 32 + br.next() * 24, hex(shade(blossom, (br.next() - 0.5) * 0.25)));
    }
    for (let i = 0; i < 60; i++) ellipse(ctx, 470 + br.next() * 360, 60 + br.next() * 220, 3, 3, hex(shade(blossom, 0.4)));
    // The swing's ropes and seat are a live object in the scene (src/scenes/couple.ts) so it can actually swing.
    // Rope knots stay painted on the branch.
    ellipse(ctx, 728, 221, 4, 3, '#c8ae8c'); ellipse(ctx, 792, 225, 4, 3, '#c8ae8c');

    // Grill
    floorShadow(ctx, 1085, 505, 200, 0.3);
    ctx.fillStyle = '#4a4450'; ctx.fillRect(1030, 450, 6, 50); ctx.fillRect(1134, 450, 6, 50);
    ellipse(ctx, 1033, 498, 9, 9, '#2a2430');
    fillRR(ctx, 1010, 440, 150, 12, 4, '#8a8090');
    ctx.beginPath(); ctx.moveTo(1020, 440); ctx.quadraticCurveTo(1085, 470, 1150, 440); ctx.closePath();
    ctx.fillStyle = '#2a2430'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(1085, 440, 65, 50, 0, Math.PI, 0); ctx.fillStyle = vgrad(ctx, 390, 440, [[0, 0xd8344f], [1, 0xa82a40]]); ctx.fill();
    fillRR(ctx, 1072, 382, 26, 8, 4, '#3a3440');
    if (evening(time)) glow(ctx, 1085, 440, 70, 0xff8a40, 0.5);
    ctx.strokeStyle = 'rgba(230,230,240,0.45)'; ctx.lineWidth = 4;
    for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(1150 + i * 8, 445); ctx.bezierCurveTo(1170, 420, 1150, 390, 1170, 350); ctx.stroke(); }

    // Picnic table
    floorShadow(ctx, 1380, 505, 300, 0.3);
    ctx.fillStyle = '#9a6a48'; ctx.fillRect(1260, 455, 240, 10);
    ctx.save(); ctx.strokeStyle = '#8a5a3a'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(1290, 410); ctx.lineTo(1270, 500); ctx.moveTo(1470, 410); ctx.lineTo(1490, 500); ctx.stroke(); ctx.restore();
    fillRR(ctx, 1250, 396, 260, 16, 3, '#b07a52');
    for (let i = 0; i < 13; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : '#ff7f9a'; ctx.fillRect(1256 + i * 19, 398, 19, 26); }
    // basket
    fillRR(ctx, 1340, 360, 70, 38, 8, '#d8a86a');
    ctx.strokeStyle = '#b08050'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(1375, 362, 28, Math.PI, 0); ctx.stroke();
    ellipse(ctx, 1450, 386, 12, 12, '#e04a5a');

    // Blanket & telescope
    ctx.beginPath(); ctx.moveTo(1640, 505); ctx.lineTo(1670, 465); ctx.lineTo(1860, 465); ctx.lineTo(1850, 505); ctx.closePath();
    ctx.fillStyle = '#7a8ad8'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
    for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(1640 + i * 36, 505); ctx.lineTo(1670 + i * 32, 465); ctx.stroke(); }
    fillRR(ctx, 1680, 450, 46, 20, 9, '#ffd6e0'); fillRR(ctx, 1736, 452, 46, 18, 9, '#fff0c8');
    ctx.strokeStyle = '#6a6070'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(1860, 505); ctx.lineTo(1878, 440); ctx.lineTo(1896, 505); ctx.moveTo(1878, 440); ctx.lineTo(1878, 505); ctx.stroke();
    ctx.save(); ctx.translate(1878, 432); ctx.rotate(-0.6); fillRR(ctx, -36, -8, 72, 16, 6, '#e8c070'); ctx.restore();
    if (night) for (let i = 0; i < 4; i++) { ctx.fillStyle = '#fff6c0'; starPath(ctx, 1700 + i * 40, 430 - i * 6, 4); ctx.fill(); }

    // Mailbox
    ctx.fillStyle = '#8a5a3a'; ctx.fillRect(1995, 370, 12, 132);
    fillRR(ctx, 1962, 332, 78, 44, 20, vgrad(ctx, 332, 376, [[0, 0xff8fa8], [1, 0xd8546e]]));
    ctx.fillStyle = '#d8344f'; ctx.fillRect(2032, 316, 5, 30); ctx.fillRect(2032, 316, 18, 10);
    ctx.fillStyle = '#ffffff'; heartPath(ctx, 1990, 344, 16); ctx.fill();
  },
  fg(ctx, time, w) {
    const night = time === 'night';
    const r = rng('fg-grass');
    for (let x = 0; x < w; x += 60 + r.next() * 120) {
      const c = night ? 0x24483a : 0x5fa85a;
      for (let i = 0; i < 9; i++) {
        ctx.strokeStyle = hex(shade(c, (r.next() - 0.5) * 0.3));
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + i * 4, 722);
        ctx.quadraticCurveTo(x + i * 4 + (r.next() - 0.5) * 10, 700, x + i * 4 + (r.next() - 0.5) * 24, 690 - r.next() * 20);
        ctx.stroke();
      }
    }
  },
};

// ====================================================================== SCHOOL
const school: RoomPainter = {
  bg(ctx, time, w) {
    // Hallway (0-930)
    ctx.fillStyle = vgrad(ctx, 0, FLOOR_Y, [[0, 0xe9eef5], [1, 0xdde4ee]]);
    ctx.fillRect(0, 0, 940, FLOOR_Y);
    ctx.fillStyle = vgrad(ctx, 300, FLOOR_Y, [[0, 0xa8bcd2], [1, 0x8ea4bc]]);
    ctx.fillRect(0, 300, 940, FLOOR_Y - 300);
    ctx.fillStyle = '#7a90aa'; ctx.fillRect(0, 296, 940, 6);
    // Classroom wall
    drawWall(ctx, w, FLOOR_Y, { base: 0xf5edda, accent: 0xd8c4a0, pattern: 'panel', wainscot: 0xc8a07a });
    ctx.fillStyle = vgrad(ctx, 0, FLOOR_Y, [[0, 0xe9eef5], [1, 0xdde4ee]]);
    ctx.fillRect(0, 0, 940, FLOOR_Y - 130 - 8);
    ctx.fillStyle = vgrad(ctx, 300, FLOOR_Y, [[0, 0xa8bcd2], [1, 0x8ea4bc]]);
    ctx.fillRect(0, 300, 940, FLOOR_Y - 316);
    ctx.fillStyle = '#7a90aa'; ctx.fillRect(0, 296, 940, 6);
    drawFloor(ctx, w, FLOOR_Y, 720 - FLOOR_Y, 'school', 0xc8b49a);
    // ceiling lights
    for (let x = 160; x < w; x += 360) {
      fillRR(ctx, x, 14, 140, 12, 4, '#ffffff');
      if (time !== 'night') glow(ctx, x + 70, 30, 120, 0xffffff, 0.25);
    }

    // Exit doors
    ctx.fillStyle = '#d0d8e0'; ctx.fillRect(14, 160, 142, 340);
    for (const dx of [22, 90]) {
      fillRR(ctx, dx, 170, 60, 330, 3, vgrad(ctx, 170, 500, [[0, 0x6a9a8a], [1, 0x4a7a6a]]));
      fillRR(ctx, dx + 10, 190, 40, 140, 3, 'rgba(200,235,255,0.75)');
      ctx.fillStyle = '#c0c0c8'; ctx.fillRect(dx + 8, 360, 44, 8);
    }
    fillRR(ctx, 50, 120, 70, 26, 4, '#2a8a4a');
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('EXIT', 85, 139);

    // Lockers
    floorShadow(ctx, 340, 500, 480, 0.25);
    for (let i = 0; i < 6; i++) {
      const lx = 120 + i * 70;
      const her = i === 3;
      const c = her ? 0xf4a6b8 : 0x7f9cc8;
      fillRR(ctx, lx, 190, 66, 310, 3, vgrad(ctx, 190, 500, [[0, shade(c, 0.1)], [1, shade(c, -0.12)]]));
      ctx.fillStyle = hex(shade(c, -0.25));
      for (let v = 0; v < 4; v++) ctx.fillRect(lx + 14, 206 + v * 8, 38, 3);
      fillRR(ctx, lx + 48, 330, 8, 26, 3, '#d0d0d8');
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(lx + 64, 190, 2, 310);
      if (her) {
        ctx.fillStyle = '#ffffff'; heartPath(ctx, lx + 33, 260, 20); ctx.fill();
        ctx.fillStyle = '#ffd36a'; starPath(ctx, lx + 18, 300, 7); ctx.fill();
        ctx.fillStyle = '#fffbea'; ctx.fillRect(lx + 26, 380, 28, 30);
      }
    }
    // Bulletin board
    fillRR(ctx, 560, 170, 220, 170, 4, '#a87650');
    fillRR(ctx, 568, 178, 204, 154, 3, '#d9b080');
    const pr = rng('board');
    for (let i = 0; i < 7; i++) {
      const px = 580 + pr.next() * 150, py = 188 + pr.next() * 100;
      ctx.save(); ctx.translate(px + 20, py + 20); ctx.rotate((pr.next() - 0.5) * 0.3);
      ctx.fillStyle = hex(pr.pick([0xffffff, 0xfff3a8, 0xffd6e0, 0xd0f0ff]));
      ctx.fillRect(-20, -18, 42, 40);
      ctx.fillStyle = 'rgba(80,80,100,0.4)'; for (let l = 0; l < 3; l++) ctx.fillRect(-14, -8 + l * 9, 30, 2);
      ellipse(ctx, 0, -18, 3, 3, '#e04a5a');
      ctx.restore();
    }
    ctx.fillStyle = '#5a3a2a'; ctx.font = 'bold 15px Fredoka, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('CHALLENGES', 670, 164);
    // Pillar between hallway and classroom
    fillRR(ctx, 915, 0, 50, 500, 0, vgrad(ctx, 0, 500, [[0, 0xf0ece4], [1, 0xd8d0c4]]));

    // Clock
    ellipse(ctx, 1050, 210, 34, 34, '#5a4a4a'); ellipse(ctx, 1050, 210, 29, 29, '#ffffff');
    ctx.strokeStyle = '#3a2a2a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(1050, 210); ctx.lineTo(1050, 190); ctx.moveTo(1050, 210); ctx.lineTo(1064, 216); ctx.stroke();

    // Chalkboard
    fillRR(ctx, 1140, 140, 520, 240, 6, '#9a6a48');
    fillRR(ctx, 1152, 152, 496, 216, 4, vgrad(ctx, 152, 368, [[0, 0x3a6a54], [1, 0x2c5442]]));
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(1160, 170, 300, 60);
    fillRR(ctx, 1150, 376, 500, 12, 3, '#a87650');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(1210, 370, 18, 6); ctx.fillStyle = '#ffb3c8'; ctx.fillRect(1240, 370, 14, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '38px Caveat, cursive'; ctx.textAlign = 'left';
    ctx.fillText('Today’s lesson:', 1185, 205);
    ctx.font = '46px Caveat, cursive';
    ctx.fillStyle = 'rgba(255,200,215,0.95)';
    ctx.fillText('L _ V E   W _ R D S', 1215, 270);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2.5;
    heartPath(ctx, 1590, 180, 34); ctx.stroke();
    starPath(ctx, 1560, 320, 14); ctx.stroke();
    ctx.font = '26px Caveat, cursive'; ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('+ = ♡', 1200, 330);

    // Teacher desk
    floorShadow(ctx, 1820, 505, 260, 0.28);
    fillRR(ctx, 1720, 392, 200, 108, 4, vgrad(ctx, 392, 500, [[0, 0xb8865e], [1, 0x946644]]));
    fillRR(ctx, 1712, 382, 216, 14, 3, '#c8946a');
    ctx.strokeStyle = 'rgba(60,30,20,0.3)'; ctx.lineWidth = 2; ctx.strokeRect(1735, 410, 80, 75);
    ellipse(ctx, 1755, 368, 13, 13, '#e0404f'); ctx.fillStyle = '#5a3a2a'; ctx.fillRect(1754, 350, 3, 8);
    ellipse(ctx, 1762, 352, 6, 3, '#5fae6a');
    ctx.fillStyle = '#fffdf8'; ctx.fillRect(1790, 368, 60, 14); ctx.fillStyle = '#f0e8dc'; ctx.fillRect(1794, 362, 56, 8);
    ellipse(ctx, 1890, 352, 20, 20, '#7fb4e8'); ellipse(ctx, 1885, 346, 8, 6, '#7cc274');
    ctx.fillStyle = '#9a6a48'; ctx.fillRect(1888, 372, 4, 10);

    // Student desk (secret)
    floorShadow(ctx, 1965, 505, 120, 0.25);
    fillRR(ctx, 1925, 440, 80, 10, 3, '#d4a47c');
    ctx.fillStyle = '#7a7a88'; ctx.fillRect(1935, 450, 5, 50); ctx.fillRect(1990, 450, 5, 50);
    ctx.strokeStyle = 'rgba(60,30,20,0.6)'; ctx.lineWidth = 1.5; heartPath(ctx, 1992, 470, 10); ctx.stroke();

    // Windows
    for (const wx of [1990, 2170]) {
      drawWindow(ctx, wx, 130, 160, 210, time, { seed: 'sch' + wx, rows: 3, view: (c) => {
        c.fillStyle = time === 'night' ? '#20402e' : '#7cc274';
        c.fillRect(wx, 290, 160, 50);
        ellipse(c, wx + 50, 290, 34, 30, time === 'night' ? '#1a3428' : '#5fae6a');
      } });
    }
    drawPlant(ctx, 2360, 500, 0.9, 0x8ab0d8);
  },
};

export const ROOMS: Record<LocationId, RoomPainter> = { bedroom, livingroom, kitchen, backyard, school };

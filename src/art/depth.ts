import type { TimeOfDay } from '../content/types';
import { type Ctx } from './paint';

/*
 * The depth pass: painted once over an indoor room (after its furniture), so it costs nothing per frame.
 *  - ambient occlusion where surfaces meet: under the ceiling, along the foot of the wall, on the floor at the wall,
 *    and in the far corners at each end of the room
 *  - light from every window falling onto the floor as a slanted patch (the sun's direction follows the time of
 *    day), with a faint beam through the air; moonlight at night
 *  - the floor nearest us a touch darker, so the eye settles on the room
 * Windows report themselves while they're painted (see `paintLog`, filled by drawWindow).
 */

export interface Rect { x: number; y: number; w: number; h: number }

/** What the painters drew that the depth pass needs to know about. Reset before each room. */
export const paintLog = { windows: [] as Rect[] };
export function beginRoomPaint() { paintLog.windows = []; }

/** Sun direction (floor-light slant: + falls to the right), colour and strength per time of day. */
const LIGHT: Record<TimeOfDay, { slant: number; color: [number, number, number]; a: number }> = {
  morning: { slant: 1, color: [255, 228, 180], a: 0.22 },
  day: { slant: 0.3, color: [255, 248, 228], a: 0.17 },
  sunset: { slant: -1.1, color: [255, 170, 110], a: 0.24 },
  night: { slant: -0.4, color: [170, 190, 255], a: 0.09 },
};

const rgba = ([r, g, b]: [number, number, number], a: number) => `rgba(${r},${g},${b},${a})`;

function band(ctx: Ctx, x: number, y0: number, w: number, y1: number, from: string, to: string) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  ctx.fillStyle = g;
  ctx.fillRect(x, Math.min(y0, y1), w, Math.abs(y1 - y0));
}

export function depthPass(ctx: Ctx, w: number, floorY: number, time: TimeOfDay) {
  const H = 720;
  const ao = 'rgba(48,22,54,';
  ctx.save();
  // Under the ceiling.
  band(ctx, 0, 0, w, 90, `${ao}0.17)`, `${ao}0)`);
  // Foot of the wall and the floor right against it (the deepest crease in the room).
  band(ctx, 0, floorY - 70, w, floorY, `${ao}0)`, `${ao}0.11)`);
  band(ctx, 0, floorY, w, floorY + 80, `${ao}0.16)`, `${ao}0)`);
  // The room's two ends: corners recede into shadow.
  for (const [x0, x1] of [[0, 170], [w, w - 170]]) {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, `${ao}0.2)`);
    g.addColorStop(1, `${ao}0)`);
    ctx.fillStyle = g;
    ctx.fillRect(Math.min(x0, x1), 0, 170, H);
  }
  // Closest to us: a soft darkening at the bottom edge.
  band(ctx, 0, floorY + 150, w, H, `${ao}0)`, `${ao}0.12)`);

  // Window light on the floor, and a faint beam through the air.
  const L = LIGHT[time];
  ctx.globalCompositeOperation = 'lighter';
  ctx.filter = 'blur(9px)'; // soft-edged light (painted once, so the blur costs nothing per frame)
  for (const win of paintLog.windows) {
    const s = L.slant;
    const top = floorY + 8, bot = floorY + 175;
    const x0 = win.x + 10, x1 = win.x + win.w - 10;
    const nearShift = s * 60, farShift = s * 250;
    // patch on the floor (fades toward us)
    const g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, rgba(L.color, L.a));
    g.addColorStop(1, rgba(L.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0 + nearShift, top);
    ctx.lineTo(x1 + nearShift, top);
    ctx.lineTo(x1 + farShift + 30, bot);
    ctx.lineTo(x0 + farShift - 30, bot);
    ctx.closePath();
    ctx.fill();
    // the beam from the window down to the patch
    const wy = win.y + win.h;
    const b = ctx.createLinearGradient(0, win.y + win.h * 0.4, 0, top);
    b.addColorStop(0, rgba(L.color, L.a * 0.32));
    b.addColorStop(1, rgba(L.color, 0));
    ctx.fillStyle = b;
    ctx.beginPath();
    ctx.moveTo(x0, wy);
    ctx.lineTo(x1, wy);
    ctx.lineTo(x1 + nearShift, top);
    ctx.lineTo(x0 + nearShift, top);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

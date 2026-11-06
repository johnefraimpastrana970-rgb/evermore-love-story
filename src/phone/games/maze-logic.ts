import { Dir, VEC } from './dir';

/*
 * Heart Maze: an original maze-chase game. A little heart collects sparkles while grumpy storm clouds roam the maze.
 * Petals make the clouds harmless for a few seconds, and catching one then sends it home for points.
 *
 * Legend: # wall · sparkle o petal (space) empty floor  P heart start  C cloud start
 */
export const MAZE = [
  '###############',
  '#o.....#.....o#',
  '#.###.#.#.###.#',
  '#.............#',
  '#.##.##.##.##.#',
  '#....#   #....#',
  '####.# C #.####',
  '#....#C C#....#',
  '#.##.##.##.##.#',
  '#.............#',
  '#.###.#.#.###.#',
  '#...#.#.#.#...#',
  '###.#.....#.###',
  '#.....#P#.....#',
  '#.###.#.#.###.#',
  '#o...........o#',
  '###############',
];

export interface Actor { x: number; y: number; dir: Dir; }
export interface Cloud extends Actor {
  home: [number, number];
  /** Seconds until it leaves home (start-up and after being caught). */
  wait: number;
  scared: boolean;
  style: 'chase' | 'ahead' | 'wander';
}
export type MazeEvent = 'sparkle' | 'petal' | 'catch' | 'hit' | 'clear' | 'over';

const OPP: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const DIRS: Dir[] = ['up', 'left', 'down', 'right'];
const key = (x: number, y: number) => `${x},${y}`;

export class MazeGame {
  readonly cols = MAZE[0].length;
  readonly rows = MAZE.length;
  readonly walls: boolean[][] = MAZE.map((r) => [...r].map((c) => c === '#'));
  sparkles = new Set<string>();
  petals = new Set<string>();
  player: Actor & { want: Dir | null } = { x: 0, y: 0, dir: 'left', want: null };
  clouds: Cloud[] = [];
  score = 0;
  lives = 3;
  level = 1;
  /** Seconds of petal power left. */
  power = 0;
  /** Freeze after a hit / level clear. */
  pause = 1.2;
  over = false;
  private combo = 0;
  private start: [number, number] = [7, 13];
  private homes: [number, number][] = [];

  constructor(private rand = Math.random) {
    MAZE.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === 'P') this.start = [x, y];
      if (c === 'C') this.homes.push([x, y]);
    }));
    this.fill();
    this.resetActors();
  }

  open(x: number, y: number) {
    return y >= 0 && y < this.rows && x >= 0 && x < this.cols && !this.walls[y][x];
  }
  private fill() {
    MAZE.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === '.') this.sparkles.add(key(x, y));
      if (c === 'o') this.petals.add(key(x, y));
    }));
  }
  private resetActors() {
    this.player = { x: this.start[0], y: this.start[1], dir: 'up', want: null };
    const styles: Cloud['style'][] = ['chase', 'ahead', 'wander'];
    this.clouds = this.homes.map((h, i) => ({ x: h[0], y: h[1], dir: 'up', home: h, wait: 1 + i * 2.5, scared: false, style: styles[i % 3] }));
    this.power = 0;
    this.pause = 1.2;
  }

  get playerSpeed() { return 5.4; }
  get cloudSpeed() { return Math.min(5.2, 3.9 * (1 + 0.07 * (this.level - 1))); }
  get powerTime() { return Math.max(3, 6.5 - 0.5 * (this.level - 1)); }

  steer(d: Dir) {
    this.player.want = d;
    if (d === OPP[this.player.dir]) this.player.dir = d; // reversing is always allowed, even mid-corridor
  }

  update(dt: number): MazeEvent[] {
    const ev: MazeEvent[] = [];
    if (this.over) return ev;
    if (this.pause > 0) { this.pause -= dt; return ev; }
    if (this.power > 0) {
      this.power -= dt;
      if (this.power <= 0) { this.clouds.forEach((c) => (c.scared = false)); this.combo = 0; }
    }
    // The heart.
    this.move(this.player, this.playerSpeed * dt, (a) => {
      const p = this.player;
      if (p.want && this.open(a.x + VEC[p.want][0], a.y + VEC[p.want][1])) return p.want;
      return this.open(a.x + VEC[a.dir][0], a.y + VEC[a.dir][1]) ? a.dir : null;
    });
    const k = key(Math.round(this.player.x), Math.round(this.player.y));
    if (this.sparkles.delete(k)) { this.score += 10; ev.push('sparkle'); }
    if (this.petals.delete(k)) {
      this.score += 50;
      this.power = this.powerTime;
      this.combo = 0;
      this.clouds.forEach((c) => { if (c.wait <= 0) { c.scared = true; c.dir = OPP[c.dir]; } });
      ev.push('petal');
    }
    // The clouds.
    for (const c of this.clouds) {
      if (c.wait > 0) { c.wait -= dt; continue; }
      const speed = c.scared ? this.cloudSpeed * 0.6 : this.cloudSpeed;
      this.move(c, speed * dt, (a) => this.cloudChoice(c, a));
      if (Math.hypot(c.x - this.player.x, c.y - this.player.y) < 0.62) {
        if (c.scared) {
          this.combo++;
          this.score += 100 * 2 ** Math.min(3, this.combo);
          Object.assign(c, { x: c.home[0], y: c.home[1], wait: 2.5, scared: false });
          ev.push('catch');
        } else {
          this.lives--;
          ev.push('hit');
          if (this.lives <= 0) { this.over = true; ev.push('over'); return ev; }
          this.resetActors();
          return ev;
        }
      }
    }
    if (!this.sparkles.size && !this.petals.size) {
      this.level++;
      this.fill();
      this.resetActors();
      this.pause = 1.6;
      ev.push('clear');
    }
    return ev;
  }

  /** Clouds never turn back unless stuck. Chasers head for her (or ahead of her); scared ones wander. */
  private cloudChoice(c: Cloud, a: Actor): Dir | null {
    let opts = DIRS.filter((d) => d !== OPP[a.dir] && this.open(a.x + VEC[d][0], a.y + VEC[d][1]));
    if (!opts.length) opts = DIRS.filter((d) => this.open(a.x + VEC[d][0], a.y + VEC[d][1]));
    if (!opts.length) return null;
    const p = this.player;
    const smart = c.scared ? 0 : c.style === 'wander' ? 0.45 : 0.8;
    if (this.rand() >= smart) return opts[Math.floor(this.rand() * opts.length)];
    let tx = p.x, ty = p.y;
    if (c.style === 'ahead') { tx += VEC[p.dir][0] * 3; ty += VEC[p.dir][1] * 3; }
    return opts.reduce((best, d) => {
      const dist = (dd: Dir) => Math.hypot(a.x + VEC[dd][0] - tx, a.y + VEC[dd][1] - ty);
      return dist(d) < dist(best) ? d : best;
    });
  }

  /** Move along cell centres; `choose` picks a direction whenever the actor sits exactly on a centre. */
  private move(a: Actor, dist: number, choose: (a: Actor) => Dir | null) {
    let guard = 0;
    while (dist > 1e-6 && guard++ < 8) {
      const onCentre = Math.abs(a.x - Math.round(a.x)) < 1e-6 && Math.abs(a.y - Math.round(a.y)) < 1e-6;
      if (onCentre) {
        a.x = Math.round(a.x); a.y = Math.round(a.y);
        const d = choose(a);
        if (!d) return;
        a.dir = d;
      }
      const [dx, dy] = VEC[a.dir];
      const pos = dx ? a.x : a.y;
      const dir = dx || dy;
      const target = dir > 0 ? Math.floor(pos + 1e-6) + 1 : Math.ceil(pos - 1e-6) - 1;
      const step = Math.min(dist, Math.abs(target - pos));
      if (dx) a.x += step * dx; else a.y += step * dy;
      dist -= step;
      if (Math.abs((dx ? a.x : a.y) - target) < 1e-6) { if (dx) a.x = target; else a.y = target; }
    }
  }
}

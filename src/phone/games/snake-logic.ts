import { Dir, VEC } from './dir';

/** Pure snake rules, separate from drawing (tested in tests/phone.test.ts). */
export class SnakeGame {
  body: [number, number][];
  dir: Dir = 'right';
  private queue: Dir[] = [];
  food: [number, number] = [0, 0];
  golden = false;
  score = 0;
  over = false;
  constructor(public cols: number, public rows: number, private rand = Math.random) {
    const y = Math.floor(rows / 2);
    this.body = [[4, y], [3, y], [2, y]];
    this.placeFood();
  }
  turn(d: Dir) {
    const last = this.queue[this.queue.length - 1] ?? this.dir;
    const [lx, ly] = VEC[last], [nx, ny] = VEC[d];
    if (lx + nx === 0 && ly + ny === 0) return; // no reversing into yourself
    if (d !== last && this.queue.length < 2) this.queue.push(d);
  }
  /** Advance one cell. Returns 'eat' | 'golden' | 'die' | null. */
  step(): 'eat' | 'golden' | 'die' | null {
    if (this.over) return null;
    if (this.queue.length) this.dir = this.queue.shift()!;
    const [dx, dy] = VEC[this.dir];
    const head: [number, number] = [this.body[0][0] + dx, this.body[0][1] + dy];
    const ate = head[0] === this.food[0] && head[1] === this.food[1];
    const tail = ate ? this.body : this.body.slice(0, -1);
    if (head[0] < 0 || head[1] < 0 || head[0] >= this.cols || head[1] >= this.rows || tail.some(([x, y]) => x === head[0] && y === head[1])) {
      this.over = true;
      return 'die';
    }
    this.body.unshift(head);
    if (!ate) { this.body.pop(); return null; }
    const wasGolden = this.golden;
    this.score += wasGolden ? 5 : 1;
    if (wasGolden) this.body.push(this.body[this.body.length - 1]); // golden hearts grow you a little more
    this.placeFood();
    return wasGolden ? 'golden' : 'eat';
  }
  placeFood() {
    const free: [number, number][] = [];
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) if (!this.body.some(([a, b]) => a === x && b === y)) free.push([x, y]);
    if (!free.length) { this.over = true; return; }
    this.food = free[Math.floor(this.rand() * free.length)];
    this.golden = this.score > 0 && this.rand() < 0.12;
  }
  get speed() {
    return Math.min(15, 6.5 + this.score * 0.18); // cells per second
  }
}

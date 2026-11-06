export type Hand = 'rock' | 'paper' | 'scissors';
export const HANDS: Hand[] = ['rock', 'paper', 'scissors'];
const BEATS: Record<Hand, Hand> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

/** 1 = a wins, -1 = b wins, 0 = draw. */
export function judge(a: Hand, b: Hand): 1 | 0 | -1 {
  return a === b ? 0 : BEATS[a] === b ? 1 : -1;
}

/** First to `target` wins the match. */
export class RpsMatch {
  me = 0;
  them = 0;
  rounds: { mine: Hand; theirs: Hand; result: 1 | 0 | -1 }[] = [];
  constructor(public target = 3, private rand = Math.random) {}
  get done() { return this.me >= this.target || this.them >= this.target; }
  play(mine: Hand) {
    if (this.done) throw new Error('match is over');
    const theirs = HANDS[Math.floor(this.rand() * 3)];
    const result = judge(mine, theirs);
    if (result === 1) this.me++;
    if (result === -1) this.them++;
    const r = { mine, theirs, result };
    this.rounds.push(r);
    return r;
  }
}

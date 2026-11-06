/**
 * Calculator engine (no eval). Behaves like a phone calculator:
 * - × and ÷ bind tighter than + and − (2 + 3 × 4 = 14)
 * - % turns the entry into a percentage (of the left operand after + / −: 200 + 10 % = 220)
 * - ± flips the sign, ⌫ deletes a digit, C clears the entry, AC clears everything
 * - memory: MC, MR, M+, M−
 * - results are rounded to 12 significant digits so 0.1 + 0.2 = 0.3
 */
export type Op = '+' | '−' | '×' | '÷';
export type Key = string; // '0'-'9', '.', Op, '=', '%', '±', 'C', 'AC', '⌫', 'MC', 'MR', 'M+', 'M−'

const MAX_DIGITS = 15;

export class Calculator {
  private expr: (number | Op)[] = [];
  private entry = '0';
  /** True right after '=' or an operator, so the next digit starts a fresh number. */
  private fresh = true;
  private evaluated = false;
  memory = 0;
  error: string | null = null;

  get display(): string {
    if (this.error) return this.error;
    return formatNumber(this.entry);
  }
  /** The expression line above the result, e.g. "12 + 3 ×". */
  get expression(): string {
    return this.expr.map((t) => (typeof t === 'number' ? formatNumber(String(t)) : t)).join(' ');
  }
  /** "AC" when there is nothing to clear in the entry. */
  get clearLabel(): 'C' | 'AC' {
    return this.entry !== '0' && !this.fresh && !this.error ? 'C' : 'AC';
  }

  press(key: Key): void {
    if (this.error && key !== 'AC' && key !== 'C') this.reset();
    if (/^[0-9]$/.test(key)) return this.digit(key);
    switch (key) {
      case '.': return this.dot();
      case '+': case '−': case '×': case '÷': return this.op(key);
      case '-': return this.op('−');
      case '*': return this.op('×');
      case '/': return this.op('÷');
      case '=': return this.equals();
      case '%': return this.percent();
      case '±': return this.negate();
      case 'C': if (this.clearLabel === 'C') { this.entry = '0'; this.fresh = true; } else this.reset(); return;
      case 'AC': return this.reset();
      case '⌫': return this.backspace();
      case 'MC': this.memory = 0; return;
      case 'MR': this.entry = trimNumber(this.memory); this.fresh = false; this.evaluated = false; return;
      case 'M+': this.memory = round(this.memory + Number(this.entry)); this.fresh = true; return;
      case 'M−': this.memory = round(this.memory - Number(this.entry)); this.fresh = true; return;
    }
  }

  private reset() {
    this.expr = [];
    this.entry = '0';
    this.fresh = true;
    this.evaluated = false;
    this.error = null;
  }

  private digit(d: string) {
    if (this.evaluated) { this.expr = []; this.evaluated = false; }
    if (this.fresh) { this.entry = d; this.fresh = false; return; }
    if (this.entry.replace(/[-.]/g, '').length >= MAX_DIGITS) return;
    this.entry = this.entry === '0' ? d : this.entry === '-0' ? '-' + d : this.entry + d;
  }

  private dot() {
    if (this.evaluated) { this.expr = []; this.evaluated = false; }
    if (this.fresh) { this.entry = '0.'; this.fresh = false; return; }
    if (!this.entry.includes('.')) this.entry += '.';
  }

  private op(o: Op) {
    this.evaluated = false;
    if (this.fresh && this.expr.length && typeof this.expr[this.expr.length - 1] !== 'number') {
      this.expr[this.expr.length - 1] = o; // change your mind: 5 + × → 5 ×
      return;
    }
    this.expr.push(Number(this.entry), o);
    // Show the running total of what can already be computed (like a phone does).
    const partial = evaluate(this.expr.slice(0, -1), o === '+' || o === '−' ? 'all' : 'mul');
    if (partial.error) return this.fail(partial.error);
    this.entry = trimNumber(partial.value);
    this.fresh = true;
  }

  private equals() {
    if (!this.expr.length) { this.evaluated = true; this.fresh = true; return; }
    const tokens = [...this.expr];
    if (!this.fresh || typeof tokens[tokens.length - 1] !== 'number') tokens.push(Number(this.entry));
    const r = evaluate(tokens, 'all');
    if (r.error) return this.fail(r.error);
    this.expr = [];
    this.entry = trimNumber(r.value);
    this.fresh = true;
    this.evaluated = true;
  }

  private percent() {
    const n = Number(this.entry);
    const last = this.expr[this.expr.length - 1];
    const left = this.expr[this.expr.length - 2];
    const v = (last === '+' || last === '−') && typeof left === 'number' ? (left * n) / 100 : n / 100;
    this.entry = trimNumber(round(v));
    this.fresh = false;
    this.evaluated = false;
  }

  private negate() {
    if (this.entry === '0') { if (this.fresh) { this.entry = '-0'; this.fresh = false; } return; }
    this.entry = this.entry.startsWith('-') ? this.entry.slice(1) : '-' + this.entry;
    if (this.evaluated) { this.evaluated = false; this.expr = []; }
    this.fresh = false;
  }

  private backspace() {
    if (this.fresh || this.evaluated) return;
    this.entry = this.entry.length > 1 && this.entry !== '-0' ? this.entry.slice(0, -1) : '0';
    if (this.entry === '-' ) this.entry = '0';
  }

  private fail(msg: string) {
    this.reset();
    this.error = msg;
  }
}

/** Evaluate number/operator tokens with precedence. mode 'mul' only folds a trailing × ÷ chain (for live totals). */
export function evaluate(tokens: (number | Op)[], mode: 'all' | 'mul' = 'all'): { value: number; error?: string } {
  if (!tokens.length) return { value: 0 };
  // First pass: × and ÷.
  const terms: (number | Op)[] = [tokens[0]];
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i] as Op;
    const b = tokens[i + 1] as number;
    if (op === '×' || op === '÷') {
      const a = terms.pop() as number;
      if (op === '÷' && b === 0) return { value: NaN, error: 'Can’t divide by 0' };
      terms.push(op === '×' ? a * b : a / b);
    } else terms.push(op, b);
  }
  if (mode === 'mul') return { value: round(terms[terms.length - 1] as number) };
  let v = terms[0] as number;
  for (let i = 1; i < terms.length; i += 2) v = terms[i] === '+' ? v + (terms[i + 1] as number) : v - (terms[i + 1] as number);
  if (!Number.isFinite(v)) return { value: NaN, error: 'Too big' };
  return { value: round(v) };
}

export function round(v: number): number {
  if (!Number.isFinite(v) || v === 0) return v;
  return Number(v.toPrecision(12));
}

function trimNumber(v: number): string {
  if (Object.is(v, -0)) return '0';
  const abs = Math.abs(v);
  if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) return v.toExponential(6).replace(/\.?0+e/, 'e');
  return String(v);
}

/** Add thousands separators for display, keep what's being typed ("12." stays "12."). */
export function formatNumber(s: string): string {
  if (/e/.test(s)) return s;
  const neg = s.startsWith('-');
  const [int, frac] = (neg ? s.slice(1) : s).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + grouped + (frac !== undefined ? '.' + frac : '');
}

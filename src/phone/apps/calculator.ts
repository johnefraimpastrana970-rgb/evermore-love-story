import { registerApp } from '../phone';
import { Calculator } from '../calc';
import { audio } from '../../audio/audio';

const KEYS = [
  ['MC', 'MR', 'M−', 'M+'],
  ['AC', '±', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['⌫', '0', '.', '='],
];
const KEYBOARD: Record<string, string> = {
  Enter: '=', '=': '=', Backspace: '⌫', Escape: 'AC', Delete: 'C', '%': '%', '.': '.', ',': '.',
  '+': '+', '-': '−', '*': '×', x: '×', '/': '÷',
};

registerApp({
  id: 'calculator',
  name: 'Calculator',
  open(ctx) {
    const calc = new Calculator();
    ctx.host.innerHTML = `<div class="calc">
      <div class="calc-screen"><div class="calc-mem"></div><div class="calc-expr"></div><div class="calc-out" aria-live="polite"></div></div>
      <div class="calc-keys">${KEYS.flat().map((k) => `<button class="ck ${/[÷×−+=]/.test(k) ? 'op' : /^M/.test(k) ? 'mem' : /AC|±|%|⌫/.test(k) ? 'fn' : ''}" data-k="${k}">${k}</button>`).join('')}</div>
    </div>`;
    const out = ctx.host.querySelector('.calc-out') as HTMLElement;
    const expr = ctx.host.querySelector('.calc-expr') as HTMLElement;
    const mem = ctx.host.querySelector('.calc-mem') as HTMLElement;
    const clearKey = ctx.host.querySelector('[data-k=AC]') as HTMLElement;
    const render = () => {
      out.textContent = calc.display;
      // Shrink long numbers so they always fit.
      const len = calc.display.length;
      out.style.fontSize = len > 14 ? '24px' : len > 10 ? '32px' : '';
      out.classList.toggle('err', !!calc.error);
      expr.textContent = calc.expression || ' ';
      mem.textContent = calc.memory ? `M = ${calc.memory}` : '';
      clearKey.textContent = calc.clearLabel;
      ctx.host.querySelectorAll<HTMLElement>('.ck.op').forEach((b) => b.classList.toggle('armed', calc.expression.endsWith(b.dataset.k!) && b.dataset.k !== '='));
    };
    const press = (k: string) => {
      calc.press(k === 'AC' ? calc.clearLabel : k);
      audio.sfx('type');
      render();
    };
    ctx.host.querySelectorAll<HTMLElement>('[data-k]').forEach((b) => b.addEventListener('click', () => press(b.dataset.k!)));
    const onKey = (e: KeyboardEvent) => {
      const k = /^[0-9]$/.test(e.key) ? e.key : KEYBOARD[e.key];
      if (!k || e.key === 'Escape') return; // Escape still goes back
      e.preventDefault();
      e.stopPropagation();
      press(k === 'AC' ? 'AC' : k);
      const btn = ctx.host.querySelector<HTMLElement>(`[data-k="${k}"]`);
      btn?.classList.add('pressed');
      setTimeout(() => btn?.classList.remove('pressed'), 120);
    };
    window.addEventListener('keydown', onKey, true);
    render();
    return () => window.removeEventListener('keydown', onKey, true);
  },
});

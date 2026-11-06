export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export function $(sel: string, root: ParentNode = document): HTMLElement {
  const e = root.querySelector(sel);
  if (!e) throw new Error(`Missing element ${sel}`);
  return e as HTMLElement;
}

export function uiRoot(): HTMLElement {
  return $('#ui');
}

/** Text with ⟦placeholder⟧ markers rendered as styled template chips, newlines → <br>. */
export function richText(s: string): string {
  return esc(s)
    .replace(/⟦([^⟧]*)⟧/g, '<span class="tpl">$1</span>')
    .replace(/\n/g, '<br>');
}

export function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export function isTouch(): boolean {
  return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
}

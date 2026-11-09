import { store } from '../core/store';
import { toast } from '../systems/game';
import { HOME_MEMORY_DEFS, remember, type HomeMemory, type HomeMemoryId } from './logic';

export function captureHomeMemory(id: HomeMemoryId): boolean {
  if (!store.hasGame) return false;
  const memory = remember(store.state.home, id);
  if (!memory) return false;
  store.save();
  toast(`A new home memory: ${memory.title} ♡`, 'polaroid', 'good');
  return true;
}

const xml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function homeMemoryImage(memory: HomeMemory): string {
  const colors = {
    bedroom: ['#f8d7e2', '#c56f91'],
    livingroom: ['#e7e4f5', '#8174a8'],
    kitchen: ['#f8e7c7', '#c68d51'],
  }[memory.room];
  const title = xml(HOME_MEMORY_DEFS[memory.id].title);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs><linearGradient id="paper" x2="0" y2="1"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="#fff8f1"/></linearGradient></defs>
    <rect width="600" height="600" rx="34" fill="url(#paper)"/>
    <circle cx="492" cy="104" r="52" fill="#fff9d9" opacity=".8"/>
    <path d="M92 342 300 176l208 166v148H92z" fill="#fffaf4" stroke="${colors[1]}" stroke-width="12" stroke-linejoin="round"/>
    <path d="M62 352 300 158l238 194" fill="none" stroke="${colors[1]}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="260" y="382" width="82" height="108" rx="36" fill="${colors[0]}" stroke="${colors[1]}" stroke-width="8"/>
    <rect x="132" y="374" width="78" height="70" rx="12" fill="#d9eff0" stroke="${colors[1]}" stroke-width="8"/>
    <rect x="390" y="374" width="78" height="70" rx="12" fill="#d9eff0" stroke="${colors[1]}" stroke-width="8"/>
    <path d="M292 284c-34-36-87 10 8 70 95-60 42-106 8-70-6 7-10 14-8 23-2-9-2-16-8-23z" fill="#ed7797"/>
    <text x="300" y="548" text-anchor="middle" fill="#59384f" font-family="Fredoka, sans-serif" font-size="32" font-weight="600">${title}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

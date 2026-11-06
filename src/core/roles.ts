/**
 * Who is who.
 *
 * Story content is written from one point of view: `'her'` is the character the player controls and `'him'` is the
 * partner who keeps them company. When a story is started as the boyfriend, the two roles swap: the player walks
 * around as him and she becomes the companion. Speakers, names ({her} / {him}) and pronouns in the text are mapped
 * here, so every quest, talk and joke works for both without writing anything twice.
 */
export type Who = 'her' | 'him';

export const other = (w: Who): Who => (w === 'her' ? 'him' : 'her');

/** Words after "her" that mean it's an object ("hug her tight") rather than a possessive ("her glasses"). */
const OBJECT_FOLLOWERS = new Set(`a an the and or but nor to up in on at with for from of out back again so too that this
these those than like into onto over off down away around close closer tight tighter just more less even still all
yourself myself everything something anything nothing first last now then today tonight here there how what why when
where who whom if as because about before after until while once not never always really very please know feel think
hear see look smile laugh cry sleep stay go come be is was`.split(/\s+/));

const PAIRS: Record<string, string> = {
  he: 'she', she: 'he',
  himself: 'herself', herself: 'himself',
  hers: 'his',
  boyfriend: 'girlfriend', girlfriend: 'boyfriend',
  boyfriends: 'girlfriends', girlfriends: 'boyfriends',
  boy: 'girl', girl: 'boy', boys: 'girls', girls: 'boys',
  guy: 'girl',
  husband: 'wife', wife: 'husband',
  king: 'queen', queen: 'king', prince: 'princess', princess: 'prince',
  mr: 'ms', ms: 'mr',
};

function matchCase(src: string, word: string): string {
  if (src.length > 1 && src === src.toUpperCase()) return word.toUpperCase();
  if (src[0] === src[0].toUpperCase()) return word[0].toUpperCase() + word.slice(1);
  return word;
}

/** Swap gendered words: he ↔ she, his ↔ her, him ↔ her, boyfriend ↔ girlfriend… Leaves {tokens} alone. */
export function swapGender(text: string): string {
  return text.replace(/(\{[a-z]+\})|\b([A-Za-z]+)\b(?=(\s*)([A-Za-z’']*))/g, (m, token, word: string, _sp: string, nextWord: string) => {
    if (token) return token;
    const lower = word.toLowerCase();
    let out: string | undefined;
    if (lower === 'him') out = 'her';
    else if (lower === 'his') out = nextWord && /^[a-z]/i.test(nextWord) && !OBJECT_FOLLOWERS.has(nextWord.toLowerCase()) ? 'her' : 'hers';
    else if (lower === 'her') out = nextWord && /^[a-z]/i.test(nextWord) && !OBJECT_FOLLOWERS.has(nextWord.toLowerCase()) ? 'his' : 'him';
    else out = PAIRS[lower];
    return out ? matchCase(word, out) : m;
  });
}

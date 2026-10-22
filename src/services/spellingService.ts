/**
 * Spelling Service
 * Provides spelling correction suggestions using a hybrid architecture:
 * 1. Offline dictionary of common typos and misspellings
 * 2. Datamuse spelling API (`sp=`) for broad online coverage
 * 3. Smart casing and punctuation preservation
 */

export interface SpellingItem {
  word: string;
  defs?: string[];
}

/**
 * Built-in dictionary of high-frequency English misspellings and typos.
 */
export const COMMON_TYPOS: Record<string, string[]> = {
  misspeled: ['misspelled', 'misspell'],
  thesauraus: ['thesaurus'],
  definately: ['definitely'],
  definatly: ['definitely'],
  seperate: ['separate'],
  seperately: ['separately'],
  truely: ['truly'],
  occured: ['occurred'],
  occurance: ['occurrence'],
  untill: ['until'],
  accomodate: ['accommodate'],
  wierd: ['weird'],
  goverment: ['government'],
  beleive: ['believe'],
  embarass: ['embarrass'],
  recieved: ['received'],
  recieve: ['receive'],
  alot: ['a lot'],
  tommorrow: ['tomorrow'],
  tommorow: ['tomorrow'],
  writting: ['writing'],
  freind: ['friend'],
  neccessary: ['necessary'],
  concious: ['conscious'],
  calender: ['calendar'],
  collegue: ['colleague'],
  existance: ['existence'],
  independant: ['independent'],
  maintainance: ['maintenance'],
  noticable: ['noticeable'],
  perserverance: ['perseverance'],
  priviledge: ['privilege'],
  pronounciation: ['pronunciation'],
  rythm: ['rhythm'],
  suprise: ['surprise'],
  thier: ['their'],
  begining: ['beginning'],
  dissapear: ['disappear'],
  dissapoint: ['disappoint'],
  enviornment: ['environment'],
  fourty: ['forty'],
  guarentee: ['guarantee'],
  intrest: ['interest'],
  intresting: ['interesting'],
  knowlege: ['knowledge'],
  millenium: ['millennium'],
  posession: ['possession'],
  publically: ['publicly'],
  recommand: ['recommend'],
  religous: ['religious'],
  resistence: ['resistance'],
  succesful: ['successful'],
  tendancy: ['tendency'],
  unforseen: ['unforeseen'],
  peice: ['piece'],
  sieze: ['seize'],
  absense: ['absence'],
  acess: ['access'],
  adress: ['address'],
  apparant: ['apparent'],
  arguement: ['argument'],
  catagory: ['category'],
  cemetery: ['cemetery'],
  colum: ['column'],
  curiousity: ['curiosity'],
  definate: ['definite'],
  dilemna: ['dilemma'],
  familar: ['familiar'],
  finaly: ['finally'],
  foriegn: ['foreign'],
  futher: ['further'],
  heigth: ['height'],
  hierachy: ['hierarchy'],
  humourous: ['humorous'],
  immediatly: ['immediately'],
  incidently: ['incidentally'],
  lisence: ['license'],
  mischievious: ['mischievous'],
  ocassion: ['occasion'],
  paralel: ['parallel'],
  persue: ['pursue'],
  posible: ['possible'],
  preceed: ['precede'],
  prefered: ['preferred'],
  proceedure: ['procedure'],
  questionaire: ['questionnaire'],
  refference: ['reference'],
  relavant: ['relevant'],
  secratary: ['secretary'],
  senseable: ['sensible'],
  similiar: ['similar'],
  speach: ['speech'],
  stuborn: ['stubborn'],
  succede: ['succeed'],
  tempature: ['temperature'],
  tounge: ['tongue'],
  unfortuantly: ['unfortunately'],
  vaccum: ['vacuum'],
  vehical: ['vehicle'],
  villian: ['villain'],
  warrent: ['warrant'],
  yatch: ['yacht'],
};

// In-memory cache for spelling suggestions
const spellingCache = new Map<string, string[]>();

/**
 * Strips punctuation and returns a sanitized clean word for spellchecking.
 */
export function sanitizeSpellWord(word: string): string {
  return word.replace(/^[^a-zA-Z0-9'-]+|[^a-zA-Z0-9'-]+$/g, '').trim();
}

/**
 * Fetches spelling replacement suggestions for a given word.
 * Returns an empty array if the word is spelled correctly or if no suggestions exist.
 */
export async function fetchSpellingSuggestions(rawWord: string): Promise<string[]> {
  const clean = sanitizeSpellWord(rawWord);
  if (!clean || clean.length < 2) return [];

  const lower = clean.toLowerCase();

  // Check in-memory cache
  if (spellingCache.has(lower)) {
    return spellingCache.get(lower)!;
  }

  // 1. Check offline common typos dictionary
  const offlineMatch = COMMON_TYPOS[lower];
  if (offlineMatch) {
    spellingCache.set(lower, offlineMatch);
    return offlineMatch;
  }

  // 2. Query Datamuse spelling endpoint with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    const encoded = encodeURIComponent(lower);
    const res = await fetch(`https://api.datamuse.com/words?sp=${encoded}&md=d&max=5`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      spellingCache.set(lower, []);
      return [];
    }

    const items: SpellingItem[] = await res.json();
    if (!items || items.length === 0) {
      spellingCache.set(lower, []);
      return [];
    }

    const suggestions: string[] = [];

    // Check for explicit 'Misspelling of <target>' in definitions
    let isMisspellingOf: string | null = null;
    for (const item of items) {
      if (item.defs) {
        for (const def of item.defs) {
          const match = def.match(/Misspelling of ([a-zA-Z0-9'-]+)/i);
          if (match && match[1].toLowerCase() !== lower) {
            isMisspellingOf = match[1];
            suggestions.push(match[1]);
          }
        }
      }
    }

    const isTopExact = items[0].word.toLowerCase() === lower;

    // If top item is exact match and has NO misspelling definition, the word is correctly spelled!
    if (isTopExact && !isMisspellingOf) {
      spellingCache.set(lower, []);
      return [];
    }

    // If top item is NOT exact match, it is the primary spelling candidate
    if (!isTopExact) {
      suggestions.push(items[0].word);
    }

    // Add other candidates
    for (const item of items) {
      if (item.word.toLowerCase() !== lower && !suggestions.includes(item.word)) {
        suggestions.push(item.word);
      }
    }

    const uniqueSuggestions = Array.from(new Set(suggestions)).slice(0, 3);
    spellingCache.set(lower, uniqueSuggestions);
    return uniqueSuggestions;
  } catch {
    clearTimeout(timeoutId);

    // If fetch failed, return empty (already checked offline COMMON_TYPOS)
    spellingCache.set(lower, []);
    return [];
  }
}

/**
 * Clears the spelling cache (useful for testing).
 */
export function clearSpellingCache(): void {
  spellingCache.clear();
}

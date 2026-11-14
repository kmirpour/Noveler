/**
 * On-device English dictionary (Hunspell en-US word list, read with nspell).
 *
 * It is loaded once, on demand, from files bundled with the app, so spelling is checked without
 * any text leaving the computer. Until it has loaded, callers simply treat every word as fine.
 */
interface Speller {
  correct: (word: string) => boolean;
  suggest: (word: string) => string[];
}

let speller: Speller | null = null;
let loading: Promise<boolean> | null = null;
const verdicts = new Map<string, boolean>();

export function loadDictionary(): Promise<boolean> {
  if (!loading) {
    loading = (async () => {
      try {
        const [nspellModule, aff, dic] = await Promise.all([
          import('nspell'),
          import('../assets/spelling/en.aff?raw'),
          import('../assets/spelling/en.dic?raw'),
        ]);
        speller = nspellModule.default(aff.default, dic.default);
        verdicts.clear();
        return true;
      } catch (err) {
        console.warn('Could not load the spelling dictionary:', err);
        return false;
      }
    })();
  }
  return loading;
}

export function isDictionaryReady(): boolean {
  return speller !== null;
}

const normalize = (word: string) =>
  word
    .replace(/[’‘]/g, "'")
    .replace(/^['-]+|['-]+$/g, '');

function lookUp(word: string): boolean {
  if (!speller) return true;
  if (speller.correct(word)) return true;

  // Possessives: "kiosk's", "residents'"
  const possessive = word.match(/^(.+?)'s?$/i);
  if (possessive && speller.correct(possessive[1])) return true;

  if (EXTRA_WORDS.has(word.toLowerCase())) return true;

  // Hyphenated compounds are fine when each part is a word or a common prefix:
  // "well-lit", "five-year-old", "pre-dawn", "de-branded"
  if (word.includes('-')) {
    const parts = word.split('-').filter(Boolean);
    const ok = (p: string) => p.length === 1 || PREFIXES.has(p.toLowerCase()) || speller!.correct(p);
    if (parts.length > 1 && parts.every(ok)) return true;
  }
  return false;
}

/** Everyday spellings the US word list lacks. */
const EXTRA_WORDS = new Set(['ok', 'grey', 'greyed', 'greying', 'unshakeable', 'email', 'emails', 'online', 'offline']);

const PREFIXES = new Set([
  'anti', 'co', 'counter', 'de', 'ex', 'hyper', 'inter', 'micro', 'mid', 'mini', 'multi', 'neo', 'non',
  'over', 'post', 'pre', 'pro', 'pseudo', 'quasi', 're', 'self', 'semi', 'sub', 'super', 'ultra', 'un', 'under',
]);

/** True if the word is spelled correctly (or the dictionary is not available yet). */
export function isKnownWord(rawWord: string): boolean {
  if (!speller) return true;
  const word = normalize(rawWord);
  if (word.length < 2) return true;
  const cached = verdicts.get(word);
  if (cached !== undefined) return cached;
  const known = lookUp(word);
  verdicts.set(word, known);
  return known;
}

/** Spelling suggestions for a word, best first. Empty if the dictionary is not loaded. */
export function suggestWords(rawWord: string, max = 5): string[] {
  if (!speller) return [];
  try {
    return speller.suggest(normalize(rawWord)).slice(0, max);
  } catch {
    return [];
  }
}

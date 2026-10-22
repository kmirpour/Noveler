/**
 * Thesaurus Service
 * Provides synonyms and antonyms using a hybrid architecture:
 * 1. Fast in-memory cache for repeated lookups
 * 2. Datamuse REST API for real-time lexical suggestions
 * 3. Offline fallback dictionary for distraction-free writing without internet
 */

export interface ThesaurusResult {
  word: string;
  synonyms: string[];
  antonyms: string[];
  isOffline?: boolean;
}

interface DatamuseItem {
  word: string;
  score?: number;
}

// In-memory cache for session lifetime
const cache = new Map<string, ThesaurusResult>();

/**
 * Built-in offline dictionary of common fiction writing vocabulary,
 * emotional states, sensory words, and verbs.
 */
export const OFFLINE_THESAURUS: Record<string, { synonyms: string[]; antonyms: string[] }> = {
  happy: {
    synonyms: ['joyful', 'cheerful', 'delighted', 'content', 'elated', 'glad', 'jubilant', 'gleeful'],
    antonyms: ['sad', 'miserable', 'sorrowful', 'gloomy', 'unhappy', 'depressed'],
  },
  sad: {
    synonyms: ['sorrowful', 'mournful', 'gloomy', 'melancholy', 'grief-stricken', 'downcast', 'dejected'],
    antonyms: ['happy', 'joyful', 'cheerful', 'delighted', 'glad', 'elated'],
  },
  angry: {
    synonyms: ['furious', 'irate', 'enraged', 'incensed', 'livid', 'wrathful', 'seething', 'indignant'],
    antonyms: ['calm', 'peaceful', 'placid', 'tranquil', 'serene', 'composed'],
  },
  afraid: {
    synonyms: ['fearful', 'terrified', 'frightened', 'petrified', 'alarmed', 'panicked', 'intimidated'],
    antonyms: ['brave', 'courageous', 'bold', 'fearless', 'confident', 'valiant'],
  },
  brave: {
    synonyms: ['courageous', 'valiant', 'bold', 'fearless', 'heroic', 'intrepid', 'daring', 'dauntless'],
    antonyms: ['cowardly', 'fearful', 'timid', 'faint-hearted', 'craven', 'afraid'],
  },
  dark: {
    synonyms: ['shadowy', 'murky', 'gloomy', 'obscure', 'dim', 'pitch-black', 'somber', 'tenebrous'],
    antonyms: ['bright', 'luminous', 'radiant', 'light', 'shining', 'brilliant'],
  },
  bright: {
    synonyms: ['radiant', 'luminous', 'dazzling', 'brilliant', 'vivid', 'shining', 'gleaming', 'resplendent'],
    antonyms: ['dark', 'dim', 'dull', 'gloomy', 'shadowy', 'murky'],
  },
  fast: {
    synonyms: ['swift', 'rapid', 'quick', 'brisk', 'speedy', 'fleet', 'hasty', 'accelerated'],
    antonyms: ['slow', 'sluggish', 'leisurely', 'unhurried', 'gradual', 'languid'],
  },
  slow: {
    synonyms: ['sluggish', 'leisurely', 'unhurried', 'gradual', 'ponderous', 'deliberate', 'languid'],
    antonyms: ['fast', 'swift', 'rapid', 'quick', 'speedy', 'brisk'],
  },
  quiet: {
    synonyms: ['silent', 'hushed', 'tranquil', 'still', 'peaceful', 'subdued', 'muted', 'noiseless'],
    antonyms: ['loud', 'noisy', 'clamorous', 'boisterous', 'deafening', 'raucous'],
  },
  loud: {
    synonyms: ['deafening', 'boisterous', 'thunderous', 'clamorous', 'piercing', 'resounding', 'raucous'],
    antonyms: ['quiet', 'silent', 'hushed', 'whispered', 'soft', 'subdued'],
  },
  whisper: {
    synonyms: ['murmur', 'mutter', 'breathe', 'hiss', 'rustle', 'sigh', 'undertone'],
    antonyms: ['shout', 'yell', 'scream', 'bellow', 'holler', 'roar'],
  },
  shout: {
    synonyms: ['yell', 'bellow', 'scream', 'cry', 'howl', 'roar', 'holler', 'shriek'],
    antonyms: ['whisper', 'murmur', 'mutter', 'breathe'],
  },
  walk: {
    synonyms: ['stride', 'stroll', 'saunter', 'wander', 'pace', 'tread', 'trudge', 'amble'],
    antonyms: ['run', 'sprint', 'dash', 'gallop', 'halt', 'stay'],
  },
  run: {
    synonyms: ['sprint', 'dash', 'scurry', 'bolt', 'flee', 'charge', 'dart', 'rush'],
    antonyms: ['walk', 'stroll', 'crawl', 'creep', 'halt', 'linger'],
  },
  look: {
    synonyms: ['gaze', 'glance', 'stare', 'peer', 'behold', 'scan', 'observe', 'inspect'],
    antonyms: ['ignore', 'overlook', 'neglect', 'disregard'],
  },
  see: {
    synonyms: ['behold', 'witness', 'perceive', 'discern', 'spot', 'notice', 'glimpse'],
    antonyms: ['miss', 'overlook', 'ignore'],
  },
  cold: {
    synonyms: ['chilly', 'frigid', 'freezing', 'icy', 'frosty', 'glacial', 'bleak', 'numbing'],
    antonyms: ['hot', 'warm', 'sweltering', 'scorching', 'burning', 'fiery'],
  },
  hot: {
    synonyms: ['scorching', 'sweltering', 'scalding', 'blistering', 'fiery', 'sultry', 'burning', 'boiling'],
    antonyms: ['cold', 'frigid', 'freezing', 'chilly', 'icy', 'cool'],
  },
  beautiful: {
    synonyms: ['gorgeous', 'stunning', 'lovely', 'breathtaking', 'radiant', 'exquisite', 'alluring', 'striking'],
    antonyms: ['ugly', 'hideous', 'repulsive', 'grotesque', 'unattractive', 'unsightly'],
  },
  ugly: {
    synonyms: ['hideous', 'grotesque', 'repulsive', 'monstrous', 'unsightly', 'deformed', 'unpleasant'],
    antonyms: ['beautiful', 'attractive', 'gorgeous', 'handsome', 'lovely', 'alluring'],
  },
  strong: {
    synonyms: ['powerful', 'mighty', 'robust', 'sturdy', 'resilient', 'vigorous', 'brawny', 'stalwart'],
    antonyms: ['weak', 'feeble', 'frail', 'fragile', 'delicate', 'impotent'],
  },
  weak: {
    synonyms: ['feeble', 'frail', 'fragile', 'delicate', 'powerless', 'faltering', 'infirm', 'vulnerable'],
    antonyms: ['strong', 'powerful', 'mighty', 'robust', 'sturdy', 'vigorous'],
  },
  strange: {
    synonyms: ['peculiar', 'bizarre', 'uncanny', 'odd', 'weird', 'unusual', 'mysterious', 'curious'],
    antonyms: ['normal', 'ordinary', 'common', 'familiar', 'conventional', 'typical'],
  },
  mysterious: {
    synonyms: ['enigmatic', 'cryptic', 'inscrutable', 'unfathomable', 'occult', 'shadowy', 'secretive'],
    antonyms: ['obvious', 'clear', 'evident', 'apparent', 'transparent', 'familiar'],
  },
  old: {
    synonyms: ['ancient', 'aged', 'venerable', 'archaic', 'timeworn', 'antique', 'antiquated'],
    antonyms: ['young', 'new', 'modern', 'fresh', 'youthful', 'novel'],
  },
  young: {
    synonyms: ['youthful', 'juvenile', 'fresh', 'adolescent', 'fledgling', 'green', 'untried'],
    antonyms: ['old', 'aged', 'ancient', 'elderly', 'mature', 'venerable'],
  },
  good: {
    synonyms: ['virtuous', 'righteous', 'noble', 'worthy', 'admirable', 'beneficial', 'splendid', 'stellar'],
    antonyms: ['bad', 'evil', 'wicked', 'malevolent', 'vile', 'sinister'],
  },
  bad: {
    synonyms: ['evil', 'wicked', 'vile', 'sinister', 'malevolent', 'nefarious', 'dreadful', 'atrocious'],
    antonyms: ['good', 'virtuous', 'righteous', 'noble', 'benevolent', 'honorable'],
  },
  sudden: {
    synonyms: ['abrupt', 'unexpected', 'unforeseen', 'swift', 'instant', 'precipitous', 'hasty'],
    antonyms: ['gradual', 'slow', 'expected', 'predictable', 'deliberate'],
  },
  calm: {
    synonyms: ['serene', 'tranquil', 'peaceful', 'placid', 'composed', 'untroubled', 'still'],
    antonyms: ['agitated', 'turbulent', 'stormy', 'frantic', 'anxious', 'furious'],
  },
  fierce: {
    synonyms: ['ferocious', 'savage', 'furious', 'relentless', 'vicious', 'untamed', 'violent'],
    antonyms: ['gentle', 'tame', 'mild', 'passive', 'docile', 'peaceful'],
  },
  gentle: {
    synonyms: ['tender', 'mild', 'soft', 'compassionate', 'delicate', 'kind', 'soothing', 'serene'],
    antonyms: ['harsh', 'rough', 'fierce', 'severe', 'brutal', 'coarse'],
  },
  harsh: {
    synonyms: ['severe', 'abrasive', 'grating', 'bitter', 'cruel', 'austere', 'jarring', 'strident'],
    antonyms: ['gentle', 'mild', 'soft', 'pleasant', 'soothing', 'tender'],
  },
  tired: {
    synonyms: ['exhausted', 'weary', 'fatigued', 'spent', 'drained', 'lethargic', 'enervated', 'worn-out'],
    antonyms: ['energetic', 'refreshed', 'invigorated', 'rested', 'vibrant', 'lively'],
  },
  clean: {
    synonyms: ['spotless', 'pristine', 'immaculate', 'pure', 'unblemished', 'stainless'],
    antonyms: ['dirty', 'filthy', 'soiled', 'grimy', 'polluted', 'stained'],
  },
  darkness: {
    synonyms: ['shadow', 'obscurity', 'gloom', 'murk', 'blackness', 'shade', 'twilight'],
    antonyms: ['light', 'brightness', 'radiance', 'illumination', 'clarity'],
  },
  light: {
    synonyms: ['radiance', 'glow', 'illumination', 'brilliance', 'gleam', 'luster', 'beam'],
    antonyms: ['darkness', 'shadow', 'gloom', 'obscurity', 'blackness'],
  },
};

/**
 * Strips punctuation and returns a sanitized clean word.
 */
export function sanitizeWord(word: string): string {
  return word.replace(/^[^a-zA-Z0-9'-]+|[^a-zA-Z0-9'-]+$/g, '').trim();
}

/**
 * Applies the original word's capitalization pattern to the replacement word.
 * - ALL CAPS: "BRILLIANT" -> "RADIANT"
 * - Title Case: "Brilliant" -> "Radiant"
 * - lowercase: "brilliant" -> "radiant"
 */
export function applyCasing(original: string, replacement: string): string {
  if (!original || !replacement) return replacement;

  // Check ALL CAPS (e.g. "HAPPY" or "RUN")
  const isAllCaps = original === original.toUpperCase() && original !== original.toLowerCase();
  if (isAllCaps) {
    return replacement.toUpperCase();
  }

  // Check Title Case (First letter capitalized, e.g. "Happy")
  const firstLetter = original.charAt(0);
  const isTitleCase = firstLetter === firstLetter.toUpperCase() && firstLetter !== firstLetter.toLowerCase();
  if (isTitleCase) {
    // If replacement has multiple words / hyphens, capitalize each segment
    return replacement
      .split(/(\s+|-)/)
      .map((segment) => {
        if (!segment || /^\s+|-$/.test(segment)) return segment;
        return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
      })
      .join('');
  }

  // Default: lowercase
  return replacement.toLowerCase();
}

/**
 * Fetches synonyms and antonyms for a given word using Datamuse with offline fallback.
 */
export async function fetchThesaurus(rawWord: string): Promise<ThesaurusResult> {
  const cleanWord = sanitizeWord(rawWord);
  if (!cleanWord) {
    return { word: rawWord, synonyms: [], antonyms: [] };
  }

  const cacheKey = cleanWord.toLowerCase();
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  // Query Datamuse API with a timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const encoded = encodeURIComponent(cacheKey);
    const [synRes, antRes] = await Promise.all([
      fetch(`https://api.datamuse.com/words?rel_syn=${encoded}&max=10`, { signal: controller.signal }),
      fetch(`https://api.datamuse.com/words?rel_ant=${encoded}&max=8`, { signal: controller.signal }),
    ]);

    clearTimeout(timeoutId);

    if (!synRes.ok && !antRes.ok) {
      throw new Error('Network error from thesaurus API');
    }

    const synData: DatamuseItem[] = synRes.ok ? await synRes.json() : [];
    const antData: DatamuseItem[] = antRes.ok ? await antRes.json() : [];

    const synonyms = synData
      .map((item) => item.word.replace(/_/g, ' ').trim())
      .filter((w) => w && w.toLowerCase() !== cacheKey);

    const antonyms = antData
      .map((item) => item.word.replace(/_/g, ' ').trim())
      .filter((w) => w && w.toLowerCase() !== cacheKey);

    // If API returned nothing at all, check offline thesaurus
    if (synonyms.length === 0 && antonyms.length === 0) {
      const fallback = OFFLINE_THESAURUS[cacheKey];
      if (fallback) {
        const result: ThesaurusResult = {
          word: cleanWord,
          synonyms: fallback.synonyms,
          antonyms: fallback.antonyms,
          isOffline: true,
        };
        cache.set(cacheKey, result);
        return result;
      }
    }

    const result: ThesaurusResult = {
      word: cleanWord,
      synonyms: Array.from(new Set(synonyms)).slice(0, 8),
      antonyms: Array.from(new Set(antonyms)).slice(0, 6),
      isOffline: false,
    };

    cache.set(cacheKey, result);
    return result;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('Thesaurus fetch error (falling back to offline dictionary):', err);

    // Offline fallback when network fails or times out
    const fallback = OFFLINE_THESAURUS[cacheKey];
    if (fallback) {
      const result: ThesaurusResult = {
        word: cleanWord,
        synonyms: fallback.synonyms,
        antonyms: fallback.antonyms,
        isOffline: true,
      };
      cache.set(cacheKey, result);
      return result;
    }

    // Return empty result if not in offline dictionary
    const emptyResult: ThesaurusResult = {
      word: cleanWord,
      synonyms: [],
      antonyms: [],
      isOffline: true,
    };
    cache.set(cacheKey, emptyResult);
    return emptyResult;
  }
}

/**
 * Clears the in-memory thesaurus cache (useful for testing).
 */
export function clearThesaurusCache(): void {
  cache.clear();
}

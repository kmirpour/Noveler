/**
 * Sophisticated Spell, Homophone & Grammar Service
 * Provides multi-layered spell and contextual grammar checking:
 * 1. Offline Contextual Fiction Grammar & Homophone Engine (their/there/they're, its/it's,
 *    your/you're, could of -> could have, comparative then -> than, a/an, repeated words)
 * 2. Expanded Offline Typo Dictionary + Damerau-Levenshtein transposition fallback
 * 3. LanguageTool Context-Aware API (`https://api.languagetool.org/v2/check`) for full sentence grammar
 * 4. Datamuse spelling API (`sp=`) for single-word fallback suggestions
 * 5. Automatic Codex & Custom Project Dictionary whitelisting
 */

export interface SpellingItem {
  word: string;
  defs?: string[];
}

export type IssueCategory = 'spelling' | 'grammar' | 'style';

export interface SpellGrammarIssue {
  /** 0-based start character offset within the checked text */
  offset: number;
  /** Length of the matched span in characters */
  length: number;
  /** Exact matched substring */
  matchedText: string;
  /** Issue category: 'spelling' (red underline) or 'grammar' / 'style' (amber/blue underline) */
  category: IssueCategory;
  /** Detailed human-readable explanation */
  message: string;
  /** Short rule label for compact headers */
  shortMessage: string;
  /** Ranked replacement candidates for the matched span */
  replacements: string[];
}

/**
 * Built-in dictionary of high-frequency English misspellings and fiction typos.
 */
export const COMMON_TYPOS: Record<string, string[]> = {
  teh: ['the'],
  adn: ['and'],
  taht: ['that'],
  wiht: ['with'],
  thn: ['then', 'than'],
  ahve: ['have'],
  hvae: ['have'],
  coudl: ['could'],
  shoudl: ['should'],
  woudl: ['would'],
  becuase: ['because'],
  beacuse: ['because'],
  abotu: ['about'],
  jsut: ['just'],
  knwo: ['know'],
  konw: ['know'],
  frome: ['from', 'frame'],
  tihs: ['this'],
  htis: ['this'],
  waht: ['what'],
  hwat: ['what'],
  wihch: ['which'],
  whcih: ['which'],
  agian: ['again'],
  agains: ['against', 'again'],
  alwasy: ['always'],
  allways: ['always'],
  aroudn: ['around'],
  arond: ['around'],
  befor: ['before'],
  beofre: ['before'],
  betwen: ['between'],
  happend: ['happened'],
  hapened: ['happened'],
  heared: ['heard'],
  listend: ['listened'],
  lookd: ['looked'],
  turnned: ['turned'],
  walkd: ['walked'],
  whisperd: ['whispered'],
  screamd: ['screamed'],
  smild: ['smiled'],
  glancd: ['glanced'],
  shruggd: ['shrugged'],
  hesitatd: ['hesitated'],
  murmurd: ['murmured'],
  shiverd: ['shivered'],
  trembld: ['trembled'],
  suddnely: ['suddenly'],
  sudenly: ['suddenly'],
  finallly: ['finally'],
  eachother: ['each other'],
  everytime: ['every time'],
  noone: ['no one'],
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

interface OfflineGrammarRule {
  id: string;
  pattern: RegExp;
  category: IssueCategory;
  shortMessage: string;
  getMessage: (match: RegExpExecArray) => string;
  getReplacements: (match: RegExpExecArray) => string[];
}

function preserveLeadCase(original: string, replacement: string): string {
  if (!original || !replacement) return replacement;
  if (original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

const OFFLINE_GRAMMAR_RULES: OfflineGrammarRule[] = [
  // 1. Repeated adjacent words ("the the", "and and", "in in")
  {
    id: 'REPEATED_WORD',
    pattern: /\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by|from|as|is|was|are|were|be|been|he|she|it|they|we|I|you|his|her|their|my|your|our)\s+\1\b/gi,
    category: 'grammar',
    shortMessage: 'Repeated word',
    getMessage: (m) => `Repeated word "${m[1]}".`,
    getReplacements: (m) => [m[1]],
  },
  // 2. Modal + "of" -> "have" ("could of", "should of", "would of", "must of", "might of")
  {
    id: 'MODAL_OF',
    pattern: /\b(could|should|would|must|might)\s+of\b/gi,
    category: 'grammar',
    shortMessage: 'Use "have" instead of "of"',
    getMessage: (m) => `"${m[0]}" is a common phonetic mistake. Use "${preserveLeadCase(m[1], m[1].toLowerCase())} have" instead.`,
    getReplacements: (m) => {
      const modal = preserveLeadCase(m[1], m[1].toLowerCase());
      return [`${modal} have`, `${modal}'ve`];
    },
  },
  // 3. "their" vs "there" / "they're"
  {
    id: 'THEIR_IS_ARE',
    pattern: /\b(their)\s+(is|are|was|were|has\s+been|have\s+been|will\s+be|seems|appears)\b/gi,
    category: 'grammar',
    shortMessage: 'Confused word: their / there',
    getMessage: () => 'Use "there" (or "they\'re") instead of the possessive "their" before a verb.',
    getReplacements: (m) => {
      const verb = m[2];
      const lead = preserveLeadCase(m[1], 'there');
      const results = [`${lead} ${verb}`];
      if (/^are$/i.test(verb)) {
        results.push(preserveLeadCase(m[1], "they're"));
      }
      return results;
    },
  },
  {
    id: 'THEIR_PARTICIPLE',
    pattern: /\b(their)\s+(going|coming|running|walking|trying|waiting|looking|standing|sitting|making|doing|saying|thinking|hoping|leaving|staying|working|fighting|hiding|dying|getting|taking|giving|telling|asking|calling|watching)\b/gi,
    category: 'grammar',
    shortMessage: "Confused word: their / they're",
    getMessage: (m) => `Did you mean "${preserveLeadCase(m[1], "they're")} ${m[2]}" (contraction of "they are")?`,
    getReplacements: (m) => [`${preserveLeadCase(m[1], "they're")} ${m[2]}`],
  },
  {
    id: 'THERE_POSSESSIVE',
    pattern: /\b(there|they're)\s+(own|eyes|hands|faces|voices|heads|hearts|father|mother|parents|house|home|friends|children|lives|clothes|weapons|horses|swords|backs|feet|names|rooms|minds|souls)\b/gi,
    category: 'grammar',
    shortMessage: 'Confused word: possessive "their"',
    getMessage: (m) => `Use the possessive "${preserveLeadCase(m[1], 'their')}" before "${m[2]}".`,
    getReplacements: (m) => [`${preserveLeadCase(m[1], 'their')} ${m[2]}`],
  },
  // 4. "your" vs "you're"
  {
    id: 'YOUR_CONTRACTION',
    pattern: /\b(your)\s+(welcome|right|wrong|correct|mistaken|late|early|dead|alive|safe|free|crazy|insane|kidding|joking|lying|going|coming|running|walking|trying|waiting|looking|standing|sitting|making|doing|saying|thinking|leaving|staying|working|fighting|hiding|not|sure|certain|afraid|ready|invited|done|finished|the\s+best|the\s+only|the\s+one)\b/gi,
    category: 'grammar',
    shortMessage: "Confused word: your / you're",
    getMessage: (m) => `Did you mean "${preserveLeadCase(m[1], "you're")} ${m[2]}" (contraction of "you are")?`,
    getReplacements: (m) => [`${preserveLeadCase(m[1], "you're")} ${m[2]}`],
  },
  {
    id: 'YOURE_POSSESSIVE',
    pattern: /\b(you're)\s+(own|eyes|hands|face|voice|head|heart|father|mother|parents|house|home|friend|friends|life|name|fault|turn|problem|sister|brother|sword|mind|soul|room)\b/gi,
    category: 'grammar',
    shortMessage: 'Confused word: possessive "your"',
    getMessage: (m) => `Use the possessive "${preserveLeadCase(m[1], 'your')}" before "${m[2]}".`,
    getReplacements: (m) => [`${preserveLeadCase(m[1], 'your')} ${m[2]}`],
  },
  // 5. "its" vs "it's"
  {
    id: 'ITS_CONTRACTION',
    pattern: /\b(its)\s+(a|an|the|been|not|going|coming|getting|starting|beginning|snowing|raining|cold|hot|dark|light|too|very|so|quite|almost|nearly|already|still|always|never|only|just|impossible|possible|important|clear|obvious|true|false|hard|easy|time|over|done|finished)\b/gi,
    category: 'grammar',
    shortMessage: "Confused word: its / it's",
    getMessage: (m) => `Use "${preserveLeadCase(m[1], "it's")}" (contraction of "it is" or "it has") here.`,
    getReplacements: (m) => [`${preserveLeadCase(m[1], "it's")} ${m[2]}`],
  },
  {
    id: 'ITS_POSSESSIVE',
    pattern: /\b(it's)\s+(own|head|eyes|tail|wings|paws|claws|teeth|mouth|back|side|feet|legs|body|surface|place|way|center|edge|shadow|color|shape|door|cover|handle|blade|name|owner|mother|father)\b/gi,
    category: 'grammar',
    shortMessage: 'Confused word: possessive "its"',
    getMessage: (m) => `Possessive "${preserveLeadCase(m[1], 'its')}" does not take an apostrophe before "${m[2]}".`,
    getReplacements: (m) => [`${preserveLeadCase(m[1], 'its')} ${m[2]}`],
  },
  // 6. Comparative + "then" -> "than"
  {
    id: 'COMPARATIVE_THEN',
    pattern: /\b(better|worse|more|less|faster|slower|bigger|smaller|taller|shorter|older|younger|stronger|weaker|harder|easier|closer|further|farther|higher|lower|louder|quieter|brighter|darker|deeper|longer|sooner|rather|other|different)\s+then\b/gi,
    category: 'grammar',
    shortMessage: 'Confused word: then / than',
    getMessage: (m) => `Use "${m[1]} than" for comparisons ("then" refers to time).`,
    getReplacements: (m) => [`${m[1]} than`],
  },
  // 7. "a" before clear vowel sound -> "an"
  {
    id: 'ARTICLE_A_AN',
    pattern: /\b(a)\s+(apple|hour|honest|heir|honor|honour|umbrella|elephant|island|idea|idiot|inch|instant|old|open|empty|ancient|angry|awful|evil|early|easy|effort|eye|ear|arm|arrow|echo|edge|emperor|empress|empire|enemy|engine|evening|example|excuse|exit|explosion|object|ocean|office|officer|official|omen|onion|opinion|opportunity|option|orange|order|origin|orphan|other|outcome|outlaw|outline|owl)\b/gi,
    category: 'grammar',
    shortMessage: 'Use "an" before a vowel sound',
    getMessage: (m) => `Use "${preserveLeadCase(m[1], 'an')} ${m[2]}" instead of "${m[0]}".`,
    getReplacements: (m) => [`${preserveLeadCase(m[1], 'an')} ${m[2]}`],
  },
  // 8. "affect" vs "effect" after "the/an/any/no/some/positive/negative"
  {
    id: 'THE_AFFECT',
    pattern: /\b(the|an|any|no|some|little|much|positive|negative|side|immediate|lasting)\s+affect\b/gi,
    category: 'grammar',
    shortMessage: 'Confused word: affect / effect',
    getMessage: (m) => `Did you mean "${m[1]} effect" (the noun)? "Affect" is usually a verb.`,
    getReplacements: (m) => [`${m[1]} effect`],
  },
];

// In-memory caches
const spellingCache = new Map<string, string[]>();
const textCheckCache = new Map<string, SpellGrammarIssue[]>();

/**
 * Strips punctuation and returns a sanitized clean word for spellchecking.
 */
export function sanitizeSpellWord(word: string): string {
  return word.replace(/^[^a-zA-Z0-9'-]+|[^a-zA-Z0-9'-]+$/g, '').trim();
}

/**
 * Computes Damerau-Levenshtein edit distance (including adjacent transpositions) between two strings.
 */
export function damerauLevenshtein(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;
  const dp: number[][] = Array.from({ length: lenA + 1 }, () => Array(lenB + 1).fill(0));

  for (let i = 0; i <= lenA; i++) dp[i][0] = i;
  for (let j = 0; j <= lenB; j++) dp[0][j] = j;

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1); // transposition
      }
    }
  }
  return dp[lenA][lenB];
}

/**
 * Runs fast, 100% offline contextual grammar, homophone, and typo detection on a block of text.
 */
export function checkTextOffline(text: string, ignoreWords: string[] = []): SpellGrammarIssue[] {
  if (!text || !text.trim()) return [];

  const ignoreSet = new Set(ignoreWords.map((w) => w.toLowerCase()));
  const issues: SpellGrammarIssue[] = [];

  // 1. Contextual Grammar & Homophone Rules
  for (const rule of OFFLINE_GRAMMAR_RULES) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const matchedText = match[0];
      // For REPEATED_WORD, only flag if case-insensitive match is identical
      if (rule.id === 'REPEATED_WORD') {
        const parts = matchedText.trim().split(/\s+/);
        if (parts.length !== 2 || parts[0].toLowerCase() !== parts[1].toLowerCase()) {
          continue;
        }
      }
      issues.push({
        offset: match.index,
        length: matchedText.length,
        matchedText,
        category: rule.category,
        message: rule.getMessage(match),
        shortMessage: rule.shortMessage,
        replacements: rule.getReplacements(match),
      });
    }
  }

  // 2. Single-Word Offline Typos (COMMON_TYPOS)
  const wordRegex = /\b[a-zA-Z][a-zA-Z'-]{1,}\b/g;
  let wordMatch: RegExpExecArray | null;
  while ((wordMatch = wordRegex.exec(text)) !== null) {
    const rawWord = wordMatch[0];
    const startIdx = wordMatch.index;

    // Skip hashtags (#character)
    if (startIdx > 0 && text[startIdx - 1] === '#') continue;

    const lower = rawWord.toLowerCase();
    if (ignoreSet.has(lower)) continue;

    const typoFixes = COMMON_TYPOS[lower];
    if (typoFixes && typoFixes.length > 0) {
      // Avoid duplicating if already covered by a multi-word grammar issue
      const overlaps = issues.some(
        (iss) => startIdx < iss.offset + iss.length && startIdx + rawWord.length > iss.offset
      );
      if (!overlaps) {
        issues.push({
          offset: startIdx,
          length: rawWord.length,
          matchedText: rawWord,
          category: 'spelling',
          message: `Possible spelling mistake: "${rawWord}".`,
          shortMessage: 'Spelling mistake',
          replacements: typoFixes.map((fix) => preserveLeadCase(rawWord, fix)),
        });
      }
    }
  }

  return issues.sort((a, b) => a.offset - b.offset);
}

interface LanguageToolMatch {
  message: string;
  shortMessage?: string;
  offset: number;
  length: number;
  replacements?: { value: string }[];
  rule?: {
    id?: string;
    issueType?: string;
    category?: { id?: string; name?: string };
  };
}

/**
 * Checks a paragraph or block of text using both the Offline Fiction Grammar/Typo Engine
 * and the LanguageTool Context-Aware API (`https://api.languagetool.org/v2/check`),
 * filtering out Codex entities, narrative #tags, and Custom Project Dictionary words.
 */
export async function checkTextSpellAndGrammar(
  text: string,
  ignoreWords: string[] = []
): Promise<SpellGrammarIssue[]> {
  if (!text || text.trim().length < 2) return [];

  const ignoreKey = ignoreWords.slice().sort().join(',');
  const cacheKey = `${text}::${ignoreKey}`;
  if (textCheckCache.has(cacheKey)) {
    return textCheckCache.get(cacheKey)!;
  }

  const ignoreSet = new Set(ignoreWords.map((w) => w.toLowerCase()));
  const offlineIssues = checkTextOffline(text, ignoreWords);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const body = new URLSearchParams();
    body.set('text', text);
    body.set('language', 'en-US');
    body.set('disabledRules', 'WHITESPACE_RULE,EN_QUOTES');

    const res = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      textCheckCache.set(cacheKey, offlineIssues);
      return offlineIssues;
    }

    const data = (await res.json()) as { matches?: LanguageToolMatch[] };
    const ltMatches = data.matches || [];
    const merged: SpellGrammarIssue[] = [...offlineIssues];

    for (const m of ltMatches) {
      if (typeof m.offset !== 'number' || typeof m.length !== 'number' || m.length <= 0) {
        continue;
      }
      const matchedText = text.slice(m.offset, m.offset + m.length);
      const cleanWord = sanitizeSpellWord(matchedText).toLowerCase();

      // Skip narrative hashtags (#tag)
      if (m.offset > 0 && text[m.offset - 1] === '#') continue;

      // Skip words in the project's Custom Dictionary or Codex
      if (cleanWord && ignoreSet.has(cleanWord)) continue;

      // Skip if overlapping with an existing issue
      const overlaps = merged.some(
        (existing) =>
          m.offset < existing.offset + existing.length && m.offset + m.length > existing.offset
      );
      if (overlaps) continue;

      const issueType = m.rule?.issueType?.toLowerCase() || '';
      const ruleId = m.rule?.id || '';
      const isSpelling =
        issueType === 'misspelling' ||
        ruleId.includes('MORFOLOGIK') ||
        ruleId.includes('SPELLER') ||
        (m.shortMessage || '').toLowerCase().includes('spelling');

      const replacements = (m.replacements || [])
        .map((r) => r.value)
        .filter((v) => Boolean(v) && v !== matchedText)
        .slice(0, 5);

      merged.push({
        offset: m.offset,
        length: m.length,
        matchedText,
        category: isSpelling ? 'spelling' : 'grammar',
        message: m.message || 'Possible writing issue',
        shortMessage: m.shortMessage || (isSpelling ? 'Spelling mistake' : 'Grammar / Usage'),
        replacements,
      });
    }

    merged.sort((a, b) => a.offset - b.offset);
    if (textCheckCache.size > 250) {
      const firstKey = textCheckCache.keys().next().value;
      if (firstKey !== undefined) textCheckCache.delete(firstKey);
    }
    textCheckCache.set(cacheKey, merged);
    return merged;
  } catch {
    clearTimeout(timeoutId);
    textCheckCache.set(cacheKey, offlineIssues);
    return offlineIssues;
  }
}

/**
 * Fetches spelling replacement suggestions for a single word.
 * Returns an empty array if the word is spelled correctly, is in the custom ignore list,
 * or if no suggestions exist.
 */
export async function fetchSpellingSuggestions(
  rawWord: string,
  ignoreWords: string[] = []
): Promise<string[]> {
  const clean = sanitizeSpellWord(rawWord);
  if (!clean || clean.length < 2) return [];

  const lower = clean.toLowerCase();

  if (ignoreWords.some((w) => w.toLowerCase() === lower)) {
    return [];
  }

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
 * Clears the spelling and grammar caches (useful for testing or when dictionary updates).
 */
export function clearSpellingCache(): void {
  spellingCache.clear();
  textCheckCache.clear();
}

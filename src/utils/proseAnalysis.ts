/**
 * Fiction Prose Diagnostics and Analysis Utility
 */

export interface ProseMetrics {
  totalWords: number;
  totalSentences: number;
  totalParagraphs: number;
  avgSentenceLength: number;
  
  // Readability
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  readabilityLabel: string;

  // Dialogue vs Narrative
  dialogueWords: number;
  narrativeWords: number;
  dialoguePercentage: number;

  // Rhythm & Sentence Distribution
  shortSentences: number; // < 10 words
  mediumSentences: number; // 10 - 25 words
  longSentences: number; // > 25 words

  // Weak prose flags
  adverbs: { word: string; count: number }[];
  totalAdverbs: number;
  filterWords: { word: string; count: number }[];
  totalFilterWords: number;
  passiveVoiceInstances: string[];

  // Echoes / Repeated words
  topRepeatedWords: { word: string; count: number }[];
}

const COMMON_NON_ADVERBS = new Set([
  'only', 'early', 'daily', 'friendly', 'lonely', 'family', 'lovely', 'likely',
  'ugly', 'silly', 'holy', 'belly', 'jelly', 'supply', 'fly', 'apply', 'rely',
  'reply', 'ally', 'monopoly', 'anomaly', 'butterfly', 'assembly', 'homily'
]);

const FILTER_WORDS = [
  'felt', 'feel', 'feeling',
  'saw', 'see', 'seeing',
  'heard', 'hear', 'hearing',
  'noticed', 'notice', 'noticing',
  'watched', 'watch', 'watching',
  'wondered', 'wonder', 'wondering',
  'realized', 'realize', 'realizing',
  'seemed', 'seem', 'seeming',
  'appeared', 'appear', 'appearing',
  'decided', 'decide', 'deciding',
  'thought', 'think', 'thinking',
  'knew', 'know', 'knowing',
];

const STOP_WORDS = new Set([
  'the', 'and', 'a', 'to', 'of', 'in', 'i', 'he', 'she', 'it', 'was', 'you',
  'that', 'his', 'her', 'with', 'had', 'as', 'for', 'at', 'on', 'but', 'my',
  'not', 'they', 'we', 'be', 'by', 'this', 'have', 'from', 'or', 'one', 'all',
  'an', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about',
  'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time',
  'no', 'just', 'him', 'into', 'your', 'some', 'could', 'them', 'see', 'other',
  'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
  'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
  'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us'
]);

/**
 * Estimates syllables in an English word
 */
export function countSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) return 0;
  if (clean.length <= 3) return 1;

  const stripped = clean
    .replace(/(?:[^laeiouy]|ed|es|e)$/, '')
    .replace(/^y/, '');
  const matches = stripped.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

/**
 * Analyzes prose for a scene or text string
 */
export function analyzeProse(text: string): ProseMetrics {
  const cleanText = text.trim();
  if (!cleanText) {
    return {
      totalWords: 0,
      totalSentences: 0,
      totalParagraphs: 0,
      avgSentenceLength: 0,
      fleschReadingEase: 100,
      fleschKincaidGrade: 0,
      readabilityLabel: 'No content',
      dialogueWords: 0,
      narrativeWords: 0,
      dialoguePercentage: 0,
      shortSentences: 0,
      mediumSentences: 0,
      longSentences: 0,
      adverbs: [],
      totalAdverbs: 0,
      filterWords: [],
      totalFilterWords: 0,
      passiveVoiceInstances: [],
      topRepeatedWords: [],
    };
  }

  // Paragraphs
  const paragraphs = cleanText.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const totalParagraphs = paragraphs.length;

  // Words
  const allWordMatches = cleanText.match(/\b[a-zA-Z'’-]+\b/g) || [];
  const totalWords = allWordMatches.length;

  // Sentences
  const sentences = cleanText
    .split(/(?<=[.!?])\s+(?=[A-Z"“'‘])/g)
    .filter((s) => s.trim().length > 0);
  const totalSentences = Math.max(1, sentences.length);
  const avgSentenceLength = totalWords / totalSentences;

  // Syllables
  let totalSyllables = 0;
  for (const w of allWordMatches) {
    totalSyllables += countSyllables(w);
  }

  // Readability
  // Flesch Reading Ease = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)
  const wordsPerSentence = totalWords / totalSentences;
  const syllablesPerWord = totalWords > 0 ? totalSyllables / totalWords : 1;
  const rawEase = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;
  const fleschReadingEase = Math.max(0, Math.min(100, Math.round(rawEase)));

  // Flesch-Kincaid Grade Level = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59
  const rawGrade = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;
  const fleschKincaidGrade = Math.max(0, Math.round(rawGrade * 10) / 10);

  let readabilityLabel: string;
  if (fleschReadingEase >= 80) readabilityLabel = 'Very Easy';
  else if (fleschReadingEase >= 70) readabilityLabel = 'Fairly Easy';
  else if (fleschReadingEase >= 60) readabilityLabel = 'Plain English (Optimal Fiction)';
  else if (fleschReadingEase >= 50) readabilityLabel = 'Fairly Difficult';
  else readabilityLabel = 'Complex / Dense';

  // Dialogue extraction
  const quoteRegex = /["“](.*?)["”]|(?<=^|\s)'(.*?)'(?=\s|$)/g;
  let dialogueWordCount = 0;
  let match: RegExpExecArray | null;
  while ((match = quoteRegex.exec(cleanText)) !== null) {
    const quote = (match[1] || match[2] || '').trim();
    if (quote) {
      const wordsInQuote = (quote.match(/\b[a-zA-Z'’-]+\b/g) || []).length;
      dialogueWordCount += wordsInQuote;
    }
  }

  const dialogueWords = Math.min(totalWords, dialogueWordCount);
  const narrativeWords = Math.max(0, totalWords - dialogueWords);
  const dialoguePercentage = totalWords > 0 ? Math.round((dialogueWords / totalWords) * 100) : 0;

  // Sentence distribution
  let shortSentences = 0;
  let mediumSentences = 0;
  let longSentences = 0;

  for (const s of sentences) {
    const count = (s.match(/\b[a-zA-Z'’-]+\b/g) || []).length;
    if (count < 10) shortSentences++;
    else if (count <= 25) mediumSentences++;
    else longSentences++;
  }

  // Adverbs detection (-ly words)
  const adverbCounts = new Map<string, number>();
  let totalAdverbs = 0;

  for (const word of allWordMatches) {
    const lower = word.toLowerCase();
    if (lower.endsWith('ly') && lower.length > 3 && !COMMON_NON_ADVERBS.has(lower)) {
      adverbCounts.set(lower, (adverbCounts.get(lower) || 0) + 1);
      totalAdverbs++;
    }
  }

  const adverbs = Array.from(adverbCounts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);

  // Filter words detection
  const filterCounts = new Map<string, number>();
  let totalFilterWords = 0;

  for (const word of allWordMatches) {
    const lower = word.toLowerCase();
    if (FILTER_WORDS.includes(lower)) {
      filterCounts.set(lower, (filterCounts.get(lower) || 0) + 1);
      totalFilterWords++;
    }
  }

  const filterWords = Array.from(filterCounts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);

  // Passive voice detection
  const passiveVoiceRegex = /\b(was|were|been|being|is|are)\s+([a-zA-Z]+ed|[a-zA-Z]+en|hit|put|set|run|cut|lost|made|done|found|seen|taken|given)\b/gi;
  const passiveMatches = cleanText.match(passiveVoiceRegex) || [];
  const passiveVoiceInstances = Array.from(new Set(passiveMatches.map((p) => p.toLowerCase())));

  // Repeated content words (frequency)
  const wordFreq = new Map<string, number>();
  for (const word of allWordMatches) {
    const lower = word.toLowerCase();
    if (lower.length >= 3 && !STOP_WORDS.has(lower)) {
      wordFreq.set(lower, (wordFreq.get(lower) || 0) + 1);
    }
  }

  const topRepeatedWords = Array.from(wordFreq.entries())
    .filter(([_, count]) => count >= 3)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalWords,
    totalSentences,
    totalParagraphs,
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    fleschReadingEase,
    fleschKincaidGrade,
    readabilityLabel,
    dialogueWords,
    narrativeWords,
    dialoguePercentage,
    shortSentences,
    mediumSentences,
    longSentences,
    adverbs,
    totalAdverbs,
    filterWords,
    totalFilterWords,
    passiveVoiceInstances,
    topRepeatedWords,
  };
}

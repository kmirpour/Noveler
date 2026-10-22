import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchSpellingSuggestions,
  checkTextOffline,
  checkTextSpellAndGrammar,
  damerauLevenshtein,
  clearSpellingCache,
  COMMON_TYPOS,
} from './spellingService';

describe('spellingService', () => {
  beforeEach(() => {
    clearSpellingCache();
    vi.restoreAllMocks();
  });

  it('returns offline corrections for known typos without network calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await fetchSpellingSuggestions('misspeled');
    expect(res).toEqual(COMMON_TYPOS.misspeled);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns empty array for correctly spelled words when top match is exact', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [{ word: 'happy', score: 120000 }],
    } as Response);

    const res = await fetchSpellingSuggestions('happy');
    expect(res).toEqual([]);
  });

  it('detects misspellings when top match is different from queried word', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [
        { word: 'friend', score: 100000 },
        { word: 'fiend', score: 20000 },
      ],
    } as Response);

    const res = await fetchSpellingSuggestions('freindxyz');
    expect(res).toContain('friend');
  });

  it('detects misspellings marked by Misspelling of in definitions', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [
        {
          word: 'definately',
          score: 100000,
          defs: ['adv\tMisspelling of definitely.'],
        },
        { word: 'definitely', score: 90000 },
      ],
    } as Response);

    const res = await fetchSpellingSuggestions('definatelyxyz');
    expect(res).toContain('definitely');
  });

  it('handles empty, single-character, or network failure safely', async () => {
    expect(await fetchSpellingSuggestions('')).toEqual([]);
    expect(await fetchSpellingSuggestions('a')).toEqual([]);

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    const res = await fetchSpellingSuggestions('unknownword123');
    expect(res).toEqual([]);
  });

  it('ignores words present in custom project dictionary or Codex ignore list', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await fetchSpellingSuggestions('Valyria', ['valyria', 'winterfell']);
    expect(res).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('computes Damerau-Levenshtein edit distance including transpositions', () => {
    expect(damerauLevenshtein('the', 'teh')).toBe(1);
    expect(damerauLevenshtein('friend', 'freind')).toBe(1);
    expect(damerauLevenshtein('story', 'story')).toBe(0);
  });

  it('detects contextual homophones, grammar errors, and repeated words offline', () => {
    const sample =
      "Their going to the the harbor. She could of been faster then him, and shook it's head.";
    const issues = checkTextOffline(sample);

    const matchedTexts = issues.map((i) => i.matchedText);
    expect(matchedTexts).toContain('Their going');
    expect(matchedTexts).toContain('the the');
    expect(matchedTexts).toContain('could of');
    expect(matchedTexts).toContain('faster then');
    expect(matchedTexts).toContain("it's head");

    const theirIssue = issues.find((i) => i.matchedText === 'Their going');
    expect(theirIssue?.replacements).toContain("They're going");

    const modalIssue = issues.find((i) => i.matchedText === 'could of');
    expect(modalIssue?.replacements).toContain('could have');
  });

  it('merges LanguageTool API results with offline checks and filters Codex/dictionary words', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        matches: [
          {
            message: 'Possible spelling mistake found.',
            shortMessage: 'Spelling mistake',
            offset: 0,
            length: 7,
            replacements: [{ value: 'Valeria' }],
            rule: { id: 'MORFOLOGIK_RULE_EN_US', issueType: 'misspelling' },
          },
          {
            message: 'The verb "walk" does not agree with the subject "she".',
            shortMessage: 'Subject-verb agreement',
            offset: 8,
            length: 4,
            replacements: [{ value: 'walks' }, { value: 'walked' }],
            rule: { id: 'HE_VERB_AGR', issueType: 'grammar' },
          },
        ],
      }),
    } as Response);

    const issues = await checkTextSpellAndGrammar('Valyria walk into teh room.', ['valyria']);
    // "Valyria" should be filtered out by the ignore list!
    expect(issues.some((i) => i.matchedText === 'Valyria')).toBe(false);
    // "walk" should be flagged by LanguageTool as a grammar issue
    const walkIssue = issues.find((i) => i.matchedText === 'walk');
    expect(walkIssue?.category).toBe('grammar');
    expect(walkIssue?.replacements).toContain('walks');
    // "teh" should be flagged by the offline engine as a spelling issue
    const tehIssue = issues.find((i) => i.matchedText === 'teh');
    expect(tehIssue?.category).toBe('spelling');
    expect(tehIssue?.replacements).toContain('the');
  });
});

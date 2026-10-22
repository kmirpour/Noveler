import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchSpellingSuggestions,
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
});

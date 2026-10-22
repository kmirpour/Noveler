import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  applyCasing,
  sanitizeWord,
  fetchThesaurus,
  clearThesaurusCache,
  OFFLINE_THESAURUS,
} from './thesaurusService';

describe('thesaurusService', () => {
  beforeEach(() => {
    clearThesaurusCache();
    vi.restoreAllMocks();
  });

  describe('applyCasing', () => {
    it('applies Title Case to replacement when original is capitalized', () => {
      expect(applyCasing('Happy', 'joyful')).toBe('Joyful');
      expect(applyCasing('Beautiful', 'gorgeous')).toBe('Gorgeous');
      expect(applyCasing('Tired', 'worn-out')).toBe('Worn-Out');
    });

    it('applies UPPERCASE to replacement when original is all caps', () => {
      expect(applyCasing('HAPPY', 'joyful')).toBe('JOYFUL');
      expect(applyCasing('DARK', 'shadowy')).toBe('SHADOWY');
      expect(applyCasing('FAST', 'fleet-footed')).toBe('FLEET-FOOTED');
    });

    it('keeps lowercase when original is lowercase', () => {
      expect(applyCasing('happy', 'Joyful')).toBe('joyful');
      expect(applyCasing('dark', 'SHADOWY')).toBe('shadowy');
    });

    it('safely handles empty strings', () => {
      expect(applyCasing('', 'test')).toBe('test');
      expect(applyCasing('test', '')).toBe('');
    });
  });

  describe('sanitizeWord', () => {
    it('strips surrounding punctuation while keeping characters intact', () => {
      expect(sanitizeWord('"Happy,"')).toBe('Happy');
      expect(sanitizeWord('...whisper!')).toBe('whisper');
      expect(sanitizeWord('(darkness)')).toBe('darkness');
      expect(sanitizeWord('word')).toBe('word');
    });

    it('preserves contractions and internal hyphens', () => {
      expect(sanitizeWord("don't,")).toBe("don't");
      expect(sanitizeWord('"worn-out"')).toBe('worn-out');
    });
  });

  describe('fetchThesaurus', () => {
    it('falls back to OFFLINE_THESAURUS when fetch rejects', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline'));

      const result = await fetchThesaurus('happy');
      expect(result.word).toBe('happy');
      expect(result.isOffline).toBe(true);
      expect(result.synonyms).toEqual(OFFLINE_THESAURUS.happy.synonyms);
      expect(result.antonyms).toEqual(OFFLINE_THESAURUS.happy.antonyms);
    });

    it('returns empty result when word is unknown and network offline', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline'));

      const result = await fetchThesaurus('xyzzy123');
      expect(result.word).toBe('xyzzy123');
      expect(result.synonyms).toEqual([]);
      expect(result.antonyms).toEqual([]);
      expect(result.isOffline).toBe(true);
    });

    it('parses Datamuse API responses when online', async () => {
      const mockSynonyms = [{ word: 'gleeful' }, { word: 'ecstatic' }];
      const mockAntonyms = [{ word: 'sad' }, { word: 'gloomy' }];

      vi.spyOn(globalThis, 'fetch').mockImplementation((url: RequestInfo | URL) => {
        const urlStr = url.toString();
        if (urlStr.includes('rel_syn=')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockSynonyms,
          } as Response);
        }
        if (urlStr.includes('rel_ant=')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockAntonyms,
          } as Response);
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      const result = await fetchThesaurus('happy');
      expect(result.word).toBe('happy');
      expect(result.isOffline).toBe(false);
      expect(result.synonyms).toContain('gleeful');
      expect(result.synonyms).toContain('ecstatic');
      expect(result.antonyms).toContain('sad');
      expect(result.antonyms).toContain('gloomy');
    });

    it('uses cached results for repeated queries without re-fetching', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => [{ word: 'luminous' }],
      } as Response);

      const first = await fetchThesaurus('bright');
      expect(fetchSpy).toHaveBeenCalled();
      const callsAfterFirst = fetchSpy.mock.calls.length;

      const second = await fetchThesaurus('bright');
      expect(second).toEqual(first);
      expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst); // No extra network calls
    });
  });
});

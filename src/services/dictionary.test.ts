import { beforeAll, describe, expect, it } from 'vitest';
import { isDictionaryReady, isKnownWord, loadDictionary, suggestWords } from './dictionary';
import { checkTextOffline, collectLikelyNames, fetchSpellingSuggestions } from './spellingService';

const flagged = (text: string, ignore: string[] = []) =>
  checkTextOffline(text, ignore)
    .filter((i) => i.category === 'spelling')
    .map((i) => i.matchedText);

describe('on-device spelling dictionary', () => {
  it('flags nothing beyond the built-in typo list until the dictionary has loaded', () => {
    expect(isDictionaryReady()).toBe(false);
    expect(flagged('The coridor was litrature. Teh end.')).toEqual(['Teh']);
  });

  describe('once loaded', () => {
    beforeAll(async () => {
      expect(await loadDictionary()).toBe(true);
    });

    it('knows ordinary words, contractions, possessives and compounds', () => {
      for (const word of ['corridor', 'Corridor', "didn't", 'didn’t', "kiosk's", "residents'", 'well-lit', 'pre-dawn', 'five-year-old', 'ok']) {
        expect(isKnownWord(word), word).toBe(true);
      }
      for (const word of ['coridor', 'litrature', 'thaught', 'pretendssnever']) {
        expect(isKnownWord(word), word).toBe(false);
      }
    });

    it('flags real misspellings in prose, with positions that match the text', () => {
      const text = 'She walked down the coridor and thaught about the litrature.';
      const issues = checkTextOffline(text).filter((i) => i.category === 'spelling');
      expect(issues.map((i) => i.matchedText)).toEqual(['coridor', 'thaught', 'litrature']);
      for (const issue of issues) {
        expect(text.slice(issue.offset, issue.offset + issue.length)).toBe(issue.matchedText);
        expect(issue.source).toBe('offline');
      }
    });

    it('accepts curly-apostrophe contractions and does not split them', () => {
      expect(flagged('“I didn’t,” she said. “We couldn’t, and they won’t.”')).toEqual([]);
    });

    it('leaves names, acronyms, numbers and foreign words alone', () => {
      const text = 'Yesterday Azie met Brodie at Zzyzx. The MRI took 5th place for Yüksel, who used an x86 laptop.';
      expect(flagged(text)).toEqual([]);
    });

    it('checks capitalised words only where a sentence starts, and accepts names seen elsewhere', () => {
      expect(flagged('Coridors are long.')).toEqual(['Coridors']);
      const doc = 'They drove to Zzyzx at night. Zzyzx was hot.';
      expect(flagged(doc)).toEqual(['Zzyzx']);
      expect(collectLikelyNames(doc)).toContain('zzyzx');
      expect(flagged(doc, collectLikelyNames(doc))).toEqual([]);
    });

    it("skips the project's own words and story-bible names", () => {
      expect(flagged('The neurobabel grew louder.', ['neurobabel'])).toEqual([]);
      expect(flagged('The neurobabel grew louder.')).toEqual(['neurobabel']);
    });

    it('suggests corrections without any network request', async () => {
      const original = globalThis.fetch;
      let called = false;
      globalThis.fetch = (() => {
        called = true;
        return Promise.reject(new Error('no network in this test'));
      }) as typeof fetch;
      try {
        expect(suggestWords('coridor')).toContain('corridor');
        expect(await fetchSpellingSuggestions('Litrature')).toContain('Literature');
        expect(await fetchSpellingSuggestions('corridor')).toEqual([]);
        expect(called).toBe(false);
      } finally {
        globalThis.fetch = original;
      }
    });
  });
});

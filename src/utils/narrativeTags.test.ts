import { describe, expect, it } from 'vitest';
import { extractNarrativeTags, categorizeTags } from './narrativeTags';

describe('narrativeTags utility', () => {
  it('extracts hashtags from text while ignoring headings', () => {
    const text = `# Title of Chapter
#alice was waiting near #the-docks when #inspector-morse arrived.
She hid the #brass-key in her coat pocket.
## Chapter Subsection
Later, #alice returned to #the-docks.`;

    const tags = extractNarrativeTags(text);
    const tagNames = tags.map((t) => t.name);

    expect(tagNames).toContain('alice');
    expect(tagNames).toContain('the-docks');
    expect(tagNames).toContain('inspector-morse');
    expect(tagNames).toContain('brass-key');

    // Make sure markdown headings are NOT extracted as tags
    expect(tagNames).not.toContain('title');
    expect(tagNames).not.toContain('chapter');

    // Counts check
    const alice = tags.find((t) => t.name === 'alice');
    expect(alice?.count).toBe(2);

    const docks = tags.find((t) => t.name === 'the-docks');
    expect(docks?.count).toBe(2);

    const key = tags.find((t) => t.name === 'brass-key');
    expect(key?.count).toBe(1);
  });

  it('categorizes tags into user categories and uncategorized', () => {
    const tags = [
      { tag: '#alice', name: 'alice', count: 2 },
      { tag: '#the-docks', name: 'the-docks', count: 1 },
      { tag: '#key', name: 'key', count: 1 },
    ];

    const categories = ['characters', 'locations', 'items'];
    const assignments = {
      alice: 'characters',
      'the-docks': 'locations',
    };

    const grouped = categorizeTags(tags, categories, assignments);
    expect(grouped['characters']).toHaveLength(1);
    expect(grouped['characters'][0].name).toBe('alice');

    expect(grouped['locations']).toHaveLength(1);
    expect(grouped['locations'][0].name).toBe('the-docks');

    expect(grouped['Uncategorized']).toHaveLength(1);
    expect(grouped['Uncategorized'][0].name).toBe('key');
  });
});

import { describe, expect, it } from 'vitest';
import {
  isChapterFileName,
  parseChapterNumber,
  formatChapterFileName,
  getNextChapterFileName,
  sortChapterFiles,
  extractChapterDisplayTitle,
  slugifyTitle,
  buildRenamedChapterFileName,
} from './chapterNaming';

describe('chapterNaming utility', () => {
  it('classifies chapter filenames vs other files accurately', () => {
    expect(isChapterFileName('chapter-01.md')).toBe(true);
    expect(isChapterFileName('Chapter 1.md')).toBe(true);
    expect(isChapterFileName('chapter_two.md')).toBe(true);
    expect(isChapterFileName('Chapter 03 - The Harbor.md')).toBe(true);
    expect(isChapterFileName('01-chapter.md')).toBe(true);
    expect(isChapterFileName('02-the-beginning.md')).toBe(true);

    expect(isChapterFileName('outline.md')).toBe(false);
    expect(isChapterFileName('characters.md')).toBe(false);
    expect(isChapterFileName('worldbuilding.txt')).toBe(false);
    expect(isChapterFileName('notes.md')).toBe(false);
    expect(isChapterFileName('prologue.md')).toBe(false);
  });

  it('parses chapter numbers correctly from both numeric and chapter-* prefixes', () => {
    expect(parseChapterNumber('01-chapter.md')).toBe(1);
    expect(parseChapterNumber('02-the-beginning.md')).toBe(2);
    expect(parseChapterNumber('10-climax.md')).toBe(10);
    expect(parseChapterNumber('chapter-01.md')).toBe(1);
    expect(parseChapterNumber('Chapter 2.md')).toBe(2);
    expect(parseChapterNumber('chapter_12_finale.md')).toBe(12);
    expect(parseChapterNumber('prologue.md')).toBeNull();
    expect(parseChapterNumber('chapter-one.md')).toBeNull();
  });

  it('slugifies titles safely', () => {
    expect(slugifyTitle('The Quiet Dawn')).toBe('the-quiet-dawn');
    expect(slugifyTitle('Chapter #1: Hello!')).toBe('chapter-1-hello');
  });

  it('formats chapter filenames with padding', () => {
    expect(formatChapterFileName(1)).toBe('01-chapter.md');
    expect(formatChapterFileName(2, 'The Beginning')).toBe('02-the-beginning.md');
    expect(formatChapterFileName(12, 'Dark Night')).toBe('12-dark-night.md');
  });

  it('computes next chapter filename sequentially', () => {
    expect(getNextChapterFileName([])).toBe('01-chapter.md');
    expect(getNextChapterFileName(['01-chapter.md'])).toBe('02-chapter.md');
    expect(getNextChapterFileName(['chapter-01.md', 'chapter-02.md'])).toBe('03-chapter.md');
    expect(getNextChapterFileName(['01-chapter.md', '02-middle.md'])).toBe('03-chapter.md');
    expect(getNextChapterFileName(['01-chapter.md', '09-late.md'])).toBe('10-chapter.md');
    expect(getNextChapterFileName(['01-chapter.md'], 'The Escape')).toBe('02-the-escape.md');
  });

  it('sorts chapter files naturally in ascending order', () => {
    const list = [
      { name: '10-climax.md' },
      { name: 'chapter-03-storm.md' },
      { name: '02-the-beginning.md' },
      { name: '01-chapter.md' },
      { name: 'prologue.md' },
    ];
    const sorted = sortChapterFiles(list);
    expect(sorted.map((s) => s.name)).toEqual([
      '01-chapter.md',
      '02-the-beginning.md',
      'chapter-03-storm.md',
      '10-climax.md',
      'prologue.md',
    ]);
  });

  it('extracts readable chapter display titles', () => {
    expect(extractChapterDisplayTitle('01-chapter.md')).toBe('Chapter 1');
    expect(extractChapterDisplayTitle('02-the-beginning.md')).toBe('Chapter 2: The beginning');
    expect(extractChapterDisplayTitle('chapter-03-the-storm.md')).toBe('Chapter 3: The storm');
    expect(extractChapterDisplayTitle('chapter-prologue.md')).toBe('Chapter: Prologue');
    expect(extractChapterDisplayTitle('epilogue.md')).toBe('epilogue');
  });

  it('builds renamed chapter filenames while preserving numeric or chapter prefix', () => {
    expect(buildRenamedChapterFileName('01-chapter.md', 'The Harbor')).toBe('01-the-harbor.md');
    expect(buildRenamedChapterFileName('02-the-beginning.md', 'Chapter 2: The Departure')).toBe('02-the-departure.md');
    expect(buildRenamedChapterFileName('chapter-01.md', 'The Harbor')).toBe('chapter-01-the-harbor.md');
    expect(buildRenamedChapterFileName('epilogue.md', 'Final Note')).toBe('Final Note.md');
  });
});

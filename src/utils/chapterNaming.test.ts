import { describe, expect, it } from 'vitest';
import {
  parseChapterNumber,
  formatChapterFileName,
  getNextChapterFileName,
  sortChapterFiles,
  extractChapterDisplayTitle,
  slugifyTitle,
  buildRenamedChapterFileName,
} from './chapterNaming';

describe('chapterNaming utility', () => {
  it('parses chapter numbers correctly', () => {
    expect(parseChapterNumber('01-chapter.md')).toBe(1);
    expect(parseChapterNumber('02-the-beginning.md')).toBe(2);
    expect(parseChapterNumber('10-climax.md')).toBe(10);
    expect(parseChapterNumber('prologue.md')).toBeNull();
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
    expect(getNextChapterFileName(['01-chapter.md', '02-middle.md'])).toBe('03-chapter.md');
    expect(getNextChapterFileName(['01-chapter.md', '09-late.md'])).toBe('10-chapter.md');
    expect(getNextChapterFileName(['01-chapter.md'], 'The Escape')).toBe('02-the-escape.md');
  });

  it('sorts chapter files naturally in ascending order', () => {
    const list = [
      { name: '10-climax.md' },
      { name: '02-the-beginning.md' },
      { name: '01-chapter.md' },
      { name: 'prologue.md' },
    ];
    const sorted = sortChapterFiles(list);
    expect(sorted.map((s) => s.name)).toEqual([
      '01-chapter.md',
      '02-the-beginning.md',
      '10-climax.md',
      'prologue.md',
    ]);
  });

  it('extracts readable chapter display titles', () => {
    expect(extractChapterDisplayTitle('01-chapter.md')).toBe('Chapter 1');
    expect(extractChapterDisplayTitle('02-the-beginning.md')).toBe('Chapter 2: The beginning');
    expect(extractChapterDisplayTitle('epilogue.md')).toBe('epilogue');
  });

  it('builds renamed chapter filenames while preserving numeric prefix', () => {
    expect(buildRenamedChapterFileName('01-chapter.md', 'The Harbor')).toBe('01-the-harbor.md');
    expect(buildRenamedChapterFileName('02-the-beginning.md', 'Chapter 2: The Departure')).toBe('02-the-departure.md');
    expect(buildRenamedChapterFileName('epilogue.md', 'Final Note')).toBe('Final Note.md');
  });
});

import { describe, expect, it } from 'vitest';
import { markdownToHtml, markdownToProseMirror, proseMirrorToMarkdown } from './markdown';

const roundTrip = (md: string) => proseMirrorToMarkdown(markdownToProseMirror(md));

describe('markdownToHtml sanitization', () => {
  it('strips <script> tags', () => {
    const html = markdownToHtml('Hello\n\n<script>alert(1)</script>');
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain('Hello');
  });

  it('strips inline event handlers', () => {
    const html = markdownToHtml('<img src="x" onerror="alert(1)">');
    expect(html).not.toMatch(/onerror/i);
  });

  it('strips javascript: URLs', () => {
    const html = markdownToHtml('[click](javascript:alert(1))');
    expect(html).not.toMatch(/javascript:/i);
  });

  it('strips iframes', () => {
    expect(markdownToHtml('<iframe src="https://evil.example"></iframe>')).not.toMatch(/<iframe/i);
  });

  it('keeps the formatting Noveler uses', () => {
    const html = markdownToHtml('**b** *i* <u>u</u> <mark>m</mark>\n\n> quote\n\n---');
    for (const tag of ['<strong>', '<em>', '<u>', '<mark>', '<blockquote>', '<hr>']) {
      expect(html).toContain(tag);
    }
  });

  it('returns an empty string for empty input', () => {
    expect(markdownToHtml('')).toBe('');
  });
});

describe('markdown round-trip (open -> save without edits)', () => {
  const stable = [
    ['headings', '# Title\n\n## Chapter One\n\n### Scene'],
    ['bold and italic', 'She was **very** *quietly* angry.'],
    ['dialogue with smart quotes', '“Are you coming?” he called. ‘Not yet,’ she said.'],
    ['em-dashes and ellipses', 'I thought—no, I knew… it was over.'],
    ['scene break', 'End of scene.\n\n---\n\nNext scene.'],
    ['blockquote', '> A letter, read aloud.'],
    ['underline and highlight', 'A <u>marked</u> and <mark>highlighted</mark> word.'],
  ] as const;

  for (const [name, md] of stable) {
    it(`preserves ${name}`, () => {
      expect(roundTrip(md)).toBe(md);
    });
  }

  it('parses alternative ++underline++ and ==highlight== syntax', () => {
    const md = 'Alternative ++underlined++ and ==highlighted== words.';
    const json = markdownToProseMirror(md);
    expect(proseMirrorToMarkdown(json)).toBe('Alternative <u>underlined</u> and <mark>highlighted</mark> words.');
  });

  // ---- Fixed in Phase 2: previously lost/corrupted by turndown/marked ----
  it('preserves soft-wrapped lines without adding trailing spaces', () => {
    const md = 'A line that was\nhard-wrapped by another editor.';
    expect(roundTrip(md)).toBe(md);
  });

  it('does not escape a paragraph starting with a number and period', () => {
    const md = '1984. That was the year everything changed.';
    expect(roundTrip(md)).toBe(md);
  });
});

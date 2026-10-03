import { describe, expect, it } from 'vitest';
import { Document, Packer } from 'docx';
import { markdownToDocxParagraphs, parseInlineSegments } from './docx';

const texts = (md: string) => parseInlineSegments(md).map((s) => s.text).join('');

describe('parseInlineSegments', () => {
  it('handles plain text', () => {
    expect(parseInlineSegments('Just words.')).toEqual([
      { text: 'Just words.', bold: false, italics: false, underline: false, highlight: false, code: false },
    ]);
  });

  it('handles bold, italic and bold-italic', () => {
    const segs = parseInlineSegments('a **b** *c* ***d***');
    const styled = segs.map((s) => [s.text, s.bold, s.italics]);
    expect(styled).toEqual([
      ['a ', false, false],
      ['b', true, false],
      [' ', false, false],
      ['c', false, true],
      [' ', false, false],
      ['d', true, true],
    ]);
  });

  it('handles nesting', () => {
    const segs = parseInlineSegments('**bold *both* bold**');
    expect(segs.map((s) => [s.text, s.bold, s.italics])).toEqual([
      ['bold ', true, false],
      ['both', true, true],
      [' bold', true, false],
    ]);
  });

  it('handles <u> and <mark> without leaking tags into the text', () => {
    const segs = parseInlineSegments('x <u>under</u> y <mark>hi</mark> z');
    expect(texts('x <u>under</u> y <mark>hi</mark> z')).toBe('x under y hi z');
    expect(segs.find((s) => s.text === 'under')?.underline).toBe(true);
    expect(segs.find((s) => s.text === 'hi')?.highlight).toBe(true);
  });

  it('unescapes backslash escapes', () => {
    expect(texts('1984\\. A \\*literal\\* star')).toBe('1984. A *literal* star');
    expect(parseInlineSegments('\\*not italic\\*').every((s) => !s.italics)).toBe(true);
  });

  it('treats inline code literally', () => {
    const segs = parseInlineSegments('run `**x**` now');
    expect(segs.find((s) => s.code)?.text).toBe('**x**');
  });

  it('keeps an unknown "<" character', () => {
    expect(texts('a < b and c <d>')).toBe('a < b and c <d>');
  });
});

describe('markdownToDocxParagraphs', () => {
  it('produces one paragraph per block and skips blank lines', () => {
    const md = '## Chapter One\n\nFirst paragraph.\n\nSecond paragraph.\n\n---\n\n- item one\n- item two\n\n> quote';
    expect(markdownToDocxParagraphs(md)).toHaveLength(7);
  });

  it('builds a valid .docx (zip) archive', async () => {
    const doc = new Document({
      sections: [{ children: markdownToDocxParagraphs('# T\n\nText with **bold** and <mark>mark</mark>.') }],
    });
    const blob = await Packer.toBlob(doc);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // ZIP local file header "PK\x03\x04"
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });
});

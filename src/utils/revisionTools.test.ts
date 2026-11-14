import { afterEach, describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { buildEpub, chapterToXhtml } from '../export/epub';
import { collapseUnchanged, diffParagraphs, summarizeDiff } from './textDiff';
import { WritingAids, findEchoes, findQuoteRange, writingAidsKey, type CommentAnchor } from '../extensions/writingAids';

describe('EPUB export', () => {
  const chapters = [
    { title: 'Chapter 1: Beanery', markdown: '# Chapter 1: Beanery\n\n## Axel\n\nHe *waited* & watched.\n\n## Papa\n\nPapa arrived.\n\n---\n\nLater.' },
    { title: 'Chapter 2', markdown: 'No heading here, just text.' },
  ];

  it('produces a valid EPUB container with one section per chapter', async () => {
    const blob = await buildEpub(chapters, { title: 'Proviso <22>', author: 'K. M.', identifier: 'urn:test', modified: '2026-01-01T00:00:00Z' });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());

    // The mimetype entry is first and uncompressed, as the format requires.
    expect(Object.keys(zip.files)[0]).toBe('mimetype');
    expect(await zip.file('mimetype')!.async('string')).toBe('application/epub+zip');
    expect(await zip.file('META-INF/container.xml')!.async('string')).toContain('OEBPS/content.opf');

    const opf = await zip.file('OEBPS/content.opf')!.async('string');
    expect(opf).toContain('<dc:title>Proviso &lt;22&gt;</dc:title>');
    expect(opf).toContain('<dc:creator>K. M.</dc:creator>');
    expect(opf).toContain('<itemref idref="chapter-1"/>');
    expect(opf).toContain('<itemref idref="chapter-2"/>');

    const nav = await zip.file('OEBPS/nav.xhtml')!.async('string');
    expect(nav).toContain('<a href="chapter-1.xhtml">Chapter 1: Beanery</a>');

    const one = await zip.file('OEBPS/chapter-1.xhtml')!.async('string');
    expect(one).toContain('<h1>Chapter 1: Beanery</h1>');
    expect(one).toContain('<em>waited</em> &amp; watched');
    expect((one.match(/<h1/g) || []).length).toBe(1);
    // Every page must be well-formed XML for e-readers.
    for (const name of ['OEBPS/chapter-1.xhtml', 'OEBPS/chapter-2.xhtml', 'OEBPS/nav.xhtml', 'OEBPS/title.xhtml', 'OEBPS/content.opf', 'OEBPS/toc.ncx']) {
      const xml = await zip.file(name)!.async('string');
      const parsed = new DOMParser().parseFromString(xml, 'application/xml');
      expect(parsed.getElementsByTagName('parsererror').length, name).toBe(0);
    }

    // A chapter without its own heading gets its title added.
    expect(await zip.file('OEBPS/chapter-2.xhtml')!.async('string')).toContain('<h1>Chapter 2</h1>');
  });

  it('follows the scene-heading display choice', () => {
    const md = chapters[0].markdown;
    const shown = chapterToXhtml(md, 'show').body;
    expect(shown).toContain('<h2>Axel</h2>');
    expect(shown).toContain('<h2>Papa</h2>');

    const hidden = chapterToXhtml(md, 'hide').body;
    expect(hidden).not.toContain('<h2');
    // The first scene opens the chapter (no break); the second is separated; the --- is a break too.
    expect((hidden.match(/class="scene-break"/g) || []).length).toBe(2);
    expect(hidden.indexOf('scene-break')).toBeGreaterThan(hidden.indexOf('watched'));
  });
});

describe('paragraph diff', () => {
  it('reports added and removed paragraphs and collapses unchanged runs', () => {
    const before = 'One.\n\nTwo.\n\nThree.\n\nFour.\n\nFive.\n\nSix.';
    const after = 'One.\n\nTwo.\n\nThree.\n\nFour.\n\nFive, rewritten.\n\nSix.\n\nSeven.';
    const blocks = diffParagraphs(before, after);
    expect(summarizeDiff(blocks)).toEqual({ added: 2, removed: 1, identical: false });
    expect(blocks.filter((b) => b.type === 'removed').map((b) => b.text)).toEqual(['Five.']);
    expect(blocks.filter((b) => b.type === 'added').map((b) => b.text)).toEqual(['Five, rewritten.', 'Seven.']);

    const rows = collapseUnchanged(blocks);
    expect(rows[0]).toEqual({ type: 'skipped', count: 3 });
    expect(summarizeDiff(diffParagraphs(before, before)).identical).toBe(true);
  });
});

describe('writing aids', () => {
  let editor: Editor | null = null;
  afterEach(() => {
    editor?.destroy();
    editor = null;
  });

  const make = (markdown: string, comments: CommentAnchor[] = [], echoes = false) => {
    editor = new Editor({
      element: document.createElement('div'),
      extensions: [StarterKit, Markdown, WritingAids.configure({ getComments: () => comments, echoesEnabled: () => echoes })],
      content: markdown,
      contentType: 'markdown',
    });
    return editor;
  };

  it('anchors a comment to its passage without changing the text, and follows edits', () => {
    const md = '# Chapter\n\nThe bus was *late*, which was reliable.\n';
    const ed = make(md, [{ id: 'c1', quote: 'bus was late', text: 'Check the timetable' }]);
    const range = findQuoteRange(ed.state.doc, 'bus was late')!;
    expect(ed.state.doc.textBetween(range.from, range.to)).toBe('bus was late');
    expect(writingAidsKey.getState(ed.state)!.comments.find().length).toBe(1);

    // Typing earlier in the paragraph keeps the anchor on the same words.
    ed.commands.insertContentAt(range.from - 4, 'Now ');
    const moved = writingAidsKey.getState(ed.state)!.comments.find()[0];
    expect(ed.state.doc.textBetween(moved.from, moved.to)).toBe('bus was late');

    // The Markdown saved to disk contains no trace of the comment.
    expect(ed.getMarkdown()).not.toContain('Check the timetable');
    expect(findQuoteRange(ed.state.doc, 'no such passage')).toBeNull();
  });

  it('finds content words repeated close together, ignoring names and small words', () => {
    const ed = make(
      'She glanced at the corridor. Azie glanced again, and the corridor was empty. Azie said that Azie knew.\n\n' +
        `${'Filler words keep running along here without stopping anywhere soon. '.repeat(6)}\n\nA lone corridor.`,
      [],
      true
    );
    const words = findEchoes(ed.state.doc).map((e) => e.word.toLowerCase());
    expect(words.filter((w) => w === 'glanced').length).toBe(2);
    expect(words.filter((w) => w === 'corridor').length).toBe(2);
    expect(words).not.toContain('azie');
    expect(words).not.toContain('that');
    expect(writingAidsKey.getState(ed.state)!.echoes.find().length).toBeGreaterThan(0);
  });
});

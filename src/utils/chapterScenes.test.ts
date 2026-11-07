import { describe, it, expect } from 'vitest';
import {
  splitChapterIntoScenes,
  joinChapterScenes,
  getChapterScenes,
  extractSceneTitlesFromMarkdown,
  updateSceneTitleAtIndex,
  reorderChapterScenes,
  appendSceneToChapter,
  insertSceneAfterIndex,
  deleteSceneFromChapter,
  findScenePositionInDoc,
  getSceneIndexAtPosition,
  getSceneHeadingsSignatureInDoc,
  type TraversableProseMirrorDoc,
} from './chapterScenes';

describe('chapterScenes utilities (## Scene Header model)', () => {
  it('splits a chapter with a preamble and multiple ## scene headers', () => {
    const md = `# Chapter One\n\n## The Arrival\n\nFirst scene text here.\n\n## The Tavern\n\nSecond scene text here.\n\n## Midnight Escape\n\nThird scene text.`;
    const res = splitChapterIntoScenes(md);
    expect(res.preamble).toBe('# Chapter One');
    expect(res.scenes).toEqual([
      { title: 'The Arrival', body: 'First scene text here.' },
      { title: 'The Tavern', body: 'Second scene text here.' },
      { title: 'Midnight Escape', body: 'Third scene text.' },
    ]);
  });

  it('extracts structured scene outline items from ## headers', () => {
    const md = `# The Harbor\n\n## Arrival at the Docks\n\nRain fell on the docks.\n\n## Inside the Tavern\n\nInside the tavern, the fire crackled.`;
    const items = getChapterScenes(md);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('Arrival at the Docks');
    expect(items[0].wordCount).toBe(5);
    expect(items[1].title).toBe('Inside the Tavern');
    expect(items[1].wordCount).toBe(6);

    expect(extractSceneTitlesFromMarkdown(md)).toEqual([
      'Arrival at the Docks',
      'Inside the Tavern',
    ]);
  });

  it('returns an empty list when no ## scene headers exist in the chapter', () => {
    const md = `# Chapter One\n\nJust some introductory text without scene headers.`;
    expect(getChapterScenes(md)).toEqual([]);
  });

  it('updates a scene ## header title at a specific index in markdown', () => {
    const md = `# Chapter One\n\n## Old Scene 1\n\nBody 1.\n\n## Old Scene 2\n\nBody 2.\n`;
    const updated = updateSceneTitleAtIndex(md, 1, 'The Climax');
    expect(updated).toBe(`# Chapter One\n\n## Old Scene 1\n\nBody 1.\n\n## The Climax\n\nBody 2.\n`);
  });

  it('reorders scenes (both ## header and body) while keeping the chapter preamble at the top', () => {
    const md = `# Chapter One\n\n## Morning\n\nScene A prose.\n\n## Afternoon\n\nScene B prose.\n\n## Midnight\n\nScene C prose.\n`;
    const reordered = reorderChapterScenes(md, 2, 0);
    expect(reordered).toBe(
      `# Chapter One\n\n## Midnight\n\nScene C prose.\n\n## Morning\n\nScene A prose.\n\n## Afternoon\n\nScene B prose.\n`
    );
  });

  it('appends and inserts new ## scenes at the end or in the middle of a chapter', () => {
    const md = `# Chapter One\n\n## The Beginning\n\nFirst scene prose.\n\n## The Finale\n\nLast scene prose.\n`;
    const insertedMid = insertSceneAfterIndex(md, 0, 'The Bridge');
    expect(insertedMid.newSceneIndex).toBe(1);
    expect(extractSceneTitlesFromMarkdown(insertedMid.markdown)).toEqual([
      'The Beginning',
      'The Bridge',
      'The Finale',
    ]);

    const appended = appendSceneToChapter(insertedMid.markdown, 'Epilogue Beat');
    expect(appended.newSceneIndex).toBe(3);
    expect(extractSceneTitlesFromMarkdown(appended.markdown)).toEqual([
      'The Beginning',
      'The Bridge',
      'The Finale',
      'Epilogue Beat',
    ]);
  });

  it('deletes a ## scene and its body from the chapter', () => {
    const md = `# Chapter One\n\n## One\n\nScene 1.\n\n## Two\n\nScene 2.\n\n## Three\n\nScene 3.\n`;
    const res = deleteSceneFromChapter(md, 1);
    expect(res).toBe(`# Chapter One\n\n## One\n\nScene 1.\n\n## Three\n\nScene 3.\n`);
  });

  it('joins chapter preamble and scenes cleanly', () => {
    expect(
      joinChapterScenes('# Ch 1', [
        { title: 'Scene A', body: 'Prose A' },
        { title: 'Scene B', body: 'Prose B' },
      ])
    ).toBe('# Ch 1\n\n## Scene A\n\nProse A\n\n## Scene B\n\nProse B\n');
  });

  it('calculates ProseMirror scene positions and active scene index from ## (level 2) headings', () => {
    const nodes = [
      { type: { name: 'heading' }, nodeSize: 10, attrs: { level: 1 }, textContent: 'Chapter 1', offset: 0 },
      { type: { name: 'heading' }, nodeSize: 10, attrs: { level: 2 }, textContent: 'Scene 1', offset: 10 },
      { type: { name: 'paragraph' }, nodeSize: 15, textContent: 'Body 1', offset: 20 },
      { type: { name: 'heading' }, nodeSize: 10, attrs: { level: 2 }, textContent: 'Scene 2', offset: 35 },
      { type: { name: 'paragraph' }, nodeSize: 15, textContent: 'Body 2', offset: 45 },
    ];
    const mockDoc: TraversableProseMirrorDoc = {
      content: { size: 60 },
      forEach: (cb) => {
        nodes.forEach((n, idx) => cb(n, n.offset, idx));
      },
    };

    expect(findScenePositionInDoc(mockDoc, 0)).toBe(11);
    expect(findScenePositionInDoc(mockDoc, 1)).toBe(36);

    expect(getSceneIndexAtPosition(mockDoc, 22)).toBe(0);
    expect(getSceneIndexAtPosition(mockDoc, 48)).toBe(1);
    expect(getSceneHeadingsSignatureInDoc(mockDoc)).toBe('2:Scene 1|Scene 2');
  });
});

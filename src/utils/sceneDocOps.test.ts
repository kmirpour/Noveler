import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import type { Editor as ReactEditor } from '@tiptap/react';
import {
  appendMarkdownInEditor,
  deleteSceneInEditor,
  insertSceneInEditor,
  moveSceneInEditor,
  renameSceneInEditor,
  resetEditorHistory,
  setChapterTitleInEditor,
} from './sceneDocOps';
import { extractSceneTitlesFromMarkdown } from './chapterScenes';

const CHAPTER = [
  '# Chapter 1',
  '',
  'Opening line.',
  '',
  '## One',
  '',
  'First *scene* text.',
  '',
  '## Two',
  '',
  'Second scene text.',
  '',
  '## Three',
  '',
  'Third scene text.',
  '',
].join('\n');

let editor: Editor | null = null;

function makeEditor(markdown: string): ReactEditor {
  editor = new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit, Markdown],
    content: markdown,
    contentType: 'markdown',
  });
  return editor as unknown as ReactEditor;
}

const titles = (ed: ReactEditor) => extractSceneTitlesFromMarkdown(ed.getMarkdown());

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe('scene operations on the live editor', () => {
  it('renames a scene heading and can be undone', () => {
    const ed = makeEditor(CHAPTER);
    expect(renameSceneInEditor(ed, 1, 'The Kick')).toBe(true);
    expect(titles(ed)).toEqual(['One', 'The Kick', 'Three']);
    ed.commands.undo();
    expect(titles(ed)).toEqual(['One', 'Two', 'Three']);
  });

  it('moves a scene with its text, in both directions', () => {
    const ed = makeEditor(CHAPTER);
    expect(moveSceneInEditor(ed, 2, 0)).toBe(true);
    expect(titles(ed)).toEqual(['Three', 'One', 'Two']);
    expect(moveSceneInEditor(ed, 0, 2)).toBe(true);
    expect(titles(ed)).toEqual(['One', 'Two', 'Three']);
    expect(moveSceneInEditor(ed, 0, 1)).toBe(true);
    expect(titles(ed)).toEqual(['Two', 'One', 'Three']);

    const md = ed.getMarkdown();
    // The text travelled with its heading, and the chapter opening stayed on top.
    expect(md.indexOf('Second scene text.')).toBeLessThan(md.indexOf('## One'));
    expect(md.indexOf('First *scene* text.')).toBeGreaterThan(md.indexOf('## One'));
    expect(md.startsWith('# Chapter 1')).toBe(true);
    expect(moveSceneInEditor(ed, 1, 1)).toBe(false);
    expect(moveSceneInEditor(ed, 0, 9)).toBe(false);
  });

  it('inserts an empty scene after a given scene, at the start, or at the end', () => {
    const ed = makeEditor(CHAPTER);
    expect(insertSceneInEditor(ed, 0, 'Interlude')).toBe(1);
    expect(titles(ed)).toEqual(['One', 'Interlude', 'Two', 'Three']);
    expect(insertSceneInEditor(ed, 3)).toBe(4);
    expect(titles(ed)).toEqual(['One', 'Interlude', 'Two', 'Three', 'Scene 5']);
    expect(insertSceneInEditor(ed, -1, 'Prologue')).toBe(0);
    expect(titles(ed)[0]).toBe('Prologue');
    expect(ed.getMarkdown().startsWith('# Chapter 1')).toBe(true);
  });

  it('deletes a scene and its text, and undo brings it back', () => {
    const ed = makeEditor(CHAPTER);
    expect(deleteSceneInEditor(ed, 1)).toBe(true);
    expect(titles(ed)).toEqual(['One', 'Three']);
    expect(ed.getMarkdown()).not.toContain('Second scene text.');
    ed.commands.undo();
    expect(titles(ed)).toEqual(['One', 'Two', 'Three']);
    expect(ed.getMarkdown()).toContain('Second scene text.');
    expect(deleteSceneInEditor(ed, 7)).toBe(false);
  });

  it('sets the chapter title as a plain # heading', () => {
    const ed = makeEditor(CHAPTER);
    expect(setChapterTitleInEditor(ed, 'Chapter 1: Arrival')).toBe(true);
    expect(ed.getMarkdown().startsWith('# Chapter 1: Arrival\n')).toBe(true);

    const bare = makeEditor('## Only\n\nText.\n');
    expect(setChapterTitleInEditor(bare, 'Added Title')).toBe(true);
    expect(bare.getMarkdown().startsWith('# Added Title\n')).toBe(true);
    expect(titles(bare)).toEqual(['Only']);
  });

  it('keeps output standard Markdown: only #, ## headings and paragraphs', () => {
    const ed = makeEditor(CHAPTER);
    moveSceneInEditor(ed, 0, 2);
    insertSceneInEditor(ed, 1, 'New');
    renameSceneInEditor(ed, 0, 'Renamed');
    const md = ed.getMarkdown();
    expect(md).not.toMatch(/<[a-z]/i);
    expect(md).not.toMatch(/^---$/m);
    for (const line of md.split('\n')) {
      if (line.startsWith('#')) expect(line).toMatch(/^#{1,2} \S/);
    }
  });

  it('appends a note as a new last scene, keeping its formatting', () => {
    const ed = makeEditor(CHAPTER);
    expect(appendMarkdownInEditor(ed, '## Armageddon\n\nThe *end* began on a Tuesday.\n\nNobody noticed.\n')).toBe(true);
    expect(titles(ed)).toEqual(['One', 'Two', 'Three', 'Armageddon']);
    const md = ed.getMarkdown();
    expect(md).toContain('The *end* began on a Tuesday.');
    expect(md.indexOf('Nobody noticed.')).toBeGreaterThan(md.indexOf('## Armageddon'));
    expect(md.indexOf('Third scene text.')).toBeLessThan(md.indexOf('## Armageddon'));
    ed.commands.undo();
    expect(titles(ed)).toEqual(['One', 'Two', 'Three']);
  });

  it('cannot undo back into a previously loaded document', () => {
    const ed = makeEditor('# Chapter A\n\nText of chapter A.\n');
    ed.commands.setContent('# Chapter B\n\nText of chapter B.\n', { contentType: 'markdown', emitUpdate: false });
    resetEditorHistory(ed);
    ed.commands.undo();
    expect(ed.getMarkdown()).toContain('Chapter B');
    expect(ed.getMarkdown()).not.toContain('Chapter A');
  });
});

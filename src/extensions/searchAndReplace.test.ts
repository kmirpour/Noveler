import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { SearchAndReplace, searchPluginKey } from './searchAndReplace';

function createSearchEditor(content: string) {
  return new Editor({
    extensions: [StarterKit, SearchAndReplace],
    content: `<p>${content}</p>`,
  });
}

describe('SearchAndReplace extension', () => {
  it('finds all occurrences of a search term', () => {
    const editor = createSearchEditor('The cat sat on the mat. The cat smiled.');
    editor.commands.setSearchTerm('cat');

    const state = searchPluginKey.getState(editor.state);
    expect(state?.results).toHaveLength(2);
    expect(state?.currentIndex).toBe(0);
    editor.destroy();
  });

  it('respects case sensitivity flag', () => {
    const editor = createSearchEditor('The Cat chased another cat.');
    editor.commands.setSearchTerm('Cat');
    editor.commands.setCaseSensitive(true);

    const state = searchPluginKey.getState(editor.state);
    expect(state?.results).toHaveLength(1);
    editor.destroy();
  });

  it('respects whole word flag', () => {
    const editor = createSearchEditor('The catalog was about a cat.');
    editor.commands.setSearchTerm('cat');
    editor.commands.setWholeWord(true);

    const state = searchPluginKey.getState(editor.state);
    expect(state?.results).toHaveLength(1);
    editor.destroy();
  });

  it('navigates next and previous matches with cycling', () => {
    const editor = createSearchEditor('one two one three one');
    editor.commands.setSearchTerm('one');

    let state = searchPluginKey.getState(editor.state);
    expect(state?.results).toHaveLength(3);
    expect(state?.currentIndex).toBe(0);

    editor.commands.nextSearchResult();
    state = searchPluginKey.getState(editor.state);
    expect(state?.currentIndex).toBe(1);

    editor.commands.nextSearchResult();
    state = searchPluginKey.getState(editor.state);
    expect(state?.currentIndex).toBe(2);

    editor.commands.nextSearchResult();
    state = searchPluginKey.getState(editor.state);
    expect(state?.currentIndex).toBe(0);

    editor.commands.previousSearchResult();
    state = searchPluginKey.getState(editor.state);
    expect(state?.currentIndex).toBe(2);

    editor.commands.goToSearchResult(0);
    state = searchPluginKey.getState(editor.state);
    expect(state?.currentIndex).toBe(0);
    expect(editor.state.selection.from).toBe(state!.results[0].from);
    expect(editor.state.selection.to).toBe(state!.results[0].to);

    editor.destroy();
  });

  it('replaces current result', () => {
    const editor = createSearchEditor('Hello world, beautiful world.');
    editor.commands.setSearchTerm('world');
    editor.commands.setReplaceTerm('universe');

    editor.commands.replaceCurrentResult();
    expect(editor.getText()).toContain('Hello universe, beautiful world.');
    editor.destroy();
  });

  it('replaces all results', () => {
    const editor = createSearchEditor('alpha beta alpha gamma alpha');
    editor.commands.setSearchTerm('alpha');
    editor.commands.setReplaceTerm('omega');

    editor.commands.replaceAllResults();
    expect(editor.getText()).toBe('omega beta omega gamma omega');
    editor.destroy();
  });
});

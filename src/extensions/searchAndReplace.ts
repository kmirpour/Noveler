import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

export interface SearchResult {
  from: number;
  to: number;
}

export interface SearchOptions {
  searchTerm: string;
  replaceTerm: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
  results: SearchResult[];
  currentIndex: number;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchAndReplace: {
      setSearchTerm: (term: string) => ReturnType;
      setReplaceTerm: (term: string) => ReturnType;
      setCaseSensitive: (val: boolean) => ReturnType;
      setWholeWord: (val: boolean) => ReturnType;
      setUseRegex: (val: boolean) => ReturnType;
      nextSearchResult: () => ReturnType;
      previousSearchResult: () => ReturnType;
      goToSearchResult: (index: number) => ReturnType;
      replaceCurrentResult: () => ReturnType;
      replaceAllResults: () => ReturnType;
      clearSearch: () => ReturnType;
    };
  }
}

export const searchPluginKey = new PluginKey<SearchOptions>('searchAndReplace');

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findMatches(doc: PMNode, options: Omit<SearchOptions, 'results' | 'currentIndex'>): SearchResult[] {
  const { searchTerm, caseSensitive, wholeWord, useRegex } = options;
  if (!searchTerm || searchTerm.trim() === '') return [];

  let pattern: RegExp;
  try {
    let source = useRegex ? searchTerm : escapeRegExp(searchTerm);
    if (wholeWord) source = `\\b${source}\\b`;
    pattern = new RegExp(source, caseSensitive ? 'gu' : 'giu');
  } catch {
    return [];
  }

  const results: SearchResult[] = [];

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(node.text)) !== null) {
        if (match[0].length === 0) break;
        const from = pos + match.index;
        const to = from + match[0].length;
        results.push({ from, to });
      }
    }
  });

  return results;
}

export const SearchAndReplace = Extension.create<SearchOptions>({
  name: 'searchAndReplace',

  addOptions() {
    return {
      searchTerm: '',
      replaceTerm: '',
      caseSensitive: false,
      wholeWord: false,
      useRegex: false,
      results: [],
      currentIndex: 0,
    };
  },

  addStorage() {
    return {
      searchTerm: '',
      replaceTerm: '',
      caseSensitive: false,
      wholeWord: false,
      useRegex: false,
      results: [] as SearchResult[],
      currentIndex: 0,
    };
  },

  addCommands() {
    return {
      setSearchTerm:
        (searchTerm: string) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchPluginKey, { searchTerm, currentIndex: 0 });
          }
          return true;
        },

      setReplaceTerm:
        (replaceTerm: string) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchPluginKey, { replaceTerm });
          }
          return true;
        },

      setCaseSensitive:
        (caseSensitive: boolean) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchPluginKey, { caseSensitive, currentIndex: 0 });
          }
          return true;
        },

      setWholeWord:
        (wholeWord: boolean) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchPluginKey, { wholeWord, currentIndex: 0 });
          }
          return true;
        },

      setUseRegex:
        (useRegex: boolean) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchPluginKey, { useRegex, currentIndex: 0 });
          }
          return true;
        },

      nextSearchResult:
        () =>
        ({ editor, tr, dispatch }) => {
          const state = searchPluginKey.getState(editor.state);
          if (!state || state.results.length === 0) return false;
          const nextIndex = (state.currentIndex + 1) % state.results.length;
          if (dispatch) {
            tr.setMeta(searchPluginKey, { currentIndex: nextIndex });
            const target = state.results[nextIndex];
            tr.setSelection(TextSelection.create(tr.doc, target.from, target.to));
            tr.scrollIntoView();
          }
          return true;
        },

      previousSearchResult:
        () =>
        ({ editor, tr, dispatch }) => {
          const state = searchPluginKey.getState(editor.state);
          if (!state || state.results.length === 0) return false;
          const prevIndex = (state.currentIndex - 1 + state.results.length) % state.results.length;
          if (dispatch) {
            tr.setMeta(searchPluginKey, { currentIndex: prevIndex });
            const target = state.results[prevIndex];
            tr.setSelection(TextSelection.create(tr.doc, target.from, target.to));
            tr.scrollIntoView();
          }
          return true;
        },

      goToSearchResult:
        (index: number) =>
        ({ editor, tr, dispatch }) => {
          const state = searchPluginKey.getState(editor.state);
          if (!state || state.results.length === 0) return false;
          const targetIndex = ((index % state.results.length) + state.results.length) % state.results.length;
          if (dispatch) {
            tr.setMeta(searchPluginKey, { currentIndex: targetIndex });
            const target = state.results[targetIndex];
            tr.setSelection(TextSelection.create(tr.doc, target.from, target.to));
            tr.scrollIntoView();
          }
          return true;
        },

      replaceCurrentResult:
        () =>
        ({ editor, tr, dispatch }) => {
          const state = searchPluginKey.getState(editor.state);
          if (!state || state.results.length === 0) return false;
          const current = state.results[state.currentIndex];
          if (!current) return false;

          if (dispatch) {
            tr.insertText(state.replaceTerm, current.from, current.to);
          }
          return true;
        },

      replaceAllResults:
        () =>
        ({ editor, tr, dispatch }) => {
          const state = searchPluginKey.getState(editor.state);
          if (!state || state.results.length === 0) return false;

          if (dispatch) {
            // Replace from end to start so earlier offsets remain valid
            for (let i = state.results.length - 1; i >= 0; i--) {
              const res = state.results[i];
              tr.insertText(state.replaceTerm, res.from, res.to);
            }
          }
          return true;
        },

      clearSearch:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchPluginKey, {
              searchTerm: '',
              replaceTerm: '',
              results: [],
              currentIndex: 0,
            });
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const { storage } = this;

    return [
      new Plugin({
        key: searchPluginKey,
        state: {
          init: () => ({
            searchTerm: '',
            replaceTerm: '',
            caseSensitive: false,
            wholeWord: false,
            useRegex: false,
            results: [],
            currentIndex: 0,
          }),

          apply: (tr, prev, _oldState, newState) => {
            const meta = tr.getMeta(searchPluginKey);
            const next = { ...prev, ...meta };

            if (tr.docChanged || meta) {
              next.results = findMatches(newState.doc, next);
              if (next.currentIndex >= next.results.length) {
                next.currentIndex = 0;
              }
            }

            storage.searchTerm = next.searchTerm;
            storage.replaceTerm = next.replaceTerm;
            storage.caseSensitive = next.caseSensitive;
            storage.wholeWord = next.wholeWord;
            storage.useRegex = next.useRegex;
            storage.results = next.results;
            storage.currentIndex = next.currentIndex;

            return next;
          },
        },

        props: {
          decorations(state) {
            const pluginState = searchPluginKey.getState(state);
            if (!pluginState || pluginState.results.length === 0) return DecorationSet.empty;

            const decos = pluginState.results.map((res, index) => {
              const isCurrent = index === pluginState.currentIndex;
              return Decoration.inline(res.from, res.to, {
                class: isCurrent ? 'search-match search-match-current' : 'search-match',
              });
            });

            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});

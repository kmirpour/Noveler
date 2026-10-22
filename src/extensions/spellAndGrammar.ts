import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PmNode } from '@tiptap/pm/model';
import {
  checkTextOffline,
  checkTextSpellAndGrammar,
  type SpellGrammarIssue,
} from '../services/spellingService';

export interface DocumentSpellIssue extends SpellGrammarIssue {
  from: number;
  to: number;
}

export interface SpellAndGrammarOptions {
  isEnabled: () => boolean;
  getIgnoreWords: () => string[];
}

export const spellAndGrammarPluginKey = new PluginKey<{
  decorations: DecorationSet;
  issues: DocumentSpellIssue[];
}>('spellAndGrammar');

/**
 * Helper to map character offsets within a single textblock node to ProseMirror document positions.
 */
function collectIssuesInNode(
  node: PmNode,
  nodePos: number,
  rawIssues: SpellGrammarIssue[]
): DocumentSpellIssue[] {
  if (rawIssues.length === 0) return [];
  // Build a map from plain text offset within the block to ProseMirror document position
  const textOffsetsToPmPos: number[] = [];
  node.descendants((child, relPos) => {
    if (child.isText && child.text) {
      const startPmPos = nodePos + 1 + relPos;
      for (let i = 0; i < child.text.length; i++) {
        textOffsetsToPmPos.push(startPmPos + i);
      }
    }
    return true;
  });

  const mapped: DocumentSpellIssue[] = [];
  for (const issue of rawIssues) {
    const startIdx = issue.offset;
    const endIdx = issue.offset + issue.length - 1;
    if (startIdx >= 0 && endIdx < textOffsetsToPmPos.length) {
      const from = textOffsetsToPmPos[startIdx];
      const to = textOffsetsToPmPos[endIdx] + 1;
      if (to > from) {
        mapped.push({
          ...issue,
          from,
          to,
        });
      }
    }
  }
  return mapped;
}

function buildDecorations(doc: PmNode, issues: DocumentSpellIssue[]): DecorationSet {
  if (issues.length === 0) return DecorationSet.empty;
  const decos = issues.map((iss) =>
    Decoration.inline(iss.from, iss.to, {
      class: iss.category === 'spelling' ? 'spell-error-spelling' : 'spell-error-grammar',
      'data-spell-category': iss.category,
      title: `${iss.shortMessage}: ${iss.message}`,
    })
  );
  return DecorationSet.create(doc, decos);
}

/**
 * Scans all textblocks in the document synchronously with the fast offline engine.
 */
function scanDocOffline(doc: PmNode, ignoreWords: string[]): DocumentSpellIssue[] {
  const allIssues: DocumentSpellIssue[] = [];
  doc.descendants((node, pos) => {
    if (node.isTextblock && node.type.name !== 'codeBlock') {
      const text = node.textContent;
      if (text && text.trim().length > 1) {
        const blockIssues = checkTextOffline(text, ignoreWords);
        allIssues.push(...collectIssuesInNode(node, pos, blockIssues));
      }
      return false;
    }
    return true;
  });
  return allIssues;
}

/**
 * Retrieves any active spell or grammar issue covering the given ProseMirror document position.
 */
export function getSpellGrammarIssueAtPos(
  state: EditorState,
  pos: number
): DocumentSpellIssue | null {
  const pluginState = spellAndGrammarPluginKey.getState(state);
  if (!pluginState || !pluginState.issues.length) return null;
  return (
    pluginState.issues.find((iss) => pos >= iss.from && pos <= iss.to) || null
  );
}

export const SpellAndGrammar = Extension.create<SpellAndGrammarOptions>({
  name: 'spellAndGrammar',

  addOptions() {
    return {
      isEnabled: () => true,
      getIgnoreWords: () => [],
    };
  },

  addProseMirrorPlugins() {
    const { isEnabled, getIgnoreWords } = this.options;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return [
      new Plugin<{ decorations: DecorationSet; issues: DocumentSpellIssue[] }>({
        key: spellAndGrammarPluginKey,
        state: {
          init(_, { doc }) {
            if (!isEnabled()) {
              return { decorations: DecorationSet.empty, issues: [] };
            }
            const issues = scanDocOffline(doc, getIgnoreWords());
            return {
              decorations: buildDecorations(doc, issues),
              issues,
            };
          },
          apply(tr, prev, _oldState, newState) {
            const metaIssues = tr.getMeta(spellAndGrammarPluginKey) as
              | DocumentSpellIssue[]
              | undefined;
            if (metaIssues !== undefined) {
              if (!isEnabled()) {
                return { decorations: DecorationSet.empty, issues: [] };
              }
              return {
                decorations: buildDecorations(newState.doc, metaIssues),
                issues: metaIssues,
              };
            }

            if (!isEnabled()) {
              return { decorations: DecorationSet.empty, issues: [] };
            }

            if (tr.docChanged) {
              const issues = scanDocOffline(newState.doc, getIgnoreWords());
              return {
                decorations: buildDecorations(newState.doc, issues),
                issues,
              };
            }

            return prev;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)?.decorations ?? DecorationSet.empty;
          },
        },
        view(editorView) {
          const scheduleAsyncCheck = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            if (!isEnabled()) return;

            debounceTimer = setTimeout(async () => {
              if (!isEnabled() || editorView.isDestroyed) return;
              const doc = editorView.state.doc;
              const ignoreWords = getIgnoreWords();
              const blocks: { node: PmNode; pos: number; text: string }[] = [];

              doc.descendants((node, pos) => {
                if (node.isTextblock && node.type.name !== 'codeBlock') {
                  const text = node.textContent;
                  if (text && text.trim().length > 1) {
                    blocks.push({ node, pos, text });
                  }
                  return false;
                }
                return true;
              });

              // Check up to 15 non-empty paragraphs per pass (prioritizing around cursor)
              const cursorPos = editorView.state.selection.from;
              const sortedBlocks = [...blocks]
                .sort((a, b) => Math.abs(a.pos - cursorPos) - Math.abs(b.pos - cursorPos))
                .slice(0, 15);

              const resolvedByPos = new Map<number, DocumentSpellIssue[]>();
              await Promise.all(
                sortedBlocks.map(async (b) => {
                  const raw = await checkTextSpellAndGrammar(b.text, ignoreWords);
                  resolvedByPos.set(b.pos, collectIssuesInNode(b.node, b.pos, raw));
                })
              );

              if (editorView.isDestroyed || editorView.state.doc !== doc) return;

              const combined: DocumentSpellIssue[] = [];
              for (const b of blocks) {
                if (resolvedByPos.has(b.pos)) {
                  combined.push(...resolvedByPos.get(b.pos)!);
                } else {
                  const offlineRaw = checkTextOffline(b.text, ignoreWords);
                  combined.push(...collectIssuesInNode(b.node, b.pos, offlineRaw));
                }
              }

              const tr = editorView.state.tr.setMeta(spellAndGrammarPluginKey, combined);
              editorView.dispatch(tr);
            }, 900);
          };

          // Run initial async check shortly after mount
          scheduleAsyncCheck();

          return {
            update(view, prevState) {
              if (view.state.doc !== prevState.doc) {
                scheduleAsyncCheck();
              }
            },
            destroy() {
              if (debounceTimer) clearTimeout(debounceTimer);
            },
          };
        },
      }),
    ];
  },
});

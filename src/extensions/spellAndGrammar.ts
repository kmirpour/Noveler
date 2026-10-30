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

export type SpellAndGrammarMeta =
  | DocumentSpellIssue[]
  | { blockFrom: number; blockTo: number; issues: DocumentSpellIssue[] };

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
            const meta = tr.getMeta(spellAndGrammarPluginKey) as SpellAndGrammarMeta | undefined;
            if (meta !== undefined) {
              if (!isEnabled()) {
                return { decorations: DecorationSet.empty, issues: [] };
              }

              let nextIssues: DocumentSpellIssue[];
              if (Array.isArray(meta)) {
                nextIssues = meta;
              } else {
                // Incremental block update: preserve all issues outside the updated block range
                const outside = (prev.issues || []).filter(
                  (iss) => iss.to < meta.blockFrom || iss.from > meta.blockTo
                );
                nextIssues = [...outside, ...meta.issues].sort((a, b) => a.from - b.from);
              }

              return {
                decorations: buildDecorations(newState.doc, nextIssues),
                issues: nextIssues,
              };
            }

            if (!isEnabled()) {
              return { decorations: DecorationSet.empty, issues: [] };
            }

            if (tr.docChanged) {
              const prevIssues = prev.issues || [];
              const mappedIssues: DocumentSpellIssue[] = [];

              for (const iss of prevIssues) {
                const mappedFrom = tr.mapping.map(iss.from, 1);
                const mappedTo = tr.mapping.map(iss.to, -1);
                if (mappedTo <= mappedFrom) {
                  // Span deleted or collapsed
                  continue;
                }

                // If the text at this mapped range still equals the original matched text,
                // this issue was not edited and remains valid!
                const textAtRange = newState.doc.textBetween(mappedFrom, mappedTo, ' ');
                if (textAtRange === iss.matchedText) {
                  mappedIssues.push({
                    ...iss,
                    from: mappedFrom,
                    to: mappedTo,
                  });
                }
                // If textAtRange !== iss.matchedText, the user edited/corrected this word,
                // so this issue is dropped immediately!
              }

              // Also scan for any instant offline typos in the document so new common typos appear immediately
              const offlineIssues = scanDocOffline(newState.doc, getIgnoreWords());
              for (const off of offlineIssues) {
                const exists = mappedIssues.some(
                  (m) => m.from === off.from && m.to === off.to
                );
                if (!exists) {
                  mappedIssues.push(off);
                }
              }

              return {
                decorations: buildDecorations(newState.doc, mappedIssues),
                issues: mappedIssues,
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
          let activeTimer: ReturnType<typeof setTimeout> | null = null;
          let isCheckingActiveBlock = false;

          const scheduleActiveBlockCheck = () => {
            if (activeTimer) clearTimeout(activeTimer);
            if (!isEnabled()) return;

            activeTimer = setTimeout(async () => {
              if (!isEnabled() || editorView.isDestroyed || isCheckingActiveBlock) return;

              // Find the active textblock around cursor in the current doc
              const { from } = editorView.state.selection;
              const $from = editorView.state.doc.resolve(from);
              let targetNode: PmNode | null = null;
              let targetPos = -1;

              for (let depth = $from.depth; depth >= 0; depth--) {
                const node = $from.node(depth);
                if (node.isTextblock && node.type.name !== 'codeBlock') {
                  targetNode = node;
                  targetPos = $from.before(depth);
                  break;
                }
              }

              if (!targetNode || targetPos < 0) return;
              const textToCheck = targetNode.textContent;
              if (!textToCheck || textToCheck.trim().length < 2) return;

              const ignoreWords = getIgnoreWords();
              isCheckingActiveBlock = true;

              try {
                const rawIssues = await checkTextSpellAndGrammar(textToCheck, ignoreWords);
                if (editorView.isDestroyed) return;

                // Locate this block in the latest editor state
                let currentBlockNode: PmNode | null = null;
                let currentBlockPos = -1;

                if (targetPos < editorView.state.doc.nodeSize) {
                  const nodeAt = editorView.state.doc.nodeAt(targetPos);
                  if (nodeAt && nodeAt.isTextblock && nodeAt.textContent === textToCheck) {
                    currentBlockNode = nodeAt;
                    currentBlockPos = targetPos;
                  }
                }

                if (!currentBlockNode) {
                  editorView.state.doc.descendants((node, pos) => {
                    if (node.isTextblock && node.type.name !== 'codeBlock' && node.textContent === textToCheck) {
                      currentBlockNode = node;
                      currentBlockPos = pos;
                      return false;
                    }
                    return true;
                  });
                }

                if (!currentBlockNode || currentBlockPos < 0) return;

                const blockIssues = collectIssuesInNode(currentBlockNode, currentBlockPos, rawIssues);
                const blockFrom = currentBlockPos;
                const blockTo = currentBlockPos + currentBlockNode.nodeSize;

                const tr = editorView.state.tr.setMeta(spellAndGrammarPluginKey, {
                  blockFrom,
                  blockTo,
                  issues: blockIssues,
                });
                editorView.dispatch(tr);
              } catch {
                // ignore network error
              } finally {
                isCheckingActiveBlock = false;
              }
            }, 350); // Fast 350ms debounce
          };

          const scheduleInitialDocCheck = () => {
            if (!isEnabled()) return;
            setTimeout(async () => {
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

              if (blocks.length === 0) return;

              const cursorPos = editorView.state.selection.from;
              const sorted = [...blocks].sort((a, b) => Math.abs(a.pos - cursorPos) - Math.abs(b.pos - cursorPos));

              // Process top blocks around cursor in pairs of 2 with small pauses
              for (let i = 0; i < Math.min(sorted.length, 10); i += 2) {
                if (editorView.isDestroyed) return;
                const slice = sorted.slice(i, i + 2);
                await Promise.all(
                  slice.map(async (b) => {
                    const raw = await checkTextSpellAndGrammar(b.text, ignoreWords);
                    if (editorView.isDestroyed) return;

                    let currentPos = -1;
                    let currentNode: PmNode | null = null;
                    editorView.state.doc.descendants((node, pos) => {
                      if (node.isTextblock && node.textContent === b.text) {
                        currentNode = node;
                        currentPos = pos;
                        return false;
                      }
                      return true;
                    });

                    const foundNode = currentNode as PmNode | null;
                    if (foundNode && currentPos >= 0) {
                      const mapped = collectIssuesInNode(foundNode, currentPos, raw);
                      const tr = editorView.state.tr.setMeta(spellAndGrammarPluginKey, {
                        blockFrom: currentPos,
                        blockTo: currentPos + foundNode.nodeSize,
                        issues: mapped,
                      });
                      editorView.dispatch(tr);
                    }
                  })
                );
                if (i + 2 < sorted.length) {
                  await new Promise((r) => setTimeout(r, 120));
                }
              }
            }, 100);
          };

          // Run initial check shortly after mount
          scheduleInitialDocCheck();

          return {
            update(view, prevState) {
              if (view.state.doc !== prevState.doc) {
                scheduleActiveBlockCheck();
              }
            },
            destroy() {
              if (activeTimer) clearTimeout(activeTimer);
            },
          };
        },
      }),
    ];
  },
});

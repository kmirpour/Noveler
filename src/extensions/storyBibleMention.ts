import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

export interface MentionCoords {
  left: number;
  top: number;
  bottom: number;
}

export interface MentionState {
  active: boolean;
  query: string;
  range: { from: number; to: number };
  coords: MentionCoords | null;
}

export const storyBibleMentionPluginKey = new PluginKey<MentionState>('storyBibleMention');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    storyBibleMention: {
      closeMention: () => ReturnType;
    };
  }
}

export const StoryBibleMention = Extension.create({
  name: 'storyBibleMention',

  addCommands() {
    return {
      closeMention:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(storyBibleMentionPluginKey, {
              active: false,
              query: '',
              range: { from: 0, to: 0 },
              coords: null,
            });
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    let currentMentionState: MentionState = {
      active: false,
      query: '',
      range: { from: 0, to: 0 },
      coords: null,
    };

    return [
      new Plugin<MentionState>({
        key: storyBibleMentionPluginKey,
        state: {
          init: () => currentMentionState,
          apply(tr, prev, _oldState, newState) {
            const meta = tr.getMeta(storyBibleMentionPluginKey) as MentionState | undefined;
            if (meta !== undefined) {
              currentMentionState = meta;
              return meta;
            }

            const { from, empty } = newState.selection;
            if (!empty) {
              currentMentionState = { active: false, query: '', range: { from: 0, to: 0 }, coords: null };
              return currentMentionState;
            }

            const $from = newState.doc.resolve(from);
            // Get text of current block up to cursor
            const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\0', '\0');
            const match = /(?:^|[\s(])@([a-zA-Z0-9'’_-]*)$/.exec(textBefore);

            if (match) {
              const matchStr = match[0];
              const query = match[1];
              const atIdx = matchStr.indexOf('@');
              const atPos = from - (matchStr.length - atIdx);
              currentMentionState = {
                active: true,
                query,
                range: { from: atPos, to: from },
                coords: prev.active && prev.coords ? prev.coords : null,
              };
              return currentMentionState;
            }

            currentMentionState = { active: false, query: '', range: { from: 0, to: 0 }, coords: null };
            return currentMentionState;
          },
        },
        props: {
          handleKeyDown(view: EditorView, event: KeyboardEvent) {
            const pluginState = storyBibleMentionPluginKey.getState(view.state);
            if (!pluginState || !pluginState.active) return false;

            if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) {
              const customEv = new CustomEvent('story-bible-mention-keydown', {
                detail: { key: event.key, originalEvent: event },
                cancelable: true,
                bubbles: true,
              });
              view.dom.dispatchEvent(customEv);
              if (customEv.defaultPrevented) {
                event.preventDefault();
                event.stopPropagation();
                return true;
              }
            }
            return false;
          },
        },
        view(editorView) {
          const notify = () => {
            const state = storyBibleMentionPluginKey.getState(editorView.state);
            if (state && state.active) {
              try {
                const coords = editorView.coordsAtPos(state.range.from);
                const updated: MentionState = {
                  ...state,
                  coords: { left: coords.left, top: coords.top, bottom: coords.bottom },
                };
                editorView.dom.dispatchEvent(
                  new CustomEvent('story-bible-mention-update', {
                    detail: updated,
                    bubbles: true,
                  })
                );
              } catch {
                // Pos out of bounds or view destroyed
              }
            } else {
              editorView.dom.dispatchEvent(
                new CustomEvent('story-bible-mention-update', {
                  detail: { active: false, query: '', range: { from: 0, to: 0 }, coords: null },
                  bubbles: true,
                })
              );
            }
          };

          // Initial check
          setTimeout(notify, 10);

          return {
            update() {
              notify();
            },
            destroy() {
              // cleanup
            },
          };
        },
      }),
    ];
  },
});

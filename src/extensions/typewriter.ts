import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface TypewriterOptions {
  enabled: boolean;
  isEnabled?: () => boolean;
}

export const typewriterPluginKey = new PluginKey('typewriterScrolling');

export const Typewriter = Extension.create<TypewriterOptions>({
  name: 'typewriter',

  addOptions() {
    return {
      enabled: false,
    };
  },

  addProseMirrorPlugins() {
    const { options } = this;

    const checkEnabled = () => {
      if (typeof options.isEnabled === 'function') {
        return options.isEnabled();
      }
      return options.enabled;
    };

    return [
      new Plugin({
        key: typewriterPluginKey,
        view() {
          return {
            update(view, prevState) {
              if (!checkEnabled()) return;
              if (view.state.selection === prevState?.selection) return;

              // Defer slightly to let layout settle
              requestAnimationFrame(() => {
                if (!checkEnabled()) return;
                const container = view.dom.closest('.editor-container');
                if (!container) return;

                const domSelection = window.getSelection();
                if (!domSelection || domSelection.rangeCount === 0) return;

                try {
                  const range = domSelection.getRangeAt(0);
                  const rect = range.getBoundingClientRect();
                  if (rect.height === 0 && rect.width === 0) return;

                  const containerRect = container.getBoundingClientRect();
                  const targetY = containerRect.top + containerRect.height / 2;
                  const diff = rect.top - targetY;

                  if (Math.abs(diff) > 12) {
                    container.scrollBy({ top: diff, behavior: 'smooth' });
                  }
                } catch {
                  // ignore range errors
                }
              });
            },
          };
        },
      }),
    ];
  },
});

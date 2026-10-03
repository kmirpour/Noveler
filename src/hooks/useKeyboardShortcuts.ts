import { useEffect } from 'react';
import { useEditorStore } from '../stores/editorStore';

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.ctrlKey || e.metaKey;

      if (!isModifier) return;

      const key = e.key.toLowerCase();
      // Read actions at call time so this listener never needs re-registering
      // and the hook doesn't re-render App on every store change.
      const store = useEditorStore.getState();

      const handled = (action: () => void) => {
        e.preventDefault();
        e.stopPropagation();
        action();
      };

      // Ctrl+Shift+D -> Cycle Theme (Light -> Dark -> Sepia)
      if (e.shiftKey && key === 'd') return handled(() => store.cycleTheme());

      // Ctrl+Shift+S -> Save As
      if (e.shiftKey && key === 's') return handled(() => void store.saveFileAsAction());

      // Ctrl+S -> Save
      if (!e.shiftKey && key === 's') return handled(() => void store.saveFileAction());

      // Ctrl+O -> Open
      if (!e.shiftKey && key === 'o') return handled(() => void store.openFileAction());

      // Ctrl+N -> New
      if (!e.shiftKey && key === 'n') return handled(() => void store.newFile());

      // Ctrl+P -> Print / Save as PDF. Must be intercepted: the WebView's native
      // print would otherwise print the (hidden) app UI instead of the manuscript.
      if (!e.shiftKey && key === 'p') return handled(() => store.printAction());
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);
}

import { useEffect } from 'react';
import { useEditorStore } from '../stores/editorStore';

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const store = useEditorStore.getState();

      const handled = (action: () => void) => {
        e.preventDefault();
        e.stopPropagation();
        action();
      };

      // F11 -> Toggle Focus Mode
      if (e.key === 'F11') {
        return handled(() => store.toggleFocusMode());
      }

      // Escape -> dismiss open dialogs, corkboard, or exit focus mode
      if (e.key === 'Escape') {
        if (store.commandPaletteOpen) {
          return handled(() => store.setCommandPaletteOpen(false));
        }
        if (store.compileModalOpen) {
          return handled(() => store.setCompileModalOpen(false));
        }
        if (store.codexModalOpen) {
          return handled(() => store.setCodexModalOpen(false));
        }
        if (store.proseAnalysisOpen) {
          return handled(() => store.setProseAnalysisOpen(false));
        }
        if (store.goalsModalOpen) {
          return handled(() => store.setGoalsModalOpen(false));
        }
        if (store.findReplaceOpen) {
          return handled(() => store.setFindReplaceOpen(false));
        }
        if (store.corkboardOpen) {
          return handled(() => store.setCorkboardOpen(false));
        }
        if (store.focusMode) {
          return handled(() => store.setFocusMode(false));
        }
        return;
      }

      const isModifier = e.ctrlKey || e.metaKey;
      if (!isModifier) return;

      const key = e.key.toLowerCase();

      // Ctrl+K -> Command Palette
      if (!e.shiftKey && key === 'k') return handled(() => store.setCommandPaletteOpen(true));

      // Ctrl+F -> Find and Replace
      if (!e.shiftKey && key === 'f') return handled(() => store.setFindReplaceOpen(true));

      // Ctrl+G -> Goals & Statistics Modal
      if (!e.shiftKey && key === 'g') return handled(() => store.setGoalsModalOpen(true));

      // Ctrl+Shift+F -> Toggle Focus Mode
      if (e.shiftKey && key === 'f') return handled(() => store.toggleFocusMode());

      // Ctrl+E or Ctrl+Shift+E -> Export Modal (per GUIDE.md Section 7)
      if (key === 'e') return handled(() => store.toggleCompileModal());

      // Ctrl+\ -> Toggle Sidebar (per GUIDE.md Section 8)
      if (key === '\\') return handled(() => store.toggleSidebar());

      // Ctrl+Shift+T -> Toggle Typewriter Scrolling
      if (e.shiftKey && key === 't') return handled(() => store.toggleTypewriterMode());

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

      // Ctrl+P -> Print / Save as PDF
      if (!e.shiftKey && key === 'p') return handled(() => store.printAction());
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);
}

import { useEffect } from 'react';
import { useEditorStore } from '../stores/editorStore';

export function useKeyboardShortcuts() {
  const { newFile, openFileAction, saveFileAction, saveFileAsAction, cycleTheme } = useEditorStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.ctrlKey || e.metaKey;

      if (!isModifier) return;

      const key = e.key.toLowerCase();

      // Ctrl+Shift+D -> Cycle Theme (Light -> Dark -> Sepia)
      if (e.shiftKey && key === 'd') {
        e.preventDefault();
        e.stopPropagation();
        cycleTheme();
        return;
      }

      // Ctrl+Shift+S -> Save As
      if (e.shiftKey && key === 's') {
        e.preventDefault();
        e.stopPropagation();
        void saveFileAsAction();
        return;
      }

      // Ctrl+S -> Save
      if (!e.shiftKey && key === 's') {
        e.preventDefault();
        e.stopPropagation();
        void saveFileAction();
        return;
      }

      // Ctrl+O -> Open
      if (!e.shiftKey && key === 'o') {
        e.preventDefault();
        e.stopPropagation();
        void openFileAction();
        return;
      }

      // Ctrl+N -> New
      if (!e.shiftKey && key === 'n') {
        e.preventDefault();
        e.stopPropagation();
        newFile();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [newFile, openFileAction, saveFileAction, saveFileAsAction, cycleTheme]);
}

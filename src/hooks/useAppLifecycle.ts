import { useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { ask } from '@tauri-apps/plugin-dialog';
import { useEditorStore } from '../stores/editorStore';
import { isTauri } from '../services/fileService';
import { clearRecovery, loadRecovery, saveRecovery } from '../services/recovery';

const RECOVERY_DEBOUNCE_MS = 1000;

/**
 * Subscribes to a Tauri event API that returns a Promise<unlisten>, handling the
 * case where the effect is cleaned up before the promise resolves (StrictMode).
 */
function useTauriListener(subscribe: () => Promise<() => void>) {
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    subscribe()
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch((err) => console.error('Failed to register Tauri listener:', err));
    return () => {
      disposed = true;
      unlisten?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribe once
  }, []);
}

/**
 * App-level safety nets:
 *  - prompt before closing the window with unsaved changes
 *  - open files dropped onto the window (desktop: real paths from Tauri)
 *  - crash recovery for unsaved work, including Untitled documents
 */
export function useAppLifecycle() {
  // --- Close guard -------------------------------------------------------
  useTauriListener(() =>
    getCurrentWindow().onCloseRequested(async (event) => {
      const ok = await useEditorStore.getState().confirmDiscardIfDirty();
      if (!ok) event.preventDefault();
    })
  );

  useEffect(() => {
    if (isTauri()) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (useEditorStore.getState().isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // --- Native drag & drop (desktop) ---------------------------------------
  useTauriListener(() =>
    getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type !== 'drop') return;
      const [path] = event.payload.paths;
      if (path) void useEditorStore.getState().openFileByPath(path);
    })
  );

  // --- Crash recovery: offer restore on startup ----------------------------
  const editorInstance = useEditorStore((s) => s.editorInstance);
  const recoveryChecked = useRef(false);

  useEffect(() => {
    if (!editorInstance || recoveryChecked.current) return;
    recoveryChecked.current = true;

    const snapshot = loadRecovery();
    if (!snapshot || snapshot.markdown.trim() === '') {
      clearRecovery();
      return;
    }

    const when = new Date(snapshot.savedAt).toLocaleString();
    const name = snapshot.fileName || 'Untitled';
    const prompt = `Noveler found unsaved changes to "${name}" from ${when}.\n\nDo you want to restore them?`;

    void (async () => {
      const restore = isTauri()
        ? await ask(prompt, { title: 'Restore Unsaved Work', kind: 'info', okLabel: 'Restore', cancelLabel: 'Discard' })
        : window.confirm(prompt);

      if (restore) {
        useEditorStore.getState().loadDocument({
          markdown: snapshot.markdown,
          fileName: snapshot.fileName,
          filePath: snapshot.filePath,
          dirty: true,
          statusMessage: `Restored unsaved changes to ${name}`,
        });
      } else {
        clearRecovery();
      }
    })();
  }, [editorInstance]);

  // --- Crash recovery: keep the snapshot up to date ------------------------
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = useEditorStore.subscribe((state, prev) => {
      if (state.isDirty && state.markdownContent !== prev.markdownContent) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          const s = useEditorStore.getState();
          if (s.isDirty) {
            saveRecovery({ markdown: s.markdownContent, fileName: s.fileName, filePath: s.filePath });
          }
        }, RECOVERY_DEBOUNCE_MS);
      } else if (!state.isDirty && prev.isDirty) {
        // Saved or deliberately discarded: the snapshot is no longer needed.
        if (timer) clearTimeout(timer);
        clearRecovery();
      }
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}

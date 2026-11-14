import { useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { ask } from '@tauri-apps/plugin-dialog';
import { useEditorStore, flushProjectSave } from '../stores/editorStore';
import { isTauri } from '../services/fileService';
import { clearRecovery, loadRecovery, saveRecovery } from '../services/recovery';
import { loadWindowState, saveWindowState } from '../services/settings';

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
      if (!ok) {
        event.preventDefault();
        return;
      }
      // Make sure pending project changes (synopsis, order, writing log) reach disk before exit.
      await flushProjectSave();
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

  // --- Remember the window's size and position ------------------------------
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unlisten: (() => void)[] = [];

    void (async () => {
      try {
        const win = getCurrentWindow();
        const { PhysicalPosition, PhysicalSize } = await import('@tauri-apps/api/dpi');
        const { availableMonitors } = await import('@tauri-apps/api/window');

        const saved = loadWindowState();
        if (saved) {
          // Only return to a position that is still on a connected screen.
          const monitors = await availableMonitors();
          const onScreen = monitors.some(
            (m) =>
              saved.x + 80 < m.position.x + m.size.width &&
              saved.x + saved.width - 80 > m.position.x &&
              saved.y >= m.position.y - 10 &&
              saved.y + 40 < m.position.y + m.size.height
          );
          await win.setSize(new PhysicalSize(saved.width, saved.height));
          if (onScreen) await win.setPosition(new PhysicalPosition(saved.x, saved.y));
          if (saved.maximized) await win.maximize();
        }
        if (disposed) return;

        const remember = () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(async () => {
            try {
              const maximized = await win.isMaximized();
              if (maximized) {
                // Keep the last normal size; just note that the window was maximized.
                const previous = loadWindowState();
                if (previous) saveWindowState({ ...previous, maximized: true });
                return;
              }
              if (await win.isMinimized()) return;
              const size = await win.outerSize();
              const position = await win.outerPosition();
              saveWindowState({
                width: size.width,
                height: size.height,
                x: position.x,
                y: position.y,
                maximized: false,
              });
            } catch {
              // best effort
            }
          }, 400);
        };
        unlisten.push(await win.onResized(remember), await win.onMoved(remember));
        if (disposed) unlisten.forEach((fn) => fn());
      } catch (err) {
        console.warn('Could not restore window state:', err);
      }
    })();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      unlisten.forEach((fn) => fn());
    };
  }, []);

  // --- Native drag & drop (desktop) ---------------------------------------
  useTauriListener(() =>
    getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type !== 'drop') return;
      const [path] = event.payload.paths;
      if (path) void useEditorStore.getState().openFileByPath(path);
    })
  );

  // --- Auto-load last project on startup & check crash recovery -------------
  const editorInstance = useEditorStore((s) => s.editorInstance);
  const recoveryChecked = useRef(false);

  useEffect(() => {
    if (!editorInstance || recoveryChecked.current) return;
    recoveryChecked.current = true;

    const store = useEditorStore.getState();
    if (isTauri() && store.projectPath && !store.novelProject) {
      void store.loadProjectByPath(store.projectPath).then((ok) => {
        if (!ok) {
          useEditorStore.setState({ projectPath: null, projectName: null });
        }
      });
    }

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

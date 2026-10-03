import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { useEditorStore } from '../../stores/editorStore';
import { isTauri, isSupportedTextFile } from '../../services/fileService';
import './Editor.css';

const AUTOSAVE_DELAY_MS = 1500;

export function Editor() {
  // Only the initial document is needed here; later loads go through
  // editor.commands.setContent in the store, so don't re-render per keystroke.
  const [initialContent] = useState(() => useEditorStore.getState().content);
  const setEditorInstance = useEditorStore((s) => s.setEditorInstance);
  const updateCounts = useEditorStore((s) => s.updateCounts);

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        underline: false,
      }),
      Placeholder.configure({
        placeholder: 'Start writing your story...',
      }),
      Typography,
      Underline,
      Highlight,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: { spellcheck: 'true' },
    },
    onUpdate: ({ editor }) => {
      // Always read fresh state: this callback may outlive the render that created it.
      const store = useEditorStore.getState();
      store.setContent(editor.getHTML());
      store.setDirty(true);
      store.updateCounts(editor.getText());

      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      // Autosave only to a real on-disk path. In the browser build a "save"
      // is a download, which must never fire on its own.
      if (store.autoSaveEnabled && store.filePath && isTauri()) {
        autoSaveTimerRef.current = setTimeout(() => {
          const latest = useEditorStore.getState();
          if (latest.isDirty && latest.filePath && latest.autoSaveEnabled) {
            void latest.saveFileAction();
          }
        }, AUTOSAVE_DELAY_MS);
      }
    },
  });

  useEffect(() => {
    if (editor) {
      setEditorInstance(editor);
      updateCounts(editor.getText());
    }
    return () => {
      setEditorInstance(null);
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [editor, setEditorInstance, updateCounts]);

  // Browser-build only. In the desktop app Tauri intercepts OS file drops and
  // delivers real paths via onDragDropEvent (see useAppLifecycle).
  const handleDragOver = (e: React.DragEvent) => {
    if (!isTauri() && e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (isTauri() || e.dataTransfer.files.length === 0) return;
    e.preventDefault();

    const file = e.dataTransfer.files[0];
    const store = useEditorStore.getState();
    if (!isSupportedTextFile(file.name)) {
      store.setStatusMessage(`Can't open ${file.name}: unsupported file type`);
      return;
    }
    if (!(await store.confirmDiscardIfDirty())) return;

    store.loadDocument({
      markdown: await file.text(),
      fileName: file.name,
      filePath: null, // the browser can't write back to the original location
      statusMessage: `Opened ${file.name}`,
    });
  };

  return (
    <div
      className="editor-container"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <EditorContent editor={editor} />
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Focus from '@tiptap/extension-focus';
import { Markdown } from '@tiptap/markdown';
import { FictionUnderline, FictionHighlight } from '../../utils/markdown';
import { Typewriter } from '../../extensions/typewriter';
import { SearchAndReplace } from '../../extensions/searchAndReplace';
import { useEditorStore } from '../../stores/editorStore';
import { isTauri, isSupportedTextFile } from '../../services/fileService';
import './Editor.css';

const AUTOSAVE_DELAY_MS = 1500;
const COUNT_DEBOUNCE_MS = 250;
const PREVIEW_DEBOUNCE_MS = 300;

export function Editor() {
  const [initialMarkdown] = useState(() => useEditorStore.getState().markdownContent);
  const setEditorInstance = useEditorStore((s) => s.setEditorInstance);
  const updateCounts = useEditorStore((s) => s.updateCounts);
  const fontFamily = useEditorStore((s) => s.fontFamily);
  const fontSize = useEditorStore((s) => s.fontSize);
  const paragraphIndent = useEditorStore((s) => s.paragraphIndent);
  const typewriterMode = useEditorStore((s) => s.typewriterMode);
  const dimUnfocused = useEditorStore((s) => s.dimUnfocused);

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        underline: false,
      }),
      FictionUnderline,
      FictionHighlight,
      Markdown,
      Placeholder.configure({
        placeholder: 'Start writing your story...',
      }),
      Typography,
      Focus.configure({
        className: 'has-focus',
        mode: 'shallowest',
      }),
      Typewriter.configure({
        enabled: false,
        isEnabled: () => useEditorStore.getState().typewriterMode,
      }),
      SearchAndReplace,
    ],
    content: initialMarkdown,
    contentType: 'markdown',
    editorProps: {
      attributes: { spellcheck: 'true' },
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        const text = editor.state.doc.textBetween(from, to, ' ').trim();
        const words = text === '' ? 0 : text.split(/\s+/).length;
        useEditorStore.getState().setSelectedWordCount(words);
      } else {
        useEditorStore.getState().setSelectedWordCount(0);
      }
    },
    onUpdate: ({ editor }) => {
      const store = useEditorStore.getState();

      if (!store.isDirty) {
        store.setDirty(true);
      }

      // Debounced word and character counting (avoids blocking keystrokes on large books)
      if (countTimerRef.current) clearTimeout(countTimerRef.current);
      countTimerRef.current = setTimeout(() => {
        store.updateCounts(editor.getText());
      }, COUNT_DEBOUNCE_MS);

      // Debounced markdown sync for live Preview / Split view
      if (store.viewMode !== 'editor') {
        if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
        previewTimerRef.current = setTimeout(() => {
          store.setMarkdownContent(editor.getMarkdown());
        }, PREVIEW_DEBOUNCE_MS);
      }

      // Autosave to real on-disk files
      if (store.autoSaveEnabled && store.filePath && isTauri()) {
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
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
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (countTimerRef.current) clearTimeout(countTimerRef.current);
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [editor, setEditorInstance, updateCounts]);

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
      filePath: null,
      statusMessage: `Opened ${file.name}`,
    });
  };

  return (
    <div
      className={`editor-container font-${fontFamily} ${paragraphIndent ? 'indent-fiction' : 'indent-block'} ${typewriterMode ? 'typewriter-mode' : ''} ${dimUnfocused ? 'dim-unfocused' : ''}`}
      style={{ fontSize: `${fontSize}px` }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <EditorContent editor={editor} />
    </div>
  );
}


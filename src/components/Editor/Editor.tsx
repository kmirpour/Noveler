import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { useEditorStore } from '../../stores/editorStore';
import { markdownToHtml } from '../../utils/markdown';
import './Editor.css';

export function Editor() {
  const {
    content,
    setContent,
    setDirty,
    updateCounts,
    setEditorInstance,
    autoSaveEnabled,
    filePath,
    saveFileAction,
  } = useEditorStore();

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
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText();
      setContent(html);
      setDirty(true);
      updateCounts(text);

      if (autoSaveEnabled && filePath) {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
        autoSaveTimerRef.current = setTimeout(() => {
          void saveFileAction();
        }, 1500);
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const text = await file.text();
      const html = markdownToHtml(text);
      if (editor) {
        editor.commands.setContent(html);
        updateCounts(editor.getText());
      }
      useEditorStore.setState({
        content: html,
        markdownContent: text,
        fileName: file.name,
        filePath: (file as { path?: string }).path || file.name,
        isDirty: false,
        statusMessage: `Opened ${file.name}`,
      });
    }
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

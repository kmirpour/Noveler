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
import {
  StoryBibleMention,
  type MentionState,
} from '../../extensions/storyBibleMention';
import { StoryBibleMention as StoryBibleMentionComponent } from '../Mention/StoryBibleMention';
import {
  SpellAndGrammar,
  getSpellGrammarIssueAtPos,
  spellAndGrammarPluginKey,
  type DocumentSpellIssue,
} from '../../extensions/spellAndGrammar';
import { useEditorStore } from '../../stores/editorStore';
import { isTauri, isSupportedTextFile } from '../../services/fileService';
import { extractWordsFromCodexEntry } from '../../services/projectService';
import { applyCasing } from '../../services/thesaurusService';
import { sanitizeSpellWord, clearSpellingCache, isWordIgnored } from '../../services/spellingService';
import { getWordRangeAtPos } from '../../utils/editorUtils';
import { EditorContextMenu } from '../ContextMenu/EditorContextMenu';
import './Editor.css';

function getProjectIgnoreWords(): string[] {
  const novelProject = useEditorStore.getState().novelProject;
  const words = new Set<string>(novelProject?.customDictionary || []);
  for (const entry of novelProject?.codex || []) {
    for (const w of extractWordsFromCodexEntry(entry)) {
      words.add(w);
    }
  }
  return Array.from(words);
}

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
  const spellCheckEnabled = useEditorStore((s) => s.spellCheckEnabled);
  const dictionaryKey = useEditorStore((s) => (s.novelProject?.customDictionary || []).join(','));
  const codexKey = useEditorStore((s) => (s.novelProject?.codex || []).map((c) => c.name).join(','));

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
      SpellAndGrammar.configure({
        isEnabled: () => useEditorStore.getState().spellCheckEnabled,
        getIgnoreWords: getProjectIgnoreWords,
      }),
      SearchAndReplace,
      StoryBibleMention,
    ],
    content: initialMarkdown,
    contentType: 'markdown',
    editorProps: {
      attributes: { spellcheck: 'false' },
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

      // Debounced markdown sync for live Preview, Tags, Prose Analysis, Codex mentions & Crash Recovery
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      previewTimerRef.current = setTimeout(() => {
        store.setMarkdownContent(editor.getMarkdown());
      }, PREVIEW_DEBOUNCE_MS);

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

  // Refresh spell & grammar decorations when spellCheckEnabled, dictionary, or codex changes
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    clearSpellingCache();
    if (!spellCheckEnabled) {
      editor.view.dispatch(editor.state.tr.setMeta(spellAndGrammarPluginKey, []));
    } else {
      // Trigger a lightweight re-scan
      const currentIssues = spellAndGrammarPluginKey.getState(editor.state)?.issues || [];
      const ignoreSet = new Set(getProjectIgnoreWords());
      const filtered = currentIssues.filter(
        (iss) => !isWordIgnored(sanitizeSpellWord(iss.matchedText).toLowerCase(), ignoreSet)
      );
      editor.view.dispatch(editor.state.tr.setMeta(spellAndGrammarPluginKey, filtered));
    }
  }, [editor, spellCheckEnabled, dictionaryKey, codexKey]);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    targetWord: string;
    hasSelection: boolean;
    range: { from: number; to: number };
    contextIssue: DocumentSpellIssue | null;
  } | null>(null);

  const [mentionState, setMentionState] = useState<MentionState | null>(null);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const handleMentionUpdate = (e: Event) => {
      const detail = (e as CustomEvent<MentionState>).detail;
      if (detail && detail.active) {
        setMentionState(detail);
      } else {
        setMentionState(null);
      }
    };
    dom.addEventListener('story-bible-mention-update', handleMentionUpdate);
    return () => {
      dom.removeEventListener('story-bible-mention-update', handleMentionUpdate);
    };
  }, [editor]);

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

  const handleContextMenu = (e: React.MouseEvent) => {
    // If Shift key is held, bypass custom menu to show native browser context menu
    if (e.shiftKey) {
      setContextMenu(null);
      return;
    }

    e.preventDefault();
    if (!editor) return;

    const { from, to } = editor.state.selection;
    let word = '';
    let range = { from, to };
    const hasSelection = from !== to;
    let contextIssue: DocumentSpellIssue | null = null;

    const posAt = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
    const clickPos = posAt ? posAt.pos : from;

    // Check if right-clicked on a flagged spell or grammar issue first
    const issueAtClick = getSpellGrammarIssueAtPos(editor.state, clickPos);
    if (issueAtClick && !hasSelection) {
      contextIssue = issueAtClick;
      word = issueAtClick.matchedText;
      range = { from: issueAtClick.from, to: issueAtClick.to };
      editor.commands.setTextSelection({ from: issueAtClick.from, to: issueAtClick.to });
    } else if (hasSelection) {
      word = editor.state.doc.textBetween(from, to, ' ').trim();
      contextIssue = getSpellGrammarIssueAtPos(editor.state, from);
    } else if (posAt) {
      const found = getWordRangeAtPos(editor.state.doc, posAt.pos);
      if (found) {
        word = found.word;
        range = { from: found.from, to: found.to };
        editor.commands.setTextSelection({ from: found.from, to: found.to });
      }
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetWord: word,
      hasSelection,
      range,
      contextIssue,
    });
  };

  const handleReplaceWord = (chosenWord: string) => {
    if (!editor || !contextMenu) return;
    const { range, targetWord, contextIssue } = contextMenu;
    // If replacing a multi-word contextual grammar issue, use exact replacement string
    const isMultiWord = targetWord.includes(' ') || chosenWord.includes(' ') || Boolean(contextIssue);
    const replacementText = isMultiWord ? chosenWord : applyCasing(targetWord, chosenWord);

    editor
      .chain()
      .focus()
      .insertContentAt({ from: range.from, to: range.to }, replacementText)
      .run();

    setContextMenu(null);
  };

  const handleCut = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from !== to) {
      const text = editor.state.doc.textBetween(from, to);
      void navigator.clipboard.writeText(text);
      editor.chain().focus().deleteRange({ from, to }).run();
    }
  };

  const handleCopy = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from !== to) {
      const text = editor.state.doc.textBetween(from, to);
      void navigator.clipboard.writeText(text);
    }
  };

  const handlePaste = async () => {
    if (!editor) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        editor.chain().focus().insertContent(text).run();
      }
    } catch (err) {
      console.warn('Clipboard paste failed:', err);
    }
  };

  return (
    <div
      className={`editor-container font-${fontFamily} ${paragraphIndent ? 'indent-fiction' : 'indent-block'} ${typewriterMode ? 'typewriter-mode' : ''} ${dimUnfocused ? 'dim-unfocused' : ''}`}
      style={{ fontSize: `${fontSize}px` }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onContextMenu={handleContextMenu}
    >
      <EditorContent editor={editor} />
      {contextMenu && (
        <EditorContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          targetWord={contextMenu.targetWord}
          hasSelection={contextMenu.hasSelection}
          contextIssue={contextMenu.contextIssue}
          onReplaceWord={handleReplaceWord}
          onCut={handleCut}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onClose={() => setContextMenu(null)}
        />
      )}
      {mentionState && mentionState.active && (
        <StoryBibleMentionComponent
          editor={editor}
          mentionState={mentionState}
          onClose={() => setMentionState(null)}
        />
      )}
    </div>
  );
}


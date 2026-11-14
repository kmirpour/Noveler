import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
  rescanSpelling,
  type DocumentSpellIssue,
} from '../../extensions/spellAndGrammar';
import { useEditorStore } from '../../stores/editorStore';
import { isTauri, isSupportedTextFile } from '../../services/fileService';
import { extractWordsFromCodexEntry } from '../../services/projectService';
import { applyCasing } from '../../services/thesaurusService';
import { clearSpellingCache } from '../../services/spellingService';
import { getWordRangeAtPos } from '../../utils/editorUtils';
import { getSceneIndexAtPosition, getSceneHeadingsSignatureInDoc } from '../../utils/chapterScenes';
import { EditorContextMenu } from '../ContextMenu/EditorContextMenu';
import { typefaceInfo } from '../../services/settings';
import { WritingAids, refreshWritingAids, type WritingAidsOptions } from '../../extensions/writingAids';
import { promptDialog } from '../../services/dialogs';
import { cleanPastedText } from '../../utils/pasteCleanup';
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

/** Open (unresolved) comments on the file being edited. */
function getOpenComments() {
  const { novelProject, fileName } = useEditorStore.getState();
  if (!novelProject || !fileName) return [];
  return (novelProject.comments?.[fileName] || []).filter((c) => !c.resolved);
}

const writingAidsOptions: WritingAidsOptions = {
  getComments: getOpenComments,
  echoesEnabled: () => useEditorStore.getState().showEchoes,
};

const AUTOSAVE_DELAY_MS = 1500;
const COUNT_DEBOUNCE_MS = 250;
const PREVIEW_DEBOUNCE_MS = 300;

export function Editor() {
  const setEditorInstance = useEditorStore((s) => s.setEditorInstance);
  const updateCounts = useEditorStore((s) => s.updateCounts);
  const fontFamily = useEditorStore((s) => s.fontFamily);
  const fontSize = useEditorStore((s) => s.fontSize);
  const paragraphIndent = useEditorStore((s) => s.paragraphIndent);
  const sceneTitleMode = useEditorStore((s) => s.sceneTitleMode);
  const typewriterMode = useEditorStore((s) => s.typewriterMode);
  const dimUnfocused = useEditorStore((s) => s.dimUnfocused);
  const spellCheckEnabled = useEditorStore((s) => s.spellCheckEnabled);
  const lineHeight = useEditorStore((s) => s.lineHeight);
  const lineWidth = useEditorStore((s) => s.lineWidth);
  const smartQuotes = useEditorStore((s) => s.smartQuotes);
  // The editor is created once, and again only when the smart-quotes setting changes; each time it
  // starts from the text the store holds at that moment.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialMarkdown = useMemo(() => useEditorStore.getState().markdownContent, [smartQuotes]);
  const dictionaryKey = useEditorStore((s) => (s.novelProject?.customDictionary || []).join(','));
  const codexKey = useEditorStore((s) => (s.novelProject?.codex || []).map((c) => c.name).join(','));

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSceneSigRef = useRef<string>('');

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
      // Dashes and ellipses are always tidied; curly quotes only if the writer asked for them.
      Typography.configure(
        smartQuotes
          ? {}
          : {
              openDoubleQuote: false,
              closeDoubleQuote: false,
              openSingleQuote: false,
              closeSingleQuote: false,
            }
      ),
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
      WritingAids.configure(writingAidsOptions),
      StoryBibleMention,
    ],
    content: initialMarkdown,
    contentType: 'markdown',
    editorProps: {
      attributes: { spellcheck: 'false' },
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      const store = useEditorStore.getState();
      if (from !== to) {
        const text = editor.state.doc.textBetween(from, to, ' ').trim();
        const words = text === '' ? 0 : text.split(/\s+/).length;
        store.setSelectedWordCount(words);
      } else {
        store.setSelectedWordCount(0);
      }
      store.setActiveSceneIndex(getSceneIndexAtPosition(editor.state.doc, from));
      prevSceneSigRef.current = getSceneHeadingsSignatureInDoc(editor.state.doc);
    },
    onUpdate: ({ editor }) => {
      const store = useEditorStore.getState();

      if (!store.isDirty) {
        store.setDirty(true);
      }

      // Immediately sync scene outline when a ## scene header is added, deleted, or edited
      const sceneSig = getSceneHeadingsSignatureInDoc(editor.state.doc);
      const sceneSigChanged = prevSceneSigRef.current !== '' && sceneSig !== prevSceneSigRef.current;
      prevSceneSigRef.current = sceneSig;

      // Debounced word and character counting (avoids blocking keystrokes on large books)
      if (countTimerRef.current) clearTimeout(countTimerRef.current);
      countTimerRef.current = setTimeout(() => {
        store.updateCounts(editor.getText());
      }, COUNT_DEBOUNCE_MS);

      // Sync markdown immediately if scene headers changed; otherwise debounce for 300ms
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      if (sceneSigChanged) {
        store.setMarkdownContent(editor.getMarkdown());
      } else {
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
  }, [smartQuotes]);

  useEffect(() => {
    if (editor) {
      prevSceneSigRef.current = getSceneHeadingsSignatureInDoc(editor.state.doc);
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

  // Redraw comment anchors and repeated-word marks when they change, or another file is opened
  const showEchoes = useEditorStore((s) => s.showEchoes);
  const commentsKey = useEditorStore((s) =>
    s.fileName
      ? (s.novelProject?.comments?.[s.fileName] || []).map((c) => `${c.id}:${c.resolved ? 1 : 0}`).join(',')
      : ''
  );
  const openFilePath = useEditorStore((s) => s.filePath);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    refreshWritingAids(editor.view, writingAidsOptions);
  }, [editor, showEchoes, commentsKey, openFilePath]);

  // Refresh spell & grammar decorations when spellCheckEnabled, dictionary, or codex changes
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    clearSpellingCache();
    if (!spellCheckEnabled) {
      editor.view.dispatch(editor.state.tr.setMeta(spellAndGrammarPluginKey, []));
    } else {
      // Check the whole document again: marks come back when the check is switched on, and
      // disappear for words just added to the novel's dictionary or story bible.
      rescanSpelling(editor.view, getProjectIgnoreWords());
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

  /** Pastes the clipboard after tidying text copied from chat assistants or web pages. */
  const handlePasteClean = async () => {
    if (!editor) return;
    try {
      const text = cleanPastedText(await navigator.clipboard.readText());
      if (text) {
        editor.chain().focus().insertContent(text, { contentType: 'markdown' } as never).run();
      }
    } catch (err) {
      console.warn('Clipboard paste failed:', err);
    }
  };

  /** Leaves a note on the selected passage. The note is stored with the project, not in the text. */
  const handleAddComment = async () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
    // A note is anchored to text inside one paragraph: use the first paragraph of the selection.
    const quote = editor.state.doc.textBetween(from, to, '\n').split('\n')[0].trim().slice(0, 240);
    if (!quote) return;
    const text = await promptDialog({
      title: 'Comment on this passage',
      message: `“${quote.length > 90 ? `${quote.slice(0, 90)}…` : quote}”\n\nComments are saved with the novel and are never exported.`,
      placeholder: 'Your note',
      confirmLabel: 'Add comment',
    });
    if (text?.trim()) useEditorStore.getState().addCommentAction(quote, text);
  };

  /** Cuts the selection out of the manuscript and parks it in the scratchpad. */
  const handleMoveToScratchpad = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const text = editor.state.doc.textBetween(from, to, '\n\n');
    useEditorStore.getState().appendToScratchpadAction(text);
    editor.chain().focus().deleteRange({ from, to }).run();
  };

  const pageStyle = {
    fontSize: `${fontSize}px`,
    '--editor-font': typefaceInfo(fontFamily).stack,
    '--editor-line-height': String(lineHeight),
    '--editor-width': `${lineWidth}px`,
  } as CSSProperties;

  return (
    <div
      className={`editor-container ${paragraphIndent ? 'indent-fiction' : 'indent-block'} scene-title-${sceneTitleMode} ${typewriterMode ? 'typewriter-mode' : ''} ${dimUnfocused ? 'dim-unfocused' : ''}`}
      style={pageStyle}
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
          onPasteClean={handlePasteClean}
          onMoveToScratchpad={handleMoveToScratchpad}
          onAddComment={useEditorStore.getState().novelProject ? () => void handleAddComment() : undefined}
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


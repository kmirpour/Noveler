import { useState, useEffect, useRef } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { StickyNote, Eraser, Archive, CornerUpLeft } from 'lucide-react';
import { confirmDialog } from '../../services/dialogs';
import './Scratchpad.css';

const SCRATCHPAD_AUTOSAVE_MS = 800;

/**
 * A parking lot beside the manuscript, saved as `scratchpad.md` in the novel folder.
 * Text can be sent here from the editor (right-click a selection) and sent back at the cursor.
 */
export function Scratchpad() {
  const scratchpadContent = useEditorStore((s) => s.scratchpadContent);
  const setScratchpadContent = useEditorStore((s) => s.setScratchpadContent);
  const flushScratchpadAction = useEditorStore((s) => s.flushScratchpadAction);
  const editorInstance = useEditorStore((s) => s.editorInstance);
  const setStatusMessage = useEditorStore((s) => s.setStatusMessage);

  const [text, setText] = useState(scratchpadContent);
  const [hasSelection, setHasSelection] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep local state synced if the store changes from outside (e.g. text sent from the editor)
  useEffect(() => {
    setText(scratchpadContent);
  }, [scratchpadContent]);

  const commit = (val: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setScratchpadContent(val);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => commit(val), SCRATCHPAD_AUTOSAVE_MS);
  };

  const updateSelection = () => {
    const el = textareaRef.current;
    setHasSelection(Boolean(el && el.selectionStart !== el.selectionEnd));
  };

  /** Moves the selected scratchpad text into the manuscript at the editor's cursor. */
  const handleSendToManuscript = () => {
    const el = textareaRef.current;
    if (!el || !editorInstance || editorInstance.isDestroyed) return;
    const { selectionStart: from, selectionEnd: to } = el;
    const chosen = text.slice(from, to).trim();
    if (!chosen) return;

    const inserted = editorInstance
      .chain()
      .focus()
      .insertContent(chosen, { contentType: 'markdown' } as never)
      .run();
    if (!inserted) return;

    const remaining = `${text.slice(0, from).replace(/\s+$/, '')}\n\n${text.slice(to).replace(/^\s+/, '')}`.trim();
    setText(remaining);
    commit(remaining);
    setHasSelection(false);
    setStatusMessage('Moved from scratchpad into the manuscript');
  };

  const handleFlushToGraveyard = async () => {
    if (!text.trim()) return;
    const ok = await confirmDialog({
      title: 'Archive the scratchpad?',
      message:
        'Everything here is saved as a dated Markdown file in the graveyard folder, and the scratchpad is emptied.',
      confirmLabel: 'Archive',
    });
    if (!ok) return;
    commit(text);
    if (await flushScratchpadAction()) setText('');
  };

  const handleClear = async () => {
    if (!text.trim()) return;
    const ok = await confirmDialog({
      title: 'Clear the scratchpad?',
      message: 'These notes are deleted, not archived. Use Archive instead to keep a copy in the graveyard folder.',
      confirmLabel: 'Clear notes',
      danger: true,
    });
    if (!ok) return;
    setText('');
    commit('');
  };

  const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;

  return (
    <div className="scratchpad-container">
      <div className="scratchpad-header">
        <div className="scratchpad-title">
          <StickyNote size={14} />
          <span>Scratchpad</span>
        </div>
        <div className="scratchpad-actions">
          <span className="scratchpad-count">{wordCount.toLocaleString()} words</span>
          {text.trim() && (
            <>
              <button
                className="scratchpad-btn"
                onClick={handleSendToManuscript}
                disabled={!hasSelection || !editorInstance}
                title="Move the selected text into the manuscript at the cursor"
                aria-label="Move selection into the manuscript"
              >
                <CornerUpLeft size={13} />
              </button>
              <button
                className="scratchpad-btn"
                onClick={() => void handleFlushToGraveyard()}
                title="Archive to the graveyard folder and start fresh"
                aria-label="Archive scratchpad"
              >
                <Archive size={13} />
              </button>
              <button
                className="scratchpad-btn"
                onClick={() => void handleClear()}
                title="Clear the scratchpad without archiving"
                aria-label="Clear scratchpad"
              >
                <Eraser size={13} />
              </button>
            </>
          )}
        </div>
      </div>
      <div className="scratchpad-body">
        <textarea
          ref={textareaRef}
          className="scratchpad-textarea"
          value={text}
          onChange={handleChange}
          onSelect={updateSelection}
          onBlur={() => commit(text)}
          placeholder={
            'Park cut passages, stray lines and reminders here. Saved with the novel, never exported.\n\nTip: select text in the manuscript, right-click, and choose "Move to scratchpad".'
          }
        />
      </div>
    </div>
  );
}

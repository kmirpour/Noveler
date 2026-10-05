import { useState, useEffect, useRef } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { StickyNote, Eraser, Archive } from 'lucide-react';
import './Scratchpad.css';

const SCRATCHPAD_AUTOSAVE_MS = 800;

export function Scratchpad() {
  const scratchpadContent = useEditorStore((s) => s.scratchpadContent);
  const setScratchpadContent = useEditorStore((s) => s.setScratchpadContent);
  const flushScratchpadAction = useEditorStore((s) => s.flushScratchpadAction);

  const [text, setText] = useState(scratchpadContent);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local state synced if store updates externally
  useEffect(() => {
    setText(scratchpadContent);
  }, [scratchpadContent]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setScratchpadContent(val);
    }, SCRATCHPAD_AUTOSAVE_MS);
  };

  const handleFlushToGraveyard = async () => {
    if (!text.trim()) return;
    if (
      window.confirm(
        'Flush all scratchpad notes to the project graveyard folder as a timestamped markdown file?'
      )
    ) {
      const ok = await flushScratchpadAction();
      if (ok) {
        setText('');
      }
    }
  };

  const handleClear = () => {
    if (text.trim() && window.confirm('Clear all scratchpad notes for this project?')) {
      setText('');
      setScratchpadContent('');
    }
  };

  const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;

  return (
    <div className="scratchpad-container">
      <div className="scratchpad-header">
        <div className="scratchpad-title">
          <StickyNote size={14} />
          <span>Scratchpad & Notes</span>
        </div>
        <div className="scratchpad-actions">
          <span className="scratchpad-count">{wordCount} words</span>
          {text.trim() && (
            <>
              <button
                className="scratchpad-btn"
                onClick={() => void handleFlushToGraveyard()}
                title="Flush to Graveyard (archive to graveyard/ folder as timestamped .md)"
              >
                <Archive size={13} />
              </button>
              <button
                className="scratchpad-btn"
                onClick={handleClear}
                title="Clear Scratchpad"
              >
                <Eraser size={13} />
              </button>
            </>
          )}
        </div>
      </div>
      <div className="scratchpad-body">
        <textarea
          className="scratchpad-textarea"
          value={text}
          onChange={handleChange}
          placeholder="Jot down plot thoughts, character sketches, dialogue lines, or research notes here. Scratchpad notes are saved with your project, but never included in your manuscript export..."
        />
      </div>
    </div>
  );
}

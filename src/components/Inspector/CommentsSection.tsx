import { useShallow } from 'zustand/react/shallow';
import { Check, MessageSquare, RotateCcw, Trash2 } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { findQuoteRange } from '../../extensions/writingAids';
import './CommentsSection.css';

/**
 * Notes the writer has left on passages of the open file. They are stored in noveler.json, shown
 * as highlights in the editor, and never appear in the chapter file or any export.
 */
export function CommentsSection() {
  const { comments, hasProject, editor, updateCommentAction, deleteCommentAction, setStatusMessage } =
    useEditorStore(
      useShallow((s) => ({
        comments: s.fileName ? s.novelProject?.comments?.[s.fileName] : undefined,
        hasProject: Boolean(s.novelProject && s.fileName),
        editor: s.editorInstance,
        updateCommentAction: s.updateCommentAction,
        deleteCommentAction: s.deleteCommentAction,
        setStatusMessage: s.setStatusMessage,
      }))
    );

  if (!hasProject) return null;
  const list = comments || [];
  const open = list.filter((c) => !c.resolved);
  const resolved = list.filter((c) => c.resolved);

  const jumpTo = (quote: string) => {
    if (!editor || editor.isDestroyed) return;
    const range = findQuoteRange(editor.state.doc, quote);
    if (!range) {
      setStatusMessage('That passage has been rewritten since the comment was added');
      return;
    }
    editor.chain().focus().setTextSelection(range).scrollIntoView().run();
  };

  return (
    <div className="inspector-section">
      <div className="snapshots-header">
        <label className="inspector-label">
          Comments{open.length > 0 ? ` (${open.length})` : ''}
        </label>
      </div>

      {list.length === 0 ? (
        <p className="comments-empty">
          Select a passage, right-click and choose <strong>Add comment</strong> to leave yourself a note. Comments
          are never exported.
        </p>
      ) : (
        <ul className="comments-list">
          {[...open, ...resolved].map((c) => (
            <li key={c.id} className={`comment-card ${c.resolved ? 'resolved' : ''}`}>
              <button
                type="button"
                className="comment-quote"
                onClick={() => jumpTo(c.quote)}
                title="Go to this passage"
              >
                <MessageSquare size={12} />
                <span>“{c.quote}”</span>
              </button>
              <p className="comment-text">{c.text}</p>
              <div className="comment-actions">
                <span className="comment-date">{new Date(c.createdAt).toLocaleDateString()}</span>
                <button
                  type="button"
                  className="snapshot-action-btn"
                  onClick={() => updateCommentAction(c.id, { resolved: !c.resolved })}
                  title={c.resolved ? 'Reopen' : 'Mark as done'}
                  aria-label={c.resolved ? 'Reopen comment' : 'Mark comment as done'}
                >
                  {c.resolved ? <RotateCcw size={12} /> : <Check size={12} />}
                </button>
                <button
                  type="button"
                  className="snapshot-action-btn delete"
                  onClick={() => deleteCommentAction(c.id)}
                  title="Delete comment"
                  aria-label="Delete comment"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

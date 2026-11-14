import { useMemo } from 'react';
import { collapseUnchanged, diffParagraphs, summarizeDiff } from '../../utils/textDiff';

/**
 * Shows what changed between an earlier version and the current draft, paragraph by paragraph:
 * text that exists only in the earlier version, and text that has been written since.
 */
export function DiffView({ before, after, beforeLabel }: { before: string; after: string; beforeLabel: string }) {
  const { rows, summary } = useMemo(() => {
    const blocks = diffParagraphs(before, after);
    return { rows: collapseUnchanged(blocks), summary: summarizeDiff(blocks) };
  }, [before, after]);

  if (summary.identical) {
    return <p className="diff-empty">This version is the same as the current draft.</p>;
  }

  return (
    <div className="diff-view">
      <p className="diff-legend">
        <span className="diff-key removed">Only in {beforeLabel}</span>
        <span className="diff-key added">Only in the current draft</span>
        <span className="diff-count">
          {summary.removed} and {summary.added} {summary.removed + summary.added === 1 ? 'paragraph' : 'paragraphs'}
        </span>
      </p>
      {rows.map((row, i) =>
        row.type === 'skipped' ? (
          <p key={i} className="diff-skipped">
            {row.count} unchanged {row.count === 1 ? 'paragraph' : 'paragraphs'}
          </p>
        ) : (
          <p key={i} className={`diff-block ${row.type}`}>
            {row.type !== 'same' && (
              <span className="diff-marker" aria-label={row.type === 'added' ? 'Added' : 'Removed'}>
                {row.type === 'added' ? '+' : '−'}
              </span>
            )}
            {row.text}
          </p>
        )
      )}
    </div>
  );
}

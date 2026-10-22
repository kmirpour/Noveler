import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '../../stores/editorStore';
import { markdownToHtml } from '../../utils/markdown';
import './Preview.css';

export function Preview() {
  const { markdownContent, fileName } = useEditorStore(
    useShallow((s) => ({ markdownContent: s.markdownContent, fileName: s.fileName }))
  );

  const renderedHtml = useMemo(() => {
    return markdownToHtml(markdownContent);
  }, [markdownContent]);

  return (
    <div className="preview-container">
      <div className="preview-header">
        <span className="preview-label">Preview — {fileName || 'Untitled'}</span>
      </div>
      <div className="preview-content">
        <article
          className="fiction-manuscript"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      </div>
    </div>
  );
}

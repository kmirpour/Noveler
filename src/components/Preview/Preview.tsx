import { useMemo } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { markdownToHtml } from '../../utils/markdown';
import './Preview.css';

export function Preview() {
  const { markdownContent, fileName } = useEditorStore();

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

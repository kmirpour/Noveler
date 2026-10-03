import { useEditorStore } from '../../stores/editorStore';
import './StatusBar.css';

export function StatusBar() {
  const { fileName, filePath, isDirty, wordCount, charCount, statusMessage } = useEditorStore();

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span className="file-info" title={filePath || 'Untitled document'}>
          {fileName || 'Untitled'}
        </span>
        {isDirty && <span className="dirty-indicator" title="Unsaved changes"></span>}
        {statusMessage && <span className="status-badge">{statusMessage}</span>}
      </div>
      <div className="status-bar-right">
        <span>{wordCount.toLocaleString()} words</span>
        <span>{charCount.toLocaleString()} characters</span>
      </div>
    </div>
  );
}

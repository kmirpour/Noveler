import { useEditorStore } from '../../stores/editorStore';
import { Target, ScrollText } from 'lucide-react';
import './StatusBar.css';

export function StatusBar() {
  const {
    fileName,
    filePath,
    isDirty,
    wordCount,
    charCount,
    selectedWordCount,
    sessionWords,
    dailyWordGoal,
    typewriterMode,
    toggleTypewriterMode,
    setGoalsModalOpen,
    statusMessage,
  } = useEditorStore();

  const percent = dailyWordGoal > 0 ? Math.min(100, Math.round((sessionWords / dailyWordGoal) * 100)) : 0;

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
        {selectedWordCount > 0 ? (
          <span className="status-stat" title="Selected words out of total words">
            <strong>{selectedWordCount.toLocaleString()}</strong> of {wordCount.toLocaleString()} words
          </span>
        ) : (
          <span className="status-stat">{wordCount.toLocaleString()} words</span>
        )}

        <span className="status-stat">{charCount.toLocaleString()} characters</span>

        {sessionWords > 0 && (
          <span className="status-stat session-stat" title="Words written in this writing session">
            +{sessionWords.toLocaleString()} session
          </span>
        )}

        {dailyWordGoal > 0 && (
          <button
            className={`status-btn goal-badge ${percent >= 100 ? 'goal-met' : ''}`}
            onClick={() => setGoalsModalOpen(true)}
            title="Daily Writing Goal Progress (Ctrl+G)"
          >
            <Target size={12} />
            <span>{percent}%</span>
          </button>
        )}

        <button
          className={`status-btn typewriter-toggle-btn ${typewriterMode ? 'active' : ''}`}
          onClick={toggleTypewriterMode}
          title={`Typewriter Scrolling: ${typewriterMode ? 'ON' : 'OFF'} (Ctrl+Shift+T)`}
        >
          <ScrollText size={12} />
        </button>
      </div>
    </div>
  );
}


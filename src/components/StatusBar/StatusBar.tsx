import { useEditorStore } from '../../stores/editorStore';
import { Target, ScrollText, BookOpen, Clock } from 'lucide-react';
import './StatusBar.css';

export function StatusBar() {
  const {
    fileName,
    filePath,
    isDirty,
    wordCount,
    selectedWordCount,
    novelWordCount,
    sessionWords,
    dailyWordGoal,
    typewriterMode,
    toggleTypewriterMode,
    setGoalsModalOpen,
    statusMessage,
    projectPath,
  } = useEditorStore();

  const totalWords = projectPath ? (novelWordCount || wordCount) : wordCount;
  const estimatedPages = Math.max(1, Math.round(totalWords / 250));
  const readMinutes = Math.max(1, Math.ceil(totalWords / 250));
  const readTimeFormatted =
    readMinutes < 60 ? `${readMinutes} min` : `${Math.floor(readMinutes / 60)}h ${readMinutes % 60}m`;

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
          <span className="status-stat" title="Selected words out of chapter words">
            <strong>{selectedWordCount.toLocaleString()}</strong> of {wordCount.toLocaleString()} words
          </span>
        ) : (
          <span className="status-stat" title="Words in current chapter">
            {wordCount.toLocaleString()} words
          </span>
        )}

        {projectPath && novelWordCount > 0 && (
          <span className="status-stat novel-stat" title="Total words across entire novel">
            Novel: <strong>{novelWordCount.toLocaleString()}</strong>
          </span>
        )}

        <span
          className="status-stat"
          title="Estimated Book Pages (publishing standard of 250 words per paperback page)"
        >
          <BookOpen size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
          ~{estimatedPages} {estimatedPages === 1 ? 'page' : 'pages'}
        </span>

        <span
          className="status-stat"
          title="Estimated reading time (adult average of 250 words per minute)"
        >
          <Clock size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
          {readTimeFormatted}
        </span>

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


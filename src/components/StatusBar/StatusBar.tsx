import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '../../stores/editorStore';
import { Target, Check, GitCommitHorizontal } from 'lucide-react';
import { wordsToday } from '../../utils/writingLog';
import './StatusBar.css';

export function StatusBar() {
  const {
    fileName,
    filePath,
    isDirty,
    lastSavedAt,
    autoSaveEnabled,
    wordCount,
    selectedWordCount,
    novelWordCount,
    dailyWordGoal,
    writingLog,
    setGoalsModalOpen,
    statusMessage,
    projectPath,
    sceneTitle,
    chapterTitle,
    gitChangedCount,
    commitVersionAction,
  } = useEditorStore(
    useShallow((s) => {
      const chapter = s.novelProject?.binder.find((b) => b.path === s.filePath);
      return {
        fileName: s.fileName,
        filePath: s.filePath,
        isDirty: s.isDirty,
        lastSavedAt: s.lastSavedAt,
        autoSaveEnabled: s.autoSaveEnabled,
        wordCount: s.wordCount,
        selectedWordCount: s.selectedWordCount,
        novelWordCount: s.novelWordCount,
        dailyWordGoal: s.dailyWordGoal,
        writingLog: s.writingLog,
        setGoalsModalOpen: s.setGoalsModalOpen,
        statusMessage: s.statusMessage,
        projectPath: s.projectPath,
        sceneTitle: chapter?.scenes?.[s.activeSceneIndex],
        chapterTitle: chapter?.title,
        gitChangedCount: s.gitChangedFiles?.length ?? 0,
        commitVersionAction: s.commitVersionAction,
      };
    })
  );

  const todayWords = wordsToday(writingLog);
  const percent = dailyWordGoal > 0 ? Math.min(100, Math.round((todayWords / dailyWordGoal) * 100)) : 0;
  const goalMet = dailyWordGoal > 0 && todayWords >= dailyWordGoal;

  const savedTime = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;
  const saveState = isDirty
    ? { className: 'unsaved', label: filePath && autoSaveEnabled ? 'Saving…' : 'Unsaved changes' }
    : savedTime
      ? { className: 'saved', label: `Saved ${savedTime}` }
      : null;

  return (
    <div className="status-bar" role="status">
      <div className="status-bar-left">
        <span className="file-info" title={filePath || 'Untitled document'}>
          {chapterTitle || fileName || 'Untitled'}
        </span>
        {sceneTitle && (
          <span className="status-scene" title="Scene the cursor is in">
            › {sceneTitle}
          </span>
        )}
        {saveState && (
          <span className={`save-state ${saveState.className}`}>
            <span className="save-dot" aria-hidden="true" />
            {saveState.label}
          </span>
        )}
        {statusMessage && <span className="status-badge">{statusMessage}</span>}
      </div>

      <div className="status-bar-right">
        {selectedWordCount > 0 ? (
          <span className="status-stat" title="Words selected, of words in this file">
            <strong>{selectedWordCount.toLocaleString()}</strong> of {wordCount.toLocaleString()} words
          </span>
        ) : (
          <span className="status-stat" title="Words in this file">
            {wordCount.toLocaleString()} words
          </span>
        )}

        {projectPath && novelWordCount > 0 && (
          <span className="status-stat" title="Words across all chapters">
            Novel <strong>{novelWordCount.toLocaleString()}</strong>
          </span>
        )}

        {gitChangedCount > 0 && (
          <button
            className="status-btn"
            onClick={() => void commitVersionAction()}
            title={`${gitChangedCount} ${gitChangedCount === 1 ? 'file has' : 'files have'} changed since the last saved version. Click to save a version (git commit, kept on this computer).`}
          >
            <GitCommitHorizontal size={12} />
            <span>{gitChangedCount} changed</span>
          </button>
        )}

        {dailyWordGoal > 0 && (
          <button
            className={`status-btn goal-badge ${goalMet ? 'goal-met' : ''}`}
            onClick={() => setGoalsModalOpen(true)}
            title="Today's words toward your daily goal. Click for goals, streak and manuscript statistics (Ctrl+G)"
          >
            {goalMet ? <Check size={12} /> : <Target size={12} />}
            <span>
              {todayWords.toLocaleString()} / {dailyWordGoal.toLocaleString()}
            </span>
            <span className="goal-meter" aria-hidden="true">
              <span style={{ width: `${percent}%` }} />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

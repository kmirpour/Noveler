import { useState, type ChangeEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '../../stores/editorStore';
import {
  SlidersHorizontal,
  X,
  FileText,
  User,
  Target,
  Sparkles,
  Camera,
  RotateCcw,
  Trash2,
  Eye,
} from 'lucide-react';
import type { SceneMetadata, SceneStatus, SceneSnapshot } from '../../services/projectService';
import { sceneMetaAt } from '../../utils/sceneMetadata';
import { confirmDialog } from '../../services/dialogs';
import './Inspector.css';

export function Inspector() {
  const {
    inspectorOpen,
    setInspectorOpen,
    currentMetadata,
    updateSceneMetadata,
    fileName,
    filePath,
    wordCount,
    markdownContent,
    novelProject,
    createSceneSnapshotAction,
    restoreSceneSnapshotAction,
    deleteSceneSnapshotAction,
    activeSceneIndex,
    updateSceneNotesAction,
  } = useEditorStore(
    useShallow((s) => ({
      activeSceneIndex: s.activeSceneIndex,
      updateSceneNotesAction: s.updateSceneNotesAction,
      inspectorOpen: s.inspectorOpen,
      setInspectorOpen: s.setInspectorOpen,
      currentMetadata: s.currentMetadata,
      updateSceneMetadata: s.updateSceneMetadata,
      fileName: s.fileName,
      filePath: s.filePath,
      wordCount: s.wordCount,
      markdownContent: s.markdownContent,
      novelProject: s.novelProject,
      createSceneSnapshotAction: s.createSceneSnapshotAction,
      restoreSceneSnapshotAction: s.restoreSceneSnapshotAction,
      deleteSceneSnapshotAction: s.deleteSceneSnapshotAction,
    }))
  );

  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [takingSnapshot, setTakingSnapshot] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState<SceneSnapshot | null>(null);
  const [scopeChoice, setScopeChoice] = useState<'scene' | 'chapter'>('scene');

  if (!inspectorOpen) return null;

  // Notes can be kept for the scene the cursor is in, or for the chapter as a whole.
  const chapterItem = novelProject?.binder.find((b) => b.path === filePath);
  const sceneTitle = chapterItem?.scenes?.[activeSceneIndex];
  const hasScene = Boolean(filePath && sceneTitle !== undefined);
  const scope: 'scene' | 'chapter' = hasScene ? scopeChoice : 'chapter';
  const meta: SceneMetadata =
    scope === 'scene' ? sceneMetaAt(novelProject, filePath, activeSceneIndex) : currentMetadata;
  const update = (partial: Partial<SceneMetadata>) => {
    if (scope === 'scene' && filePath) updateSceneNotesAction(filePath, activeSceneIndex, partial);
    else updateSceneMetadata(partial);
  };
  const scopeWords =
    scope === 'scene' ? (chapterItem?.sceneWords?.[activeSceneIndex] ?? 0) : wordCount;
  const scopeLabel = scope === 'scene' ? 'Scene' : 'Chapter';

  const targetWords = meta.targetWords || 0;
  const progressPercent = targetWords > 0 ? Math.min(100, Math.round((scopeWords / targetWords) * 100)) : 0;

  const handleStatusChange = (status: SceneStatus) => {
    update({ status });
  };

  const handleSynopsisChange = (synopsis: string) => {
    update({ synopsis });
  };

  const handlePovChange = (pov: string) => {
    update({ pov });
  };

  const handleTargetChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    update({ targetWords: isNaN(val) ? 0 : Math.max(0, val) });
  };

  const sceneSnapshots = (novelProject?.snapshots || []).filter(
    (s) => s.scenePath === filePath
  );

  return (
    <aside className="inspector-panel">
      <div className="inspector-header">
        <div className="inspector-title">
          <SlidersHorizontal size={15} />
          <span>Inspector</span>
        </div>
        <button
          className="inspector-close-btn"
          onClick={() => setInspectorOpen(false)}
          title="Close Inspector"
        >
          <X size={15} />
        </button>
      </div>

      <div className="inspector-content">
        {/* Scene Document Name & Status */}
        <div className="inspector-section">
          {hasScene && (
            <div className="inspector-scope-toggle" role="tablist" aria-label="Notes for">
              <button
                type="button"
                role="tab"
                aria-selected={scope === 'scene'}
                className={`inspector-scope-btn ${scope === 'scene' ? 'active' : ''}`}
                onClick={() => setScopeChoice('scene')}
              >
                This scene
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={scope === 'chapter'}
                className={`inspector-scope-btn ${scope === 'chapter' ? 'active' : ''}`}
                onClick={() => setScopeChoice('chapter')}
              >
                Whole chapter
              </button>
            </div>
          )}
          <div
            className="inspector-scene-name"
            title={scope === 'scene' ? sceneTitle : chapterItem?.title || fileName || 'Untitled'}
          >
            <FileText size={14} className="inspector-meta-icon" />
            <span>
              {scope === 'scene'
                ? sceneTitle
                : chapterItem?.title ||
                  (fileName ? fileName.replace(/\.(md|markdown|txt)$/i, '') : 'Untitled Document')}
            </span>
          </div>
          {scope === 'scene' && (
            <p className="inspector-hint">Follows the cursor. Notes are saved with the project, never in the chapter file.</p>
          )}
        </div>

        {/* Status Selector */}
        <div className="inspector-section">
          <label className="inspector-label">{scopeLabel} Status</label>
          <div className="status-button-group">
            {(['idea', 'draft', 'revised', 'final'] as SceneStatus[]).map((st) => (
              <button
                key={st}
                className={`status-pill-btn ${meta.status === st ? 'active' : ''} ${st}`}
                onClick={() => handleStatusChange(st)}
              >
                {st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* POV Character */}
        <div className="inspector-section">
          <label className="inspector-label">POV Character</label>
          <div className="inspector-input-wrapper">
            <User size={14} className="inspector-meta-icon" />
            <input
              type="text"
              className="inspector-text-input"
              placeholder="e.g. John Miller"
              value={meta.pov || ''}
              onChange={(e) => handlePovChange(e.target.value)}
            />
          </div>
        </div>

        {/* Scene Word Goal */}
        <div className="inspector-section">
          <label className="inspector-label">{scopeLabel} Word Target</label>
          <div className="inspector-input-wrapper">
            <Target size={14} className="inspector-meta-icon" />
            <input
              type="number"
              min="0"
              step="100"
              className="inspector-text-input"
              placeholder="e.g. 1500"
              value={meta.targetWords || ''}
              onChange={handleTargetChange}
            />
          </div>

          {targetWords > 0 && (
            <div className="scene-progress-container">
              <div className="scene-progress-bar">
                <div
                  className="scene-progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="scene-progress-text">
                <span>{scopeWords.toLocaleString()} / {targetWords.toLocaleString()} words</span>
                <span>{progressPercent}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Scene Synopsis / Beats */}
        <div className="inspector-section flex-1">
          <div className="inspector-label-row">
            <label className="inspector-label">Synopsis & Beats</label>
            <Sparkles size={13} className="synopsis-sparkle-icon" />
          </div>
          <textarea
            className="inspector-textarea"
            placeholder={
              scope === 'scene'
                ? 'What happens in this scene? Beats, conflict, what changes…'
                : 'What this chapter does for the story…'
            }
            value={meta.synopsis || ''}
            onChange={(e) => handleSynopsisChange(e.target.value)}
          />
        </div>

        {/* Scene Snapshots & Version History */}
        {novelProject && (
          <div className="inspector-section">
            <div className="snapshots-header">
              <label className="inspector-label">Chapter Snapshots</label>
              {!takingSnapshot && (
                <button
                  className="take-snapshot-btn"
                  onClick={() => setTakingSnapshot(true)}
                  title="Save a named copy of this chapter as it is now"
                >
                  <Camera size={12} />
                  <span>Snapshot</span>
                </button>
              )}
            </div>

            {takingSnapshot && (
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <input
                  type="text"
                  className="inspector-text-input"
                  style={{ fontSize: 12, padding: '4px 8px' }}
                  placeholder="Snapshot label..."
                  value={snapshotLabel}
                  onChange={(e) => setSnapshotLabel(e.target.value)}
                  autoFocus
                />
                <button
                  className="take-snapshot-btn"
                  style={{ background: '#3b82f6', color: '#fff', border: 'none' }}
                  onClick={async () => {
                    await createSceneSnapshotAction(snapshotLabel || 'Quick Snapshot');
                    setSnapshotLabel('');
                    setTakingSnapshot(false);
                  }}
                >
                  Save
                </button>
                <button
                  className="take-snapshot-btn"
                  style={{ border: 'none' }}
                  onClick={() => {
                    setSnapshotLabel('');
                    setTakingSnapshot(false);
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            <div className="snapshot-list">
              {sceneSnapshots.length === 0 ? (
                <div className="snapshot-empty">No snapshots saved for this chapter.</div>
              ) : (
                sceneSnapshots.map((snap) => {
                  const dateStr = new Date(snap.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const diff = snap.wordCount - wordCount;
                  const diffText = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '0';

                  return (
                    <div key={snap.id} className="snapshot-card">
                      <div className="snapshot-top">
                        <span className="snapshot-label" title={snap.label}>
                          {snap.label}
                        </span>
                        <span className="snapshot-time">{dateStr}</span>
                      </div>
                      <div className="snapshot-meta">
                        <span>
                          {snap.wordCount.toLocaleString()} words ({diffText})
                        </span>
                        <div className="snapshot-actions">
                          <button
                            className="snapshot-action-btn preview"
                            onClick={() => setPreviewSnapshot(snap)}
                            title="Preview & Compare Snapshot"
                          >
                            <Eye size={12} />
                          </button>
                          <button
                            className="snapshot-action-btn restore"
                            onClick={async () => {
                              if (
                                await confirmDialog({
                                  title: `Restore snapshot "${snap.label}"?`,
                                  message: 'The chapter text is replaced by this snapshot. Ctrl+Z undoes the restore.',
                                  confirmLabel: 'Restore',
                                })
                              ) {
                                void restoreSceneSnapshotAction(snap.id);
                              }
                            }}
                            title="Restore this version"
                          >
                            <RotateCcw size={12} />
                          </button>
                          <button
                            className="snapshot-action-btn delete"
                            onClick={async () => {
                              if (
                                await confirmDialog({
                                  title: `Delete snapshot "${snap.label}"?`,
                                  message: 'This saved copy cannot be recovered afterwards.',
                                  confirmLabel: 'Delete snapshot',
                                  danger: true,
                                })
                              ) {
                                void deleteSceneSnapshotAction(snap.id);
                              }
                            }}
                            title="Delete snapshot"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Snapshot Preview & Compare Modal */}
      {previewSnapshot && (
        <div className="modal-backdrop" onClick={() => setPreviewSnapshot(null)}>
          <div className="snapshot-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <Camera size={18} className="modal-title-icon" />
                <h2>Snapshot Comparison — {previewSnapshot.label}</h2>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setPreviewSnapshot(null)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="snapshot-compare-grid">
              <div className="snapshot-compare-pane">
                <div className="snapshot-compare-header">
                  <strong>Snapshot ({new Date(previewSnapshot.timestamp).toLocaleString()})</strong>
                  <span>{previewSnapshot.wordCount.toLocaleString()} words</span>
                </div>
                <pre className="snapshot-compare-body">{previewSnapshot.content}</pre>
              </div>
              <div className="snapshot-compare-pane">
                <div className="snapshot-compare-header">
                  <strong>Current Active Draft</strong>
                  <span>{wordCount.toLocaleString()} words</span>
                </div>
                <pre className="snapshot-compare-body">{markdownContent}</pre>
              </div>
            </div>
            <div className="snapshot-preview-footer">
              <button
                type="button"
                className="snapshot-cancel-btn"
                onClick={() => setPreviewSnapshot(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="snapshot-restore-confirm-btn"
                onClick={() => {
                  void restoreSceneSnapshotAction(previewSnapshot.id);
                  setPreviewSnapshot(null);
                }}
              >
                <RotateCcw size={14} />
                <span>Restore This Snapshot</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

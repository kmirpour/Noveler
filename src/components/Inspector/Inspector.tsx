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
import type { SceneStatus, SceneSnapshot } from '../../services/projectService';
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
  } = useEditorStore(
    useShallow((s) => ({
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

  if (!inspectorOpen) return null;

  const targetWords = currentMetadata.targetWords || 0;
  const progressPercent = targetWords > 0 ? Math.min(100, Math.round((wordCount / targetWords) * 100)) : 0;

  const handleStatusChange = (status: SceneStatus) => {
    updateSceneMetadata({ status });
  };

  const handleSynopsisChange = (synopsis: string) => {
    updateSceneMetadata({ synopsis });
  };

  const handlePovChange = (pov: string) => {
    updateSceneMetadata({ pov });
  };

  const handleTargetChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    updateSceneMetadata({ targetWords: isNaN(val) ? 0 : Math.max(0, val) });
  };

  const sceneSnapshots = (novelProject?.snapshots || []).filter(
    (s) => s.scenePath === filePath
  );

  return (
    <aside className="inspector-panel">
      <div className="inspector-header">
        <div className="inspector-title">
          <SlidersHorizontal size={15} />
          <span>Scene Inspector</span>
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
          <label className="inspector-label">Active Scene</label>
          <div className="inspector-scene-name" title={fileName || 'Untitled'}>
            <FileText size={14} className="inspector-meta-icon" />
            <span>{fileName ? fileName.replace(/\.(md|markdown|txt)$/i, '') : 'Untitled Document'}</span>
          </div>
        </div>

        {/* Status Selector */}
        <div className="inspector-section">
          <label className="inspector-label">Scene Status</label>
          <div className="status-button-group">
            {(['idea', 'draft', 'revised', 'final'] as SceneStatus[]).map((st) => (
              <button
                key={st}
                className={`status-pill-btn ${currentMetadata.status === st ? 'active' : ''} ${st}`}
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
              value={currentMetadata.pov || ''}
              onChange={(e) => handlePovChange(e.target.value)}
            />
          </div>
        </div>

        {/* Scene Word Goal */}
        <div className="inspector-section">
          <label className="inspector-label">Scene Word Target</label>
          <div className="inspector-input-wrapper">
            <Target size={14} className="inspector-meta-icon" />
            <input
              type="number"
              min="0"
              step="100"
              className="inspector-text-input"
              placeholder="e.g. 1500"
              value={currentMetadata.targetWords || ''}
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
                <span>{wordCount.toLocaleString()} / {targetWords.toLocaleString()} words</span>
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
            placeholder="Outline what happens in this scene, key dialogue, conflicts, and outcomes..."
            value={currentMetadata.synopsis || ''}
            onChange={(e) => handleSynopsisChange(e.target.value)}
          />
        </div>

        {/* Scene Snapshots & Version History */}
        {novelProject && (
          <div className="inspector-section">
            <div className="snapshots-header">
              <label className="inspector-label">Version Snapshots</label>
              {!takingSnapshot && (
                <button
                  className="take-snapshot-btn"
                  onClick={() => setTakingSnapshot(true)}
                  title="Capture snapshot of current scene"
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
                <div className="snapshot-empty">No snapshots saved for this scene.</div>
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
                            onClick={() => {
                              if (confirm(`Restore snapshot "${snap.label}"? Current edits will be replaced.`)) {
                                void restoreSceneSnapshotAction(snap.id);
                              }
                            }}
                            title="Restore this version"
                          >
                            <RotateCcw size={12} />
                          </button>
                          <button
                            className="snapshot-action-btn delete"
                            onClick={() => {
                              if (confirm(`Delete snapshot "${snap.label}"?`)) {
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

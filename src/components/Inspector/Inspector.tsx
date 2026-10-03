import type { ChangeEvent } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import {
  SlidersHorizontal,
  X,
  FileText,
  User,
  Target,
  Sparkles,
} from 'lucide-react';
import type { SceneStatus } from '../../services/projectService';
import './Inspector.css';

export function Inspector() {
  const {
    inspectorOpen,
    setInspectorOpen,
    currentMetadata,
    updateSceneMetadata,
    fileName,
    wordCount,
  } = useEditorStore();

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
      </div>
    </aside>
  );
}

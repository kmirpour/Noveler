import { useState, type DragEvent, type FormEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '../../stores/editorStore';
import {
  User,
  Plus,
  ArrowRight,
  Target,
  X,
  LayoutGrid,
  GripVertical,
} from 'lucide-react';
import {
  type BinderItem,
  type SceneStatus,
  flattenScenes,
} from '../../services/projectService';
import './Corkboard.css';

export function Corkboard() {
  const {
    corkboardOpen,
    setCorkboardOpen,
    novelProject,
    projectPath,
    activeScenePath,
    loadSceneByPath,
    createSceneAction,
    updateSceneMetadataByPath,
    reorderBinderItemsAction,
  } = useEditorStore(
    useShallow((s) => ({
      corkboardOpen: s.corkboardOpen,
      setCorkboardOpen: s.setCorkboardOpen,
      novelProject: s.novelProject,
      projectPath: s.projectPath,
      activeScenePath: s.activeScenePath,
      loadSceneByPath: s.loadSceneByPath,
      createSceneAction: s.createSceneAction,
      updateSceneMetadataByPath: s.updateSceneMetadataByPath,
      reorderBinderItemsAction: s.reorderBinderItemsAction,
    }))
  );

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [addingScene, setAddingScene] = useState(false);
  const [newSceneTitle, setNewSceneTitle] = useState('');

  if (!corkboardOpen) return null;

  const scenes = novelProject ? flattenScenes(novelProject.binder) : [];

  const handleOpenScene = async (path: string) => {
    await loadSceneByPath(path);
    setCorkboardOpen(false);
  };

  const handleUpdateSynopsis = (scene: BinderItem, synopsis: string) => {
    updateSceneMetadataByPath(scene.path, { synopsis });
  };

  const handleUpdateStatus = (scene: BinderItem, status: SceneStatus) => {
    updateSceneMetadataByPath(scene.path, { status });
  };

  const handleUpdatePov = (scene: BinderItem, pov: string) => {
    updateSceneMetadataByPath(scene.path, { pov });
  };

  const handleAddNewSceneSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!projectPath) return;
    if (newSceneTitle.trim()) {
      await createSceneAction(projectPath, newSceneTitle.trim());
    } else {
      await createSceneAction(projectPath, '');
    }
    setNewSceneTitle('');
    setAddingScene(false);
  };

  const handleDragStart = (e: DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDrop = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx !== null && draggedIdx !== index) {
      void reorderBinderItemsAction(draggedIdx, index);
    }
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const getStatusColor = (status?: SceneStatus) => {
    switch (status) {
      case 'final':
        return '#10b981';
      case 'revised':
        return '#8b5cf6';
      case 'draft':
        return '#f59e0b';
      case 'idea':
      default:
        return '#64748b';
    }
  };

  return (
    <div className="corkboard-overlay">
      <div className="corkboard-header">
        <div className="corkboard-header-title">
          <LayoutGrid size={18} className="corkboard-header-icon" />
          <h2>Index Card Corkboard & Outline</h2>
          <span className="corkboard-count">{scenes.length} Scenes</span>
        </div>
        <button
          className="corkboard-close-btn"
          onClick={() => setCorkboardOpen(false)}
          title="Return to Manuscript Editor"
        >
          <X size={18} />
          <span>Back to Editor</span>
        </button>
      </div>

      <div className="corkboard-canvas">
        <div className="corkboard-grid">
          {scenes.map((scene, idx) => {
            const isActive = activeScenePath === scene.path;
            const statusColor = getStatusColor(scene.status);

            return (
              <div
                key={scene.id || scene.path}
                className={`index-card ${isActive ? 'active-card' : ''} ${dragOverIdx === idx && draggedIdx !== idx ? 'drag-over-card' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
              >
                {/* Pin / Header bar */}
                <div className="index-card-header">
                  <span title="Drag to reorder chapter" style={{ display: 'inline-flex' }}>
                    <GripVertical size={13} className="card-drag-handle" />
                  </span>
                  <div className="index-card-number">#{idx + 1}</div>
                  <h3 className="index-card-title" title={scene.title}>
                    {scene.title}
                  </h3>
                  <select
                    className="status-selector"
                    value={scene.status || 'draft'}
                    style={{ borderColor: statusColor, color: statusColor }}
                    onChange={(e) => handleUpdateStatus(scene, e.target.value as SceneStatus)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="idea">Idea</option>
                    <option value="draft">Draft</option>
                    <option value="revised">Revised</option>
                    <option value="final">Final</option>
                  </select>
                </div>

                {/* Synopsis / Beat note */}
                <div className="index-card-body">
                  <textarea
                    key={`${scene.path}-synopsis-${scene.synopsis || ''}`}
                    className="index-card-synopsis"
                    placeholder="Write scene synopsis, plot beats, or character conflict here..."
                    defaultValue={scene.synopsis || ''}
                    onBlur={(e) => handleUpdateSynopsis(scene, e.target.value)}
                  />
                </div>

                {/* Card Footer: POV character & word target */}
                <div className="index-card-footer">
                  <div className="card-meta-row">
                    <div className="card-pov-input-wrapper" title="POV Character">
                      <User size={12} className="card-meta-icon" />
                      <input
                        key={`${scene.path}-pov-${scene.pov || ''}`}
                        type="text"
                        className="card-pov-input"
                        placeholder="POV Character"
                        defaultValue={scene.pov || ''}
                        onBlur={(e) => handleUpdatePov(scene, e.target.value)}
                      />
                    </div>

                    {scene.targetWords ? (
                      <span className="card-target-words" title="Word Target">
                        <Target size={12} />
                        {scene.targetWords}w
                      </span>
                    ) : null}
                  </div>

                  <button
                    className="open-scene-card-btn"
                    onClick={() => handleOpenScene(scene.path)}
                    title="Open this scene in the editor"
                  >
                    <span>Write</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add New Scene Card */}
          {addingScene ? (
            <form className="index-card new-scene-form-card" onSubmit={handleAddNewSceneSubmit}>
              <div className="index-card-header">
                <h3 className="index-card-title">New Chapter / Scene</h3>
              </div>
              <div className="index-card-body" style={{ flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
                <input
                  type="text"
                  autoFocus
                  className="new-scene-title-input"
                  placeholder="Chapter title (optional)..."
                  value={newSceneTitle}
                  onChange={(e) => setNewSceneTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setAddingScene(false);
                      setNewSceneTitle('');
                    }
                  }}
                />
              </div>
              <div className="index-card-footer" style={{ justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="open-scene-card-btn"
                  onClick={() => {
                    setAddingScene(false);
                    setNewSceneTitle('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="open-scene-card-btn"
                  style={{ background: '#3b82f6', color: '#fff', borderColor: '#3b82f6' }}
                >
                  Create
                </button>
              </div>
            </form>
          ) : (
            <button className="index-card add-card-btn" onClick={() => setAddingScene(true)}>
              <Plus size={24} className="add-card-icon" />
              <span>Add New Scene</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

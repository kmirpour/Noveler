import { useEditorStore } from '../../stores/editorStore';
import {
  User,
  Plus,
  ArrowRight,
  Target,
  X,
  LayoutGrid,
} from 'lucide-react';
import {
  type BinderItem,
  type SceneStatus,
  flattenScenes,
  saveNovelProject,
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
  } = useEditorStore();

  if (!corkboardOpen) return null;

  const scenes = novelProject ? flattenScenes(novelProject.binder) : [];

  const handleOpenScene = async (path: string) => {
    await loadSceneByPath(path);
    setCorkboardOpen(false);
  };

  const handleUpdateSynopsis = (scene: BinderItem, synopsis: string) => {
    if (!novelProject || !projectPath) return;
    scene.synopsis = synopsis;
    useEditorStore.setState({ novelProject: { ...novelProject } });
    void saveNovelProject(projectPath, novelProject);
  };

  const handleUpdateStatus = (scene: BinderItem, status: SceneStatus) => {
    if (!novelProject || !projectPath) return;
    scene.status = status;
    useEditorStore.setState({ novelProject: { ...novelProject } });
    void saveNovelProject(projectPath, novelProject);
  };

  const handleUpdatePov = (scene: BinderItem, pov: string) => {
    if (!novelProject || !projectPath) return;
    scene.pov = pov;
    useEditorStore.setState({ novelProject: { ...novelProject } });
    void saveNovelProject(projectPath, novelProject);
  };

  const handleAddNewScene = async () => {
    if (!projectPath) return;
    const title = prompt('New Scene Title:');
    if (title?.trim()) {
      await createSceneAction(projectPath, title.trim());
    }
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
                className={`index-card ${isActive ? 'active-card' : ''}`}
              >
                {/* Pin / Header bar */}
                <div className="index-card-header">
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
          <button className="index-card add-card-btn" onClick={handleAddNewScene}>
            <Plus size={24} className="add-card-icon" />
            <span>Add New Scene</span>
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, type DragEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '../../stores/editorStore';
import { User, Plus, ArrowRight, X, LayoutGrid, GripVertical, FilePlus } from 'lucide-react';
import { type BinderItem, type SceneStatus } from '../../services/projectService';
import { sceneMetaAt } from '../../utils/sceneMetadata';
import { formatWordsCompact } from '../../utils/fileGroups';
import './Corkboard.css';

const STATUSES: SceneStatus[] = ['idea', 'draft', 'revised', 'final'];

/**
 * The novel as index cards: one card per scene (each `##` heading), grouped under its chapter.
 * Cards carry the scene's synopsis, status and POV; these notes are kept in noveler.json and are
 * never written into the chapter files.
 */
export function Corkboard() {
  const {
    corkboardOpen,
    setCorkboardOpen,
    novelProject,
    activeScenePath,
    activeSceneIndex,
    activeWordCount,
    jumpToSceneAction,
    loadSceneByPath,
    createChapterAction,
    addSceneToChapterAction,
    updateSceneNotesAction,
    reorderChapterScenesAction,
  } = useEditorStore(
    useShallow((s) => ({
      corkboardOpen: s.corkboardOpen,
      setCorkboardOpen: s.setCorkboardOpen,
      novelProject: s.novelProject,
      activeScenePath: s.activeScenePath,
      activeSceneIndex: s.activeSceneIndex,
      activeWordCount: s.wordCount,
      jumpToSceneAction: s.jumpToSceneAction,
      loadSceneByPath: s.loadSceneByPath,
      createChapterAction: s.createChapterAction,
      addSceneToChapterAction: s.addSceneToChapterAction,
      updateSceneNotesAction: s.updateSceneNotesAction,
      reorderChapterScenesAction: s.reorderChapterScenesAction,
    }))
  );

  const [dragged, setDragged] = useState<{ chapter: string; index: number } | null>(null);
  const [dragOver, setDragOver] = useState<{ chapter: string; index: number } | null>(null);

  if (!corkboardOpen) return null;

  const chapters = novelProject?.binder || [];
  const totalScenes = chapters.reduce((n, c) => n + (c.scenes?.length || 0), 0);

  const openScene = async (chapter: BinderItem, sceneIndex: number) => {
    setCorkboardOpen(false);
    await jumpToSceneAction(chapter.path, sceneIndex);
  };

  const openChapter = async (chapter: BinderItem) => {
    setCorkboardOpen(false);
    await loadSceneByPath(chapter.path);
  };

  const addScene = async (chapter: BinderItem) => {
    setCorkboardOpen(false);
    await addSceneToChapterAction(chapter.path);
  };

  const addChapter = async () => {
    setCorkboardOpen(false);
    await createChapterAction();
  };

  const handleDragStart = (e: DragEvent, chapter: string, index: number) => {
    setDragged({ chapter, index });
    e.dataTransfer.effectAllowed = 'move';
  };

  // Scenes are reordered within their own chapter.
  const handleDragOver = (e: DragEvent, chapter: string, index: number) => {
    if (!dragged || dragged.chapter !== chapter) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!dragOver || dragOver.chapter !== chapter || dragOver.index !== index) {
      setDragOver({ chapter, index });
    }
  };

  const handleDrop = (e: DragEvent, chapter: string, index: number) => {
    e.preventDefault();
    if (dragged && dragged.chapter === chapter && dragged.index !== index) {
      void reorderChapterScenesAction(chapter, dragged.index, index);
    }
    setDragged(null);
    setDragOver(null);
  };

  const handleDragEnd = () => {
    setDragged(null);
    setDragOver(null);
  };

  return (
    <div className="corkboard-overlay">
      <div className="corkboard-header">
        <div className="corkboard-header-title">
          <LayoutGrid size={18} className="corkboard-header-icon" />
          <h2>Corkboard</h2>
          <span className="corkboard-count">
            {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'} · {totalScenes}{' '}
            {totalScenes === 1 ? 'scene' : 'scenes'}
          </span>
        </div>
        <button
          className="corkboard-close-btn"
          onClick={() => setCorkboardOpen(false)}
          title="Return to the editor (Esc)"
        >
          <X size={18} />
          <span>Back to Editor</span>
        </button>
      </div>

      <div className="corkboard-canvas">
        <div className="corkboard-chapters">
          {chapters.map((chapter, chapterIdx) => {
            const sceneTitles = chapter.scenes || [];
            const isActiveChapter = activeScenePath === chapter.path;
            const chapterWords = isActiveChapter ? activeWordCount : chapter.wordCount || 0;

            return (
              <section key={chapter.id || chapter.path} className="corkboard-chapter">
                <header className="corkboard-chapter-header">
                  <span className="corkboard-chapter-number">{chapterIdx + 1}</span>
                  <h3 className="corkboard-chapter-title" title={chapter.title}>
                    {chapter.title}
                  </h3>
                  <span className="corkboard-chapter-stats">
                    {sceneTitles.length} {sceneTitles.length === 1 ? 'scene' : 'scenes'} ·{' '}
                    {chapterWords.toLocaleString()} words
                  </span>
                  <button
                    className="open-scene-card-btn"
                    onClick={() => void openChapter(chapter)}
                    title="Open this chapter in the editor"
                  >
                    <span>Open</span>
                    <ArrowRight size={13} />
                  </button>
                </header>

                <div className="corkboard-grid">
                  {sceneTitles.map((sceneTitle, sceneIdx) => {
                    const meta = sceneMetaAt(novelProject, chapter.path, sceneIdx);
                    const words = chapter.sceneWords?.[sceneIdx] ?? 0;
                    const isActive = isActiveChapter && activeSceneIndex === sceneIdx;
                    const isDragOver =
                      dragOver?.chapter === chapter.path &&
                      dragOver.index === sceneIdx &&
                      dragged?.index !== sceneIdx;
                    const status = meta.status || '';

                    return (
                      <div
                        key={`${chapter.path}-${sceneIdx}-${sceneTitle}`}
                        className={`index-card ${isActive ? 'active-card' : ''} ${isDragOver ? 'drag-over-card' : ''}`}
                        draggable={sceneTitles.length > 1}
                        onDragStart={(e) => handleDragStart(e, chapter.path, sceneIdx)}
                        onDragOver={(e) => handleDragOver(e, chapter.path, sceneIdx)}
                        onDrop={(e) => handleDrop(e, chapter.path, sceneIdx)}
                        onDragEnd={handleDragEnd}
                      >
                        <div className="index-card-header">
                          {sceneTitles.length > 1 && (
                            <span title="Drag to reorder within this chapter" style={{ display: 'inline-flex' }}>
                              <GripVertical size={13} className="card-drag-handle" />
                            </span>
                          )}
                          <div className="index-card-number">{sceneIdx + 1}</div>
                          <h3 className="index-card-title" title={sceneTitle}>
                            {sceneTitle}
                          </h3>
                          <select
                            className={`status-selector status-${status || 'none'}`}
                            value={status}
                            onChange={(e) =>
                              updateSceneNotesAction(chapter.path, sceneIdx, {
                                status: (e.target.value || undefined) as SceneStatus | undefined,
                              })
                            }
                            aria-label={`Status of scene ${sceneTitle}`}
                          >
                            <option value="">No status</option>
                            {STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st.charAt(0).toUpperCase() + st.slice(1)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="index-card-body">
                          <textarea
                            key={`synopsis-${meta.synopsis || ''}`}
                            className="index-card-synopsis"
                            placeholder="What happens in this scene? Beats, conflict, what changes…"
                            defaultValue={meta.synopsis || ''}
                            onBlur={(e) => {
                              if (e.target.value !== (meta.synopsis || '')) {
                                updateSceneNotesAction(chapter.path, sceneIdx, { synopsis: e.target.value });
                              }
                            }}
                          />
                        </div>

                        <div className="index-card-footer">
                          <div className="card-meta-row">
                            <div className="card-pov-input-wrapper" title="Point-of-view character">
                              <User size={12} className="card-meta-icon" />
                              <input
                                key={`pov-${meta.pov || ''}`}
                                type="text"
                                className="card-pov-input"
                                placeholder="POV"
                                defaultValue={meta.pov || ''}
                                onBlur={(e) => {
                                  if (e.target.value !== (meta.pov || '')) {
                                    updateSceneNotesAction(chapter.path, sceneIdx, { pov: e.target.value });
                                  }
                                }}
                              />
                            </div>
                            <span className="card-target-words" title={`${words.toLocaleString()} words`}>
                              {formatWordsCompact(words)}
                              {meta.targetWords ? ` / ${formatWordsCompact(meta.targetWords)}` : ''} w
                            </span>
                          </div>

                          <button
                            className="open-scene-card-btn"
                            onClick={() => void openScene(chapter, sceneIdx)}
                            title="Go to this scene in the editor"
                          >
                            <span>Write</span>
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    className="index-card add-card-btn"
                    onClick={() => void addScene(chapter)}
                    title="Adds a new ## scene heading at the end of this chapter"
                  >
                    <Plus size={22} className="add-card-icon" />
                    <span>{sceneTitles.length === 0 ? 'Add the first scene' : 'Add scene'}</span>
                  </button>
                </div>
              </section>
            );
          })}

          {novelProject ? (
            <button className="corkboard-add-chapter-btn" onClick={() => void addChapter()}>
              <FilePlus size={15} />
              <span>Add chapter</span>
            </button>
          ) : (
            <p className="corkboard-empty">Open a novel folder to see its chapters and scenes as cards.</p>
          )}
        </div>
      </div>
    </div>
  );
}

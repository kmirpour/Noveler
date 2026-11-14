import {
  useState,
  useMemo,
  useRef,
  type MouseEvent,
  type FormEvent,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '../../stores/editorStore';
import {
  FolderOpen,
  FileText,
  FilePlus,
  X,
  RefreshCw,
  MoreVertical,
  LayoutGrid,
  SlidersHorizontal,
  Trash2,
  Edit2,
  BookText,
  Users,
  GripVertical,
  ChevronDown,
  ChevronRight,
  StickyNote,
  Plus,
  ListTree,
  FileOutput,
  FileInput,
  BookOpenText,
} from 'lucide-react';
import { sceneKeys } from '../../utils/sceneMetadata';
import { groupFilesByPrefix, formatWordsCompact, UNGROUPED_KEY } from '../../utils/fileGroups';
import { extractFileName } from '../../services/fileService';
import { confirmDialog } from '../../services/dialogs';
import type { BinderItem, SceneStatus } from '../../services/projectService';
import { getChapterScenes, type ChapterSceneItem } from '../../utils/chapterScenes';
import { CastTab } from './CastTab';
import './Sidebar.css';

interface ChapterItemProps {
  item: BinderItem;
  index?: number;
  isExtraFile?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: DragEvent, index: number) => void;
  onDragOver?: (e: DragEvent, index: number) => void;
  onDrop?: (e: DragEvent, index: number) => void;
  onDragEnd?: () => void;
}

function ChapterItem({
  item,
  index = 0,
  isExtraFile = false,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: ChapterItemProps) {
  const {
    activeScenePath,
    activeSceneIndex,
    markdownContent,
    loadSceneByPath,
    renameBinderItemAction,
    deleteBinderItemAction,
    jumpToSceneAction,
    renameChapterSceneAction,
    addSceneToChapterAction,
    insertSceneAfterAction,
    reorderChapterScenesAction,
    deleteSceneFromChapterAction,
    extractSceneToFileAction,
    insertFileAsSceneAction,
    openReferenceAction,
    activeWordCount,
    sceneNotes,
    chapters,
  } = useEditorStore(
    useShallow((s) => ({
      extractSceneToFileAction: s.extractSceneToFileAction,
      insertFileAsSceneAction: s.insertFileAsSceneAction,
      openReferenceAction: s.openReferenceAction,
      activeWordCount: s.wordCount,
      sceneNotes: s.novelProject?.sceneMetadata?.[extractFileName(item.path)],
      chapters: s.novelProject?.binder,
      activeScenePath: s.activeScenePath,
      activeSceneIndex: s.activeSceneIndex,
      markdownContent: s.markdownContent,
      loadSceneByPath: s.loadSceneByPath,
      renameBinderItemAction: s.renameBinderItemAction,
      deleteBinderItemAction: s.deleteBinderItemAction,
      jumpToSceneAction: s.jumpToSceneAction,
      renameChapterSceneAction: s.renameChapterSceneAction,
      addSceneToChapterAction: s.addSceneToChapterAction,
      insertSceneAfterAction: s.insertSceneAfterAction,
      reorderChapterScenesAction: s.reorderChapterScenesAction,
      deleteSceneFromChapterAction: s.deleteSceneFromChapterAction,
    }))
  );

  const isActive = activeScenePath === item.path;

  const [showMenu, setShowMenu] = useState(false);
  const [showInsertTargets, setShowInsertTargets] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(item.title);

  // Scene Outline state for this chapter
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const isExpanded = !isExtraFile && (manualExpanded !== null ? manualExpanded : isActive);

  const [renamingSceneIdx, setRenamingSceneIdx] = useState<number | null>(null);
  const [renameSceneValue, setRenameSceneValue] = useState('');
  const [draggedSceneIdx, setDraggedSceneIdx] = useState<number | null>(null);
  const [dragOverSceneIdx, setDragOverSceneIdx] = useState<number | null>(null);
  const suppressSceneClickRef = useRef(false);

  // Compute scenes for this chapter from ## headers
  const chapterScenes: ChapterSceneItem[] = useMemo(() => {
    if (isExtraFile) return [];
    if (isActive) {
      return getChapterScenes(markdownContent);
    }
    const parsedList = item.scenes || [];
    return parsedList.map((title, idx) => ({
      index: idx,
      title: title || `Scene ${idx + 1}`,
      customTitle: title,
      wordCount: item.sceneWords?.[idx] ?? 0,
      previewText: '',
    }));
  }, [isExtraFile, isActive, markdownContent, item.scenes, item.sceneWords]);

  const chapterWords = isActive ? activeWordCount : item.wordCount || 0;
  const sceneNoteKeys = useMemo(() => sceneKeys(chapterScenes.map((s) => s.title)), [chapterScenes]);

  const handleClick = () => {
    void loadSceneByPath(item.path);
  };

  const handleToggleExpand = (e: MouseEvent) => {
    e.stopPropagation();
    setManualExpanded(!isExpanded);
  };

  const handleRenameSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (renameValue.trim() && renameValue !== item.title) {
      await renameBinderItemAction(item.path, renameValue.trim());
    }
    setIsRenaming(false);
  };

  const handleDelete = async (e: MouseEvent) => {
    e.stopPropagation();
    if (
      await confirmDialog({
        title: `Move "${item.title}" to the graveyard?`,
        message: 'The file is kept in the graveyard folder and can be moved back by hand.',
        confirmLabel: 'Move to graveyard',
        danger: true,
      })
    ) {
      await deleteBinderItemAction(item.path);
    }
  };

  const handleSceneClick = (e: MouseEvent, sceneIdx: number) => {
    e.stopPropagation();
    if (suppressSceneClickRef.current) {
      suppressSceneClickRef.current = false;
      return;
    }
    if (renamingSceneIdx === sceneIdx) return;
    void jumpToSceneAction(item.path, sceneIdx);
  };

  const startRenamingScene = (e: MouseEvent, scene: ChapterSceneItem) => {
    e.stopPropagation();
    setRenamingSceneIdx(scene.index);
    setRenameSceneValue(scene.customTitle || scene.title);
  };

  const commitSceneRename = (sceneIdx: number) => {
    renameChapterSceneAction(item.path, sceneIdx, renameSceneValue.trim());
    setRenamingSceneIdx(null);
  };

  const handleSceneRenameSubmit = (e: FormEvent, sceneIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    commitSceneRename(sceneIdx);
  };

  const handleAddScene = async (e: MouseEvent) => {
    e.stopPropagation();
    setManualExpanded(true);
    const newIdx = await addSceneToChapterAction(item.path);
    if (newIdx >= 0) {
      setRenamingSceneIdx(newIdx);
      setRenameSceneValue(`Scene ${newIdx + 1}`);
    }
  };

  const handleInsertSceneAfter = async (e: MouseEvent, afterIdx: number) => {
    e.stopPropagation();
    setManualExpanded(true);
    const newIdx = await insertSceneAfterAction(item.path, afterIdx);
    if (newIdx >= 0) {
      setRenamingSceneIdx(newIdx);
      setRenameSceneValue(`Scene ${newIdx + 1}`);
    }
  };

  const handleExtractScene = async (e: MouseEvent, scene: ChapterSceneItem) => {
    e.stopPropagation();
    if (
      await confirmDialog({
        title: `Move scene "${scene.title}" to its own file?`,
        message: 'It leaves this chapter and appears under Other Files, where it can be placed elsewhere later.',
        confirmLabel: 'Move to file',
      })
    ) {
      await extractSceneToFileAction(item.path, scene.index);
    }
  };

  const handleDeleteScene = async (e: MouseEvent, scene: ChapterSceneItem) => {
    e.stopPropagation();
    if (
      await confirmDialog({
        title: `Remove scene "${scene.title}"?`,
        message: 'Its text is saved to the graveyard folder first. Ctrl+Z also brings it back.',
        confirmLabel: 'Remove scene',
        danger: true,
      })
    ) {
      await deleteSceneFromChapterAction(item.path, scene.index);
    }
  };

  const handleScenePointerDown = (e: ReactPointerEvent<HTMLDivElement>, sceneIdx: number) => {
    if (e.button !== 0 || renamingSceneIdx !== null || chapterScenes.length <= 1) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, form')) return;

    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    let isDragging = false;
    let currentOverIdx = sceneIdx;

    const handleWindowPointerMove = (moveEvent: PointerEvent) => {
      const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (!isDragging) {
        if (dist < 4) return;
        isDragging = true;
        suppressSceneClickRef.current = true;
        setDraggedSceneIdx(sceneIdx);
        setDragOverSceneIdx(sceneIdx);
      }

      moveEvent.preventDefault();
      const el = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      const sceneEl = el?.closest('[data-scene-index]') as HTMLElement | null;
      if (sceneEl && sceneEl.getAttribute('data-chapter-path') === item.path) {
        const overIdx = Number(sceneEl.getAttribute('data-scene-index'));
        if (!Number.isNaN(overIdx) && overIdx !== currentOverIdx) {
          currentOverIdx = overIdx;
          setDragOverSceneIdx(overIdx);
        }
      }
    };

    const handleWindowPointerUp = () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);

      if (isDragging) {
        setDraggedSceneIdx(null);
        setDragOverSceneIdx(null);
        if (currentOverIdx !== sceneIdx) {
          void reorderChapterScenesAction(item.path, sceneIdx, currentOverIdx);
        }
        setTimeout(() => {
          suppressSceneClickRef.current = false;
        }, 0);
      }
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);
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
    <div className="binder-item-wrapper">
      <div
        className={`binder-item is-scene ${isExtraFile ? 'is-extra-file' : ''} ${isActive ? 'active' : ''} ${isDragOver ? 'drag-over' : ''}`}
        draggable={!isExtraFile && !isRenaming && renamingSceneIdx === null && draggedSceneIdx === null}
        onDragStart={!isExtraFile && onDragStart ? (e) => onDragStart(e, index) : undefined}
        onDragOver={!isExtraFile && onDragOver ? (e) => onDragOver(e, index) : undefined}
        onDrop={!isExtraFile && onDrop ? (e) => onDrop(e, index) : undefined}
        onDragEnd={!isExtraFile ? onDragEnd : undefined}
        onClick={handleClick}
      >
        {!isExtraFile ? (
          <>
            <GripVertical size={12} className="binder-drag-handle" />
            <button
              type="button"
              className="binder-chevron-btn"
              onClick={handleToggleExpand}
              title={isExpanded ? 'Collapse chapter outline' : 'Expand chapter outline'}
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            <span
              className="scene-status-dot"
              style={{ backgroundColor: getStatusColor(item.status) }}
              title={`Status: ${item.status || 'draft'}`}
            />
            <FileText size={14} className="binder-icon scene-icon" />
          </>
        ) : (
          <StickyNote size={14} className="binder-icon extra-file-icon" />
        )}

        {isRenaming ? (
          <form className="rename-form" onSubmit={handleRenameSubmit} onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              autoFocus
              className="rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => setIsRenaming(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsRenaming(false);
              }}
            />
          </form>
        ) : (
          <span className="binder-item-title" title={item.title}>
            {item.title}
          </span>
        )}

        {!isExtraFile && !isRenaming && (
          <span
            className="chapter-scene-count-badge"
            title={`${chapterScenes.length} ${chapterScenes.length === 1 ? 'scene' : 'scenes'} · ${chapterWords.toLocaleString()} words`}
          >
            {formatWordsCompact(chapterWords)}
          </span>
        )}

        <div className="binder-hover-actions" onClick={(e) => e.stopPropagation()}>
          {!isExtraFile && (
            <button
              type="button"
              className="binder-action-mini-btn"
              onClick={(e) => void handleAddScene(e)}
              title="Add scene to chapter"
            >
              <Plus size={12} />
            </button>
          )}
          <div className="binder-menu-container">
            <button
              type="button"
              className="binder-action-mini-btn"
              onClick={() => setShowMenu(!showMenu)}
              title="More options"
            >
              <MoreVertical size={12} />
            </button>

            {showMenu && (
              <div
                className="binder-dropdown-menu"
                onMouseLeave={() => {
                  setShowMenu(false);
                  setShowInsertTargets(false);
                }}
              >
                <button
                  type="button"
                  className="binder-menu-option"
                  onClick={() => {
                    setShowMenu(false);
                    openReferenceAction(item.path);
                  }}
                >
                  <BookOpenText size={12} />
                  Open Beside Editor
                </button>
                {isExtraFile && (chapters?.length ?? 0) > 0 && (
                  <>
                    <button
                      type="button"
                      className="binder-menu-option"
                      onClick={() => setShowInsertTargets((v) => !v)}
                      title="Add this note's text to a chapter as a new scene. The note is kept in the graveyard folder."
                    >
                      <FileInput size={12} />
                      Insert as Scene in…
                    </button>
                    {showInsertTargets &&
                      chapters!.map((ch) => (
                        <button
                          key={ch.path}
                          type="button"
                          className="binder-menu-option binder-menu-suboption"
                          onClick={() => {
                            setShowMenu(false);
                            setShowInsertTargets(false);
                            void insertFileAsSceneAction(item.path, ch.path);
                          }}
                        >
                          {ch.title}
                        </button>
                      ))}
                  </>
                )}
                {!isExtraFile && (
                  <button
                    type="button"
                    className="binder-menu-option"
                    onClick={(e) => {
                      setShowMenu(false);
                      void handleAddScene(e);
                    }}
                  >
                    <Plus size={12} />
                    Add Scene
                  </button>
                )}
                <button
                  type="button"
                  className="binder-menu-option"
                  onClick={() => {
                    setShowMenu(false);
                    setIsRenaming(true);
                  }}
                >
                  <Edit2 size={12} />
                  Rename
                </button>
                <button
                  type="button"
                  className="binder-menu-option danger"
                  onClick={(e) => {
                    setShowMenu(false);
                    void handleDelete(e);
                  }}
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expandable Chapter Scene Outline */}
      {isExpanded && !isExtraFile && (
        <div className="chapter-scenes-outline" role="list" aria-label={`Outline for ${item.title}`}>
          {chapterScenes.map((scene) => {
            const isSceneActive = isActive && activeSceneIndex === scene.index;
            const isSceneRenaming = renamingSceneIdx === scene.index;
            const isBeingDragged = draggedSceneIdx === scene.index;
            const isSceneDragOver =
              dragOverSceneIdx === scene.index && draggedSceneIdx !== null && draggedSceneIdx !== scene.index;
            const dragDirectionClass = isSceneDragOver
              ? draggedSceneIdx !== null && scene.index > draggedSceneIdx
                ? 'drag-over-below'
                : 'drag-over-above'
              : '';

            return (
              <div
                key={`${item.path}-scene-${scene.index}`}
                role="listitem"
                data-scene-index={scene.index}
                data-chapter-path={item.path}
                className={`chapter-scene-item ${isSceneActive ? 'active-scene' : ''} ${isBeingDragged ? 'is-dragging-scene' : ''} ${isSceneDragOver ? `drag-over-scene ${dragDirectionClass}` : ''}`}
                onPointerDown={(e) => handleScenePointerDown(e, scene.index)}
                onClick={(e) => handleSceneClick(e, scene.index)}
                onDoubleClick={(e) => startRenamingScene(e, scene)}
                title={
                  scene.previewText
                    ? `${scene.title} — "${scene.previewText}" (Drag to reorder, double-click to rename)`
                    : `${scene.title} (Click to jump, drag to reorder, double-click to rename)`
                }
              >
                <GripVertical size={11} className="scene-drag-handle" />
                <span className="scene-outline-number">{scene.index + 1}</span>

                {isSceneRenaming ? (
                  <form
                    className="rename-form scene-rename-form"
                    onSubmit={(e) => handleSceneRenameSubmit(e, scene.index)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      autoFocus
                      className="rename-input scene-rename-input"
                      placeholder={`Scene ${scene.index + 1}`}
                      value={renameSceneValue}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => setRenameSceneValue(e.target.value)}
                      onBlur={() => commitSceneRename(scene.index)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.stopPropagation();
                          setRenamingSceneIdx(null);
                        }
                      }}
                    />
                  </form>
                ) : (
                  <span className="scene-outline-title">{scene.title}</span>
                )}

                {!isSceneRenaming && (
                  <span className="scene-outline-meta">
                    {sceneNotes?.[sceneNoteKeys[scene.index]]?.status && (
                      <span
                        className="scene-status-dot"
                        style={{
                          backgroundColor: getStatusColor(sceneNotes[sceneNoteKeys[scene.index]].status),
                        }}
                        title={`Status: ${sceneNotes[sceneNoteKeys[scene.index]].status}`}
                      />
                    )}
                    <span className="scene-outline-words" title={`${scene.wordCount.toLocaleString()} words`}>
                      {formatWordsCompact(scene.wordCount)}
                    </span>
                  </span>
                )}

                {!isSceneRenaming && (
                  <div className="scene-hover-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="binder-action-mini-btn"
                      onClick={(e) => void handleInsertSceneAfter(e, scene.index)}
                      title="Insert scene below"
                    >
                      <Plus size={11} />
                    </button>
                    <button
                      type="button"
                      className="binder-action-mini-btn"
                      onClick={(e) => startRenamingScene(e, scene)}
                      title="Rename scene title"
                    >
                      <Edit2 size={11} />
                    </button>
                    <button
                      type="button"
                      className="binder-action-mini-btn"
                      onClick={(e) => void handleExtractScene(e, scene)}
                      title="Move scene out to its own file (Other Files)"
                    >
                      <FileOutput size={11} />
                    </button>
                    <button
                      type="button"
                      className="binder-action-mini-btn scene-delete-btn"
                      onClick={(e) => void handleDeleteScene(e, scene)}
                      title="Delete scene"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            className="add-scene-outline-btn"
            onClick={(e) => void handleAddScene(e)}
            title="Add a new scene to this chapter (inserts a scene break)"
          >
            <Plus size={11} />
            <span>Add Scene</span>
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Standalone Chapter Scene Outline shown when editing a single document without a project folder open.
 */
function StandaloneChapterOutline() {
  const {
    fileName,
    filePath,
    markdownContent,
    activeSceneIndex,
    jumpToSceneAction,
    renameChapterSceneAction,
    addSceneToChapterAction,
    insertSceneAfterAction,
    reorderChapterScenesAction,
    deleteSceneFromChapterAction,
  } = useEditorStore(
    useShallow((s) => ({
      fileName: s.fileName,
      filePath: s.filePath,
      markdownContent: s.markdownContent,
      activeSceneIndex: s.activeSceneIndex,
      jumpToSceneAction: s.jumpToSceneAction,
      renameChapterSceneAction: s.renameChapterSceneAction,
      addSceneToChapterAction: s.addSceneToChapterAction,
      insertSceneAfterAction: s.insertSceneAfterAction,
      reorderChapterScenesAction: s.reorderChapterScenesAction,
      deleteSceneFromChapterAction: s.deleteSceneFromChapterAction,
    }))
  );

  const [renamingIdx, setRenamingIdx] = useState<number | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const suppressClickRef = useRef(false);

  const scenes = useMemo(() => getChapterScenes(markdownContent), [markdownContent]);

  const targetPath = filePath || '';
  const chapterKey = targetPath || '__standalone__';

  const startRename = (e: MouseEvent, scene: ChapterSceneItem) => {
    e.stopPropagation();
    setRenamingIdx(scene.index);
    setRenameVal(scene.customTitle || scene.title);
  };

  const commitRename = (idx: number) => {
    renameChapterSceneAction(targetPath, idx, renameVal.trim());
    setRenamingIdx(null);
  };

  const handleAddScene = async () => {
    const newIdx = await addSceneToChapterAction(targetPath);
    if (newIdx >= 0) {
      setRenamingIdx(newIdx);
      setRenameVal(`Scene ${newIdx + 1}`);
    }
  };

  const handleInsertAfter = async (e: MouseEvent, afterIdx: number) => {
    e.stopPropagation();
    const newIdx = await insertSceneAfterAction(targetPath, afterIdx);
    if (newIdx >= 0) {
      setRenamingIdx(newIdx);
      setRenameVal(`Scene ${newIdx + 1}`);
    }
  };

  const handleScenePointerDown = (e: ReactPointerEvent<HTMLDivElement>, sceneIdx: number) => {
    if (e.button !== 0 || renamingIdx !== null || scenes.length <= 1) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, form')) return;

    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    let isDragging = false;
    let currentOverIdx = sceneIdx;

    const handleWindowPointerMove = (moveEvent: PointerEvent) => {
      const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (!isDragging) {
        if (dist < 4) return;
        isDragging = true;
        suppressClickRef.current = true;
        setDraggedIdx(sceneIdx);
        setDragOverIdx(sceneIdx);
      }

      moveEvent.preventDefault();
      const el = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      const sceneEl = el?.closest('[data-scene-index]') as HTMLElement | null;
      if (sceneEl && sceneEl.getAttribute('data-chapter-path') === chapterKey) {
        const overIdx = Number(sceneEl.getAttribute('data-scene-index'));
        if (!Number.isNaN(overIdx) && overIdx !== currentOverIdx) {
          currentOverIdx = overIdx;
          setDragOverIdx(overIdx);
        }
      }
    };

    const handleWindowPointerUp = () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);

      if (isDragging) {
        setDraggedIdx(null);
        setDragOverIdx(null);
        if (currentOverIdx !== sceneIdx) {
          void reorderChapterScenesAction(targetPath, sceneIdx, currentOverIdx);
        }
        setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);
  };

  return (
    <div className="standalone-outline-section">
      <div className="sidebar-section-header">
        <span className="sidebar-section-label">
          <ListTree size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          {fileName ? fileName.replace(/\.(md|markdown|txt)$/i, '') : 'Chapter'} Outline ({scenes.length})
        </span>
      </div>
      <div className="chapter-scenes-outline standalone">
        {scenes.map((scene) => {
          const isSceneActive = activeSceneIndex === scene.index;
          const isSceneRenaming = renamingIdx === scene.index;
          const isBeingDragged = draggedIdx === scene.index;
          const isSceneDragOver =
            dragOverIdx === scene.index && draggedIdx !== null && draggedIdx !== scene.index;
          const dragDirectionClass = isSceneDragOver
            ? draggedIdx !== null && scene.index > draggedIdx
              ? 'drag-over-below'
              : 'drag-over-above'
            : '';

          return (
            <div
              key={`standalone-scene-${scene.index}`}
              data-scene-index={scene.index}
              data-chapter-path={chapterKey}
              className={`chapter-scene-item ${isSceneActive ? 'active-scene' : ''} ${isBeingDragged ? 'is-dragging-scene' : ''} ${isSceneDragOver ? `drag-over-scene ${dragDirectionClass}` : ''}`}
              onPointerDown={(e) => handleScenePointerDown(e, scene.index)}
              onClick={() => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                void jumpToSceneAction(targetPath, scene.index);
              }}
              onDoubleClick={(e) => startRename(e, scene)}
            >
              <GripVertical size={11} className="scene-drag-handle" />
              <span className="scene-outline-number">{scene.index + 1}</span>
              {isSceneRenaming ? (
                <form
                  className="rename-form scene-rename-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    commitRename(scene.index);
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="text"
                    autoFocus
                    className="rename-input scene-rename-input"
                    value={renameVal}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onBlur={() => commitRename(scene.index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setRenamingIdx(null);
                    }}
                  />
                </form>
              ) : (
                <span className="scene-outline-title">{scene.title}</span>
              )}
              {!isSceneRenaming && (
                <div className="scene-hover-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="binder-action-mini-btn"
                    onClick={(e) => void handleInsertAfter(e, scene.index)}
                    title="Insert scene below"
                  >
                    <Plus size={11} />
                  </button>
                  <button
                    type="button"
                    className="binder-action-mini-btn"
                    onClick={(e) => startRename(e, scene)}
                    title="Rename scene title"
                  >
                    <Edit2 size={11} />
                  </button>
                  <button
                    type="button"
                    className="binder-action-mini-btn scene-delete-btn"
                    onClick={async () => {
                      if (
                        await confirmDialog({
                          title: `Remove scene "${scene.title}"?`,
                          message: 'Ctrl+Z brings it back.',
                          confirmLabel: 'Remove scene',
                          danger: true,
                        })
                      ) {
                        void deleteSceneFromChapterAction(targetPath, scene.index);
                      }
                    }}
                    title="Delete scene"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <button
          type="button"
          className="add-scene-outline-btn"
          onClick={() => void handleAddScene()}
          title="Add a new scene to this chapter"
        >
          <Plus size={11} />
          <span>Add Scene</span>
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const {
    sidebarOpen,
    toggleSidebar,
    projectName,
    projectPath,
    novelProject,
    openProjectFolderAction,
    createChapterAction,
    createExtraFileAction,
    refreshProjectFiles,
    reorderBinderItemsAction,
    toggleCorkboard,
    corkboardOpen,
    toggleInspector,
    inspectorOpen,
  } = useEditorStore(
    useShallow((s) => ({
      sidebarOpen: s.sidebarOpen,
      toggleSidebar: s.toggleSidebar,
      projectName: s.projectName,
      projectPath: s.projectPath,
      novelProject: s.novelProject,
      openProjectFolderAction: s.openProjectFolderAction,
      createChapterAction: s.createChapterAction,
      createExtraFileAction: s.createExtraFileAction,
      refreshProjectFiles: s.refreshProjectFiles,
      reorderBinderItemsAction: s.reorderBinderItemsAction,
      toggleCorkboard: s.toggleCorkboard,
      corkboardOpen: s.corkboardOpen,
      toggleInspector: s.toggleInspector,
      inspectorOpen: s.inspectorOpen,
    }))
  );

  const [activeTab, setActiveTab] = useState<'chapters' | 'tags'>('chapters');
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [otherFilesExpanded, setOtherFilesExpanded] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [isCreatingExtra, setIsCreatingExtra] = useState(false);
  const [newExtraTitle, setNewExtraTitle] = useState('');

  if (!sidebarOpen) {
    return null;
  }

  const binderItems = novelProject?.binder || [];
  const extraFiles = novelProject?.extraFiles || [];
  const extraGroups = groupFilesByPrefix(extraFiles, (f) => extractFileName(f.path));
  const showGroupHeaders = extraGroups.some((g) => g.key !== UNGROUPED_KEY);
  const toggleGroup = (key: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

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

  const handleCreateExtraSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const title = newExtraTitle.trim() || 'notes';
    setIsCreatingExtra(false);
    setNewExtraTitle('');
    setOtherFilesExpanded(true);
    await createExtraFileAction(title);
  };

  return (
    <aside className="sidebar">
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="sidebar-title" title={projectName || 'Manuscript'}>
          <BookText size={15} />
          <span>{projectName || 'Manuscript'}</span>
        </div>
        <div className="sidebar-header-actions">
          {projectPath && (
            <button
              type="button"
              className="sidebar-icon-btn"
              onClick={() => void refreshProjectFiles()}
              title="Refresh Files"
            >
              <RefreshCw size={13} />
            </button>
          )}
          <button
            type="button"
            className="sidebar-icon-btn"
            onClick={toggleSidebar}
            title="Close Sidebar"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {projectPath ? (
        <>
          {/* Tab Navigation: Chapters vs Tags */}
          <div className="sidebar-tab-switcher">
            <button
              type="button"
              className={`sidebar-tab-btn ${activeTab === 'chapters' ? 'active' : ''}`}
              onClick={() => setActiveTab('chapters')}
            >
              <BookText size={13} />
              <span>Files ({binderItems.length + extraFiles.length})</span>
            </button>
            <button
              type="button"
              className={`sidebar-tab-btn ${activeTab === 'tags' ? 'active' : ''}`}
              onClick={() => setActiveTab('tags')}
            >
              <Users size={13} />
              <span>Cast</span>
            </button>
          </div>

          {activeTab === 'chapters' ? (
            <>
              {/* Primary Chapter Actions */}
              <div className="sidebar-actions">
                <button
                  type="button"
                  className="sidebar-btn primary-chapter-btn"
                  onClick={() => void createChapterAction()}
                  title="Add Next Chapter sequentially (Ctrl+N)"
                >
                  <FilePlus size={13} />
                  <span>+ Chapter</span>
                </button>
                <button
                  type="button"
                  className={`sidebar-icon-btn ${corkboardOpen ? 'active' : ''}`}
                  onClick={toggleCorkboard}
                  title="Corkboard / Outline View"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  className={`sidebar-icon-btn ${inspectorOpen ? 'active' : ''}`}
                  onClick={toggleInspector}
                  title="Chapter Inspector (Metadata & Synopsis)"
                >
                  <SlidersHorizontal size={15} />
                </button>
              </div>

              {/* Categorized File Lists: Chapters vs Other Files */}
              <div className="sidebar-file-list">
                <div className="sidebar-section-header">
                  <span className="sidebar-section-label">Chapters ({binderItems.length})</span>
                </div>

                {binderItems.length === 0 ? (
                  <div className="sidebar-empty">
                    <p>No chapters found. Click <strong>+ Chapter</strong> above to begin your novel!</p>
                  </div>
                ) : (
                  binderItems.map((item, idx) => (
                    <ChapterItem
                      key={item.id || item.path}
                      item={item}
                      index={idx}
                      isDragOver={dragOverIdx === idx && draggedIdx !== idx}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                    />
                  ))
                )}

                {/* Other Files Section */}
                <div className="sidebar-section-divider" />
                <div className="sidebar-section-header collapsible">
                  <button
                    type="button"
                    className="sidebar-section-toggle"
                    onClick={() => setOtherFilesExpanded((v) => !v)}
                  >
                    {otherFilesExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <span className="sidebar-section-label">Other Files ({extraFiles.length})</span>
                  </button>
                  <button
                    type="button"
                    className="sidebar-section-add-btn"
                    onClick={() => {
                      setOtherFilesExpanded(true);
                      setIsCreatingExtra(true);
                    }}
                    title="Create a non-chapter note or file (e.g. outline.md, notes.md)"
                  >
                    <Plus size={12} />
                    <span>File</span>
                  </button>
                </div>

                {isCreatingExtra && (
                  <form className="extra-file-create-form" onSubmit={handleCreateExtraSubmit}>
                    <input
                      type="text"
                      autoFocus
                      className="rename-input"
                      placeholder="e.g. outline, characters..."
                      value={newExtraTitle}
                      onChange={(e) => setNewExtraTitle(e.target.value)}
                      onBlur={() => setIsCreatingExtra(false)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setIsCreatingExtra(false);
                          setNewExtraTitle('');
                        }
                      }}
                    />
                  </form>
                )}

                {otherFilesExpanded && (
                  <div className="sidebar-extra-files-list">
                    {extraFiles.length === 0 ? (
                      <div className="sidebar-empty-subtle">
                        Non-chapter files (e.g. <code>outline.md</code>, <code>notes.md</code>) appear here.
                      </div>
                    ) : (
                      extraGroups.map((group) => (
                        <div key={group.key} className="extra-file-group">
                          {showGroupHeaders && (
                            <button
                              type="button"
                              className="extra-group-toggle"
                              onClick={() => toggleGroup(group.key)}
                              aria-expanded={!collapsedGroups.has(group.key)}
                            >
                              {collapsedGroups.has(group.key) ? (
                                <ChevronRight size={11} />
                              ) : (
                                <ChevronDown size={11} />
                              )}
                              <span className="extra-group-label">{group.label}</span>
                              <span className="extra-group-count">{group.items.length}</span>
                            </button>
                          )}
                          {!collapsedGroups.has(group.key) &&
                            group.items.map((item) => (
                              <ChapterItem key={item.id || item.path} item={item} isExtraFile />
                            ))}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Narrative Tags Panel */
            <div className="sidebar-tab-content">
              <CastTab />
            </div>
          )}
        </>
      ) : (
        <div className="sidebar-file-list">
          <StandaloneChapterOutline />
          <div className="sidebar-section-divider" />
          <div className="sidebar-empty-project">
            <p>Open a novel folder to see all chapters in your manuscript.</p>
            <button
              type="button"
              className="sidebar-btn primary-action"
              onClick={() => void openProjectFolderAction()}
              title="Open Folder (Ctrl+O)"
            >
              <FolderOpen size={15} />
              <span>Open Folder</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

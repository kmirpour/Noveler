import { useState, type MouseEvent, type FormEvent, type DragEvent } from 'react';
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
  Hash,
  GripVertical,
  ChevronDown,
  ChevronRight,
  StickyNote,
  Plus,
} from 'lucide-react';
import type { BinderItem, SceneStatus } from '../../services/projectService';
import { TagsTab } from './TagsTab';
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
    loadSceneByPath,
    renameBinderItemAction,
    deleteBinderItemAction,
  } = useEditorStore(
    useShallow((s) => ({
      activeScenePath: s.activeScenePath,
      loadSceneByPath: s.loadSceneByPath,
      renameBinderItemAction: s.renameBinderItemAction,
      deleteBinderItemAction: s.deleteBinderItemAction,
    }))
  );

  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(item.title);

  const isActive = activeScenePath === item.path;

  const handleClick = () => {
    void loadSceneByPath(item.path);
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
    if (confirm(`Delete "${item.title}"?`)) {
      await deleteBinderItemAction(item.path);
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
    <div
      className="binder-item-wrapper"
      draggable={!isExtraFile && !isRenaming}
      onDragStart={!isExtraFile && onDragStart ? (e) => onDragStart(e, index) : undefined}
      onDragOver={!isExtraFile && onDragOver ? (e) => onDragOver(e, index) : undefined}
      onDrop={!isExtraFile && onDrop ? (e) => onDrop(e, index) : undefined}
      onDragEnd={!isExtraFile ? onDragEnd : undefined}
    >
      <div
        className={`binder-item is-scene ${isExtraFile ? 'is-extra-file' : ''} ${isActive ? 'active' : ''} ${isDragOver ? 'drag-over' : ''}`}
        onClick={handleClick}
      >
        {!isExtraFile ? (
          <>
            <GripVertical size={12} className="binder-drag-handle" />
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

        <div className="binder-hover-actions" onClick={(e) => e.stopPropagation()}>
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
              <div className="binder-dropdown-menu" onMouseLeave={() => setShowMenu(false)}>
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
  const [isCreatingExtra, setIsCreatingExtra] = useState(false);
  const [newExtraTitle, setNewExtraTitle] = useState('');

  if (!sidebarOpen) {
    return null;
  }

  const binderItems = novelProject?.binder || [];
  const extraFiles = novelProject?.extraFiles || [];

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
              <Hash size={13} />
              <span>Tags</span>
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
                      extraFiles.map((item) => (
                        <ChapterItem
                          key={item.id || item.path}
                          item={item}
                          isExtraFile
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Narrative Tags Panel */
            <div className="sidebar-tab-content">
              <TagsTab />
            </div>
          )}
        </>
      ) : (
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
      )}
    </aside>
  );
}

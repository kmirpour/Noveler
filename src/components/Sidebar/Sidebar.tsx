import { useState, type MouseEvent, type FormEvent } from 'react';
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
} from 'lucide-react';
import type { BinderItem, SceneStatus } from '../../services/projectService';
import { TagsTab } from './TagsTab';
import './Sidebar.css';

interface ChapterItemProps {
  item: BinderItem;
}

function ChapterItem({ item }: ChapterItemProps) {
  const {
    activeScenePath,
    loadSceneByPath,
    renameBinderItemAction,
    deleteBinderItemAction,
  } = useEditorStore();

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
    <div className="binder-item-wrapper">
      <div
        className={`binder-item is-scene ${isActive ? 'active' : ''}`}
        onClick={handleClick}
      >
        <span
          className="scene-status-dot"
          style={{ backgroundColor: getStatusColor(item.status) }}
          title={`Status: ${item.status || 'draft'}`}
        />

        <FileText size={14} className="binder-icon scene-icon" />

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
    refreshProjectFiles,
    toggleCorkboard,
    corkboardOpen,
    toggleInspector,
    inspectorOpen,
  } = useEditorStore();

  const [activeTab, setActiveTab] = useState<'chapters' | 'tags'>('chapters');

  if (!sidebarOpen) {
    return null;
  }

  const binderItems = novelProject?.binder || [];

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
              title="Refresh Chapters"
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
              <span>Chapters ({binderItems.length})</span>
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

              {/* Sequential Chapters List */}
              <div className="sidebar-file-list">
                {binderItems.length === 0 ? (
                  <div className="sidebar-empty">
                    <p>No chapters found. Click <strong>+ Chapter</strong> above to begin your novel!</p>
                  </div>
                ) : (
                  binderItems.map((item) => (
                    <ChapterItem key={item.id || item.path} item={item} />
                  ))
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

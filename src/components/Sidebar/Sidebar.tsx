import { useState, type MouseEvent, type FormEvent } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import {
  Folder,
  FolderOpen,
  FileText,
  FilePlus,
  FolderPlus,
  X,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  LayoutGrid,
  SlidersHorizontal,
  Trash2,
  Edit2,
  Plus,
} from 'lucide-react';
import type { BinderItem, SceneStatus } from '../../services/projectService';
import './Sidebar.css';

interface TreeItemProps {
  item: BinderItem;
  depth: number;
}

function BinderTreeItem({ item, depth }: TreeItemProps) {
  const {
    activeScenePath,
    loadSceneByPath,
    createSceneAction,
    createFolderAction,
    renameBinderItemAction,
    deleteBinderItemAction,
  } = useEditorStore();

  const [expanded, setExpanded] = useState(!item.collapsed);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(item.title);

  const isFolder = item.type === 'folder';
  const isActive = activeScenePath === item.path;

  const handleToggleExpand = (e: MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const handleClick = () => {
    if (isFolder) {
      setExpanded(!expanded);
    } else {
      void loadSceneByPath(item.path);
    }
  };

  const handleRenameSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (renameValue.trim() && renameValue !== item.title) {
      await renameBinderItemAction(item.path, renameValue.trim());
    }
    setIsRenaming(false);
  };

  const handleAddScene = async (e: MouseEvent) => {
    e.stopPropagation();
    const title = prompt('Scene Title:');
    if (title?.trim()) {
      await createSceneAction(item.path, title.trim());
      setExpanded(true);
    }
  };

  const handleAddFolder = async (e: MouseEvent) => {
    e.stopPropagation();
    const name = prompt('Folder Name:');
    if (name?.trim()) {
      await createFolderAction(item.path, name.trim());
      setExpanded(true);
    }
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
        className={`binder-item ${isActive ? 'active' : ''} ${isFolder ? 'is-folder' : 'is-scene'}`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={handleClick}
      >
        {isFolder ? (
          <button className="binder-chevron-btn" onClick={handleToggleExpand}>
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : (
          <span
            className="scene-status-dot"
            style={{ backgroundColor: getStatusColor(item.status) }}
            title={`Status: ${item.status || 'draft'}`}
          />
        )}

        {isFolder ? (
          expanded ? (
            <FolderOpen size={15} className="binder-icon folder-icon" />
          ) : (
            <Folder size={15} className="binder-icon folder-icon" />
          )
        ) : (
          <FileText size={14} className="binder-icon scene-icon" />
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

        {/* Hover action menu buttons */}
        <div className="binder-hover-actions" onClick={(e) => e.stopPropagation()}>
          {isFolder && (
            <>
              <button
                className="binder-action-mini-btn"
                onClick={handleAddScene}
                title="Add Scene inside folder"
              >
                <Plus size={12} />
              </button>
              <button
                className="binder-action-mini-btn"
                onClick={handleAddFolder}
                title="Add Subfolder"
              >
                <FolderPlus size={12} />
              </button>
            </>
          )}

          <div className="binder-menu-container">
            <button
              className="binder-action-mini-btn"
              onClick={() => setShowMenu(!showMenu)}
              title="More options"
            >
              <MoreVertical size={12} />
            </button>

            {showMenu && (
              <div className="binder-dropdown-menu" onMouseLeave={() => setShowMenu(false)}>
                <button
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

      {isFolder && expanded && item.children && item.children.length > 0 && (
        <div className="binder-children">
          {item.children.map((child) => (
            <BinderTreeItem key={child.id || child.path} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
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
    createSceneAction,
    createFolderAction,
    refreshProjectFiles,
    toggleCorkboard,
    corkboardOpen,
    toggleInspector,
    inspectorOpen,
  } = useEditorStore();

  if (!sidebarOpen) {
    return null;
  }

  const handleNewTopScene = async () => {
    if (!projectPath) return;
    const title = prompt('Scene Title:');
    if (title?.trim()) {
      await createSceneAction(projectPath, title.trim());
    }
  };

  const handleNewTopFolder = async () => {
    if (!projectPath) return;
    const name = prompt('Folder / Chapter Name:');
    if (name?.trim()) {
      await createFolderAction(projectPath, name.trim());
    }
  };

  const binderItems = novelProject?.binder || [];

  return (
    <aside className="sidebar">
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="sidebar-title" title={projectName || 'Project Binder'}>
          <Folder size={16} />
          <span>{projectName || 'Novel Binder'}</span>
        </div>
        <div className="sidebar-header-actions">
          {projectPath && (
            <button
              className="sidebar-icon-btn"
              onClick={() => void refreshProjectFiles()}
              title="Refresh Binder"
            >
              <RefreshCw size={13} />
            </button>
          )}
          <button
            className="sidebar-icon-btn"
            onClick={toggleSidebar}
            title="Close Binder"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Primary Project Actions */}
      <div className="sidebar-actions">
        {projectPath ? (
          <>
            <button
              className="sidebar-btn"
              onClick={handleNewTopScene}
              title="New Scene"
            >
              <FilePlus size={14} />
              <span>Scene</span>
            </button>
            <button
              className="sidebar-btn"
              onClick={handleNewTopFolder}
              title="New Folder / Chapter"
            >
              <FolderPlus size={14} />
              <span>Chapter</span>
            </button>
            <button
              className={`sidebar-icon-btn ${corkboardOpen ? 'active' : ''}`}
              onClick={toggleCorkboard}
              title="Corkboard / Outline View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              className={`sidebar-icon-btn ${inspectorOpen ? 'active' : ''}`}
              onClick={toggleInspector}
              title="Scene Inspector (Metadata & Synopsis)"
            >
              <SlidersHorizontal size={15} />
            </button>
          </>
        ) : (
          <button
            className="sidebar-btn primary-action"
            onClick={() => void openProjectFolderAction()}
            title="Open Folder"
          >
            <FolderOpen size={15} />
            <span>Open Project Folder</span>
          </button>
        )}
      </div>

      {/* Binder Tree */}
      <div className="sidebar-file-list">
        {!projectPath ? (
          <div className="sidebar-empty">
            <p>Open a folder to organize your manuscript chapters, scenes, and characters in the binder.</p>
          </div>
        ) : binderItems.length === 0 ? (
          <div className="sidebar-empty">
            <p>No scenes found. Click <strong>+ Scene</strong> above to begin your manuscript!</p>
          </div>
        ) : (
          binderItems.map((item) => (
            <BinderTreeItem key={item.id || item.path} item={item} depth={0} />
          ))
        )}
      </div>
    </aside>
  );
}

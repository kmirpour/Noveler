import { useEditorStore } from '../../stores/editorStore';
import {
  Folder,
  FolderOpen,
  FileText,
  FilePlus,
  X,
  RefreshCw,
} from 'lucide-react';
import './Sidebar.css';

export function Sidebar() {
  const {
    sidebarOpen,
    toggleSidebar,
    projectName,
    projectFiles,
    filePath,
    openProjectFolderAction,
    openFileByPath,
    refreshProjectFiles,
    newFile,
  } = useEditorStore();

  if (!sidebarOpen) {
    return null;
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <Folder size={16} />
          <span>{projectName || 'Project Files'}</span>
        </div>
        <div className="sidebar-header-actions">
          {projectName && (
            <button
              className="sidebar-icon-btn"
              onClick={() => void refreshProjectFiles()}
              title="Refresh Files"
            >
              <RefreshCw size={14} />
            </button>
          )}
          <button
            className="sidebar-icon-btn"
            onClick={toggleSidebar}
            title="Close Sidebar"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="sidebar-actions">
        <button
          className="sidebar-btn"
          onClick={() => void openProjectFolderAction()}
          title="Open Folder"
        >
          <FolderOpen size={15} />
          <span>{projectName ? 'Change Folder' : 'Open Folder'}</span>
        </button>
        <button
          className="sidebar-btn"
          onClick={() => newFile()}
          title="New File"
        >
          <FilePlus size={15} />
          <span>New File</span>
        </button>
      </div>

      <div className="sidebar-file-list">
        {projectFiles.length === 0 ? (
          <div className="sidebar-empty">
            {projectName ? (
              <p>No markdown files found in this folder.</p>
            ) : (
              <p>Open a folder to see your chapters and manuscript files.</p>
            )}
          </div>
        ) : (
          projectFiles.map((file) => {
            if (file.is_dir) {
              // Folder navigation arrives with the binder tree (roadmap Phase 4).
              return (
                <div
                  key={file.path}
                  className="sidebar-file-item is-folder"
                  title={`${file.path}\n(Sub-folders aren't browsable yet)`}
                >
                  <Folder size={15} className="file-icon" />
                  <span className="file-name">{file.name}</span>
                </div>
              );
            }
            const isActive = filePath === file.path;
            return (
              <button
                key={file.path}
                className={`sidebar-file-item ${isActive ? 'active' : ''}`}
                onClick={() => void openFileByPath(file.path)}
                title={file.path}
              >
                <FileText size={15} className="file-icon" />
                <span className="file-name">{file.name}</span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

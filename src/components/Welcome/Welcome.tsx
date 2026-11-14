import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { BookText, FolderOpen, PenLine, Clock } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { extractFileName, isTauri } from '../../services/fileService';
import './Welcome.css';

/** Shown when no novel is open: pick up a recent novel, open a folder, or just start writing. */
export function Welcome() {
  const { projectPath, filePath, isDirty, recentProjects, openProjectFolderAction, loadProjectByPath } =
    useEditorStore(
      useShallow((s) => ({
        projectPath: s.projectPath,
        filePath: s.filePath,
        isDirty: s.isDirty,
        recentProjects: s.recentProjects,
        openProjectFolderAction: s.openProjectFolderAction,
        loadProjectByPath: s.loadProjectByPath,
      }))
    );
  const [dismissed, setDismissed] = useState(false);

  if (projectPath || filePath || isDirty || dismissed) return null;

  return (
    <div className="welcome-overlay">
      <div className="welcome-card" role="dialog" aria-labelledby="welcome-title">
        <BookText size={28} className="welcome-icon" />
        <h1 id="welcome-title" className="welcome-title">
          Noveler
        </h1>
        <p className="welcome-text">
          A novel is a folder of plain Markdown chapters. Open one to pick up where you left off, or choose an
          empty folder to start a new book.
        </p>

        <div className="welcome-actions">
          <button type="button" className="welcome-btn primary" onClick={() => void openProjectFolderAction()}>
            <FolderOpen size={16} />
            <span>Open novel folder…</span>
          </button>
          <button type="button" className="welcome-btn" onClick={() => setDismissed(true)}>
            <PenLine size={16} />
            <span>Just write</span>
          </button>
        </div>

        {isTauri() && recentProjects.length > 0 && (
          <div className="welcome-recent">
            <h2 className="welcome-recent-heading">
              <Clock size={12} />
              Recent novels
            </h2>
            {recentProjects.map((path) => (
              <button
                key={path}
                type="button"
                className="welcome-recent-item"
                onClick={() => void loadProjectByPath(path)}
                title={path}
              >
                <span className="welcome-recent-name">{extractFileName(path)}</span>
                <span className="welcome-recent-path">{path}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

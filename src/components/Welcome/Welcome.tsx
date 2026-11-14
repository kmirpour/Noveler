import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { BookText, FolderOpen, PenLine, Clock } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import {
  extractFileName,
  isTauri,
  canOpenFolders,
  listRecentNovels,
  reopenRecentNovel,
  forgetRecentNovel,
} from '../../services/fileService';
import { appMode } from '../../services/appMode';
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
  // Browser: novels this browser remembers (the desktop app uses its own list of paths)
  const [webNovels, setWebNovels] = useState<{ id: string; name: string; lastOpened: number }[]>([]);
  const [reopenError, setReopenError] = useState<string | null>(null);

  useEffect(() => {
    if (canOpenFolders()) void listRecentNovels().then(setWebNovels);
  }, []);

  const reopen = async (id: string) => {
    setReopenError(null);
    try {
      const opened = await reopenRecentNovel(id);
      if (opened) await loadProjectByPath(opened.path);
    } catch (err) {
      setReopenError(err instanceof Error ? err.message : String(err));
    }
  };

  const forget = async (id: string) => {
    await forgetRecentNovel(id);
    setWebNovels(await listRecentNovels());
  };

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

        {appMode() === 'folders' && (
          <p className="welcome-note">
            Your files stay on this computer. When you open a folder, your browser asks permission to read and
            write it; nothing is uploaded. If the browser refuses a folder such as Documents or Desktop itself,
            choose the folder that holds your novel.
          </p>
        )}
        {appMode() === 'basic' && (
          <p className="welcome-note warn" role="note">
            This browser cannot save straight to your files, so Noveler works on a copy: Save downloads the file,
            and nothing is saved automatically. For the full experience use Chrome, Edge or Opera on a computer,
            or the desktop app.
          </p>
        )}

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

        {webNovels.length > 0 && (
          <div className="welcome-recent">
            <h2 className="welcome-recent-heading">
              <Clock size={12} />
              Recent novels
            </h2>
            {webNovels.map((novel) => (
              <div key={novel.id} className="welcome-recent-row">
                <button
                  type="button"
                  className="welcome-recent-item"
                  onClick={() => void reopen(novel.id)}
                  title="Reopen this novel. The browser may ask your permission to edit its folder."
                >
                  <span className="welcome-recent-name">{novel.name}</span>
                  <span className="welcome-recent-path">
                    Last opened {new Date(novel.lastOpened).toLocaleDateString()}
                  </span>
                </button>
                <button
                  type="button"
                  className="welcome-recent-forget"
                  aria-label={`Remove ${novel.name} from this list`}
                  title="Remove from this list (the novel itself is not touched)"
                  onClick={() => void forget(novel.id)}
                >
                  ×
                </button>
              </div>
            ))}
            {reopenError && (
              <p className="welcome-error" role="alert">
                {reopenError}
              </p>
            )}
          </div>
        )}

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

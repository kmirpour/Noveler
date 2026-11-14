import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { BookOpenText, RefreshCw, PenLine } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { readFileDirect } from '../../services/fileService';
import { parseSceneMarkdown } from '../../services/projectService';
import { markdownToHtml } from '../../utils/markdown';
import './Reference.css';

/**
 * Read-only view of any other file in the novel folder, shown beside the editor: the world wiki
 * while drafting a chapter, an earlier chapter while writing a later one, a plot outline, etc.
 */
export function Reference() {
  const { novelProject, referencePath, setReferencePath, filePath, markdownContent, loadSceneByPath } =
    useEditorStore(
      useShallow((s) => ({
        novelProject: s.novelProject,
        referencePath: s.referencePath,
        setReferencePath: s.setReferencePath,
        filePath: s.filePath,
        markdownContent: s.markdownContent,
        loadSceneByPath: s.loadSceneByPath,
      }))
    );

  const [loaded, setLoaded] = useState<{ path: string; content: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const chapters = novelProject?.binder || [];
  const notes = novelProject?.extraFiles || [];
  const known = [...chapters, ...notes].some((f) => f.path === referencePath);
  const isOpenInEditor = Boolean(referencePath && referencePath === filePath);

  useEffect(() => {
    if (!referencePath || isOpenInEditor) return;
    let cancelled = false;
    readFileDirect(referencePath)
      .then((file) => {
        if (cancelled) return;
        setLoaded({ path: referencePath, content: parseSceneMarkdown(file.content).body });
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoaded(null);
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [referencePath, isOpenInEditor, reloadTick]);

  // The file being edited is shown live from the editor; anything else comes from disk.
  const content = isOpenInEditor
    ? markdownContent
    : loaded && loaded.path === referencePath
      ? loaded.content
      : '';
  const html = useMemo(() => (content ? markdownToHtml(content) : ''), [content]);

  return (
    <div className="reference-container">
      <div className="reference-header">
        <BookOpenText size={14} className="reference-header-icon" />
        <select
          className="reference-select"
          value={known ? (referencePath ?? '') : ''}
          onChange={(e) => setReferencePath(e.target.value || null)}
          aria-label="File shown in the reference pane"
        >
          <option value="">Choose a file to keep beside the editor…</option>
          {notes.length > 0 && (
            <optgroup label="Notes & other files">
              {notes.map((f) => (
                <option key={f.path} value={f.path}>
                  {f.title}
                </option>
              ))}
            </optgroup>
          )}
          {chapters.length > 0 && (
            <optgroup label="Chapters">
              {chapters.map((f) => (
                <option key={f.path} value={f.path}>
                  {f.title}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {referencePath && !isOpenInEditor && (
          <>
            <button
              type="button"
              className="reference-btn"
              onClick={() => setReloadTick((n) => n + 1)}
              title="Reload from disk"
            >
              <RefreshCw size={13} />
            </button>
            <button
              type="button"
              className="reference-btn"
              onClick={() => void loadSceneByPath(referencePath)}
              title="Open this file in the editor"
            >
              <PenLine size={13} />
            </button>
          </>
        )}
      </div>

      <div className="reference-body">
        {!novelProject ? (
          <p className="reference-empty">Open a novel folder to keep notes or another chapter beside the editor.</p>
        ) : !referencePath || !known ? (
          <p className="reference-empty">
            Pick a file above. It stays here, read-only, while you write: your world notes, a plot outline, or
            an earlier chapter.
          </p>
        ) : error ? (
          <p className="reference-empty">Could not read this file: {error}</p>
        ) : (
          <article className="reference-content" dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
    </div>
  );
}

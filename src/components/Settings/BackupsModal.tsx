import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { History, X } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { isTauri, listBackups, readBackup, type BackupEntry } from '../../services/fileService';
import { DiffView } from './DiffView';
import './SettingsModal.css';

const countWords = (text: string) => (text.trim() === '' ? 0 : text.trim().split(/\s+/).length);

/**
 * Browse and restore the automatic backups of the open file. Noveler keeps up to 20 earlier
 * versions per file (at most one every 10 minutes) in `.noveler/backups/` inside the novel folder.
 */
export function BackupsModal() {
  const { open, setOpen, filePath, fileName, wordCount, replaceDocumentTextAction, currentText } = useEditorStore(
    useShallow((s) => ({
      open: s.backupsOpen,
      setOpen: s.setBackupsOpen,
      filePath: s.filePath,
      fileName: s.fileName,
      wordCount: s.wordCount,
      replaceDocumentTextAction: s.replaceDocumentTextAction,
      currentText: s.markdownContent,
    }))
  );

  const [entries, setEntries] = useState<BackupEntry[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'changes' | 'text'>('changes');

  useEffect(() => {
    if (!open) return;
    setEntries(null);
    setSelected(null);
    setPreview(null);
    setError(null);
    if (!filePath) {
      setEntries([]);
      return;
    }
    let cancelled = false;
    listBackups(filePath)
      .then((list) => {
        if (cancelled) return;
        setEntries(list);
        if (list.length > 0) setSelected(list[0].name);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [open, filePath]);

  useEffect(() => {
    if (!open || !filePath || !selected) return;
    let cancelled = false;
    readBackup(filePath, selected)
      .then((text) => !cancelled && setPreview({ name: selected, text }))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [open, filePath, selected]);

  if (!open) return null;

  const current = entries?.find((e) => e.name === selected);
  const when = (e: BackupEntry) => new Date(e.timestamp * 1000);
  const shown = preview && preview.name === selected ? preview.text : null;
  const shownWords = shown !== null ? countWords(shown) : 0;

  const restore = () => {
    if (shown === null || !current) return;
    replaceDocumentTextAction(
      shown,
      `Restored the version from ${when(current).toLocaleString()} (Ctrl+Z undoes this)`
    );
    setOpen(false);
  };

  return (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div
        className="backups-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backups-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <History className="modal-title-icon" size={20} />
            <h2 id="backups-title">Backups of {fileName || 'this file'}</h2>
          </div>
          <button className="modal-close-btn" onClick={() => setOpen(false)} title="Close (Esc)" aria-label="Close backups">
            <X size={18} />
          </button>
        </div>

        {!isTauri() ? (
          <p className="backups-empty">Backups are kept by the desktop app.</p>
        ) : !filePath ? (
          <p className="backups-empty">Save this document first. Backups are kept for files on disk.</p>
        ) : error ? (
          <p className="backups-empty">Could not read the backups: {error}</p>
        ) : entries === null ? (
          <p className="backups-empty">Looking for backups…</p>
        ) : entries.length === 0 ? (
          <p className="backups-empty">
            No backups yet. Noveler keeps an earlier version each time this file is saved, at most once every ten
            minutes, up to twenty versions.
          </p>
        ) : (
          <>
            <div className="backups-body">
              <div className="backups-list" role="listbox" aria-label="Earlier versions">
                {entries.map((e) => (
                  <button
                    key={e.name}
                    type="button"
                    role="option"
                    aria-selected={e.name === selected}
                    className={`backups-item ${e.name === selected ? 'active' : ''}`}
                    onClick={() => setSelected(e.name)}
                  >
                    <span className="backups-item-date">
                      {when(e).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      {' · '}
                      {when(e).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="backups-item-meta">{Math.max(1, Math.round(e.size / 1024))} KB</span>
                  </button>
                ))}
              </div>
              <div className="backups-preview">
                <div className="backups-mode" role="tablist" aria-label="Show">
                  <button type="button" role="tab" aria-selected={mode === 'changes'} className={mode === 'changes' ? 'active' : ''} onClick={() => setMode('changes')}>
                    What changed
                  </button>
                  <button type="button" role="tab" aria-selected={mode === 'text'} className={mode === 'text' ? 'active' : ''} onClick={() => setMode('text')}>
                    Full text
                  </button>
                </div>
                {shown === null ? (
                  <pre className="backups-preview-text">Loading…</pre>
                ) : mode === 'text' ? (
                  <pre className="backups-preview-text">{shown}</pre>
                ) : (
                  <div className="backups-preview-text">
                    <DiffView before={shown} after={currentText} beforeLabel="this backup" />
                  </div>
                )}
              </div>
            </div>
            <div className="backups-footer">
              <span>
                {shown !== null
                  ? `This version: ${shownWords.toLocaleString()} words · Now: ${wordCount.toLocaleString()} words`
                  : ''}
              </span>
              <button type="button" className="backups-restore-btn" onClick={restore} disabled={shown === null}>
                Restore this version
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

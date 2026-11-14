import { useState } from 'react';
import { FileInput } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { readFileDirect, extractFileName } from '../../services/fileService';
import { parseWikiEntries, planWikiImport, type WikiImportPlan } from '../../utils/storyBible';

/**
 * Fills the story bible from a notes file. Entries are recognised by a bold lead-in such as
 * `**Azie (Azar Zarin):** …`. Nothing already typed into the story bible is overwritten, and the
 * notes file itself is only read.
 */
export function WikiImport() {
  const novelProject = useEditorStore((s) => s.novelProject);
  const applyWikiImportAction = useEditorStore((s) => s.applyWikiImportAction);
  const filePath = useEditorStore((s) => s.filePath);
  const markdownContent = useEditorStore((s) => s.markdownContent);

  const notes = novelProject?.extraFiles || [];
  const likely = notes.find((f) => /wiki|world|character|cast|bible/i.test(extractFileName(f.path)));

  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<string>(likely?.path ?? notes[0]?.path ?? '');
  const [plan, setPlan] = useState<WikiImportPlan | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!novelProject || notes.length === 0) return null;

  const scan = async (path: string) => {
    setSource(path);
    setPlan(null);
    setMessage(null);
    if (!path) return;
    try {
      const text = path === filePath ? markdownContent : (await readFileDirect(path)).content;
      const parsed = parseWikiEntries(text);
      if (parsed.length === 0) {
        setMessage('No entries found. Entries start with a bold name, like **Name (Alias):** description.');
        return;
      }
      setPlan(planWikiImport(novelProject.codex || [], parsed));
    } catch (err) {
      setMessage(`Could not read that file: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const run = async () => {
    if (!plan) return;
    const count = await applyWikiImportAction(plan);
    setPlan(null);
    setMessage(count > 0 ? `Done: ${count} ${count === 1 ? 'entry' : 'entries'} updated.` : 'Nothing to import.');
  };

  if (!open) {
    return (
      <button
        type="button"
        className="codex-import-toggle"
        onClick={() => {
          setOpen(true);
          void scan(source);
        }}
        title="Read characters, places and terms from one of your notes files"
      >
        <FileInput size={13} />
        <span>Import from notes…</span>
      </button>
    );
  }

  const nothingToDo = plan && plan.toAdd.length === 0 && plan.toUpdate.length === 0;

  return (
    <div className="codex-import-panel">
      <label className="codex-label" htmlFor="codex-import-source">
        Read entries from
      </label>
      <select
        id="codex-import-source"
        className="codex-search-input"
        value={source}
        onChange={(e) => void scan(e.target.value)}
      >
        {notes.map((f) => (
          <option key={f.path} value={f.path}>
            {f.title}
          </option>
        ))}
      </select>

      {plan && (
        <p className="codex-import-summary">
          <strong>{plan.toAdd.length}</strong> new
          {plan.toAdd.length > 0 && `: ${plan.toAdd.slice(0, 6).map((e) => e.name).join(', ')}${plan.toAdd.length > 6 ? '…' : ''}`}
          <br />
          <strong>{plan.toUpdate.length}</strong> existing to fill in · {plan.unchanged} already complete
        </p>
      )}
      {message && <p className="codex-import-summary">{message}</p>}

      <div className="codex-import-actions">
        <button type="button" className="codex-chip" onClick={() => setOpen(false)}>
          Close
        </button>
        <button
          type="button"
          className="codex-chip active"
          onClick={() => void run()}
          disabled={!plan || Boolean(nothingToDo)}
        >
          Import
        </button>
      </div>
    </div>
  );
}

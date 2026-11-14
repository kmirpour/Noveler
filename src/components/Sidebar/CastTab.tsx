import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { RefreshCw, Users } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { readFileDirect } from '../../services/fileService';
import type { CodexEntry } from '../../services/projectService';
import { splitChapterIntoScenes } from '../../utils/chapterScenes';
import { extractNarrativeTags } from '../../utils/narrativeTags';
import { countMentions, mentionRegExp } from '../../utils/storyBible';
import { TagsTab } from './TagsTab';
import './CastTab.css';

type Counts = Record<string, number>;

/**
 * Who and what appears where, worked out from the story bible: no tagging needed.
 * Shows the cast of the open chapter scene by scene, and of the whole novel chapter by chapter.
 */
export function CastTab() {
  const { codex, chapters, filePath, markdownContent, editorInstance, toggleCodexModal, loadSceneByPath } =
    useEditorStore(
      useShallow((s) => ({
        codex: s.novelProject?.codex,
        chapters: s.novelProject?.binder,
        filePath: s.filePath,
        markdownContent: s.markdownContent,
        editorInstance: s.editorInstance,
        toggleCodexModal: s.toggleCodexModal,
        loadSceneByPath: s.loadSceneByPath,
      }))
    );

  const entries: CodexEntry[] = useMemo(() => codex || [], [codex]);
  const [novelCounts, setNovelCounts] = useState<Record<string, Counts> | null>(null);
  const [scanning, setScanning] = useState(false);

  const chapterCounts = useMemo(() => countMentions(markdownContent, entries), [markdownContent, entries]);
  const scenes = useMemo(() => {
    const isChapter = chapters?.some((c) => c.path === filePath);
    if (!isChapter) return [];
    return splitChapterIntoScenes(markdownContent).scenes.map((scene, i) => ({
      title: scene.title || `Scene ${i + 1}`,
      counts: countMentions(scene.body, entries),
    }));
  }, [chapters, filePath, markdownContent, entries]);

  const hasHashtags = useMemo(() => extractNarrativeTags(markdownContent).length > 0, [markdownContent]);

  const scanNovel = async () => {
    if (!chapters) return;
    setScanning(true);
    const result: Record<string, Counts> = {};
    for (const chapter of chapters) {
      try {
        const text =
          chapter.path === filePath ? markdownContent : (await readFileDirect(chapter.path)).content;
        result[chapter.path] = countMentions(text, entries);
      } catch {
        result[chapter.path] = {};
      }
    }
    setNovelCounts(result);
    setScanning(false);
  };

  // Results for the whole novel go stale when the story bible changes.
  useEffect(() => {
    setNovelCounts(null);
  }, [entries]);

  /** Moves the cursor to the next mention of an entry in the open chapter. */
  const jumpToNext = (entry: CodexEntry) => {
    const editor = editorInstance;
    const regex = mentionRegExp(entry);
    if (!editor || editor.isDestroyed || !regex) return;
    const hits: { from: number; to: number }[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      regex.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(node.text)) !== null) {
        hits.push({ from: pos + m.index, to: pos + m.index + m[0].length });
      }
    });
    if (hits.length === 0) return;
    const cursor = editor.state.selection.to;
    const next = hits.find((h) => h.from >= cursor) ?? hits[0];
    editor.chain().focus().setTextSelection(next).scrollIntoView().run();
  };

  if (entries.length === 0) {
    return (
      <div className="cast-tab">
        <p className="cast-empty">
          Add your characters and places to the story bible, and this panel will show where each one appears.
        </p>
        <button type="button" className="cast-action" onClick={toggleCodexModal}>
          <Users size={13} />
          <span>Open story bible</span>
        </button>
        {hasHashtags && <TagsTab />}
      </div>
    );
  }

  const present = entries
    .filter((e) => chapterCounts[e.id])
    .sort((a, b) => chapterCounts[b.id] - chapterCounts[a.id]);
  const nameOf = (id: string) => entries.find((e) => e.id === id)?.name ?? '';

  return (
    <div className="cast-tab">
      <section className="cast-section">
        <h3 className="cast-heading">In this file</h3>
        {present.length === 0 ? (
          <p className="cast-empty">Nobody from the story bible is mentioned here yet.</p>
        ) : (
          <div className="cast-chips">
            {present.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`cast-chip cast-${entry.category}`}
                onClick={() => jumpToNext(entry)}
                title={`${entry.name}: ${chapterCounts[entry.id]} mentions. Click to jump to the next one.`}
              >
                <span>{entry.name}</span>
                <span className="cast-count">{chapterCounts[entry.id]}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {scenes.length > 0 && (
        <section className="cast-section">
          <h3 className="cast-heading">Scene by scene</h3>
          <ol className="cast-scenes">
            {scenes.map((scene, i) => {
              const ids = Object.keys(scene.counts).sort((a, b) => scene.counts[b] - scene.counts[a]);
              return (
                <li key={`${i}-${scene.title}`} className="cast-scene">
                  <span className="cast-scene-title">{scene.title}</span>
                  <span className="cast-scene-names">{ids.length ? ids.map(nameOf).join(', ') : '—'}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="cast-section">
        <div className="cast-heading-row">
          <h3 className="cast-heading">Across the novel</h3>
          <button
            type="button"
            className="cast-action"
            onClick={() => void scanNovel()}
            disabled={scanning}
            title="Count mentions in every chapter"
          >
            <RefreshCw size={12} />
            <span>{scanning ? 'Counting…' : novelCounts ? 'Recount' : 'Count'}</span>
          </button>
        </div>
        {novelCounts && chapters && (
          <div className="cast-table-wrap">
            <table className="cast-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  {chapters.map((c, i) => (
                    <th key={c.path} scope="col" title={c.title}>
                      <button type="button" className="cast-col-btn" onClick={() => void loadSceneByPath(c.path)}>
                        {i + 1}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries
                  .map((e) => ({
                    entry: e,
                    total: chapters.reduce((n, c) => n + (novelCounts[c.path]?.[e.id] || 0), 0),
                  }))
                  .sort((a, b) => b.total - a.total)
                  .map(({ entry, total }) => (
                    <tr key={entry.id} className={total === 0 ? 'cast-absent' : ''}>
                      <th scope="row" title={entry.name}>
                        {entry.name}
                      </th>
                      {chapters.map((c) => {
                        const n = novelCounts[c.path]?.[entry.id] || 0;
                        return <td key={c.path}>{n || '·'}</td>;
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        {!novelCounts && <p className="cast-empty">Shows how often each name appears in each chapter.</p>}
      </section>

      {hasHashtags && (
        <section className="cast-section">
          <h3 className="cast-heading">Hashtags</h3>
          <TagsTab />
        </section>
      )}
    </div>
  );
}

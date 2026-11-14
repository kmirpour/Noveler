import type { NovelProject, SceneMetadata } from '../services/projectService';

/**
 * Per-scene notes (synopsis, status, POV, word target).
 *
 * Chapter files stay plain Markdown, so nothing about a scene is written into them. Instead the
 * notes live in noveler.json, filed under the chapter's file name and the scene's `##` title.
 * Using the title (not the position) means notes follow a scene when it is moved; when a title is
 * edited, {@link migrateSceneKeys} carries the notes over to the new title.
 */
export type ChapterSceneMeta = Record<string, SceneMetadata>;

/** Stable lookup keys for a chapter's scenes; repeated titles get `~2`, `~3`… in order. */
export function sceneKeys(titles: string[]): string[] {
  const seen = new Map<string, number>();
  return titles.map((title) => {
    const base = title.trim().toLowerCase();
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}~${n}`;
  });
}

function sameMultiset(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sorted = (x: string[]) => [...x].sort().join('\u0000');
  return sorted(a) === sorted(b);
}

/**
 * Re-files scene notes after the chapter's scene titles changed.
 *  - Scenes only moved around: nothing to do, notes are filed by title.
 *  - Same number of scenes but some titles differ: those scenes were renamed in place, so their
 *    notes move to the new titles.
 *  - Scenes were added or removed: titles of the others are unchanged, nothing to do.
 * Returns the same object when nothing changed.
 */
export function migrateSceneKeys(
  meta: ChapterSceneMeta,
  oldTitles: string[],
  newTitles: string[]
): ChapterSceneMeta {
  if (oldTitles.length !== newTitles.length) return meta;
  const oldKeys = sceneKeys(oldTitles);
  const newKeys = sceneKeys(newTitles);
  if (sameMultiset(oldKeys, newKeys)) return meta;

  const next: ChapterSceneMeta = { ...meta };
  let changed = false;
  // Two passes so that swapping-style renames can't overwrite each other.
  const moved: [string, SceneMetadata][] = [];
  oldKeys.forEach((oldKey, i) => {
    const newKey = newKeys[i];
    if (oldKey !== newKey && meta[oldKey]) {
      moved.push([newKey, meta[oldKey]]);
      delete next[oldKey];
      changed = true;
    }
  });
  for (const [key, value] of moved) next[key] = value;
  return changed ? next : meta;
}

function fileNameOf(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || path;
}

/** Notes for the scene at `sceneIndex` of a chapter (empty object if none were written). */
export function sceneMetaAt(
  project: NovelProject | null,
  chapterPath: string | null,
  sceneIndex: number
): SceneMetadata {
  if (!project || !chapterPath) return {};
  const chapter = project.binder.find((b) => b.path === chapterPath);
  const titles = chapter?.scenes || [];
  const key = sceneKeys(titles)[sceneIndex];
  if (key === undefined) return {};
  return project.sceneMetadata?.[fileNameOf(chapterPath)]?.[key] || {};
}

/** Returns a project with the given scene's notes updated. */
export function withSceneMeta(
  project: NovelProject,
  chapterPath: string,
  sceneIndex: number,
  partial: Partial<SceneMetadata>
): NovelProject {
  const chapter = project.binder.find((b) => b.path === chapterPath);
  const key = sceneKeys(chapter?.scenes || [])[sceneIndex];
  if (key === undefined) return project;
  const file = fileNameOf(chapterPath);
  const chapterMeta = project.sceneMetadata?.[file] || {};
  return {
    ...project,
    sceneMetadata: {
      ...(project.sceneMetadata || {}),
      [file]: { ...chapterMeta, [key]: { ...(chapterMeta[key] || {}), ...partial } },
    },
  };
}

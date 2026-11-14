/**
 * Helpers shared by the store's slices: initial values, chapter outline maintenance, and the single
 * writer for noveler.json. The store registers itself here (bindStore) so these helpers can read
 * the latest state without importing the store module.
 */
import * as fileService from '../services/fileService';
import { type AppSettings, loadSettings } from '../services/settings';
import {
  type NovelProject,
  type BinderItem,
  saveNovelProject,
  extractChapterHeadingTitle,
} from '../services/projectService';
import { extractChapterDisplayTitle } from '../utils/chapterNaming';
import { getChapterScenes } from '../utils/chapterScenes';
import { migrateSceneKeys } from '../utils/sceneMetadata';
import { setOnlineGrammarEnabled } from '../services/spellingService';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { EditorState } from './types';

let store: () => EditorState = () => {
  throw new Error('The editor store has not been created yet');
};

/** Called once by the store, right after it is created. */
export function bindStore(getState: () => EditorState): void {
  store = getState;
}

export const initialMarkdown = `# Welcome to Noveler

Start writing your story here. Noveler is a simple, distraction-free editor purpose-built for fiction writers.

**Bold**, *italic*, dialogue tags, and markdown formatting work naturally as you type.

---

## Chapter One

The morning sun cast long shadows across the empty street. She stood at the window, watching, waiting for something she couldn't quite name.

"Are you coming?" he called from the doorway.

She didn't turn around. "In a moment," she said softly.`;

export const initialSettings: AppSettings = loadSettings();
setOnlineGrammarEnabled(initialSettings.onlineGrammarCheck);

export const updateWindowTitle = async (fileName: string | null, isDirty: boolean) => {
  if (fileService.isTauri()) {
    try {
      const win = getCurrentWindow();
      const title = `${fileName || 'Untitled'}${isDirty ? ' •' : ''} — Noveler`;
      await win.setTitle(title);
    } catch {
      // ignore in non-tauri environment
    }
  }
};

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

export const countWords = (text: string) => {
  const t = text.trim();
  return t === '' ? 0 : t.split(/\s+/).length;
};

/** Sidebar title for a chapter: its own `# Heading` if it has one, else a name derived from the file. */
export const chapterTitleFor = (path: string, markdown: string) =>
  extractChapterHeadingTitle(markdown) || extractChapterDisplayTitle(fileService.extractFileName(path));

/** Fills in a chapter's runtime outline fields (title, scene titles, scene word counts). */
export const outlineItem = (item: BinderItem, markdown: string): BinderItem => {
  const scenes = getChapterScenes(markdown);
  return {
    ...item,
    title: chapterTitleFor(item.path, markdown),
    scenes: scenes.map((s) => s.title),
    sceneWords: scenes.map((s) => s.wordCount),
  };
};

/**
 * Refreshes one chapter's runtime outline from its Markdown. If scene titles were edited in place,
 * the scene notes filed under the old titles are carried over to the new ones.
 */
export const withChapterOutline = (project: NovelProject, path: string, markdown: string): NovelProject => {
  const previous = project.binder.find((b) => b.path === path);
  if (!previous) return project;
  const nextItem = outlineItem(previous, markdown);
  const next: NovelProject = {
    ...project,
    binder: project.binder.map((b) => (b.path === path ? nextItem : b)),
  };

  const file = fileService.extractFileName(path);
  const chapterMeta = project.sceneMetadata?.[file];
  if (chapterMeta && previous.scenes) {
    const migrated = migrateSceneKeys(chapterMeta, previous.scenes, nextItem.scenes || []);
    if (migrated !== chapterMeta) {
      next.sceneMetadata = { ...(project.sceneMetadata || {}), [file]: migrated };
      persistProject();
    }
  }
  return next;
};

// --- Project file persistence ------------------------------------------------
// Every change to noveler.json goes through one debounced, serialized writer that always saves the
// latest state. This prevents a slow or stale write from overwriting a newer one, and stops fields
// like the synopsis from rewriting the file on every keystroke.
export const PROJECT_SAVE_DEBOUNCE_MS = 500;
let projectSaveTimer: ReturnType<typeof setTimeout> | null = null;
let projectSaveChain: Promise<void> = Promise.resolve();

export function writeProjectNow(): Promise<void> {
  const { projectPath, novelProject, writingLog } = store();
  if (!projectPath || !novelProject) return projectSaveChain;
  const snapshot: NovelProject = { ...novelProject, writingLog };
  projectSaveChain = projectSaveChain
    .then(() => saveNovelProject(projectPath, snapshot))
    .catch((err) => {
      console.error('Error saving noveler.json:', err);
    });
  return projectSaveChain;
}

// After a save, look again (a little later, and not on every keystroke-save) at what git sees as changed.
let gitRefreshTimer: ReturnType<typeof setTimeout> | null = null;
export function scheduleGitRefresh(): void {
  if (!fileService.isTauri()) return;
  if (gitRefreshTimer) clearTimeout(gitRefreshTimer);
  gitRefreshTimer = setTimeout(() => {
    gitRefreshTimer = null;
    void store().refreshGitChangesAction();
  }, 4000);
}

/** Schedules a save of noveler.json from the current store state. */
export function persistProject(): void {
  if (projectSaveTimer) clearTimeout(projectSaveTimer);
  projectSaveTimer = setTimeout(() => {
    projectSaveTimer = null;
    void writeProjectNow();
  }, PROJECT_SAVE_DEBOUNCE_MS);
}

/** Writes any pending noveler.json change immediately and waits for it to reach disk. */
export function flushProjectSave(): Promise<void> {
  if (projectSaveTimer) {
    clearTimeout(projectSaveTimer);
    projectSaveTimer = null;
    return writeProjectNow();
  }
  return projectSaveChain;
}

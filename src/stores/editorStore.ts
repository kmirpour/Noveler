import { create } from 'zustand';
import type { Editor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import * as fileService from '../services/fileService';
import { clearRecovery } from '../services/recovery';
import { exportToPdf } from '../export/pdf';
import {
  type AppSettings,
  type FontFamily,
  type SceneTitleMode,
  type Theme,
  type ViewMode,
  loadSettings,
  saveSettings,
  addRecentFile,
  addRecentProject,
  TYPEFACES,
  FONT_SIZE_RANGE,
  LINE_HEIGHT_RANGE,
  LINE_WIDTH_RANGE,
} from '../services/settings';
import { THEME_IDS } from '../services/themes';
import { promptDialog } from '../services/dialogs';
import {
  type NovelProject,
  type SceneMetadata,
  type BinderItem,
  type CodexEntry,
  type SceneSnapshot,
  loadNovelProject,
  saveNovelProject,
  saveSnapshots,
  loadScratchpadFile,
  saveScratchpadFile,
  createSequentialChapter,
  createExtraFile,
  parseSceneMarkdown,
  flattenScenes,
  flushScratchpadToGraveyard,
  moveFileToGraveyard,
  archiveTextToGraveyard,
  extractChapterHeadingTitle,
  setChapterHeadingTitle,
} from '../services/projectService';
import { buildRenamedChapterFileName, extractChapterDisplayTitle } from '../utils/chapterNaming';
import {
  countScenesInMarkdown,
  extractSceneTitlesFromMarkdown,
  getChapterScenes,
  splitChapterIntoScenes,
  updateSceneTitleAtIndex,
  reorderChapterScenes,
  insertSceneAfterIndex,
  deleteSceneFromChapter,
  findScenePositionInDoc,
  getSceneIndexAtPosition,
} from '../utils/chapterScenes';
import {
  renameSceneInEditor,
  moveSceneInEditor,
  insertSceneInEditor,
  deleteSceneInEditor,
  appendMarkdownInEditor,
  setChapterTitleInEditor,
  resetEditorHistory,
} from '../utils/sceneDocOps';
import { type WritingLog, addWords } from '../utils/writingLog';
import { migrateSceneKeys, withSceneMeta } from '../utils/sceneMetadata';
import { buildContextPack } from '../utils/contextPack';
import type { WikiImportPlan } from '../utils/storyBible';
import { getGitStatus, syncGit } from '../services/gitService';
import { setOnlineGrammarEnabled } from '../services/spellingService';
import { getCurrentWindow } from '@tauri-apps/api/window';

/** A document to load into the editor, replacing the current one. */
export interface LoadDocumentInput {
  markdown: string;
  fileName: string | null;
  filePath: string | null;
  /** Mark the loaded document as having unsaved changes (e.g. restored from recovery). */
  dirty?: boolean;
  statusMessage?: string;
}

export interface DocumentSlice {
  markdownContent: string;
  fileName: string | null;
  filePath: string | null;
  isDirty: boolean;
  wordCount: number;
  charCount: number;
  statusMessage: string | null;
  editorInstance: Editor | null;

  setFileName: (name: string | null) => void;
  setFilePath: (path: string | null) => void;
  setDirty: (dirty: boolean) => void;
  setStatusMessage: (msg: string | null) => void;
  updateCounts: (text: string) => void;
  setEditorInstance: (editor: Editor | null) => void;
  setMarkdownContent: (markdown: string) => void;
  confirmDiscardIfDirty: () => Promise<boolean>;
  loadDocument: (doc: LoadDocumentInput) => void;
  newFile: () => Promise<boolean>;
  openFileAction: () => Promise<boolean>;
  openFileByPath: (path: string) => Promise<boolean>;
  saveFileAction: () => Promise<boolean>;
  saveFileAsAction: () => Promise<boolean>;
  exportDocxAction: () => Promise<void>;
  printAction: () => void;
}

export interface ProjectSlice {
  projectPath: string | null;
  projectName: string | null;
  projectFiles: fileService.FileEntry[];
  novelProject: NovelProject | null;
  activeScenePath: string | null;
  activeSceneIndex: number;
  currentMetadata: SceneMetadata;
  novelWordCount: number;
  scratchpadContent: string;
  tagCategories: string[];
  tagAssignments: Record<string, string>;
  /** File shown read-only beside the editor in "reference" view. */
  referencePath: string | null;
  setReferencePath: (path: string | null) => void;
  /** Shows a file beside the editor (switches to the reference view). */
  openReferenceAction: (path: string) => void;
  corkboardOpen: boolean;
  inspectorOpen: boolean;
  scriveningsMode: boolean;

  openProjectFolderAction: () => Promise<boolean>;
  loadProjectByPath: (path: string) => Promise<boolean>;
  refreshProjectFiles: () => Promise<void>;
  createChapterAction: (customTitle?: string) => Promise<boolean>;
  createExtraFileAction: (titleInput?: string) => Promise<boolean>;
  createSceneAction: (parentFolder: string, title: string) => Promise<boolean>;
  createFolderAction: (parentFolder: string, name: string) => Promise<boolean>;
  renameBinderItemAction: (oldPath: string, newTitle: string) => Promise<boolean>;
  deleteBinderItemAction: (path: string) => Promise<boolean>;
  reorderBinderItemsAction: (fromIndex: number, toIndex: number) => Promise<boolean>;
  updateSceneMetadata: (metadata: Partial<SceneMetadata>) => void;
  updateSceneMetadataByPath: (scenePath: string, metadata: Partial<SceneMetadata>) => void;
  /** Updates the notes (synopsis, status, POV, target) of one scene in a chapter. */
  updateSceneNotesAction: (chapterPath: string, sceneIndex: number, partial: Partial<SceneMetadata>) => void;
  setActiveSceneIndex: (index: number) => void;
  jumpToSceneAction: (chapterPath: string, sceneIndex: number) => Promise<void>;
  renameChapterSceneAction: (chapterPath: string, sceneIndex: number, newTitle: string) => void;
  addSceneToChapterAction: (chapterPath: string, customTitle?: string) => Promise<number>;
  insertSceneAfterAction: (chapterPath: string, afterSceneIndex: number, customTitle?: string) => Promise<number>;
  reorderChapterScenesAction: (chapterPath: string, fromIndex: number, toIndex: number) => Promise<boolean>;
  deleteSceneFromChapterAction: (
    chapterPath: string,
    sceneIndex: number,
    options?: { archive?: boolean }
  ) => Promise<boolean>;
  /** Moves a note file into a chapter as a new last scene; the note itself goes to the graveyard. */
  insertFileAsSceneAction: (notePath: string, chapterPath: string) => Promise<boolean>;
  /** Lifts a scene out of its chapter into its own note file under Other Files. */
  extractSceneToFileAction: (chapterPath: string, sceneIndex: number) => Promise<boolean>;
  addCustomDictionaryWordAction: (word: string) => Promise<void>;
  saveProjectConfigAction: () => Promise<void>;
  setScratchpadContent: (content: string) => void;
  /** Adds text to the end of the scratchpad (e.g. a passage cut from the manuscript). */
  appendToScratchpadAction: (text: string) => void;
  /** Replaces the open document's text (restore from a snapshot or backup). Undoable with Ctrl+Z. */
  replaceDocumentTextAction: (markdown: string, message: string) => void;
  /** Copies a briefing (story bible, outline, notes, current scene) to the clipboard. */
  copyContextPackAction: () => Promise<boolean>;
  /** Adds or fills in story-bible entries read from a notes file. */
  applyWikiImportAction: (plan: WikiImportPlan) => Promise<number>;
  addTagCategoryAction: (category: string) => Promise<void>;
  assignTagCategoryAction: (tagName: string, category: string) => Promise<void>;
  setCorkboardOpen: (open: boolean) => void;
  toggleCorkboard: () => void;
  setInspectorOpen: (open: boolean) => void;
  toggleInspector: () => void;
  setScriveningsMode: (enabled: boolean) => void;
  toggleScriveningsMode: () => void;
  loadSceneByPath: (path: string) => Promise<boolean>;
  addCodexEntryAction: (entry: Omit<CodexEntry, 'id'>) => Promise<void>;
  updateCodexEntryAction: (entry: CodexEntry) => Promise<void>;
  deleteCodexEntryAction: (id: string) => Promise<void>;
  createSceneSnapshotAction: (label: string) => Promise<void>;
  restoreSceneSnapshotAction: (snapshotId: string) => Promise<void>;
  deleteSceneSnapshotAction: (snapshotId: string) => Promise<void>;
  syncGitAction: () => Promise<boolean>;
  flushScratchpadAction: () => Promise<boolean>;
}

export interface SettingsSlice {
  theme: Theme;
  viewMode: ViewMode;
  sidebarOpen: boolean;
  autoSaveEnabled: boolean;
  autoSaveIntervalMs: number;
  fontFamily: FontFamily;
  fontSize: number;
  paragraphIndent: boolean;
  sceneTitleMode: SceneTitleMode;
  spellCheckEnabled: boolean;
  /** Off by default: when on, paragraphs are sent to the LanguageTool web service for grammar checks. */
  onlineGrammarCheck: boolean;
  recentFiles: string[];
  recentProjects: string[];
  lineHeight: number;
  lineWidth: number;
  smartQuotes: boolean;

  setLineHeight: (lineHeight: number) => void;
  setLineWidth: (lineWidth: number) => void;
  setSmartQuotes: (enabled: boolean) => void;
  toggleOnlineGrammarCheck: () => void;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
  setViewMode: (mode: ViewMode) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  setFontFamily: (fontFamily: FontFamily) => void;
  cycleFontFamily: () => void;
  setFontSize: (fontSize: number) => void;
  toggleParagraphIndent: () => void;
  setSceneTitleMode: (mode: SceneTitleMode) => void;
  toggleSpellCheck: () => void;
}

export interface WritingSlice {
  focusMode: boolean;
  typewriterMode: boolean;
  dimUnfocused: boolean;
  dailyWordGoal: number;
  /** Net words added since the app started (or since the sprint was reset), across all chapters. */
  sessionWords: number;
  /** Net words written per calendar day; saved with the project so the daily goal and streak persist. */
  writingLog: WritingLog;
  /** Word count the next delta is measured against, tied to the file it was taken from. */
  countBaseline: { path: string | null; count: number } | null;
  /** Set before a structural change (restore, delete scene) so it isn't counted as writing. */
  skipNextCountDelta: boolean;
  selectedWordCount: number;
  findReplaceOpen: boolean;
  commandPaletteOpen: boolean;
  goalsModalOpen: boolean;
  compileModalOpen: boolean;
  codexModalOpen: boolean;
  proseAnalysisOpen: boolean;
  settingsOpen: boolean;
  backupsOpen: boolean;
  /** When the open document was last written to disk (epoch ms), for the "Saved" indicator. */
  lastSavedAt: number | null;
  setSettingsOpen: (open: boolean) => void;
  setBackupsOpen: (open: boolean) => void;

  toggleFocusMode: () => void;
  setFocusMode: (val: boolean) => void;
  toggleTypewriterMode: () => void;
  toggleDimUnfocused: () => void;
  setDailyWordGoal: (goal: number) => void;
  resetSessionWords: () => void;
  setSelectedWordCount: (count: number) => void;
  setFindReplaceOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setGoalsModalOpen: (open: boolean) => void;
  setCompileModalOpen: (open: boolean) => void;
  toggleCompileModal: () => void;
  setCodexModalOpen: (open: boolean) => void;
  toggleCodexModal: () => void;
  setProseAnalysisOpen: (open: boolean) => void;
  toggleProseAnalysis: () => void;
}

export type EditorState = DocumentSlice & ProjectSlice & SettingsSlice & WritingSlice;

const initialMarkdown = `# Welcome to Noveler

Start writing your story here. Noveler is a simple, distraction-free editor purpose-built for fiction writers.

**Bold**, *italic*, dialogue tags, and markdown formatting work naturally as you type.

---

## Chapter One

The morning sun cast long shadows across the empty street. She stood at the window, watching, waiting for something she couldn't quite name.

"Are you coming?" he called from the doorway.

She didn't turn around. "In a moment," she said softly.`;

const initialSettings: AppSettings = loadSettings();
setOnlineGrammarEnabled(initialSettings.onlineGrammarCheck);

const updateWindowTitle = async (fileName: string | null, isDirty: boolean) => {
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

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

const countWords = (text: string) => {
  const t = text.trim();
  return t === '' ? 0 : t.split(/\s+/).length;
};

/** Sidebar title for a chapter: its own `# Heading` if it has one, else a name derived from the file. */
const chapterTitleFor = (path: string, markdown: string) =>
  extractChapterHeadingTitle(markdown) || extractChapterDisplayTitle(fileService.extractFileName(path));

/** Fills in a chapter's runtime outline fields (title, scene titles, scene word counts). */
const outlineItem = (item: BinderItem, markdown: string): BinderItem => {
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
const withChapterOutline = (project: NovelProject, path: string, markdown: string): NovelProject => {
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
const PROJECT_SAVE_DEBOUNCE_MS = 500;
let projectSaveTimer: ReturnType<typeof setTimeout> | null = null;
let projectSaveChain: Promise<void> = Promise.resolve();

function writeProjectNow(): Promise<void> {
  const { projectPath, novelProject, writingLog } = useEditorStore.getState();
  if (!projectPath || !novelProject) return projectSaveChain;
  const snapshot: NovelProject = { ...novelProject, writingLog };
  projectSaveChain = projectSaveChain
    .then(() => saveNovelProject(projectPath, snapshot))
    .catch((err) => {
      console.error('Error saving noveler.json:', err);
    });
  return projectSaveChain;
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

export const useEditorStore = create<EditorState>((set, get) => ({
  // --- Document Slice -----------------------------------------------------
  markdownContent: initialMarkdown,
  fileName: null,
  filePath: null,
  isDirty: false,
  wordCount: 0,
  charCount: 0,
  statusMessage: null,
  editorInstance: null,

  setFileName: (fileName) => {
    set({ fileName });
    const { isDirty } = get();
    updateWindowTitle(fileName, isDirty);
  },

  setFilePath: (filePath) => set({ filePath }),

  setDirty: (isDirty) => {
    if (get().isDirty === isDirty) return;
    set({ isDirty });
    const { fileName } = get();
    updateWindowTitle(fileName, isDirty);
  },

  setStatusMessage: (statusMessage) => {
    set({ statusMessage });
    if (statusMessage) {
      setTimeout(() => {
        if (get().statusMessage === statusMessage) {
          set({ statusMessage: null });
        }
      }, 3500);
    }
  },

  updateCounts: (text) => {
    const plainText = text.trim();
    const wordCount = countWords(plainText);
    const charCount = plainText.length;
    const state = get();

    // Words written = change in this file's count since the last measurement. Measuring per file
    // (instead of against a per-file starting point) lets the session and daily totals carry
    // across chapter switches. In a project only manuscript chapters count toward the goal.
    const base = state.countBaseline;
    const isManuscript =
      !state.novelProject || state.novelProject.binder.some((b) => b.path === state.filePath);
    const delta =
      base && base.path === state.filePath && !state.skipNextCountDelta && isManuscript
        ? wordCount - base.count
        : 0;
    const sessionWords = Math.max(0, state.sessionWords + delta);
    const writingLog = addWords(state.writingLog, delta);

    let novelWordCount = wordCount;
    if (state.novelProject && state.novelProject.binder.length > 0) {
      let otherWords = 0;
      let isCurrentAChapter = false;
      for (const item of state.novelProject.binder) {
        if (item.path === state.filePath) {
          isCurrentAChapter = true;
        } else {
          otherWords += item.wordCount || 0;
        }
      }
      novelWordCount = isCurrentAChapter ? otherWords + wordCount : otherWords;
    }

    set({
      wordCount,
      charCount,
      sessionWords,
      writingLog,
      novelWordCount,
      countBaseline: { path: state.filePath, count: wordCount },
      skipNextCountDelta: false,
    });
    if (delta !== 0 && state.projectPath) persistProject();
  },

  setEditorInstance: (editorInstance) => set({ editorInstance }),

  setMarkdownContent: (markdownContent) => {
    const { editorInstance, activeSceneIndex, filePath, activeScenePath, novelProject } = get();
    let cursorIdx = activeSceneIndex;
    if (editorInstance && !editorInstance.isDestroyed) {
      cursorIdx = getSceneIndexAtPosition(editorInstance.state.doc, editorInstance.state.selection.from);
    }

    const targetPath = activeScenePath || filePath;
    if (targetPath && novelProject) {
      set({
        markdownContent,
        activeSceneIndex: cursorIdx,
        novelProject: withChapterOutline(novelProject, targetPath, markdownContent),
      });
    } else {
      set({ markdownContent, activeSceneIndex: cursorIdx });
    }
  },

  confirmDiscardIfDirty: async () => {
    const { isDirty, fileName, filePath, autoSaveEnabled, saveFileAction } = get();
    if (!isDirty) return true;

    // With autosave on, a file that already lives on disk is simply saved: the writer asked for
    // that, and a prompt here only appears because autosave hadn't fired yet (e.g. switching
    // chapters right after typing). Untitled documents still ask.
    if (autoSaveEnabled && filePath && fileService.isTauri()) {
      return await saveFileAction();
    }

    const choice = await fileService.promptUnsavedChanges(fileName);
    if (choice === 'save') return await saveFileAction();
    if (choice === 'discard') {
      clearRecovery();
      return true;
    }
    return false;
  },

  loadDocument: ({ markdown, fileName, filePath, dirty = false, statusMessage }) => {
    const { editorInstance, updateCounts, novelProject } = get();
    const { metadata: frontMatterMeta, body } = parseSceneMarkdown(markdown);

    let resolvedMetadata: SceneMetadata = { ...frontMatterMeta };
    if (novelProject && fileName) {
      const storedMeta =
        novelProject.chapterMetadata?.[fileName] ||
        (filePath ? novelProject.chapterMetadata?.[filePath] : undefined);
      const allProjectItems = [
        ...flattenScenes(novelProject.binder),
        ...flattenScenes(novelProject.extraFiles || []),
      ];
      const binderMatch = allProjectItems.find(
        (s) => s.path === filePath || fileService.extractFileName(s.path) === fileName
      );
      resolvedMetadata = {
        synopsis: storedMeta?.synopsis ?? binderMatch?.synopsis ?? frontMatterMeta.synopsis,
        pov: storedMeta?.pov ?? binderMatch?.pov ?? frontMatterMeta.pov,
        status: storedMeta?.status ?? binderMatch?.status ?? frontMatterMeta.status,
        targetWords: storedMeta?.targetWords ?? binderMatch?.targetWords ?? frontMatterMeta.targetWords,
      };
    }

    // A different document is coming in: its length must not be read as words written.
    set({ countBaseline: null });

    if (editorInstance) {
      editorInstance.commands.setContent(body, { contentType: 'markdown', emitUpdate: false });
      resetEditorHistory(editorInstance);
      updateCounts(editorInstance.getText());
      editorInstance.commands.focus('start');
    } else {
      updateCounts(body);
    }

    set({
      markdownContent: body,
      currentMetadata: resolvedMetadata,
      fileName,
      filePath,
      activeScenePath: filePath,
      activeSceneIndex: 0,
      isDirty: dirty,
      statusMessage: statusMessage ?? null,
      selectedWordCount: 0,
      lastSavedAt: null,
      countBaseline: { path: filePath, count: get().wordCount },
    });
    updateWindowTitle(fileName, dirty);
  },

  newFile: async () => {
    if (get().projectPath) {
      return await get().createChapterAction();
    }
    if (!(await get().confirmDiscardIfDirty())) return false;
    get().loadDocument({
      markdown: '',
      fileName: null,
      filePath: null,
      statusMessage: 'New document created',
    });
    return true;
  },

  openFileAction: async () => {
    try {
      if (!(await get().confirmDiscardIfDirty())) return false;

      const opened = await fileService.openFile();
      if (!opened) return false;

      const path = fileService.isTauri() ? opened.path : null;
      if (path) {
        const updated = addRecentFile(path);
        set({ recentFiles: updated.recentFiles });
      }

      get().loadDocument({
        markdown: opened.content,
        fileName: opened.name,
        filePath: path,
        statusMessage: `Opened ${opened.name}`,
      });
      return true;
    } catch (err) {
      console.error('Error opening file:', err);
      set({ statusMessage: `Error opening file: ${errorMessage(err)}` });
      return false;
    }
  },

  openFileByPath: async (path: string) => {
    try {
      if (!fileService.isSupportedTextFile(path)) {
        get().setStatusMessage(`Can't open ${fileService.extractFileName(path)}: unsupported file type`);
        return false;
      }
      if (path === get().filePath) return true;
      if (!(await get().confirmDiscardIfDirty())) return false;

      const opened = await fileService.readFileDirect(path);
      const updated = addRecentFile(path);
      set({ recentFiles: updated.recentFiles });

      get().loadDocument({
        markdown: opened.content,
        fileName: opened.name,
        filePath: opened.path,
        statusMessage: `Opened ${opened.name}`,
      });
      return true;
    } catch (err) {
      console.error('Error opening file by path:', err);
      set({ statusMessage: `Error opening file: ${errorMessage(err)}` });
      return false;
    }
  },

  saveFileAction: async () => {
    const { filePath, fileName, editorInstance, saveFileAsAction, currentMetadata, projectPath, novelProject } = get();
    if (!filePath) {
      return await saveFileAsAction();
    }

    try {
      const body = editorInstance ? editorInstance.getMarkdown() : get().markdownContent;
      // Per GUIDE.md: Save clean standard markdown without YAML front-matter
      await fileService.saveFile(filePath, body);

      // Persist metadata cleanly into novelProject / noveler.json (scene titles remain in markdown only)
      // (Re-read the project: it may have changed while the file was being written.)
      const latestProject = get().novelProject;
      if (projectPath && novelProject && latestProject && fileName) {
        const previousMeta = latestProject.chapterMetadata?.[fileName];
        const metaChanged = JSON.stringify(previousMeta ?? {}) !== JSON.stringify(currentMetadata ?? {});
        set({
          novelProject: {
            ...withChapterOutline(latestProject, filePath, body),
            chapterMetadata: { ...(latestProject.chapterMetadata || {}), [fileName]: currentMetadata },
          },
        });
        if (metaChanged) persistProject();
      }

      const updated = addRecentFile(filePath);

      // Autosave is routine: the status bar's "Saved" time covers it without a message each time.
      set({
        markdownContent: body,
        isDirty: false,
        recentFiles: updated.recentFiles,
        lastSavedAt: Date.now(),
      });

      updateWindowTitle(fileName, false);
      return true;
    } catch (err) {
      console.error('Error saving file:', err);
      set({ statusMessage: `Error saving file: ${errorMessage(err)}` });
      return false;
    }
  },

  saveFileAsAction: async () => {
    const { fileName, editorInstance, refreshProjectFiles } = get();
    try {
      const body = editorInstance ? editorInstance.getMarkdown() : get().markdownContent;
      const defaultName = fileName || '01-chapter.md';
      const saved = await fileService.saveFileAs(body, defaultName);
      if (!saved) return false;

      const path = fileService.isTauri() ? saved.path : null;
      if (path) {
        const updated = addRecentFile(path);
        set({ recentFiles: updated.recentFiles });
      }

      set({
        filePath: path,
        fileName: saved.name,
        activeScenePath: path,
        markdownContent: body,
        isDirty: false,
        statusMessage: `Saved as ${saved.name}`,
      });

      updateWindowTitle(saved.name, false);
      void refreshProjectFiles();
      return true;
    } catch (err) {
      console.error('Error saving file as:', err);
      set({ statusMessage: `Error saving file: ${errorMessage(err)}` });
      return false;
    }
  },

  exportDocxAction: async () => {
    const { editorInstance, fileName, setStatusMessage } = get();
    try {
      const docInput: JSONContent | string = editorInstance
        ? editorInstance.getJSON()
        : get().markdownContent;

      const { exportToDocx } = await import('../export/docx');
      const saved = await exportToDocx(docInput, fileName || 'manuscript.docx');
      if (saved) setStatusMessage(`Exported ${saved.name}`);
    } catch (err) {
      console.error('Error exporting DOCX:', err);
      setStatusMessage(`Export failed: ${errorMessage(err)}`);
    }
  },

  printAction: () => {
    const { editorInstance, sceneTitleMode } = get();
    const markdown = editorInstance ? editorInstance.getMarkdown() : get().markdownContent;
    exportToPdf(markdown, sceneTitleMode);
  },

  // --- Project Slice ------------------------------------------------------
  projectPath: initialSettings.lastProjectPath,
  projectName: null,
  projectFiles: [],
  novelProject: null,
  activeScenePath: null,
  activeSceneIndex: 0,
  currentMetadata: {},
  novelWordCount: 0,
  scratchpadContent: '',
  tagCategories: ['characters', 'locations', 'items', 'scenes'],
  tagAssignments: {},
  corkboardOpen: false,
  inspectorOpen: false,
  scriveningsMode: false,

  openProjectFolderAction: async () => {
    try {
      if (!(await get().confirmDiscardIfDirty())) return false;
      const res = await fileService.openFolder();
      if (!res) return false;
      return await get().loadProjectByPath(res.path);
    } catch (err) {
      console.error('Error opening project folder:', err);
      set({ statusMessage: `Error opening folder: ${errorMessage(err)}` });
      return false;
    }
  },

  loadProjectByPath: async (path: string) => {
    try {
      // Finish writing the project we're leaving before reading the next one.
      await flushProjectSave();
      await fileService.setProjectRoot(path);
      const project = await loadNovelProject(path);
      const scratchpadText = await loadScratchpadFile(path);
      set({ recentProjects: addRecentProject(path).recentProjects });
      const name = fileService.extractFileName(path);

      let totalWords = 0;
      for (const item of project.binder) {
        try {
          const f = await fileService.readFileDirect(item.path);
          const words = countWords(f.content);
          Object.assign(item, outlineItem(item, f.content));
          item.wordCount = words;
          totalWords += words;
        } catch {
          // ignore
        }
      }

      set({
        projectPath: path,
        projectName: project.title || name,
        novelProject: project,
        novelWordCount: totalWords,
        writingLog: project.writingLog || {},
        scratchpadContent: scratchpadText,
        tagCategories: project.tagCategories || ['characters', 'locations', 'items', 'scenes'],
        tagAssignments: project.tagAssignments || {},
        sidebarOpen: true,
        statusMessage: `Opened folder: ${project.title || name}`,
      });

      // Load first chapter if current document is empty or not in this project
      if (project.binder.length > 0) {
        const scenes = flattenScenes(project.binder);
        const currentInProject = scenes.some((s) => s.path === get().filePath);
        if (!currentInProject && scenes.length > 0) {
          void get().loadSceneByPath(scenes[0].path);
        }
      }
      return true;
    } catch (err) {
      console.error('Error loading project:', err);
      set({ statusMessage: `Error loading project: ${errorMessage(err)}` });
      return false;
    }
  },

  refreshProjectFiles: async () => {
    if (!get().projectPath) return;
    try {
      // The project is re-read from disk below, so pending changes must be written first.
      await flushProjectSave();
      const { projectPath, filePath, wordCount, markdownContent } = get();
      if (!projectPath) return;
      const project = await loadNovelProject(projectPath);
      let totalWords = 0;
      for (const item of project.binder) {
        if (item.path === filePath) {
          Object.assign(item, outlineItem(item, markdownContent));
          item.wordCount = wordCount;
          totalWords += wordCount;
        } else {
          try {
            const f = await fileService.readFileDirect(item.path);
            const words = countWords(f.content);
            Object.assign(item, outlineItem(item, f.content));
            item.wordCount = words;
            totalWords += words;
          } catch {
            // ignore
          }
        }
      }
      set({ novelProject: project, novelWordCount: totalWords });
    } catch {
      // ignore
    }
  },

  createChapterAction: async (customTitle?: string) => {
    try {
      const { projectPath, novelProject, confirmDiscardIfDirty, refreshProjectFiles } = get();
      if (!projectPath) return false;
      if (!(await confirmDiscardIfDirty())) return false;

      const existingNames = (novelProject?.binder || []).map((b) => fileService.extractFileName(b.path));
      const res = await createSequentialChapter(projectPath, existingNames, customTitle);
      await refreshProjectFiles();
      await get().loadSceneByPath(res.path);
      set({ statusMessage: `Created ${res.name}` });
      return true;
    } catch (err) {
      console.error('Error creating chapter:', err);
      set({ statusMessage: `Error creating chapter: ${errorMessage(err)}` });
      return false;
    }
  },

  createExtraFileAction: async (titleInput?: string) => {
    try {
      const { projectPath, novelProject, confirmDiscardIfDirty, refreshProjectFiles } = get();
      if (!projectPath) return false;
      if (!(await confirmDiscardIfDirty())) return false;

      const existingNames = [
        ...(novelProject?.binder || []),
        ...(novelProject?.extraFiles || []),
      ].map((b) => fileService.extractFileName(b.path));
      const res = await createExtraFile(projectPath, existingNames, titleInput);
      await refreshProjectFiles();
      await get().loadSceneByPath(res.path);
      set({ statusMessage: `Created ${res.name}` });
      return true;
    } catch (err) {
      console.error('Error creating file:', err);
      set({ statusMessage: `Error creating file: ${errorMessage(err)}` });
      return false;
    }
  },

  createSceneAction: async (_parentFolder: string, title: string) => {
    return await get().createChapterAction(title);
  },

  createFolderAction: async (_parentFolder: string, name: string) => {
    return await get().createChapterAction(name);
  },

  renameBinderItemAction: async (oldPath: string, newTitle: string) => {
    try {
      const { refreshProjectFiles, novelProject, projectPath } = get();
      const safeTitle = newTitle.trim();
      if (!safeTitle) return false;

      // A chapter's name is its own `# Heading`. Renaming a chapter rewrites that heading and
      // leaves the file name alone, so backups, snapshots and git history stay attached to it.
      const isChapter = Boolean(novelProject?.binder.some((b) => b.path === oldPath));
      if (isChapter) {
        const { filePath, editorInstance, markdownContent } = get();
        if (oldPath === filePath) {
          if (editorInstance && !editorInstance.isDestroyed) {
            // Goes through the editor, so it is undoable and autosaves like any other edit.
            setChapterTitleInEditor(editorInstance, safeTitle);
            get().setMarkdownContent(editorInstance.getMarkdown());
          } else {
            get().setMarkdownContent(setChapterHeadingTitle(markdownContent, safeTitle));
            get().setDirty(true);
            if (get().autoSaveEnabled && fileService.isTauri()) void get().saveFileAction();
          }
        } else {
          const file = await fileService.readFileDirect(oldPath);
          const nextMarkdown = setChapterHeadingTitle(file.content, safeTitle);
          await fileService.saveFile(oldPath, nextMarkdown);
          const latest = get().novelProject;
          if (latest) set({ novelProject: withChapterOutline(latest, oldPath, nextMarkdown) });
        }
        set({ statusMessage: `Renamed chapter to "${safeTitle}"` });
        return true;
      }

      // Notes and other files are named after their file, so renaming them renames the file.
      const parent = oldPath.substring(0, Math.max(oldPath.lastIndexOf('/'), oldPath.lastIndexOf('\\')));
      const sep = oldPath.includes('/') ? '/' : '\\';
      const oldName = fileService.extractFileName(oldPath);
      const newName = buildRenamedChapterFileName(oldName, safeTitle);
      const newPath = `${parent}${sep}${newName}`;
      if (newPath === oldPath) return true;

      // Make sure the latest text is on disk under the old name before the file moves.
      if (get().filePath === oldPath && get().isDirty) {
        if (!(await get().saveFileAction())) return false;
      }
      await fileService.renamePath(oldPath, newPath);

      const current = get().novelProject;
      if (current && projectPath) {
        const nextChapterMeta = { ...(current.chapterMetadata || {}) };
        if (nextChapterMeta[oldName]) {
          nextChapterMeta[newName] = nextChapterMeta[oldName];
          delete nextChapterMeta[oldName];
        }
        const snapshots = current.snapshots || [];
        const nextSnapshots = snapshots.map((s) =>
          s.scenePath === oldPath ? { ...s, scenePath: newPath } : s
        );
        const displayTitle = extractChapterDisplayTitle(newName);
        set({
          novelProject: {
            ...current,
            extraFiles: (current.extraFiles || []).map((b) =>
              b.path === oldPath ? { ...b, path: newPath, title: displayTitle } : b
            ),
            chapterMetadata: nextChapterMeta,
            snapshots: nextSnapshots,
          },
        });
        persistProject();
        if (snapshots.some((s) => s.scenePath === oldPath)) {
          await saveSnapshots(projectPath, nextSnapshots);
        }
      }

      if (get().filePath === oldPath) {
        set({
          filePath: newPath,
          fileName: newName,
          activeScenePath: newPath,
          countBaseline: { path: newPath, count: get().wordCount },
        });
        updateWindowTitle(newName, get().isDirty);
      }
      await refreshProjectFiles();
      set({ statusMessage: `Renamed to "${newName}"` });
      return true;
    } catch (err) {
      console.error('Error renaming item:', err);
      set({ statusMessage: `Error renaming: ${errorMessage(err)}` });
      return false;
    }
  },

  deleteBinderItemAction: async (path: string) => {
    try {
      const { refreshProjectFiles, projectPath } = get();
      if (!projectPath) return false;

      // Save first so the copy that lands in the graveyard is the latest text.
      if (get().filePath === path && get().isDirty) {
        if (!(await get().confirmDiscardIfDirty())) return false;
      }

      // Nothing is destroyed: the file moves to graveyard/ under a timestamped name.
      const moved = await moveFileToGraveyard(projectPath, path);

      const current = get().novelProject;
      if (current) {
        const deletedName = fileService.extractFileName(path);
        const nextChapterMeta = { ...(current.chapterMetadata || {}) };
        delete nextChapterMeta[deletedName];
        set({
          novelProject: {
            ...current,
            binder: current.binder.filter((b) => b.path !== path),
            extraFiles: (current.extraFiles || []).filter((b) => b.path !== path),
            chapterMetadata: nextChapterMeta,
          },
        });
        persistProject();
      }

      if (get().filePath === path) {
        get().loadDocument({ markdown: '', fileName: null, filePath: null });
      }
      await refreshProjectFiles();
      set({ statusMessage: `Moved to graveyard/${moved.fileName}` });
      return true;
    } catch (err) {
      console.error('Error deleting item:', err);
      set({ statusMessage: `Error deleting: ${errorMessage(err)}` });
      return false;
    }
  },

  reorderBinderItemsAction: async (fromIndex: number, toIndex: number) => {
    const { novelProject, projectPath } = get();
    if (!novelProject || !projectPath) return false;
    const items = [...novelProject.binder];
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= items.length ||
      toIndex >= items.length
    ) {
      return false;
    }

    // The order lives in noveler.json. Chapter files keep their names and contents untouched,
    // so reordering can't break backups, snapshots, git history, or an open editor.
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    set({ novelProject: { ...novelProject, binder: items }, statusMessage: 'Reordered chapters' });
    persistProject();
    return true;
  },

  updateSceneMetadata: (partial: Partial<SceneMetadata>) => {
    const { activeScenePath, filePath } = get();
    const targetPath = activeScenePath || filePath;
    if (targetPath) {
      get().updateSceneMetadataByPath(targetPath, partial);
    } else {
      const nextMeta = { ...get().currentMetadata, ...partial };
      set({ currentMetadata: nextMeta, isDirty: true });
    }
  },

  updateSceneMetadataByPath: (scenePath: string, partial: Partial<SceneMetadata>) => {
    const { novelProject, projectPath, activeScenePath, filePath, currentMetadata } = get();
    const isCurrent = scenePath === activeScenePath || scenePath === filePath;
    const sceneFileName = fileService.extractFileName(scenePath);

    if (isCurrent) {
      set({ currentMetadata: { ...currentMetadata, ...partial } });
    }

    if (novelProject && projectPath) {
      const updateItem = (item: BinderItem) => {
        if (item.path === scenePath) {
          return {
            ...item,
            synopsis: partial.synopsis !== undefined ? partial.synopsis : item.synopsis,
            pov: partial.pov !== undefined ? partial.pov : item.pov,
            status: partial.status !== undefined ? partial.status : item.status,
            targetWords: partial.targetWords !== undefined ? partial.targetWords : item.targetWords,
          };
        }
        return item;
      };
      const updatedBinder = novelProject.binder.map(updateItem);
      const updatedExtras = (novelProject.extraFiles || []).map(updateItem);

      const prevFileMeta = novelProject.chapterMetadata?.[sceneFileName] || {};
      const nextFileMeta: SceneMetadata = {
        ...prevFileMeta,
        ...(isCurrent ? currentMetadata : {}),
        ...partial,
      };

      const updatedProject: NovelProject = {
        ...novelProject,
        binder: updatedBinder,
        extraFiles: updatedExtras,
        chapterMetadata: {
          ...(novelProject.chapterMetadata || {}),
          [sceneFileName]: nextFileMeta,
        },
      };

      set({ novelProject: updatedProject });
      persistProject();
    }
  },

  updateSceneNotesAction: (chapterPath, sceneIndex, partial) => {
    const { novelProject } = get();
    if (!novelProject) return;
    const next = withSceneMeta(novelProject, chapterPath, sceneIndex, partial);
    if (next === novelProject) return;
    set({ novelProject: next });
    persistProject();
  },

  setActiveSceneIndex: (activeSceneIndex: number) => {
    if (get().activeSceneIndex !== activeSceneIndex) {
      set({ activeSceneIndex });
    }
  },

  jumpToSceneAction: async (chapterPath: string, sceneIndex: number) => {
    if (chapterPath && chapterPath !== get().filePath) {
      const loaded = await get().loadSceneByPath(chapterPath);
      if (!loaded) return;
    }

    set({ activeSceneIndex: sceneIndex });

    const { editorInstance } = get();
    if (editorInstance && !editorInstance.isDestroyed) {
      const pos = findScenePositionInDoc(editorInstance.state.doc, sceneIndex);
      editorInstance.chain().focus().setTextSelection(pos).scrollIntoView().run();
      try {
        const domAt = editorInstance.view.domAtPos(pos);
        const el =
          domAt.node instanceof HTMLElement
            ? domAt.node
            : domAt.node.parentElement;
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } catch {
        // ignore in non-DOM test environments
      }
    }

    // Also scroll Preview pane if open
    if (typeof document !== 'undefined') {
      const previewContainer = document.querySelector('.preview-content');
      if (previewContainer) {
        const h2s = previewContainer.querySelectorAll('.fiction-manuscript h2');
        const targetH2 = h2s[sceneIndex];
        const targetNode =
          targetH2 && window.getComputedStyle(targetH2).display === 'none'
            ? targetH2.nextElementSibling || targetH2
            : targetH2;
        if (targetNode && typeof targetNode.scrollIntoView === 'function') {
          targetNode.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (sceneIndex <= 0) {
          previewContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    }
  },

  renameChapterSceneAction: (chapterPath: string, sceneIndex: number, newTitle: string) => {
    const { filePath, activeScenePath, editorInstance, markdownContent, novelProject, updateCounts } = get();
    const isCurrent = !chapterPath || chapterPath === filePath || chapterPath === activeScenePath;

    // With a live editor the heading is edited in place: one precise undo step, cursor untouched.
    // The editor's own update handler then marks the file dirty, syncs the outline and autosaves.
    if (isCurrent && editorInstance && !editorInstance.isDestroyed) {
      renameSceneInEditor(editorInstance, sceneIndex, newTitle);
      return;
    }

    if (isCurrent) {
      const currentMd = editorInstance ? editorInstance.getMarkdown() : markdownContent;
      const nextMarkdown = updateSceneTitleAtIndex(currentMd, sceneIndex, newTitle);
      if (nextMarkdown === currentMd) return;

      if (editorInstance && !editorInstance.isDestroyed) {
        editorInstance.commands.setContent(nextMarkdown, { contentType: 'markdown', emitUpdate: false });
        updateCounts(editorInstance.getText());
      } else {
        updateCounts(nextMarkdown);
      }

      const targetPath = chapterPath || filePath;
      const parsedScenes = extractSceneTitlesFromMarkdown(nextMarkdown);
      set({
        markdownContent: nextMarkdown,
        ...(targetPath && novelProject
          ? {
              novelProject: {
                ...novelProject,
                binder: novelProject.binder.map((b) =>
                  b.path === targetPath ? { ...b, scenes: parsedScenes } : b
                ),
              },
            }
          : {}),
      });
      get().setDirty(true);

      if (targetPath && get().autoSaveEnabled && fileService.isTauri()) {
        void get().saveFileAction();
      }
      return;
    }

    // Renaming a scene in a non-active chapter file on disk
    void (async () => {
      try {
        const file = await fileService.readFileDirect(chapterPath);
        const nextMarkdown = updateSceneTitleAtIndex(file.content, sceneIndex, newTitle);
        await fileService.saveFile(chapterPath, nextMarkdown);
        const latestProject = get().novelProject;
        if (latestProject) {
          set({ novelProject: withChapterOutline(latestProject, chapterPath, nextMarkdown) });
        }
      } catch (err) {
        console.error('Error renaming chapter scene:', err);
      }
    })();
  },

  addSceneToChapterAction: async (chapterPath: string, customTitle?: string) => {
    if (chapterPath && chapterPath !== get().filePath) {
      const loaded = await get().loadSceneByPath(chapterPath);
      if (!loaded) return -1;
    }
    const { editorInstance, markdownContent } = get();
    const currentMd = editorInstance ? editorInstance.getMarkdown() : markdownContent;
    const totalScenes = countScenesInMarkdown(currentMd);
    return await get().insertSceneAfterAction(chapterPath, totalScenes - 1, customTitle);
  },

  insertSceneAfterAction: async (chapterPath: string, afterSceneIndex: number, customTitle?: string) => {
    if (chapterPath && chapterPath !== get().filePath) {
      const loaded = await get().loadSceneByPath(chapterPath);
      if (!loaded) return -1;
    }

    const { editorInstance, markdownContent, filePath, updateCounts } = get();

    if (editorInstance && !editorInstance.isDestroyed) {
      const insertedIndex = insertSceneInEditor(editorInstance, afterSceneIndex, customTitle);
      if (insertedIndex < 0) return -1;
      get().setMarkdownContent(editorInstance.getMarkdown());
      await get().jumpToSceneAction(chapterPath || filePath || '', insertedIndex);
      return insertedIndex;
    }

    const currentMd = editorInstance ? editorInstance.getMarkdown() : markdownContent;
    const { markdown: nextMarkdown, newSceneIndex } = insertSceneAfterIndex(
      currentMd,
      afterSceneIndex,
      customTitle
    );

    if (editorInstance && !editorInstance.isDestroyed) {
      editorInstance.commands.setContent(nextMarkdown, { contentType: 'markdown', emitUpdate: false });
      updateCounts(editorInstance.getText());
    } else {
      updateCounts(nextMarkdown);
    }

    const targetPath = chapterPath || filePath;
    const parsedScenes = extractSceneTitlesFromMarkdown(nextMarkdown);
    const { novelProject } = get();

    set({
      markdownContent: nextMarkdown,
      activeSceneIndex: newSceneIndex,
      ...(targetPath && novelProject
        ? {
            novelProject: {
              ...novelProject,
              binder: novelProject.binder.map((b) =>
                b.path === targetPath ? { ...b, scenes: parsedScenes } : b
              ),
            },
          }
        : {}),
    });
    get().setDirty(true);

    if (targetPath && get().autoSaveEnabled && fileService.isTauri()) {
      void get().saveFileAction();
    }

    await get().jumpToSceneAction(targetPath || '', newSceneIndex);
    return newSceneIndex;
  },

  reorderChapterScenesAction: async (chapterPath: string, fromIndex: number, toIndex: number) => {
    const { filePath, activeScenePath, editorInstance, markdownContent, novelProject, updateCounts } = get();
    const isCurrent = !chapterPath || chapterPath === filePath || chapterPath === activeScenePath;

    if (isCurrent && editorInstance && !editorInstance.isDestroyed) {
      if (!moveSceneInEditor(editorInstance, fromIndex, toIndex)) return false;
      get().setMarkdownContent(editorInstance.getMarkdown());
      set({ activeSceneIndex: toIndex });
      return true;
    }

    if (isCurrent) {
      const currentMd = editorInstance ? editorInstance.getMarkdown() : markdownContent;
      const nextMarkdown = reorderChapterScenes(currentMd, fromIndex, toIndex);
      if (nextMarkdown === currentMd && fromIndex === toIndex) return false;

      if (editorInstance && !editorInstance.isDestroyed) {
        editorInstance.commands.setContent(nextMarkdown, { contentType: 'markdown', emitUpdate: false });
        updateCounts(editorInstance.getText());
      } else {
        updateCounts(nextMarkdown);
      }

      const targetPath = chapterPath || filePath;
      const parsedScenes = extractSceneTitlesFromMarkdown(nextMarkdown);
      set({
        markdownContent: nextMarkdown,
        activeSceneIndex: toIndex,
        ...(targetPath && novelProject
          ? {
              novelProject: {
                ...novelProject,
                binder: novelProject.binder.map((b) =>
                  b.path === targetPath ? { ...b, scenes: parsedScenes } : b
                ),
              },
            }
          : {}),
      });
      get().setDirty(true);

      if (targetPath && get().autoSaveEnabled && fileService.isTauri()) {
        void get().saveFileAction();
      }
      return true;
    }

    // Reordering scenes in a non-active chapter file on disk
    try {
      const file = await fileService.readFileDirect(chapterPath);
      const nextMarkdown = reorderChapterScenes(file.content, fromIndex, toIndex);
      await fileService.saveFile(chapterPath, nextMarkdown);
      const latestProject = get().novelProject;
      if (latestProject) {
        set({ novelProject: withChapterOutline(latestProject, chapterPath, nextMarkdown) });
      }
      return true;
    } catch (err) {
      console.error('Error reordering chapter scenes:', err);
      return false;
    }
  },

  insertFileAsSceneAction: async (notePath: string, chapterPath: string) => {
    try {
      const { projectPath } = get();
      if (!projectPath || notePath === chapterPath) return false;

      // Latest text of the note, saved to disk if it is the open document.
      if (get().filePath === notePath && get().isDirty) {
        if (!(await get().saveFileAction())) return false;
      }
      const note = await fileService.readFileDirect(notePath);
      const { body: noteBody } = parseSceneMarkdown(note.content);
      const rawTitle =
        extractChapterHeadingTitle(noteBody) ||
        extractChapterDisplayTitle(fileService.extractFileName(notePath));
      const title = rawTitle.replace(/^scenes?\b[\s:\-–—]*/i, '').trim() || rawTitle;
      const text = noteBody.replace(/^\s*#[ \t]+.*(?:\r?\n|$)/, '').trim();
      const sceneMarkdown = text ? `## ${title}\n\n${text}\n` : `## ${title}\n`;

      if (!(await get().loadSceneByPath(chapterPath))) return false;
      const { editorInstance, markdownContent } = get();

      // Text moved in from a note was not written today.
      set({ skipNextCountDelta: true });
      if (editorInstance && !editorInstance.isDestroyed) {
        if (!appendMarkdownInEditor(editorInstance, sceneMarkdown)) return false;
        get().setMarkdownContent(editorInstance.getMarkdown());
      } else {
        const joined = `${markdownContent.replace(/\s+$/, '')}\n\n${sceneMarkdown}`;
        get().setMarkdownContent(joined);
        get().updateCounts(joined);
        get().setDirty(true);
      }
      // The chapter now holds the text: save it before the note leaves the folder.
      if (fileService.isTauri() && !(await get().saveFileAction())) return false;

      const moved = await moveFileToGraveyard(projectPath, notePath);
      await get().refreshProjectFiles();

      const total = countScenesInMarkdown(get().markdownContent);
      await get().jumpToSceneAction(chapterPath, Math.max(0, total - 1));
      get().setStatusMessage(`Added "${title}" as a scene; the note is kept in graveyard/${moved.fileName}`);
      return true;
    } catch (err) {
      console.error('Error inserting note as scene:', err);
      get().setStatusMessage(`Could not insert note: ${errorMessage(err)}`);
      return false;
    }
  },

  extractSceneToFileAction: async (chapterPath: string, sceneIndex: number) => {
    try {
      const { projectPath } = get();
      if (!projectPath) return false;
      if (chapterPath !== get().filePath && !(await get().loadSceneByPath(chapterPath))) return false;

      const { editorInstance, markdownContent, novelProject } = get();
      const md =
        editorInstance && !editorInstance.isDestroyed ? editorInstance.getMarkdown() : markdownContent;
      const scene = splitChapterIntoScenes(md).scenes[sceneIndex];
      if (!scene) return false;
      const title = scene.title.trim() || `Scene ${sceneIndex + 1}`;

      // Write the scene to its own standard Markdown file first...
      const existingNames = [...(novelProject?.binder || []), ...(novelProject?.extraFiles || [])].map((b) =>
        fileService.extractFileName(b.path)
      );
      const created = await createExtraFile(projectPath, existingNames, `scene ${title}`);
      await fileService.saveFile(created.path, `# ${title}\n\n${scene.body}\n`);

      // ...then take it out of the chapter (no graveyard copy needed: the file is the copy).
      if (!(await get().deleteSceneFromChapterAction(chapterPath, sceneIndex, { archive: false }))) {
        return false;
      }
      if (fileService.isTauri()) await get().saveFileAction();
      await get().refreshProjectFiles();
      get().setStatusMessage(`Moved scene "${title}" to Other Files as ${created.name}`);
      return true;
    } catch (err) {
      console.error('Error extracting scene:', err);
      get().setStatusMessage(`Could not extract scene: ${errorMessage(err)}`);
      return false;
    }
  },

  deleteSceneFromChapterAction: async (
    chapterPath: string,
    sceneIndex: number,
    options?: { archive?: boolean }
  ) => {
    const archive = options?.archive !== false;
    {
      const before = get();
      const isCurrent =
        !chapterPath || chapterPath === before.filePath || chapterPath === before.activeScenePath;
      if (!isCurrent) {
        const loaded = await get().loadSceneByPath(chapterPath);
        if (!loaded) return false;
      }
    }

    const { filePath, editorInstance, markdownContent, updateCounts, projectPath } = get();
    const hasEditor = Boolean(editorInstance && !editorInstance.isDestroyed);
    const currentMd = hasEditor ? editorInstance!.getMarkdown() : markdownContent;

    // Keep the removed scene: it goes to graveyard/ as an ordinary Markdown file.
    const removed = splitChapterIntoScenes(currentMd).scenes[sceneIndex];
    if (!removed) return false;
    if (archive && projectPath && removed.body.trim()) {
      const title = removed.title.trim() || `Scene ${sceneIndex + 1}`;
      try {
        await archiveTextToGraveyard(projectPath, title, `## ${title}\n\n${removed.body}\n`);
      } catch (err) {
        console.error('Could not archive scene before deleting:', err);
        get().setStatusMessage(`Scene not deleted: could not archive it (${errorMessage(err)})`);
        return false;
      }
    }

    // Cutting a scene is not "negative writing" for the daily goal.
    set({ skipNextCountDelta: true });

    if (hasEditor) {
      if (!deleteSceneInEditor(editorInstance!, sceneIndex)) return false;
      const md = editorInstance!.getMarkdown();
      get().setMarkdownContent(md);
      const remaining = countScenesInMarkdown(md);
      set({ activeSceneIndex: Math.max(0, Math.min(sceneIndex, remaining - 1)) });
      if (archive && projectPath) {
        get().setStatusMessage('Scene moved to graveyard (Ctrl+Z restores it here)');
      }
      return true;
    }

    const nextMarkdown = deleteSceneFromChapter(currentMd, sceneIndex);

    if (editorInstance && !editorInstance.isDestroyed) {
      editorInstance.commands.setContent(nextMarkdown, { contentType: 'markdown', emitUpdate: false });
      updateCounts(editorInstance.getText());
    } else {
      updateCounts(nextMarkdown);
    }

    const parsedScenes = extractSceneTitlesFromMarkdown(nextMarkdown);
    const nextActiveIdx = Math.max(0, Math.min(sceneIndex, Math.max(0, parsedScenes.length - 1)));
    const targetPath = chapterPath || filePath;
    const { novelProject } = get();

    set({
      markdownContent: nextMarkdown,
      activeSceneIndex: nextActiveIdx,
      ...(targetPath && novelProject
        ? {
            novelProject: {
              ...novelProject,
              binder: novelProject.binder.map((b) =>
                b.path === targetPath ? { ...b, scenes: parsedScenes } : b
              ),
            },
          }
        : {}),
    });
    get().setDirty(true);

    if (targetPath && get().autoSaveEnabled && fileService.isTauri()) {
      void get().saveFileAction();
    }
    return true;
  },

  addCustomDictionaryWordAction: async (word: string) => {
    const clean = word.trim().toLowerCase();
    if (!clean) return;
    const { novelProject, projectPath } = get();
    if (!novelProject || !projectPath) return;
    const existing = novelProject.customDictionary || [];
    if (existing.includes(clean)) return;
    const updatedProject: NovelProject = {
      ...novelProject,
      customDictionary: [...existing, clean],
    };
    set({ novelProject: updatedProject, statusMessage: `Added "${word.trim()}" to project dictionary` });
    persistProject();
  },

  saveProjectConfigAction: async () => {
    const { projectPath, novelProject } = get();
    if (!projectPath || !novelProject) return;
    persistProject();
    await flushProjectSave();
  },

  setScratchpadContent: (content: string) => {
    set({ scratchpadContent: content });
    const { projectPath } = get();
    if (projectPath) {
      void saveScratchpadFile(projectPath, content);
    }
  },

  appendToScratchpadAction: (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const current = get().scratchpadContent.replace(/\s+$/, '');
    get().setScratchpadContent(current ? `${current}\n\n${clean}\n` : `${clean}\n`);
    get().setStatusMessage('Moved to scratchpad');
  },

  replaceDocumentTextAction: (markdown: string, message: string) => {
    const { editorInstance, setMarkdownContent, updateCounts, setDirty, setStatusMessage } = get();
    // Bringing back an old version is not words written today.
    set({ skipNextCountDelta: true });
    setMarkdownContent(markdown);
    if (editorInstance && !editorInstance.isDestroyed) {
      editorInstance.commands.setContent(markdown, { contentType: 'markdown', emitUpdate: false });
      updateCounts(editorInstance.getText());
    } else {
      updateCounts(markdown);
    }
    setDirty(true);
    setStatusMessage(message);
    if (get().filePath && get().autoSaveEnabled && fileService.isTauri()) void get().saveFileAction();
  },

  copyContextPackAction: async () => {
    const { novelProject, filePath, activeSceneIndex, editorInstance, markdownContent } = get();
    if (!novelProject) {
      get().setStatusMessage('Open a novel folder to build a context pack');
      return false;
    }
    try {
      const hasEditor = Boolean(editorInstance && !editorInstance.isDestroyed);
      const md = hasEditor ? editorInstance!.getMarkdown() : markdownContent;
      const isChapter = novelProject.binder.some((b) => b.path === filePath);
      const scene = isChapter ? splitChapterIntoScenes(md).scenes[activeSceneIndex] : undefined;
      const currentText = scene ? `### ${scene.title || `Scene ${activeSceneIndex + 1}`}\n\n${scene.body}` : isChapter ? md : '';

      let selection = '';
      if (hasEditor) {
        const { from, to } = editorInstance!.state.selection;
        if (from !== to) selection = editorInstance!.state.doc.textBetween(from, to, '\n\n');
      }

      // World notes: files whose names say they hold the world, cast or lore.
      const notes: { title: string; markdown: string }[] = [];
      for (const file of novelProject.extraFiles || []) {
        if (!/wiki|world|character|cast|bible|lore|glossary/i.test(fileService.extractFileName(file.path))) continue;
        try {
          const content =
            file.path === filePath ? md : (await fileService.readFileDirect(file.path)).content;
          notes.push({ title: file.title, markdown: content });
        } catch {
          // skip unreadable notes
        }
      }

      const pack = buildContextPack({
        project: novelProject,
        activePath: filePath,
        activeSceneIndex,
        currentText,
        selection,
        notes,
      });
      await navigator.clipboard.writeText(pack);
      get().setStatusMessage(
        `Copied context to the clipboard (${countWords(pack).toLocaleString()} words): paste it into your assistant`
      );
      return true;
    } catch (err) {
      console.error('Error building context pack:', err);
      get().setStatusMessage(`Could not copy context: ${errorMessage(err)}`);
      return false;
    }
  },

  applyWikiImportAction: async (plan: WikiImportPlan) => {
    const { novelProject } = get();
    if (!novelProject) return 0;
    const stamp = Date.now();
    const added: CodexEntry[] = plan.toAdd.map((p, i) => ({
      id: `codex_${stamp}_${i}_${Math.random().toString(36).slice(2, 7)}`,
      name: p.name,
      category: p.category,
      aliases: p.aliases,
      summary: p.summary,
      description: p.description,
    }));
    const updates = new Map(plan.toUpdate.map((u) => [u.existing.id, u.parsed]));
    const codex = (novelProject.codex || []).map((entry) => {
      const parsed = updates.get(entry.id);
      if (!parsed) return entry;
      // Fill gaps only: anything the writer already typed is kept.
      return {
        ...entry,
        summary: entry.summary?.trim() ? entry.summary : parsed.summary,
        description: entry.description?.trim() ? entry.description : parsed.description,
        aliases: Array.from(new Set([...(entry.aliases || []), ...parsed.aliases])),
      };
    });
    set({ novelProject: { ...novelProject, codex: [...codex, ...added] } });
    persistProject();
    const total = added.length + updates.size;
    get().setStatusMessage(`Story bible: ${added.length} added, ${updates.size} filled in`);
    return total;
  },

  flushScratchpadAction: async () => {
    const { projectPath, scratchpadContent } = get();
    if (!projectPath) {
      get().setStatusMessage('Open a novel folder to flush scratchpad to graveyard');
      return false;
    }
    if (!scratchpadContent.trim()) return false;

    try {
      const res = await flushScratchpadToGraveyard(projectPath, scratchpadContent);
      set({ scratchpadContent: '' });
      await saveScratchpadFile(projectPath, '');
      get().setStatusMessage(`Flushed notes to graveyard/${res.fileName}`);
      return true;
    } catch (err) {
      console.error('Error flushing scratchpad:', err);
      get().setStatusMessage(`Error archiving notes: ${errorMessage(err)}`);
      return false;
    }
  },

  syncGitAction: async () => {
    const { projectPath, novelProject, saveFileAction, isDirty } = get();
    if (!projectPath) {
      get().setStatusMessage('Open a novel folder to push to GitHub');
      return false;
    }

    if (isDirty) {
      await saveFileAction();
    }
    await flushProjectSave();

    try {
      get().setStatusMessage('Checking Git status...');
      const status = await getGitStatus(projectPath);
      if (!status.git_installed) {
        get().setStatusMessage('Git is not installed on this system. Install Git to push to GitHub.');
        return false;
      }

      let remoteUrl = status.remote_url || novelProject?.gitRemoteUrl || null;
      if (!remoteUrl) {
        const entered = await promptDialog({
          title: 'Where should the manuscript be pushed?',
          message: 'Paste the address of your GitHub repository. It is remembered for this novel.',
          placeholder: 'https://github.com/username/my-novel.git',
          confirmLabel: 'Push',
        });
        if (!entered || !entered.trim()) {
          get().setStatusMessage('GitHub push cancelled (no repository URL provided)');
          return false;
        }
        remoteUrl = entered.trim();
        if (novelProject) {
          const updated = { ...novelProject, gitRemoteUrl: remoteUrl };
          set({ novelProject: updated });
          persistProject();
        }
      }

      get().setStatusMessage('Pushing manuscript to GitHub...');
      const resultMsg = await syncGit(projectPath, remoteUrl);
      get().setStatusMessage(resultMsg);
      return true;
    } catch (err) {
      console.error('Git sync error:', err);
      get().setStatusMessage(`Git push failed: ${errorMessage(err)}`);
      return false;
    }
  },

  addTagCategoryAction: async (category: string) => {
    const { projectPath, novelProject, tagCategories } = get();
    const clean = category.trim().toLowerCase().replace(/^#/, '');
    if (!clean || tagCategories.includes(clean)) return;
    const updatedCats = [...tagCategories, clean];
    set({ tagCategories: updatedCats });
    if (projectPath && novelProject) {
      const updated = { ...novelProject, tagCategories: updatedCats };
      set({ novelProject: updated });
      persistProject();
    }
  },

  assignTagCategoryAction: async (tagName: string, category: string) => {
    const { tagAssignments, projectPath, novelProject } = get();
    const cleanTag = tagName.toLowerCase().replace(/^#/, '');
    const updatedAssignments = { ...tagAssignments, [cleanTag]: category };
    set({ tagAssignments: updatedAssignments });
    if (projectPath && novelProject) {
      const updated = { ...novelProject, tagAssignments: updatedAssignments };
      set({ novelProject: updated });
      persistProject();
    }
  },

  referencePath: null,
  setReferencePath: (referencePath) => set({ referencePath }),
  openReferenceAction: (path) => {
    set({ referencePath: path });
    get().setViewMode('reference');
  },

  setCorkboardOpen: (corkboardOpen: boolean) => set({ corkboardOpen }),
  toggleCorkboard: () => set({ corkboardOpen: !get().corkboardOpen }),
  setInspectorOpen: (inspectorOpen: boolean) => set({ inspectorOpen }),
  toggleInspector: () => set({ inspectorOpen: !get().inspectorOpen }),
  setScriveningsMode: (scriveningsMode: boolean) => set({ scriveningsMode }),
  toggleScriveningsMode: () => set({ scriveningsMode: !get().scriveningsMode }),

  loadSceneByPath: async (path: string) => {
    return await get().openFileByPath(path);
  },

  addCodexEntryAction: async (entry: Omit<CodexEntry, 'id'>) => {
    const { novelProject, projectPath } = get();
    if (!novelProject || !projectPath) return;
    const newEntry: CodexEntry = {
      ...entry,
      id: `codex_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    };
    const updatedProject: NovelProject = {
      ...novelProject,
      codex: [...(novelProject.codex || []), newEntry],
    };
    set({ novelProject: updatedProject });
    persistProject();
  },

  updateCodexEntryAction: async (entry: CodexEntry) => {
    const { novelProject, projectPath } = get();
    if (!novelProject || !projectPath) return;
    const codex = (novelProject.codex || []).map((e) => (e.id === entry.id ? entry : e));
    const updatedProject: NovelProject = { ...novelProject, codex };
    set({ novelProject: updatedProject });
    persistProject();
  },

  deleteCodexEntryAction: async (id: string) => {
    const { novelProject, projectPath } = get();
    if (!novelProject || !projectPath) return;
    const codex = (novelProject.codex || []).filter((e) => e.id !== id);
    const updatedProject: NovelProject = { ...novelProject, codex };
    set({ novelProject: updatedProject });
    persistProject();
  },

  createSceneSnapshotAction: async (label: string) => {
    const { novelProject, projectPath, filePath, editorInstance, markdownContent, wordCount, setStatusMessage } = get();
    if (!novelProject || !projectPath || !filePath) return;
    const latestContent = editorInstance ? editorInstance.getMarkdown() : markdownContent;
    const newSnapshot: SceneSnapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      scenePath: filePath,
      timestamp: new Date().toISOString(),
      label: label.trim() || 'Manual Snapshot',
      wordCount,
      content: latestContent,
    };
    const updatedProject: NovelProject = {
      ...novelProject,
      snapshots: [newSnapshot, ...(novelProject.snapshots || [])],
    };
    set({ novelProject: updatedProject, markdownContent: latestContent });
    await saveSnapshots(projectPath, updatedProject.snapshots || []);
    setStatusMessage(`Saved snapshot: "${newSnapshot.label}"`);
  },

  restoreSceneSnapshotAction: async (snapshotId: string) => {
    const { novelProject } = get();
    if (!novelProject) return;
    const snap = (novelProject.snapshots || []).find((s) => s.id === snapshotId);
    if (!snap) return;
    get().replaceDocumentTextAction(
      snap.content,
      `Restored snapshot "${snap.label}" (Ctrl+Z undoes this)`
    );
  },

  deleteSceneSnapshotAction: async (snapshotId: string) => {
    const { novelProject, projectPath } = get();
    if (!novelProject || !projectPath) return;
    const snapshots = (novelProject.snapshots || []).filter((s) => s.id !== snapshotId);
    const updatedProject: NovelProject = { ...novelProject, snapshots };
    set({ novelProject: updatedProject });
    await saveSnapshots(projectPath, snapshots);
  },


  // --- Settings Slice -----------------------------------------------------
  theme: initialSettings.theme,
  viewMode: initialSettings.viewMode,
  sidebarOpen: initialSettings.sidebarOpen,
  autoSaveEnabled: initialSettings.autoSaveEnabled,
  autoSaveIntervalMs: initialSettings.autoSaveIntervalMs,
  fontFamily: initialSettings.fontFamily,
  fontSize: initialSettings.fontSize,
  paragraphIndent: initialSettings.paragraphIndent,
  sceneTitleMode: initialSettings.sceneTitleMode,
  spellCheckEnabled: initialSettings.spellCheckEnabled,
  recentFiles: initialSettings.recentFiles,

  setTheme: (theme: Theme) => {
    saveSettings({ theme });
    set({ theme });
  },

  cycleTheme: () => {
    const currentIndex = THEME_IDS.indexOf(get().theme);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % THEME_IDS.length;
    get().setTheme(THEME_IDS[nextIndex]);
  },

  setViewMode: (viewMode: ViewMode) => {
    saveSettings({ viewMode });
    set({ viewMode });
  },

  setSidebarOpen: (sidebarOpen: boolean) => {
    saveSettings({ sidebarOpen });
    set({ sidebarOpen });
  },

  toggleSidebar: () => {
    const next = !get().sidebarOpen;
    saveSettings({ sidebarOpen: next });
    set({ sidebarOpen: next });
  },

  setAutoSaveEnabled: (autoSaveEnabled: boolean) => {
    saveSettings({ autoSaveEnabled });
    set({ autoSaveEnabled });
  },

  setFontFamily: (fontFamily: FontFamily) => {
    saveSettings({ fontFamily });
    set({ fontFamily });
  },

  cycleFontFamily: () => {
    const ids = TYPEFACES.map((t) => t.id);
    const next: FontFamily = ids[(ids.indexOf(get().fontFamily) + 1) % ids.length];
    get().setFontFamily(next);
    get().setStatusMessage(`Typeface: ${TYPEFACES.find((t) => t.id === next)?.label}`);
  },

  setFontSize: (value: number) => {
    const fontSize = Math.min(FONT_SIZE_RANGE.max, Math.max(FONT_SIZE_RANGE.min, Math.round(value)));
    saveSettings({ fontSize });
    set({ fontSize });
  },

  lineHeight: initialSettings.lineHeight,
  lineWidth: initialSettings.lineWidth,
  smartQuotes: initialSettings.smartQuotes,
  recentProjects: initialSettings.recentProjects,

  setLineHeight: (value: number) => {
    const lineHeight =
      Math.round(Math.min(LINE_HEIGHT_RANGE.max, Math.max(LINE_HEIGHT_RANGE.min, value)) * 100) / 100;
    saveSettings({ lineHeight });
    set({ lineHeight });
  },

  setLineWidth: (value: number) => {
    const lineWidth = Math.round(Math.min(LINE_WIDTH_RANGE.max, Math.max(LINE_WIDTH_RANGE.min, value)));
    saveSettings({ lineWidth });
    set({ lineWidth });
  },

  setSmartQuotes: (smartQuotes: boolean) => {
    // The editor is rebuilt for this setting; hand it the very latest text first.
    const { editorInstance } = get();
    if (editorInstance && !editorInstance.isDestroyed) {
      set({ markdownContent: editorInstance.getMarkdown() });
    }
    saveSettings({ smartQuotes });
    set({ smartQuotes });
  },

  toggleParagraphIndent: () => {
    const next = !get().paragraphIndent;
    saveSettings({ paragraphIndent: next });
    set({ paragraphIndent: next });
  },

  setSceneTitleMode: (sceneTitleMode: SceneTitleMode) => {
    saveSettings({ sceneTitleMode });
    set({ sceneTitleMode });
  },

  onlineGrammarCheck: initialSettings.onlineGrammarCheck,

  toggleOnlineGrammarCheck: () => {
    const next = !get().onlineGrammarCheck;
    saveSettings({ onlineGrammarCheck: next });
    setOnlineGrammarEnabled(next);
    set({
      onlineGrammarCheck: next,
      statusMessage: next
        ? 'Online grammar check ON: paragraphs are sent to LanguageTool'
        : 'Online grammar check OFF: spell check runs on this computer only',
    });
  },

  toggleSpellCheck: () => {
    const next = !get().spellCheckEnabled;
    saveSettings({ spellCheckEnabled: next });
    set({
      spellCheckEnabled: next,
      statusMessage: next ? 'Live Spell & Grammar Check enabled' : 'Live Spell & Grammar Check paused',
    });
  },

  // --- Writing Slice ------------------------------------------------------
  focusMode: initialSettings.focusMode,
  typewriterMode: initialSettings.typewriterMode,
  dimUnfocused: initialSettings.dimUnfocused,
  dailyWordGoal: initialSettings.dailyWordGoal,
  sessionWords: 0,
  writingLog: {},
  countBaseline: null,
  skipNextCountDelta: false,
  selectedWordCount: 0,
  findReplaceOpen: false,
  commandPaletteOpen: false,
  goalsModalOpen: false,
  compileModalOpen: false,
  codexModalOpen: false,
  proseAnalysisOpen: false,

  toggleFocusMode: () => {
    const next = !get().focusMode;
    saveSettings({ focusMode: next });
    set({ focusMode: next });
  },

  setFocusMode: (val: boolean) => {
    saveSettings({ focusMode: val });
    set({ focusMode: val });
  },

  toggleTypewriterMode: () => {
    const next = !get().typewriterMode;
    saveSettings({ typewriterMode: next });
    set({ typewriterMode: next });
  },

  toggleDimUnfocused: () => {
    const next = !get().dimUnfocused;
    saveSettings({ dimUnfocused: next });
    set({ dimUnfocused: next });
    if (next) {
      get().editorInstance?.commands.focus();
    }
  },

  setDailyWordGoal: (dailyWordGoal: number) => {
    const valid = Math.max(0, Math.floor(dailyWordGoal));
    saveSettings({ dailyWordGoal: valid });
    set({ dailyWordGoal: valid });
  },

  resetSessionWords: () => {
    set({ sessionWords: 0 });
  },

  setSelectedWordCount: (selectedWordCount: number) => set({ selectedWordCount }),
  setFindReplaceOpen: (findReplaceOpen: boolean) => set({ findReplaceOpen }),
  setCommandPaletteOpen: (commandPaletteOpen: boolean) => set({ commandPaletteOpen }),
  setGoalsModalOpen: (goalsModalOpen: boolean) => set({ goalsModalOpen }),
  setCompileModalOpen: (compileModalOpen: boolean) => set({ compileModalOpen }),
  toggleCompileModal: () => set({ compileModalOpen: !get().compileModalOpen }),
  setCodexModalOpen: (codexModalOpen: boolean) => set({ codexModalOpen }),
  toggleCodexModal: () => set({ codexModalOpen: !get().codexModalOpen }),
  settingsOpen: false,
  backupsOpen: false,
  lastSavedAt: null,
  setSettingsOpen: (settingsOpen: boolean) => set({ settingsOpen }),
  setBackupsOpen: (backupsOpen: boolean) => set({ backupsOpen }),
  setProseAnalysisOpen: (proseAnalysisOpen: boolean) => set({ proseAnalysisOpen }),
  toggleProseAnalysis: () => set({ proseAnalysisOpen: !get().proseAnalysisOpen }),
}));


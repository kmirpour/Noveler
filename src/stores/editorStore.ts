import { create } from 'zustand';
import type { Editor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import * as fileService from '../services/fileService';
import { clearRecovery } from '../services/recovery';
import { exportToPdf } from '../export/pdf';
import {
  type AppSettings,
  type FontFamily,
  type Theme,
  type ViewMode,
  loadSettings,
  saveSettings,
  addRecentFile,
} from '../services/settings';
import {
  type NovelProject,
  type SceneMetadata,
  type BinderItem,
  type CodexEntry,
  type SceneSnapshot,
  loadNovelProject,
  saveNovelProject,
  createSequentialChapter,
  parseSceneMarkdown,
  flattenScenes,
  flushScratchpadToGraveyard,
} from '../services/projectService';
import { getGitStatus, syncGit } from '../services/gitService';
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
  currentMetadata: SceneMetadata;
  novelWordCount: number;
  scratchpadContent: string;
  tagCategories: string[];
  tagAssignments: Record<string, string>;
  corkboardOpen: boolean;
  inspectorOpen: boolean;
  scriveningsMode: boolean;

  openProjectFolderAction: () => Promise<boolean>;
  loadProjectByPath: (path: string) => Promise<boolean>;
  refreshProjectFiles: () => Promise<void>;
  createChapterAction: (customTitle?: string) => Promise<boolean>;
  createSceneAction: (parentFolder: string, title: string) => Promise<boolean>;
  createFolderAction: (parentFolder: string, name: string) => Promise<boolean>;
  renameBinderItemAction: (oldPath: string, newTitle: string) => Promise<boolean>;
  deleteBinderItemAction: (path: string) => Promise<boolean>;
  updateSceneMetadata: (metadata: Partial<SceneMetadata>) => void;
  saveProjectConfigAction: () => Promise<void>;
  setScratchpadContent: (content: string) => void;
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
  recentFiles: string[];

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
}

export interface WritingSlice {
  focusMode: boolean;
  typewriterMode: boolean;
  dimUnfocused: boolean;
  dailyWordGoal: number;
  sessionStartWordCount: number | null;
  sessionWords: number;
  selectedWordCount: number;
  findReplaceOpen: boolean;
  commandPaletteOpen: boolean;
  goalsModalOpen: boolean;
  compileModalOpen: boolean;
  codexModalOpen: boolean;
  proseAnalysisOpen: boolean;

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
    const wordCount = plainText === '' ? 0 : plainText.split(/\s+/).length;
    const charCount = plainText.length;
    const state = get();
    const sessionStart = state.sessionStartWordCount ?? wordCount;
    const sessionWords = Math.max(0, wordCount - sessionStart);

    let novelWordCount = wordCount;
    if (state.novelProject && state.novelProject.binder.length > 0) {
      let otherWords = 0;
      for (const item of state.novelProject.binder) {
        if (item.path !== state.filePath) {
          otherWords += item.wordCount || 0;
        }
      }
      novelWordCount = otherWords + wordCount;
    }

    set({ wordCount, charCount, sessionStartWordCount: sessionStart, sessionWords, novelWordCount });
  },

  setEditorInstance: (editorInstance) => set({ editorInstance }),

  setMarkdownContent: (markdownContent) => set({ markdownContent }),

  confirmDiscardIfDirty: async () => {
    const { isDirty, fileName, saveFileAction } = get();
    if (!isDirty) return true;

    const choice = await fileService.promptUnsavedChanges(fileName);
    if (choice === 'save') return await saveFileAction();
    if (choice === 'discard') {
      clearRecovery();
      return true;
    }
    return false;
  },

  loadDocument: ({ markdown, fileName, filePath, dirty = false, statusMessage }) => {
    const { editorInstance, updateCounts } = get();
    const { metadata, body } = parseSceneMarkdown(markdown);

    if (editorInstance) {
      editorInstance.commands.setContent(body, { contentType: 'markdown', emitUpdate: false });
      updateCounts(editorInstance.getText());
      editorInstance.commands.focus('start');
    } else {
      updateCounts(body);
    }

    set({
      markdownContent: body,
      currentMetadata: metadata,
      fileName,
      filePath,
      activeScenePath: filePath,
      isDirty: dirty,
      statusMessage: statusMessage ?? null,
      sessionStartWordCount: null,
      sessionWords: 0,
      selectedWordCount: 0,
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

      // Persist metadata cleanly into novelProject / noveler.json
      if (projectPath && novelProject && fileName) {
        const updatedMeta = { ...(novelProject.chapterMetadata || {}), [fileName]: currentMetadata };
        const updatedProject: NovelProject = { ...novelProject, chapterMetadata: updatedMeta };
        set({ novelProject: updatedProject });
        void saveNovelProject(projectPath, updatedProject);
      }

      const updated = addRecentFile(filePath);

      set({
        markdownContent: body,
        isDirty: false,
        recentFiles: updated.recentFiles,
        statusMessage: `Saved ${fileName || 'file'}`,
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
    const { editorInstance } = get();
    const markdown = editorInstance ? editorInstance.getMarkdown() : get().markdownContent;
    exportToPdf(markdown);
  },

  // --- Project Slice ------------------------------------------------------
  projectPath: initialSettings.lastProjectPath,
  projectName: null,
  projectFiles: [],
  novelProject: null,
  activeScenePath: null,
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
      const project = await loadNovelProject(path);
      saveSettings({ lastProjectPath: path });
      const name = fileService.extractFileName(path);

      let totalWords = 0;
      for (const item of project.binder) {
        try {
          const f = await fileService.readFileDirect(item.path);
          const words = f.content.trim() === '' ? 0 : f.content.trim().split(/\s+/).length;
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
        scratchpadContent: project.scratchpad || '',
        tagCategories: project.tagCategories || ['characters', 'locations', 'items', 'scenes'],
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
    const { projectPath, filePath, wordCount } = get();
    if (!projectPath) return;
    try {
      const project = await loadNovelProject(projectPath);
      let totalWords = 0;
      for (const item of project.binder) {
        if (item.path === filePath) {
          item.wordCount = wordCount;
          totalWords += wordCount;
        } else {
          try {
            const f = await fileService.readFileDirect(item.path);
            const words = f.content.trim() === '' ? 0 : f.content.trim().split(/\s+/).length;
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

  createSceneAction: async (_parentFolder: string, title: string) => {
    return await get().createChapterAction(title);
  },

  createFolderAction: async (_parentFolder: string, name: string) => {
    return await get().createChapterAction(name);
  },

  renameBinderItemAction: async (oldPath: string, newTitle: string) => {
    try {
      const { refreshProjectFiles } = get();
      const parent = oldPath.substring(0, Math.max(oldPath.lastIndexOf('/'), oldPath.lastIndexOf('\\')));
      const sep = oldPath.includes('/') ? '/' : '\\';
      const isFile = oldPath.endsWith('.md') || oldPath.endsWith('.markdown') || oldPath.endsWith('.txt');
      const safeTitle = newTitle.trim();
      const newName = isFile ? (safeTitle.endsWith('.md') ? safeTitle : `${safeTitle}.md`) : safeTitle;
      const newPath = `${parent}${sep}${newName}`;

      await fileService.renamePath(oldPath, newPath);
      if (get().filePath === oldPath) {
        set({ filePath: newPath, fileName: newName, activeScenePath: newPath });
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
      const { refreshProjectFiles, confirmDiscardIfDirty } = get();
      if (get().filePath === path) {
        if (!(await confirmDiscardIfDirty())) return false;
      }

      await fileService.deleteFile(path);
      if (get().filePath === path) {
        get().loadDocument({ markdown: '', fileName: null, filePath: null, statusMessage: 'Item deleted' });
      }
      await refreshProjectFiles();
      set({ statusMessage: 'Deleted item' });
      return true;
    } catch (err) {
      console.error('Error deleting item:', err);
      set({ statusMessage: `Error deleting: ${errorMessage(err)}` });
      return false;
    }
  },

  updateSceneMetadata: (partial: Partial<SceneMetadata>) => {
    const nextMeta = { ...get().currentMetadata, ...partial };
    set({ currentMetadata: nextMeta, isDirty: true });

    // Also update in novelProject state if matched
    const { novelProject, activeScenePath, projectPath } = get();
    if (novelProject && activeScenePath && projectPath) {
      const updatedProject = { ...novelProject };
      const scenes = flattenScenes(updatedProject.binder);
      const matched = scenes.find((s: BinderItem) => s.path === activeScenePath);
      if (matched) {
        if (partial.synopsis !== undefined) matched.synopsis = partial.synopsis;
        if (partial.pov !== undefined) matched.pov = partial.pov;
        if (partial.status !== undefined) matched.status = partial.status;
        if (partial.targetWords !== undefined) matched.targetWords = partial.targetWords;
        set({ novelProject: updatedProject });
        void saveNovelProject(projectPath, updatedProject);
      }
    }
  },

  saveProjectConfigAction: async () => {
    const { projectPath, novelProject } = get();
    if (!projectPath || !novelProject) return;
    await saveNovelProject(projectPath, novelProject);
  },

  setScratchpadContent: (content: string) => {
    set({ scratchpadContent: content });
    const { projectPath, novelProject } = get();
    if (projectPath && novelProject) {
      const updated = { ...novelProject, scratchpad: content };
      set({ novelProject: updated });
      void saveNovelProject(projectPath, updated);
    }
  },

  flushScratchpadAction: async () => {
    const { projectPath, scratchpadContent, novelProject } = get();
    if (!projectPath) {
      get().setStatusMessage('Open a novel folder to flush scratchpad to graveyard');
      return false;
    }
    if (!scratchpadContent.trim()) return false;

    try {
      const res = await flushScratchpadToGraveyard(projectPath, scratchpadContent);
      set({ scratchpadContent: '' });
      if (novelProject) {
        const updated = { ...novelProject, scratchpad: '' };
        set({ novelProject: updated });
        void saveNovelProject(projectPath, updated);
      }
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

    try {
      get().setStatusMessage('Checking Git status...');
      const status = await getGitStatus(projectPath);
      if (!status.git_installed) {
        get().setStatusMessage('Git is not installed on this system. Install Git to push to GitHub.');
        return false;
      }

      let remoteUrl = status.remote_url || novelProject?.gitRemoteUrl || null;
      if (!remoteUrl) {
        const entered = window.prompt(
          'Enter your GitHub repository URL (e.g. https://github.com/username/my-novel.git):'
        );
        if (!entered || !entered.trim()) {
          get().setStatusMessage('GitHub push cancelled (no repository URL provided)');
          return false;
        }
        remoteUrl = entered.trim();
        if (novelProject) {
          const updated = { ...novelProject, gitRemoteUrl: remoteUrl };
          set({ novelProject: updated });
          void saveNovelProject(projectPath, updated);
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
      await saveNovelProject(projectPath, updated);
    }
  },

  assignTagCategoryAction: async (tagName: string, category: string) => {
    const { tagAssignments } = get();
    const cleanTag = tagName.toLowerCase().replace(/^#/, '');
    const updatedAssignments = { ...tagAssignments, [cleanTag]: category };
    set({ tagAssignments: updatedAssignments });
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
    await saveNovelProject(projectPath, updatedProject);
  },

  updateCodexEntryAction: async (entry: CodexEntry) => {
    const { novelProject, projectPath } = get();
    if (!novelProject || !projectPath) return;
    const codex = (novelProject.codex || []).map((e) => (e.id === entry.id ? entry : e));
    const updatedProject: NovelProject = { ...novelProject, codex };
    set({ novelProject: updatedProject });
    await saveNovelProject(projectPath, updatedProject);
  },

  deleteCodexEntryAction: async (id: string) => {
    const { novelProject, projectPath } = get();
    if (!novelProject || !projectPath) return;
    const codex = (novelProject.codex || []).filter((e) => e.id !== id);
    const updatedProject: NovelProject = { ...novelProject, codex };
    set({ novelProject: updatedProject });
    await saveNovelProject(projectPath, updatedProject);
  },

  createSceneSnapshotAction: async (label: string) => {
    const { novelProject, projectPath, filePath, markdownContent, wordCount, setStatusMessage } = get();
    if (!novelProject || !projectPath || !filePath) return;
    const newSnapshot: SceneSnapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      scenePath: filePath,
      timestamp: new Date().toISOString(),
      label: label.trim() || 'Manual Snapshot',
      wordCount,
      content: markdownContent,
    };
    const updatedProject: NovelProject = {
      ...novelProject,
      snapshots: [newSnapshot, ...(novelProject.snapshots || [])],
    };
    set({ novelProject: updatedProject });
    await saveNovelProject(projectPath, updatedProject);
    setStatusMessage(`Saved snapshot: "${newSnapshot.label}"`);
  },

  restoreSceneSnapshotAction: async (snapshotId: string) => {
    const { novelProject, setMarkdownContent, editorInstance, setDirty, setStatusMessage } = get();
    if (!novelProject) return;
    const snap = (novelProject.snapshots || []).find((s) => s.id === snapshotId);
    if (!snap) return;
    setMarkdownContent(snap.content);
    if (editorInstance) {
      editorInstance.commands.setContent(snap.content);
    }
    setDirty(true);
    setStatusMessage(`Restored snapshot from ${new Date(snap.timestamp).toLocaleTimeString()}`);
  },

  deleteSceneSnapshotAction: async (snapshotId: string) => {
    const { novelProject, projectPath } = get();
    if (!novelProject || !projectPath) return;
    const snapshots = (novelProject.snapshots || []).filter((s) => s.id !== snapshotId);
    const updatedProject: NovelProject = { ...novelProject, snapshots };
    set({ novelProject: updatedProject });
    await saveNovelProject(projectPath, updatedProject);
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
  recentFiles: initialSettings.recentFiles,

  setTheme: (theme: Theme) => {
    saveSettings({ theme });
    set({ theme });
  },

  cycleTheme: () => {
    const THEME_ORDER: Theme[] = ['sepia', 'light', 'dark', 'forest', 'nord'];
    const current = get().theme;
    const currentIndex = THEME_ORDER.indexOf(current);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % THEME_ORDER.length;
    get().setTheme(THEME_ORDER[nextIndex]);
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
    const current = get().fontFamily;
    const next: FontFamily = current === 'serif' ? 'sans' : current === 'sans' ? 'mono' : 'serif';
    get().setFontFamily(next);
  },

  setFontSize: (fontSize: number) => {
    saveSettings({ fontSize });
    set({ fontSize });
  },

  toggleParagraphIndent: () => {
    const next = !get().paragraphIndent;
    saveSettings({ paragraphIndent: next });
    set({ paragraphIndent: next });
  },

  // --- Writing Slice ------------------------------------------------------
  focusMode: initialSettings.focusMode,
  typewriterMode: initialSettings.typewriterMode,
  dimUnfocused: initialSettings.dimUnfocused,
  dailyWordGoal: initialSettings.dailyWordGoal,
  sessionStartWordCount: null,
  sessionWords: 0,
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
    const current = get().wordCount;
    set({ sessionStartWordCount: current, sessionWords: 0 });
  },

  setSelectedWordCount: (selectedWordCount: number) => set({ selectedWordCount }),
  setFindReplaceOpen: (findReplaceOpen: boolean) => set({ findReplaceOpen }),
  setCommandPaletteOpen: (commandPaletteOpen: boolean) => set({ commandPaletteOpen }),
  setGoalsModalOpen: (goalsModalOpen: boolean) => set({ goalsModalOpen }),
  setCompileModalOpen: (compileModalOpen: boolean) => set({ compileModalOpen }),
  toggleCompileModal: () => set({ compileModalOpen: !get().compileModalOpen }),
  setCodexModalOpen: (codexModalOpen: boolean) => set({ codexModalOpen }),
  toggleCodexModal: () => set({ codexModalOpen: !get().codexModalOpen }),
  setProseAnalysisOpen: (proseAnalysisOpen: boolean) => set({ proseAnalysisOpen }),
  toggleProseAnalysis: () => set({ proseAnalysisOpen: !get().proseAnalysisOpen }),
}));


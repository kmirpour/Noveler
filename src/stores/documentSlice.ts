import type { JSONContent } from '@tiptap/core';
import * as fileService from '../services/fileService';
import { clearRecovery } from '../services/recovery';
import { exportToPdf } from '../export/pdf';
import { addRecentFile } from '../services/settings';
import { type SceneMetadata, parseSceneMarkdown, flattenScenes } from '../services/projectService';
import { getSceneIndexAtPosition } from '../utils/chapterScenes';
import { resetEditorHistory } from '../utils/sceneDocOps';
import { addWords } from '../utils/writingLog';
import type { SliceCreator, DocumentSlice } from './types';
import {
  initialMarkdown,
  updateWindowTitle,
  errorMessage,
  countWords,
  withChapterOutline,
  scheduleGitRefresh,
  persistProject,
} from './shared';

/** The open document: loading, saving, counts and export. */
export const createDocumentSlice: SliceCreator<DocumentSlice> = (set, get) => ({
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

    // Count anything typed in the last moment before the switch (counting is debounced)...
    if (editorInstance && !editorInstance.isDestroyed && get().countBaseline) {
      updateCounts(editorInstance.getText());
    }
    // ...then forget the baseline: the incoming document's length is not words written.
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
    const {
      filePath,
      fileName,
      editorInstance,
      saveFileAsAction,
      currentMetadata,
      projectPath,
      novelProject,
    } = get();
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

      scheduleGitRefresh();
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
});

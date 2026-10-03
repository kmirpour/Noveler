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

  openProjectFolderAction: () => Promise<boolean>;
  refreshProjectFiles: () => Promise<void>;
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

export type EditorState = DocumentSlice & ProjectSlice & SettingsSlice;

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
    set({ wordCount, charCount });
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

    if (editorInstance) {
      editorInstance.commands.setContent(markdown, { contentType: 'markdown', emitUpdate: false });
      updateCounts(editorInstance.getText());
      editorInstance.commands.focus('start');
    } else {
      updateCounts(markdown);
    }

    set({
      markdownContent: markdown,
      fileName,
      filePath,
      isDirty: dirty,
      statusMessage: statusMessage ?? null,
    });
    updateWindowTitle(fileName, dirty);
  },

  newFile: async () => {
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
    const { filePath, fileName, editorInstance, saveFileAsAction } = get();
    if (!filePath) {
      return await saveFileAsAction();
    }

    try {
      const markdown = editorInstance ? editorInstance.getMarkdown() : get().markdownContent;
      await fileService.saveFile(filePath, markdown);

      const updated = addRecentFile(filePath);

      set({
        markdownContent: markdown,
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
      const markdown = editorInstance ? editorInstance.getMarkdown() : get().markdownContent;
      const defaultName = fileName || 'Untitled.md';
      const saved = await fileService.saveFileAs(markdown, defaultName);
      if (!saved) return false;

      const path = fileService.isTauri() ? saved.path : null;
      if (path) {
        const updated = addRecentFile(path);
        set({ recentFiles: updated.recentFiles });
      }

      set({
        filePath: path,
        fileName: saved.name,
        markdownContent: markdown,
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

  openProjectFolderAction: async () => {
    try {
      const res = await fileService.openFolder();
      if (!res) return false;

      saveSettings({ lastProjectPath: res.path });

      set({
        projectPath: res.path,
        projectName: res.name,
        projectFiles: res.entries,
        sidebarOpen: true,
        statusMessage: `Opened project: ${res.name}`,
      });
      return true;
    } catch (err) {
      console.error('Error opening project folder:', err);
      set({ statusMessage: `Error opening folder: ${errorMessage(err)}` });
      return false;
    }
  },

  refreshProjectFiles: async () => {
    const { projectPath } = get();
    if (!projectPath) return;
    try {
      const entries = await fileService.readDirectory(projectPath);
      set({ projectFiles: entries });
    } catch {
      // ignore
    }
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
    const current = get().theme;
    const next: Theme = current === 'light' ? 'dark' : current === 'dark' ? 'sepia' : 'light';
    get().setTheme(next);
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
}));

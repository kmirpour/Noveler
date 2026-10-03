import { create } from 'zustand';
import type { Editor } from '@tiptap/react';
import { markdownToHtml, htmlToMarkdown } from '../utils/markdown';
import * as fileService from '../services/fileService';
import { getCurrentWindow } from '@tauri-apps/api/window';

export type ViewMode = 'editor' | 'split' | 'preview';
export type Theme = 'light' | 'dark' | 'sepia';

export interface EditorState {
  content: string; // HTML representation for TipTap
  markdownContent: string; // Live markdown string
  fileName: string | null;
  filePath: string | null;
  isDirty: boolean;
  wordCount: number;
  charCount: number;
  statusMessage: string | null;
  editorInstance: Editor | null;

  // View modes & Theme
  viewMode: ViewMode;
  theme: Theme;
  sidebarOpen: boolean;
  autoSaveEnabled: boolean;

  // Project state
  projectPath: string | null;
  projectName: string | null;
  projectFiles: fileService.FileEntry[];

  // Setters
  setContent: (content: string) => void;
  setFileName: (name: string | null) => void;
  setFilePath: (path: string | null) => void;
  setDirty: (dirty: boolean) => void;
  setStatusMessage: (msg: string | null) => void;
  updateCounts: (text: string) => void;
  setEditorInstance: (editor: Editor | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setAutoSaveEnabled: (enabled: boolean) => void;

  // File Actions
  newFile: () => void;
  openFileAction: () => Promise<boolean>;
  openFileByPath: (path: string) => Promise<boolean>;
  saveFileAction: () => Promise<boolean>;
  saveFileAsAction: () => Promise<boolean>;
  openProjectFolderAction: () => Promise<boolean>;
  refreshProjectFiles: () => Promise<void>;
}

const initialMarkdown = `# Welcome to Noveler

Start writing your story here. Noveler is a simple, distraction-free editor purpose-built for fiction writers.

**Bold**, *italic*, dialogue tags, and markdown formatting work naturally as you type.

---

## Chapter One

The morning sun cast long shadows across the empty street. She stood at the window, watching, waiting for something she couldn't quite name.

"Are you coming?" he called from the doorway.

She didn't turn around. "In a moment," she said softly.`;

const initialHtml = markdownToHtml(initialMarkdown);

const getInitialTheme = (): Theme => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('noveler-theme') as Theme;
    if (saved && (saved === 'light' || saved === 'dark' || saved === 'sepia')) {
      document.documentElement.setAttribute('data-theme', saved);
      return saved;
    }
  }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
  return 'light';
};

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

export const useEditorStore = create<EditorState>((set, get) => ({
  content: initialHtml,
  markdownContent: initialMarkdown,
  fileName: null,
  filePath: null,
  isDirty: false,
  wordCount: 0,
  charCount: 0,
  statusMessage: null,
  editorInstance: null,

  viewMode: 'editor',
  theme: getInitialTheme(),
  sidebarOpen: false,
  autoSaveEnabled: true,

  projectPath: null,
  projectName: null,
  projectFiles: [],

  setContent: (content) => {
    const markdown = htmlToMarkdown(content);
    set({ content, markdownContent: markdown });
  },

  setFileName: (fileName) => {
    set({ fileName });
    const { isDirty } = get();
    updateWindowTitle(fileName, isDirty);
  },

  setFilePath: (filePath) => set({ filePath }),

  setDirty: (isDirty) => {
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

  setViewMode: (viewMode) => set({ viewMode }),

  setTheme: (theme: Theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('noveler-theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    }
    set({ theme });
  },

  cycleTheme: () => {
    const current = get().theme;
    const next: Theme = current === 'light' ? 'dark' : current === 'dark' ? 'sepia' : 'light';
    get().setTheme(next);
  },

  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setAutoSaveEnabled: (autoSaveEnabled) => set({ autoSaveEnabled }),

  newFile: () => {
    const { editorInstance } = get();
    const emptyContent = '';
    if (editorInstance) {
      editorInstance.commands.setContent(emptyContent);
      editorInstance.commands.focus();
    }
    set({
      content: emptyContent,
      markdownContent: '',
      fileName: null,
      filePath: null,
      isDirty: false,
      statusMessage: 'New document created',
    });
    updateWindowTitle(null, false);
  },

  openFileAction: async () => {
    try {
      const opened = await fileService.openFile();
      if (!opened) return false;

      const html = markdownToHtml(opened.content);
      const { editorInstance, updateCounts } = get();

      if (editorInstance) {
        editorInstance.commands.setContent(html);
        updateCounts(editorInstance.getText());
      }

      set({
        content: html,
        markdownContent: opened.content,
        fileName: opened.name,
        filePath: opened.path,
        isDirty: false,
        statusMessage: `Opened ${opened.name}`,
      });

      updateWindowTitle(opened.name, false);
      return true;
    } catch (err) {
      console.error('Error opening file:', err);
      set({ statusMessage: `Error opening file: ${(err as Error).message}` });
      return false;
    }
  },

  openFileByPath: async (path: string) => {
    try {
      const opened = await fileService.readFileDirect(path);
      const html = markdownToHtml(opened.content);
      const { editorInstance, updateCounts } = get();

      if (editorInstance) {
        editorInstance.commands.setContent(html);
        updateCounts(editorInstance.getText());
      }

      set({
        content: html,
        markdownContent: opened.content,
        fileName: opened.name,
        filePath: opened.path,
        isDirty: false,
        statusMessage: `Opened ${opened.name}`,
      });

      updateWindowTitle(opened.name, false);
      return true;
    } catch (err) {
      console.error('Error opening file by path:', err);
      set({ statusMessage: `Error opening file: ${(err as Error).message}` });
      return false;
    }
  },

  saveFileAction: async () => {
    const { filePath, fileName, editorInstance, saveFileAsAction } = get();
    if (!filePath) {
      return await saveFileAsAction();
    }

    try {
      const html = editorInstance ? editorInstance.getHTML() : get().content;
      const markdown = htmlToMarkdown(html);

      await fileService.saveFile(filePath, markdown);

      set({
        markdownContent: markdown,
        isDirty: false,
        statusMessage: `Saved ${fileName || 'file'}`,
      });

      updateWindowTitle(fileName, false);
      return true;
    } catch (err) {
      console.error('Error saving file:', err);
      set({ statusMessage: `Error saving file: ${(err as Error).message}` });
      return false;
    }
  },

  saveFileAsAction: async () => {
    const { fileName, editorInstance, refreshProjectFiles } = get();
    try {
      const html = editorInstance ? editorInstance.getHTML() : get().content;
      const markdown = htmlToMarkdown(html);

      const defaultName = fileName || 'Untitled.md';
      const saved = await fileService.saveFileAs(markdown, defaultName);
      if (!saved) return false;

      set({
        filePath: saved.path,
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
      set({ statusMessage: `Error saving file: ${(err as Error).message}` });
      return false;
    }
  },

  openProjectFolderAction: async () => {
    try {
      const res = await fileService.openFolder();
      if (!res) return false;

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
      set({ statusMessage: `Error opening folder: ${(err as Error).message}` });
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
}));

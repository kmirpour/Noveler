import { create } from 'zustand';
import type { Editor } from '@tiptap/react';
import { markdownToHtml, htmlToMarkdown } from '../utils/markdown';
import * as fileService from '../services/fileService';
import { clearRecovery } from '../services/recovery';
import { exportToPdf } from '../export/pdf';
import { getCurrentWindow } from '@tauri-apps/api/window';

export type ViewMode = 'editor' | 'split' | 'preview';
export type Theme = 'light' | 'dark' | 'sepia';

/** A document to load into the editor, replacing the current one. */
export interface LoadDocumentInput {
  markdown: string;
  fileName: string | null;
  filePath: string | null;
  /** Mark the loaded document as having unsaved changes (e.g. restored from recovery). */
  dirty?: boolean;
  statusMessage?: string;
}

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

  // Document lifecycle
  /**
   * If the current document has unsaved changes, ask the user to save, discard
   * or cancel. Resolves true when it is safe to replace the document.
   */
  confirmDiscardIfDirty: () => Promise<boolean>;
  /** Replace the editor contents. Does NOT check for unsaved changes. */
  loadDocument: (doc: LoadDocumentInput) => void;

  // File Actions
  newFile: () => Promise<boolean>;
  openFileAction: () => Promise<boolean>;
  openFileByPath: (path: string) => Promise<boolean>;
  saveFileAction: () => Promise<boolean>;
  saveFileAsAction: () => Promise<boolean>;
  openProjectFolderAction: () => Promise<boolean>;
  refreshProjectFiles: () => Promise<void>;

  // Export Actions
  exportDocxAction: () => Promise<void>;
  printAction: () => void;
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

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

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
    const html = markdownToHtml(markdown);
    const { editorInstance, updateCounts } = get();

    if (editorInstance) {
      // emitUpdate=false so loading a file doesn't immediately mark it dirty.
      editorInstance.commands.setContent(html, { emitUpdate: false });
      updateCounts(editorInstance.getText());
      editorInstance.commands.focus('start');
    } else {
      updateCounts(markdown);
    }

    set({
      content: html,
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

      get().loadDocument({
        markdown: opened.content,
        fileName: opened.name,
        // The browser fallback only knows the bare file name, which is not a
        // writable location. Leave it null so Save goes through Save As.
        filePath: fileService.isTauri() ? opened.path : null,
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
      if (path === get().filePath) return true; // already open
      if (!(await get().confirmDiscardIfDirty())) return false;

      const opened = await fileService.readFileDirect(path);
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
      set({ statusMessage: `Error saving file: ${errorMessage(err)}` });
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
        filePath: fileService.isTauri() ? saved.path : null,
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

  exportDocxAction: async () => {
    const { editorInstance, fileName, setStatusMessage } = get();
    try {
      // Serialize from the live editor so the export always matches the screen.
      const markdown = editorInstance ? htmlToMarkdown(editorInstance.getHTML()) : get().markdownContent;
      // Loaded on demand: the docx library is ~2/3 of the bundle and only needed here.
      const { exportToDocx } = await import('../export/docx');
      const saved = await exportToDocx(markdown, fileName || 'manuscript.docx');
      if (saved) setStatusMessage(`Exported ${saved.name}`);
    } catch (err) {
      console.error('Error exporting DOCX:', err);
      setStatusMessage(`Export failed: ${errorMessage(err)}`);
    }
  },

  printAction: () => {
    const { editorInstance } = get();
    const markdown = editorInstance ? htmlToMarkdown(editorInstance.getHTML()) : get().markdownContent;
    exportToPdf(markdown);
  },
}));

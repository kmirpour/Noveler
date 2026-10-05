import { invoke } from '@tauri-apps/api/core';
import { message, open, save } from '@tauri-apps/plugin-dialog';

/** File types Noveler can open/save as text. Mirrors TEXT_EXTENSIONS in commands.rs. */
export const TEXT_EXTENSIONS = ['md', 'markdown', 'txt', 'json'];

export function isSupportedTextFile(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return TEXT_EXTENSIONS.includes(ext);
}

export interface OpenedFile {
  path: string;
  name: string;
  content: string;
}

export interface SavedFile {
  path: string;
  name: string;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function extractFileName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || filePath;
}

/**
 * Open file dialog and read contents
 */
export async function openFile(): Promise<OpenedFile | null> {
  if (isTauri()) {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: 'Markdown & Text Files',
            extensions: TEXT_EXTENSIONS,
          },
        ],
      });

      if (!selected || typeof selected !== 'string') {
        return null;
      }

      const content = await invoke<string>('read_file', { path: selected });
      const name = extractFileName(selected);
      return { path: selected, name, content };
    } catch (err) {
      console.error('Failed to open file via Tauri:', err);
      throw err;
    }
  }

  // Browser Fallback (e.g. testing in Chrome)
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.txt';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          path: file.name,
          name: file.name,
          content: (e.target?.result as string) || '',
        });
      };
      reader.readAsText(file);
    };
    input.click();
  });
}

// In-memory virtual storage for browser environment (testing & dev without Tauri)
const browserVirtualFiles = new Map<string, string>();
let browserVirtualFolder: { path: string; name: string; entries: FileEntry[] } | null = null;

/**
 * Direct file read by path (used by sidebar)
 */
export async function readFileDirect(path: string): Promise<OpenedFile> {
  if (isTauri()) {
    const content = await invoke<string>('read_file', { path });
    const name = extractFileName(path);
    return { path, name, content };
  }
  if (browserVirtualFiles.has(path)) {
    return {
      path,
      name: extractFileName(path),
      content: browserVirtualFiles.get(path)!,
    };
  }
  throw new Error('Direct file path reading requires desktop app mode');
}

/**
 * Open project directory
 */
export async function openFolder(): Promise<{ path: string; name: string; entries: FileEntry[] } | null> {
  if (isTauri()) {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (!selected) {
        return null;
      }

      const folderPath =
        typeof selected === 'string' ? selected : Array.isArray(selected) ? (selected[0] as string) : null;
      if (!folderPath) {
        return null;
      }

      const entries = await invoke<FileEntry[]>('read_dir', { path: folderPath });
      const name = extractFileName(folderPath);
      return { path: folderPath, name, entries };
    } catch (err) {
      console.error('Failed to open folder via Tauri:', err);
      throw err;
    }
  }

  // Browser Fallback (e.g. testing in browser or npm run dev)
  if (typeof window !== 'undefined') {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (input as any).webkitdirectory = true;
      input.multiple = true;
      input.onchange = async () => {
        const fileList = input.files;
        if (!fileList || fileList.length === 0) {
          resolve(null);
          return;
        }

        const first = fileList[0];
        const relativeParts = (first.webkitRelativePath || first.name).split('/');
        const folderName = relativeParts.length > 1 ? relativeParts[0] : 'Novel';
        const folderPath = `/${folderName}`;

        const entries: FileEntry[] = [];
        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i];
          const path = `/${file.webkitRelativePath || file.name}`;
          const content = await file.text();
          browserVirtualFiles.set(path, content);
          entries.push({
            name: file.name,
            path,
            is_dir: false,
          });
        }

        browserVirtualFolder = { path: folderPath, name: folderName, entries };
        resolve(browserVirtualFolder);
      };
      input.click();
    });
  }

  return null;
}

/**
 * Read directory contents
 */
export async function readDirectory(path: string): Promise<FileEntry[]> {
  if (isTauri()) {
    return await invoke<FileEntry[]>('read_dir', { path });
  }
  return [];
}

/**
 * Save content to an existing file path
 */
export async function saveFile(path: string, content: string): Promise<void> {
  browserVirtualFiles.set(path, content);
  if (isTauri()) {
    await invoke('write_file', { path, content });
    return;
  }

  // Browser Fallback: download the file
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = extractFileName(path) || 'Untitled.md';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Open Save As dialog and write content
 */
export async function saveFileAs(
  content: string,
  defaultName: string = 'Untitled.md'
): Promise<SavedFile | null> {
  if (isTauri()) {
    const targetPath = await save({
      defaultPath: defaultName,
      filters: [
        {
          name: 'Markdown File',
          extensions: ['md'],
        },
        {
          name: 'Text File',
          extensions: ['txt'],
        },
      ],
    });

    if (!targetPath) {
      return null;
    }

    await invoke('write_file', { path: targetPath, content });
    const name = extractFileName(targetPath);
    return { path: targetPath, name };
  }

  // Browser Fallback: download
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultName.endsWith('.md') ? defaultName : `${defaultName}.md`;
  a.click();
  URL.revokeObjectURL(url);
  return { path: a.download, name: a.download };
}

export interface BinaryFilter {
  name: string;
  extensions: string[];
}

/**
 * Open a Save dialog and write raw bytes (e.g. a .docx export) without any
 * text re-encoding. Returns null if the user cancels.
 */
export async function saveBinaryAs(
  data: Blob,
  defaultName: string,
  filter: BinaryFilter
): Promise<SavedFile | null> {
  if (isTauri()) {
    const targetPath = await save({ defaultPath: defaultName, filters: [filter] });
    if (!targetPath) return null;

    const bytes = new Uint8Array(await data.arrayBuffer());
    // Tauri serializes command args as JSON, so send a plain number[] -> Vec<u8>.
    await invoke('write_binary_file', { path: targetPath, bytes: Array.from(bytes) });
    return { path: targetPath, name: extractFileName(targetPath) };
  }

  // Browser Fallback: download
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultName;
  a.click();
  URL.revokeObjectURL(url);
  return { path: defaultName, name: defaultName };
}

export type UnsavedChoice = 'save' | 'discard' | 'cancel';

/**
 * Ask the user what to do with unsaved changes before a destructive action.
 */
export async function promptUnsavedChanges(fileName: string | null): Promise<UnsavedChoice> {
  const doc = fileName || 'Untitled';
  const text = `Do you want to save the changes you made to "${doc}"?\n\nYour changes will be lost if you don't save them.`;

  if (isTauri()) {
    const result = await message(text, {
      title: 'Unsaved Changes',
      kind: 'warning',
      buttons: { yes: 'Save', no: "Don't Save", cancel: 'Cancel' },
    });
    if (result === 'Save' || result === 'Yes') return 'save';
    if (result === "Don't Save" || result === 'No') return 'discard';
    return 'cancel';
  }

  // Browser fallback: two-step confirm
  if (window.confirm(`${text}\n\nPress OK to save first.`)) return 'save';
  return window.confirm('Discard your unsaved changes?') ? 'discard' : 'cancel';
}

export interface BinderNode {
  name: string;
  path: string;
  is_dir: boolean;
  children: BinderNode[];
}

/**
 * Recursively read directory tree of Markdown files and subdirectories.
 */
export async function readDirTree(path: string): Promise<BinderNode[]> {
  if (isTauri()) {
    return await invoke<BinderNode[]>('read_dir_tree', { path });
  }
  if (browserVirtualFolder && browserVirtualFolder.path === path) {
    return browserVirtualFolder.entries.map((entry) => ({
      name: entry.name,
      path: entry.path,
      is_dir: entry.is_dir,
      children: [],
    }));
  }
  return [];
}

export async function createFile(path: string, initialContent?: string): Promise<void> {
  if (isTauri()) {
    await invoke('create_file', { path, initialContent: initialContent ?? null });
    return;
  }
  browserVirtualFiles.set(path, initialContent ?? '');
  if (browserVirtualFolder) {
    browserVirtualFolder.entries.push({
      name: extractFileName(path),
      path,
      is_dir: false,
    });
  }
}

export async function createDir(path: string): Promise<void> {
  if (isTauri()) {
    await invoke('create_dir', { path });
  }
}

export async function renamePath(oldPath: string, newPath: string): Promise<void> {
  if (isTauri()) {
    await invoke('rename_path', { oldPath, newPath });
  }
}

export async function deleteFile(path: string): Promise<void> {
  if (isTauri()) {
    await invoke('delete_file', { path });
  }
}


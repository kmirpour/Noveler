import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';

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
            extensions: ['md', 'markdown', 'txt'],
          },
          {
            name: 'All Files',
            extensions: ['*'],
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

/**
 * Direct file read by path (used by sidebar)
 */
export async function readFileDirect(path: string): Promise<OpenedFile> {
  if (isTauri()) {
    const content = await invoke<string>('read_file', { path });
    const name = extractFileName(path);
    return { path, name, content };
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

      if (!selected || typeof selected !== 'string') {
        return null;
      }

      const entries = await invoke<FileEntry[]>('read_dir', { path: selected });
      const name = extractFileName(selected);
      return { path: selected, name, entries };
    } catch (err) {
      console.error('Failed to open folder via Tauri:', err);
      throw err;
    }
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
        {
          name: 'All Files',
          extensions: ['*'],
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

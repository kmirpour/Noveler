/**
 * Browser backend for working on a novel folder on the user's own computer.
 *
 * It uses the File System Access API (desktop Chrome, Edge and Opera): the writer picks a folder,
 * the browser asks permission once, and the app then reads and writes the real files in it.
 * Nothing is uploaded anywhere.
 *
 * The rest of the app passes file locations around as text, so every opened folder is given a
 * virtual path such as `/MyNovel`, and its files `/MyNovel/02-chapter.md`. This module turns those
 * paths back into browser file handles. It mirrors the rules of the desktop backend:
 *  - only text files (`.md`, `.markdown`, `.txt`, `.json`) are read or written as text;
 *  - nothing outside an opened folder can be reached (no `..`, no other roots);
 *  - there is no delete; a file only ever disappears as the last step of a verified move.
 */
import type { BinderNode, FileEntry } from './fileService';

// --- The slice of the File System Access API that is used ----------------------------------------
// Declared here (instead of relying on lib.dom) so the module can be tested with in-memory fakes.

export interface WebFile {
  name: string;
  size: number;
  lastModified: number;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface WebWritable {
  write(data: string | ArrayBuffer): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

export interface WebFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<WebFile>;
  createWritable(): Promise<WebWritable>;
  isSameEntry?(other: unknown): Promise<boolean>;
}

export interface WebDirHandle {
  kind: 'directory';
  name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<WebFileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<WebDirHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  entries(): AsyncIterable<[string, WebFileHandle | WebDirHandle]>;
  isSameEntry?(other: unknown): Promise<boolean>;
}

interface PickerWindow {
  showDirectoryPicker?: (options?: object) => Promise<WebDirHandle>;
  showOpenFilePicker?: (options?: object) => Promise<WebFileHandle[]>;
  showSaveFilePicker?: (options?: object) => Promise<WebFileHandle>;
}

const pickers = (): PickerWindow => (typeof window === 'undefined' ? {} : (window as unknown as PickerWindow));

/** True in browsers that can open a folder and write back to it (desktop Chrome, Edge, Opera). */
export function isWebFilesSupported(): boolean {
  const w = pickers();
  return typeof w.showDirectoryPicker === 'function' && typeof w.showOpenFilePicker === 'function';
}

// --- Text file rules (mirrors TEXT_EXTENSIONS in the desktop backend) ------------------------------

const TEXT_EXTENSIONS = ['md', 'markdown', 'txt', 'json'];

const hasTextExtension = (name: string) => {
  const dot = name.lastIndexOf('.');
  return dot > 0 && TEXT_EXTENSIONS.includes(name.slice(dot + 1).toLowerCase());
};

function ensureTextPath(path: string): void {
  if (!hasTextExtension(path)) {
    throw new Error(`Unsupported file type for '${path}'. Allowed: ${TEXT_EXTENSIONS.join(', ')}`);
  }
}

// --- Opened folders and files ------------------------------------------------------------------------

/** Virtual folder under which individually opened files (no folder) are kept. */
const LOOSE_ROOT = '~file';

const roots = new Map<string, WebDirHandle>();
const looseFiles = new Map<string, WebFileHandle>();

async function sameEntry(a: { isSameEntry?: (o: unknown) => Promise<boolean> }, b: unknown): Promise<boolean> {
  try {
    return a.isSameEntry ? await a.isSameEntry(b) : a === b;
  } catch {
    return false;
  }
}

/** Remembers an opened folder and returns its virtual path (`/Name`, or `/Name (2)` if taken). */
export async function registerRoot(handle: WebDirHandle): Promise<string> {
  const base = handle.name === LOOSE_ROOT ? `${LOOSE_ROOT} (folder)` : handle.name || 'Novel';
  let name = base;
  for (let n = 2; ; n++) {
    const existing = roots.get(name);
    if (!existing) break;
    if (await sameEntry(existing, handle)) {
      roots.set(name, handle); // the same folder opened again: use the fresh handle
      return `/${name}`;
    }
    name = `${base} (${n})`;
  }
  roots.set(name, handle);
  return `/${name}`;
}

/** Remembers an individually opened or saved file and returns its virtual path. */
export async function registerFile(handle: WebFileHandle): Promise<string> {
  let name = handle.name;
  for (let n = 2; ; n++) {
    const existing = looseFiles.get(name);
    if (!existing) break;
    if (await sameEntry(existing, handle)) {
      looseFiles.set(name, handle);
      return `/${LOOSE_ROOT}/${name}`;
    }
    const dot = handle.name.lastIndexOf('.');
    name = dot > 0 ? `${handle.name.slice(0, dot)} (${n})${handle.name.slice(dot)}` : `${handle.name} (${n})`;
  }
  looseFiles.set(name, handle);
  return `/${LOOSE_ROOT}/${name}`;
}

/** Forgets everything that was opened (used by tests). */
export function resetWebFilesForTests(): void {
  roots.clear();
  looseFiles.clear();
}

// --- Paths ---------------------------------------------------------------------------------------------

/** Splits a virtual path into its segments, refusing anything that could leave the opened folder. */
function parse(path: string): string[] {
  if (typeof path !== 'string' || !path.startsWith('/')) {
    throw new Error(`'${path}' is not a location inside an opened folder`);
  }
  const parts = path.split('/').slice(1);
  if (parts.length === 0 || parts.some((p) => p === '' || p === '.' || p === '..')) {
    throw new Error(`'${path}' is not a location inside an opened folder`);
  }
  return parts;
}

/** True when `path` belongs to a folder or file that was opened in this browser tab. */
export function owns(path: string | null | undefined): boolean {
  if (!path) return false;
  let parts: string[];
  try {
    parts = parse(path);
  } catch {
    return false;
  }
  if (parts[0] === LOOSE_ROOT) return parts.length === 2 && looseFiles.has(parts[1]);
  return roots.has(parts[0]);
}

async function dirFor(parts: string[], create: boolean): Promise<WebDirHandle> {
  let dir = roots.get(parts[0]);
  if (!dir) throw new Error(`'/${parts[0]}' has not been opened`);
  for (const segment of parts.slice(1)) {
    dir = await dir.getDirectoryHandle(segment, { create });
  }
  return dir;
}

async function fileFor(path: string, create: boolean): Promise<WebFileHandle> {
  const parts = parse(path);
  if (parts[0] === LOOSE_ROOT) {
    const handle = parts.length === 2 ? looseFiles.get(parts[1]) : undefined;
    if (!handle) throw new Error(`'${path}' has not been opened`);
    return handle;
  }
  if (parts.length < 2) throw new Error(`'${path}' is a folder, not a file`);
  const dir = await dirFor(parts.slice(0, -1), create);
  return await dir.getFileHandle(parts[parts.length - 1], { create });
}

async function exists(dir: WebDirHandle, name: string): Promise<boolean> {
  for (const kind of ['file', 'directory'] as const) {
    try {
      if (kind === 'file') await dir.getFileHandle(name);
      else await dir.getDirectoryHandle(name);
      return true;
    } catch {
      // not that kind (or not there)
    }
  }
  return false;
}

/**
 * Writes data so that the existing file is only replaced once everything has been written:
 * the browser keeps the new content in a temporary file until close(), and abort() discards it.
 */
async function writeAll(handle: WebFileHandle, data: string | ArrayBuffer): Promise<void> {
  const writable = await handle.createWritable();
  try {
    await writable.write(data);
    await writable.close();
  } catch (err) {
    try {
      await writable.abort();
    } catch {
      // already closed or aborted
    }
    throw err;
  }
}

// --- Reading and writing -------------------------------------------------------------------------------

export async function readText(path: string): Promise<string> {
  ensureTextPath(path);
  const file = await (await fileFor(path, false)).getFile();
  return await file.text();
}

/** Saves a text file, creating any missing folders above it. */
export async function writeText(path: string, content: string): Promise<void> {
  ensureTextPath(path);
  await writeAll(await fileFor(path, true), content);
}

/** Creates a new text file. Refuses to overwrite one that exists. */
export async function createFile(path: string, content: string): Promise<void> {
  ensureTextPath(path);
  const parts = parse(path);
  if (parts[0] === LOOSE_ROOT || parts.length < 2) throw new Error(`Cannot create '${path}' here`);
  const dir = await dirFor(parts.slice(0, -1), true);
  const name = parts[parts.length - 1];
  if (await exists(dir, name)) throw new Error(`File already exists: ${path}`);
  await writeAll(await dir.getFileHandle(name, { create: true }), content);
}

/** Creates a folder (and any missing folders above it) inside an opened folder. */
export async function createDir(path: string): Promise<void> {
  const parts = parse(path);
  if (parts[0] === LOOSE_ROOT || parts.length < 2) throw new Error(`Cannot create '${path}' here`);
  await dirFor(parts, true);
}

const bytesEqual = (a: ArrayBuffer, b: ArrayBuffer) => {
  if (a.byteLength !== b.byteLength) return false;
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
};

/**
 * Moves or renames a text file inside an opened folder. The browser cannot move picked files
 * reliably, so the file is copied, the copy is checked byte for byte, and only then is the old
 * one removed. Never overwrites, and never moves folders.
 */
export async function renamePath(oldPath: string, newPath: string): Promise<void> {
  ensureTextPath(oldPath);
  ensureTextPath(newPath);
  const from = parse(oldPath);
  const to = parse(newPath);
  if (from[0] === LOOSE_ROOT || to[0] === LOOSE_ROOT || from[0] !== to[0] || from.length < 2 || to.length < 2) {
    throw new Error(`'${oldPath}' and '${newPath}' must both be inside the same opened folder`);
  }

  const fromDir = await dirFor(from.slice(0, -1), false);
  const toDir = await dirFor(to.slice(0, -1), false);
  const fromName = from[from.length - 1];
  const toName = to[to.length - 1];

  let source: WebFileHandle;
  try {
    source = await fromDir.getFileHandle(fromName);
  } catch {
    throw new Error(`Not a file: ${oldPath}`);
  }
  if (await exists(toDir, toName)) throw new Error(`A file named '${newPath}' already exists`);

  const original = await (await source.getFile()).arrayBuffer();
  const copy = await toDir.getFileHandle(toName, { create: true });
  let problem: string | null = null;
  try {
    await writeAll(copy, original);
    const written = await (await copy.getFile()).arrayBuffer();
    if (!bytesEqual(original, written)) problem = 'The copy did not match the original';
  } catch (err) {
    problem = err instanceof Error ? err.message : String(err);
  }
  if (problem !== null) {
    try {
      await toDir.removeEntry(toName); // only ever the copy this call just made
    } catch {
      // nothing to clean up
    }
    throw new Error(`Failed to move ${oldPath} to ${newPath}: ${problem}`);
  }
  // The copy is verified; only now does the original go.
  await fromDir.removeEntry(fromName);
}

// --- Listing ---------------------------------------------------------------------------------------------

const byDirsThenName = (a: { is_dir: boolean; name: string }, b: { is_dir: boolean; name: string }) =>
  a.is_dir !== b.is_dir ? (a.is_dir ? -1 : 1) : a.name.toLowerCase().localeCompare(b.name.toLowerCase());

/** The folder's files and subfolders, one level deep (hidden entries and non-text files skipped). */
export async function listDir(path: string): Promise<FileEntry[]> {
  const dir = await dirFor(parse(path), false);
  const entries: FileEntry[] = [];
  for await (const [name, handle] of dir.entries()) {
    if (name.startsWith('.')) continue;
    const is_dir = handle.kind === 'directory';
    if (is_dir || hasTextExtension(name)) entries.push({ name, path: `${path}/${name}`, is_dir });
  }
  return entries.sort(byDirsThenName);
}

/** The whole folder as a tree of text files and subfolders. */
export async function readTree(path: string): Promise<BinderNode[]> {
  async function scan(dir: WebDirHandle, base: string): Promise<BinderNode[]> {
    const nodes: BinderNode[] = [];
    for await (const [name, handle] of dir.entries()) {
      if (name.startsWith('.')) continue;
      const full = `${base}/${name}`;
      if (handle.kind === 'directory') {
        nodes.push({ name, path: full, is_dir: true, children: await scan(handle, full) });
      } else if (hasTextExtension(name)) {
        nodes.push({ name, path: full, is_dir: false, children: [] });
      }
    }
    return nodes.sort(byDirsThenName);
  }
  return await scan(await dirFor(parse(path), false), path);
}

// --- Pickers -------------------------------------------------------------------------------------------------

const isAbort = (err: unknown) => (err as { name?: string } | null)?.name === 'AbortError';

/** Asks the writer to pick a novel folder. Resolves to null if they cancel. */
export async function pickFolder(): Promise<{ path: string; name: string } | null> {
  const picker = pickers().showDirectoryPicker;
  if (!picker) throw new Error('This browser cannot open folders');
  try {
    const handle = await picker.call(window, { mode: 'readwrite', id: 'noveler-novel' });
    const path = await registerRoot(handle);
    return { path, name: path.slice(1) };
  } catch (err) {
    if (isAbort(err)) return null;
    throw err;
  }
}

/** Asks the writer to pick one Markdown or text file to edit. Resolves to null if they cancel. */
export async function pickTextFile(): Promise<{ path: string; name: string; content: string } | null> {
  const picker = pickers().showOpenFilePicker;
  if (!picker) throw new Error('This browser cannot open files for editing');
  try {
    const [handle] = await picker.call(window, {
      multiple: false,
      id: 'noveler-file',
      types: [{ description: 'Markdown & text files', accept: { 'text/markdown': ['.md', '.markdown'], 'text/plain': ['.txt'] } }],
    });
    if (!handle) return null;
    const path = await registerFile(handle);
    return { path, name: handle.name, content: await readText(path) };
  } catch (err) {
    if (isAbort(err)) return null;
    throw err;
  }
}

/** Save As for a text document: asks where, writes it, and keeps the file open for autosave. */
export async function saveTextAs(content: string, suggestedName: string): Promise<{ path: string; name: string } | null> {
  const picker = pickers().showSaveFilePicker;
  if (!picker) throw new Error('This browser cannot save to a chosen location');
  try {
    const handle = await picker.call(window, {
      suggestedName,
      id: 'noveler-file',
      types: [{ description: 'Markdown file', accept: { 'text/markdown': ['.md'] } }, { description: 'Text file', accept: { 'text/plain': ['.txt'] } }],
    });
    await writeAll(handle, content);
    return { path: await registerFile(handle), name: handle.name };
  } catch (err) {
    if (isAbort(err)) return null;
    throw err;
  }
}

const MIME_BY_EXTENSION: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  epub: 'application/epub+zip',
  md: 'text/markdown',
  txt: 'text/plain',
};

/** Save As for an exported file (Word, EPUB...): asks where and writes the bytes. */
export async function saveBlobAs(
  data: Blob,
  suggestedName: string,
  filter: { name: string; extensions: string[] }
): Promise<{ name: string } | null> {
  const picker = pickers().showSaveFilePicker;
  if (!picker) throw new Error('This browser cannot save to a chosen location');
  const accept: Record<string, string[]> = {};
  for (const ext of filter.extensions) {
    const mime = MIME_BY_EXTENSION[ext] || 'application/octet-stream';
    (accept[mime] ||= []).push(`.${ext}`);
  }
  try {
    const handle = await picker.call(window, { suggestedName, types: [{ description: filter.name, accept }] });
    await writeAll(handle, await data.arrayBuffer());
    return { name: handle.name };
  } catch (err) {
    if (isAbort(err)) return null;
    throw err;
  }
}

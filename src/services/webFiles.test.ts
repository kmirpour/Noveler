import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as webFiles from './webFiles';
import type { WebDirHandle, WebFile, WebFileHandle, WebWritable } from './webFiles';
import * as fileService from './fileService';
import { loadNovelProject, saveNovelProject } from './projectService';

// --- An in-memory stand-in for a folder on the writer's disk ------------------------------------------

type FileNode = { kind: 'file'; bytes: Uint8Array };
type DirNode = { kind: 'directory'; children: Map<string, FileNode | DirNode> };

const fsError = (name: string, message: string) => Object.assign(new Error(message), { name });
const enc = new TextEncoder();
const dec = new TextDecoder();

interface Faults {
  /** Make the next write fail part-way (nothing may be committed). */
  failNextWrite?: boolean;
  /** Make the next committed write store different bytes than were written. */
  corruptNextWrite?: boolean;
  removed: string[];
}

class FakeFileHandle implements WebFileHandle {
  readonly kind = 'file' as const;
  constructor(
    readonly name: string,
    private node: FileNode,
    private faults: Faults
  ) {}
  async getFile(): Promise<WebFile> {
    const bytes = this.node.bytes.slice();
    return {
      name: this.name,
      size: bytes.byteLength,
      lastModified: 0,
      text: async () => dec.decode(bytes),
      arrayBuffer: async () => bytes.buffer as ArrayBuffer,
    };
  }
  async createWritable(): Promise<WebWritable> {
    const chunks: Uint8Array[] = [];
    let done = false;
    const faults = this.faults;
    const node = this.node;
    return {
      async write(data) {
        if (faults.failNextWrite) {
          faults.failNextWrite = false;
          throw fsError('QuotaExceededError', 'disk full');
        }
        chunks.push(typeof data === 'string' ? enc.encode(data) : new Uint8Array(data));
      },
      async close() {
        if (done) throw new Error('already closed');
        done = true;
        let bytes = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
        let at = 0;
        for (const c of chunks) {
          bytes.set(c, at);
          at += c.byteLength;
        }
        if (faults.corruptNextWrite) {
          faults.corruptNextWrite = false;
          bytes = enc.encode('CORRUPTED');
        }
        node.bytes = bytes; // the old content is replaced only here
      },
      async abort() {
        done = true; // discard: the file keeps its previous content
      },
    };
  }
}

class FakeDirHandle implements WebDirHandle {
  readonly kind = 'directory' as const;
  constructor(
    readonly name: string,
    readonly node: DirNode,
    private faults: Faults
  ) {}
  private child(name: string, create: boolean, kind: 'file' | 'directory') {
    let entry = this.node.children.get(name);
    if (!entry) {
      if (!create) throw fsError('NotFoundError', `${name} not found`);
      entry = kind === 'file' ? { kind: 'file', bytes: new Uint8Array() } : { kind: 'directory', children: new Map() };
      this.node.children.set(name, entry);
    }
    if (entry.kind !== kind) throw fsError('TypeMismatchError', `${name} is not a ${kind}`);
    return entry;
  }
  async getFileHandle(name: string, options?: { create?: boolean }) {
    return new FakeFileHandle(name, this.child(name, Boolean(options?.create), 'file') as FileNode, this.faults);
  }
  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    return new FakeDirHandle(name, this.child(name, Boolean(options?.create), 'directory') as DirNode, this.faults);
  }
  async removeEntry(name: string) {
    if (!this.node.children.has(name)) throw fsError('NotFoundError', `${name} not found`);
    this.faults.removed.push(name);
    this.node.children.delete(name);
  }
  async *entries(): AsyncIterable<[string, WebFileHandle | WebDirHandle]> {
    for (const [name, entry] of this.node.children) {
      yield [name, entry.kind === 'file' ? new FakeFileHandle(name, entry, this.faults) : new FakeDirHandle(name, entry, this.faults)];
    }
  }
  async isSameEntry(other: unknown) {
    return other instanceof FakeDirHandle && other.node === this.node;
  }
}

const makeFolder = (name: string, files: Record<string, string> = {}) => {
  const root: DirNode = { kind: 'directory', children: new Map() };
  const faults: Faults = { removed: [] };
  const handle = new FakeDirHandle(name, root, faults);
  const put = (path: string, text: string) => {
    const parts = path.split('/');
    let dir = root;
    for (const part of parts.slice(0, -1)) {
      let next = dir.children.get(part) as DirNode | undefined;
      if (!next) dir.children.set(part, (next = { kind: 'directory', children: new Map() }));
      dir = next;
    }
    dir.children.set(parts[parts.length - 1], { kind: 'file', bytes: enc.encode(text) });
  };
  for (const [path, text] of Object.entries(files)) put(path, text);
  const read = (path: string): string | undefined => {
    let entry: FileNode | DirNode | undefined = root;
    for (const part of path.split('/')) entry = entry?.kind === 'directory' ? entry.children.get(part) : undefined;
    return entry?.kind === 'file' ? dec.decode(entry.bytes) : undefined;
  };
  return { handle, faults, read, put };
};

beforeEach(() => webFiles.resetWebFilesForTests());
afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

describe('opened folders', () => {
  it('gives each opened folder its own virtual path, and recognises the same folder again', async () => {
    const a = makeFolder('Novel');
    const b = makeFolder('Novel');
    expect(await webFiles.registerRoot(a.handle)).toBe('/Novel');
    expect(await webFiles.registerRoot(b.handle)).toBe('/Novel (2)');
    expect(await webFiles.registerRoot(a.handle)).toBe('/Novel');
    expect(webFiles.owns('/Novel/01-chapter.md')).toBe(true);
    expect(webFiles.owns('/Other/01-chapter.md')).toBe(false);
    expect(webFiles.owns(null)).toBe(false);
    expect(webFiles.owns('C:\\novel\\01.md')).toBe(false);
  });

  it('is not available in a browser without the file pickers', () => {
    expect(webFiles.isWebFilesSupported()).toBe(false);
    expect(fileService.canOpenFolders()).toBe(false);
  });
});

describe('reading and writing', () => {
  it('reads and saves text files, creating missing folders', async () => {
    const f = makeFolder('Novel', { '01-a.md': '# One\n' });
    const root = await webFiles.registerRoot(f.handle);
    expect(await webFiles.readText(`${root}/01-a.md`)).toBe('# One\n');

    await webFiles.writeText(`${root}/01-a.md`, '# One\n\nMore.\n');
    expect(f.read('01-a.md')).toBe('# One\n\nMore.\n');

    await webFiles.writeText(`${root}/.noveler/snapshots.json`, '[]');
    expect(f.read('.noveler/snapshots.json')).toBe('[]');
    await expect(webFiles.readText(`${root}/missing.md`)).rejects.toThrow();
  });

  it('keeps the old text when a save fails part-way', async () => {
    const f = makeFolder('Novel', { '01-a.md': 'precious chapter' });
    const root = await webFiles.registerRoot(f.handle);
    f.faults.failNextWrite = true;
    await expect(webFiles.writeText(`${root}/01-a.md`, 'half a chapter')).rejects.toThrow('disk full');
    expect(f.read('01-a.md')).toBe('precious chapter');
  });

  it('only handles text files as text', async () => {
    const f = makeFolder('Novel', { 'cover.png': 'binary' });
    const root = await webFiles.registerRoot(f.handle);
    await expect(webFiles.readText(`${root}/cover.png`)).rejects.toThrow('Unsupported file type');
    await expect(webFiles.writeText(`${root}/run.exe`, 'x')).rejects.toThrow('Unsupported file type');
    await expect(webFiles.createFile(`${root}/book.docx`, 'x')).rejects.toThrow('Unsupported file type');
  });

  it('creates new files but never overwrites an existing one', async () => {
    const f = makeFolder('Novel', { '01-a.md': 'mine' });
    const root = await webFiles.registerRoot(f.handle);
    await webFiles.createFile(`${root}/02-b.md`, '# Two\n');
    expect(f.read('02-b.md')).toBe('# Two\n');
    await expect(webFiles.createFile(`${root}/01-a.md`, 'other')).rejects.toThrow('already exists');
    expect(f.read('01-a.md')).toBe('mine');
    await webFiles.createDir(`${root}/graveyard`);
    expect(f.handle.node.children.get('graveyard')?.kind).toBe('directory');
  });
});

describe('staying inside the opened folder', () => {
  it('refuses paths that leave it or were never opened', async () => {
    const f = makeFolder('Novel', { '01-a.md': 'x' });
    const root = await webFiles.registerRoot(f.handle);
    for (const bad of [`${root}/../Secret/x.md`, `${root}/./x.md`, `${root}//x.md`, '/Unopened/x.md', 'relative.md', '/']) {
      await expect(webFiles.readText(bad), bad).rejects.toThrow();
      await expect(webFiles.writeText(bad, 'x'), bad).rejects.toThrow();
    }
    await expect(webFiles.renamePath(`${root}/01-a.md`, '/Unopened/01-a.md')).rejects.toThrow();
  });

  it('exposes no way to delete', () => {
    expect(Object.keys(webFiles).filter((k) => /delete|remove|unlink/i.test(k))).toEqual([]);
  });
});

describe('listing', () => {
  it('lists text files and folders like the desktop app: folders first, hidden and other files skipped', async () => {
    const f = makeFolder('Novel', {
      '02-b.md': '',
      '01-a.md': '',
      'notes.txt': '',
      'cover.png': '',
      'graveyard/old.md': '',
      '.noveler/backups/x.md': '',
      'noveler.json': '{}',
    });
    const root = await webFiles.registerRoot(f.handle);
    expect((await webFiles.listDir(root)).map((e) => `${e.is_dir ? 'dir ' : ''}${e.name}`)).toEqual([
      'dir graveyard',
      '01-a.md',
      '02-b.md',
      'notes.txt',
      'noveler.json',
    ]);
    const tree = await webFiles.readTree(root);
    expect(tree.map((n) => n.name)).toEqual(['graveyard', '01-a.md', '02-b.md', 'notes.txt', 'noveler.json']);
    expect(tree[0].children.map((n) => n.path)).toEqual([`${root}/graveyard/old.md`]);
  });
});

describe('moving files', () => {
  it('copies, verifies, then removes the original', async () => {
    const f = makeFolder('Novel', { '01-a.md': 'chapter text' });
    const root = await webFiles.registerRoot(f.handle);
    await webFiles.createDir(`${root}/graveyard`);
    await webFiles.renamePath(`${root}/01-a.md`, `${root}/graveyard/2026_01-a.md`);
    expect(f.read('01-a.md')).toBeUndefined();
    expect(f.read('graveyard/2026_01-a.md')).toBe('chapter text');
    expect(f.faults.removed).toEqual(['01-a.md']);
  });

  it('leaves the original alone when the copy cannot be verified or written', async () => {
    const f = makeFolder('Novel', { '01-a.md': 'chapter text' });
    const root = await webFiles.registerRoot(f.handle);

    f.faults.corruptNextWrite = true;
    await expect(webFiles.renamePath(`${root}/01-a.md`, `${root}/02-a.md`)).rejects.toThrow('did not match');
    expect(f.read('01-a.md')).toBe('chapter text');
    expect(f.read('02-a.md')).toBeUndefined();

    f.faults.failNextWrite = true;
    await expect(webFiles.renamePath(`${root}/01-a.md`, `${root}/02-a.md`)).rejects.toThrow('disk full');
    expect(f.read('01-a.md')).toBe('chapter text');
    expect(f.read('02-a.md')).toBeUndefined();
    // Only the half-made copy was ever removed, never the original.
    expect(f.faults.removed).not.toContain('01-a.md');
  });

  it('never overwrites, never moves folders, never leaves the folder', async () => {
    const f = makeFolder('Novel', { '01-a.md': 'one', '02-b.md': 'two', 'sub/x.md': 'x' });
    const g = makeFolder('Other', {});
    const root = await webFiles.registerRoot(f.handle);
    const other = await webFiles.registerRoot(g.handle);
    await expect(webFiles.renamePath(`${root}/01-a.md`, `${root}/02-b.md`)).rejects.toThrow('already exists');
    expect(f.read('02-b.md')).toBe('two');
    await expect(webFiles.renamePath(`${root}/sub`, `${root}/sub2`)).rejects.toThrow();
    await expect(webFiles.renamePath(`${root}/01-a.md`, `${other}/01-a.md`)).rejects.toThrow();
    await expect(webFiles.renamePath(`${root}/01-a.md`, `${root}/nowhere/01-a.md`)).rejects.toThrow();
    expect(f.read('01-a.md')).toBe('one');
  });
});

describe('through the app\'s file service', () => {
  it('reads, saves, creates and moves files for a registered folder, and can save to it', async () => {
    const f = makeFolder('Novel', { '01-a.md': '# One\n' });
    const root = await webFiles.registerRoot(f.handle);

    expect(fileService.canWriteToDisk(`${root}/01-a.md`)).toBe(true);
    expect(fileService.canWriteToDisk('/Elsewhere/x.md')).toBe(false);
    expect(fileService.canWriteToDisk(null)).toBe(false);

    expect((await fileService.readFileDirect(`${root}/01-a.md`)).content).toBe('# One\n');
    await fileService.saveFile(`${root}/01-a.md`, '# One, revised\n');
    expect(f.read('01-a.md')).toBe('# One, revised\n');
    await fileService.createFile(`${root}/02-b.md`, '# Two\n');
    await fileService.createDir(`${root}/graveyard`);
    await fileService.renamePath(`${root}/02-b.md`, `${root}/graveyard/02-b.md`);
    expect(f.read('graveyard/02-b.md')).toBe('# Two\n');
    expect((await fileService.readDirTree(root)).map((n) => n.name)).toEqual(['graveyard', '01-a.md']);
  });

  it('always allows saving in the desktop app, whatever the path', () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    expect(fileService.canWriteToDisk('C:\\novel\\01.md')).toBe(true);
    expect(fileService.canWriteToDisk(null)).toBe(true);
  });

  it('opens a novel from the folder: chapters in saved order, project file with portable names', async () => {
    const f = makeFolder('Novel', {
      '01-arrival.md': '# Chapter 1\n\n## Harbor\n\nText.\n',
      '02-letter.md': '# Chapter 2\n\nText.\n',
      'scene-storm.md': '# Storm\n',
      'noveler.json': JSON.stringify({
        version: 1,
        title: 'Saved',
        binder: [
          { id: 'b2', type: 'scene', title: 'x', path: '02-letter.md' },
          { id: 'b1', type: 'scene', title: 'x', path: '01-arrival.md' },
        ],
      }),
    });
    const root = await webFiles.registerRoot(f.handle);
    const project = await loadNovelProject(root);
    expect(project.title).toBe('Saved');
    expect(project.binder.map((b) => b.path)).toEqual([`${root}/02-letter.md`, `${root}/01-arrival.md`]);
    expect(project.extraFiles?.map((b) => b.path)).toEqual([`${root}/scene-storm.md`]);

    await saveNovelProject(root, project);
    const saved = JSON.parse(f.read('noveler.json')!);
    expect(saved.binder.map((b: { path: string }) => b.path)).toEqual(['02-letter.md', '01-arrival.md']);
  });

  it('starts a new novel in an empty folder with a first chapter', async () => {
    const f = makeFolder('Fresh');
    const root = await webFiles.registerRoot(f.handle);
    const project = await loadNovelProject(root);
    expect(project.binder.map((b) => b.path)).toEqual([`${root}/01-chapter.md`]);
    expect(f.read('01-chapter.md')).toContain('# Chapter One');
  });
});

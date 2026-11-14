import type { WebDirHandle, WebFile, WebFileHandle, WebWritable } from '../services/webFiles';

// An in-memory stand-in for a folder on the writer's disk, for tests.

type FileNode = { kind: 'file'; bytes: Uint8Array; modified: number };
type DirNode = { kind: 'directory'; children: Map<string, FileNode | DirNode> };

const fsError = (name: string, message: string) => Object.assign(new Error(message), { name });
const enc = new TextEncoder();
const dec = new TextDecoder();
/** A counter standing in for modification times: every write or outside edit gets a new value. */
let tick = 0;

export interface Faults {
  /** Make the next write fail part-way (nothing may be committed). */
  failNextWrite?: boolean;
  /** Make the next committed write store different bytes than were written. */
  corruptNextWrite?: boolean;
  removed: string[];
}

export class FakeFileHandle implements WebFileHandle {
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
      lastModified: this.node.modified,
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
        node.modified = ++tick;
      },
      async abort() {
        done = true; // discard: the file keeps its previous content
      },
    };
  }
}

export class FakeDirHandle implements WebDirHandle {
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
      entry = kind === 'file' ? { kind: 'file', bytes: new Uint8Array(), modified: ++tick } : { kind: 'directory', children: new Map() };
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

/**
 * A folder held in memory. `put(path, text)` creates or replaces a file the way another program
 * would (it changes the modified time); `read(path)` returns a file's text.
 */
export const makeFolder = (name: string, files: Record<string, string> = {}) => {
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
    const last = parts[parts.length - 1];
    const existing = dir.children.get(last);
    if (existing?.kind === 'file') {
      // Change the file in place, so handles opened earlier see the outside edit too.
      existing.bytes = enc.encode(text);
      existing.modified = ++tick;
    } else {
      dir.children.set(last, { kind: 'file', bytes: enc.encode(text), modified: ++tick });
    }
  };
  for (const [path, text] of Object.entries(files)) put(path, text);
  const read = (path: string): string | undefined => {
    let entry: FileNode | DirNode | undefined = root;
    for (const part of path.split('/')) entry = entry?.kind === 'directory' ? entry.children.get(part) : undefined;
    return entry?.kind === 'file' ? dec.decode(entry.bytes) : undefined;
  };
  return { handle, faults, read, put };
};

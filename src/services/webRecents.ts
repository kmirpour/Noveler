/**
 * Novels the writer opened recently in this browser, so the welcome screen can offer "Reopen".
 *
 * A browser cannot remember a folder by its path; it hands out a handle, which can be stored in
 * the browser's own database (IndexedDB) and used again later. Access still has to be granted again
 * by the writer, with one click on the novel, so the handle alone gives a page no power.
 * Everything here stays in this browser; nothing is sent anywhere.
 */
import { ensureAccess, registerRoot, sameEntry, type WebDirHandle } from './webFiles';

export interface RecentNovel {
  id: string;
  name: string;
  lastOpened: number;
}

interface StoredNovel extends RecentNovel {
  handle: WebDirHandle;
}

/** Where the remembered novels are kept. */
export interface NovelStore {
  getAll(): Promise<StoredNovel[]>;
  put(novel: StoredNovel): Promise<void>;
  delete(id: string): Promise<void>;
}

const MAX_RECENT = 8;

export function createRecents(
  store: NovelStore,
  now: () => number = () => Date.now(),
  makeId: () => string = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
) {
  return {
    /** Remembers a novel folder (or moves it to the top if it is already remembered). */
    async remember(handle: WebDirHandle): Promise<void> {
      try {
        const all = await store.getAll();
        let existing: StoredNovel | undefined;
        for (const novel of all) {
          if (await sameEntry(novel.handle, handle)) {
            existing = novel;
            break;
          }
        }
        const entry: StoredNovel = { id: existing?.id ?? makeId(), name: handle.name, lastOpened: now(), handle };
        await store.put(entry);
        const kept = [...all.filter((n) => n.id !== entry.id), entry].sort((a, b) => b.lastOpened - a.lastOpened);
        for (const old of kept.slice(MAX_RECENT)) await store.delete(old.id);
      } catch (err) {
        // A browser that cannot store handles simply has no recent list.
        console.warn('Could not remember this novel:', err);
      }
    },

    /** The remembered novels, most recent first. */
    async list(): Promise<RecentNovel[]> {
      try {
        const all = await store.getAll();
        return all
          .map(({ id, name, lastOpened }) => ({ id, name, lastOpened }))
          .sort((a, b) => b.lastOpened - a.lastOpened);
      } catch {
        return [];
      }
    },

    /**
     * Opens a remembered novel again. Must be called from a click: the browser asks the writer for
     * permission to edit the folder, and refuses to ask otherwise.
     */
    async reopen(id: string): Promise<{ path: string; name: string } | null> {
      const novel = (await store.getAll()).find((n) => n.id === id);
      if (!novel) return null;
      if (!(await ensureAccess(novel.handle, true))) {
        throw new Error(`Noveler needs your permission to edit "${novel.name}". Try again and choose Allow.`);
      }
      const path = await registerRoot(novel.handle);
      await store.put({ ...novel, lastOpened: now() });
      return { path, name: path.slice(1) };
    },

    async forget(id: string): Promise<void> {
      try {
        await store.delete(id);
      } catch {
        // nothing to forget
      }
    },
  };
}

// --- The browser's database --------------------------------------------------------------------------

const DB_NAME = 'noveler-web';
const STORE_NAME = 'novels';

function indexedDbStore(): NovelStore {
  if (typeof indexedDB === 'undefined') {
    return { getAll: async () => [], put: async () => undefined, delete: async () => undefined };
  }
  let opened: Promise<IDBDatabase> | null = null;
  const open = () =>
    (opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }));

  const run = async <T>(mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await open();
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  return {
    getAll: () => run('readonly', (s) => s.getAll() as IDBRequest<StoredNovel[]>),
    put: async (novel) => {
      await run('readwrite', (s) => s.put(novel));
    },
    delete: async (id) => {
      await run('readwrite', (s) => s.delete(id));
    },
  };
}

let shared: ReturnType<typeof createRecents> | null = null;

/** The recent-novels list kept in this browser. */
export function recents() {
  return (shared ??= createRecents(indexedDbStore()));
}

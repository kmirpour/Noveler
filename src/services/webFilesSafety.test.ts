import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as webFiles from './webFiles';
import * as fileService from './fileService';
import { createRecents, type NovelStore } from './webRecents';
import { makeFolder, FakeDirHandle } from '../test/fakeFolder';

const T0 = 1_790_000_000; // seconds since the Unix epoch
let now = T0;
const advance = (secs: number) => {
  now += secs;
};

beforeEach(() => {
  webFiles.resetWebFilesForTests();
  now = T0;
  webFiles.setClockForTests(() => now * 1000);
});
afterEach(() => {
  webFiles.setClockForTests(null);
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

const backupFolder = (name: string) => `.noveler/backups/${name}`;

describe('rolling backups', () => {
  it('keeps the previous version when a file is saved over, at most one every ten minutes', async () => {
    const f = makeFolder('Novel', { '01-a.md': 'v1' });
    const root = await webFiles.registerRoot(f.handle);
    const path = `${root}/01-a.md`;

    await webFiles.writeText(path, 'v2');
    let list = await webFiles.listBackups(path);
    expect(list).toHaveLength(1);
    // Same layout and name format as the desktop app, so either can read the other's backups.
    expect(list[0].name).toBe(`${webFiles.formatStamp(T0)}_01-a.md`);
    expect(f.read(`${backupFolder('01-a.md')}/${list[0].name}`)).toBe('v1');

    advance(60);
    await webFiles.writeText(path, 'v3');
    expect(await webFiles.listBackups(path)).toHaveLength(1);

    advance(11 * 60);
    await webFiles.writeText(path, 'v4');
    list = await webFiles.listBackups(path);
    expect(list).toHaveLength(2);
    expect(list[0].timestamp).toBeGreaterThan(list[1].timestamp); // newest first
    expect(await webFiles.readBackup(path, list[0].name)).toBe('v3');
    expect(await webFiles.readBackup(path, list[1].name)).toBe('v1');
  });

  it('keeps only the newest twenty', async () => {
    const f = makeFolder('Novel', { '01-a.md': 'v0' });
    const root = await webFiles.registerRoot(f.handle);
    const path = `${root}/01-a.md`;
    for (let i = 1; i <= 25; i++) {
      advance(11 * 60);
      await webFiles.writeText(path, `v${i}`);
    }
    const list = await webFiles.listBackups(path);
    expect(list).toHaveLength(20);
    // 25 saves backed up v0..v24; the oldest five are gone.
    expect(await webFiles.readBackup(path, list[19].name)).toBe('v5');
    expect(await webFiles.readBackup(path, list[0].name)).toBe('v24');
  });

  it('does not back up new files or its own bookkeeping', async () => {
    const f = makeFolder('Novel');
    const root = await webFiles.registerRoot(f.handle);
    await webFiles.writeText(`${root}/02-new.md`, 'x');
    await webFiles.writeText(`${root}/.noveler/snapshots.json`, '[]');
    await webFiles.writeText(`${root}/.noveler/snapshots.json`, '[1]');
    expect(await webFiles.listBackups(`${root}/02-new.md`)).toEqual([]);
    expect(f.read(backupFolder('snapshots.json'))).toBeUndefined();
    expect(f.handle.node.children.has('.noveler')).toBe(true);
  });

  it('still saves when the backup cannot be made', async () => {
    // A plain file where the .noveler folder should be: the backup folder cannot be created.
    const f = makeFolder('Novel', { '01-a.md': 'v1', '.noveler': 'in the way' });
    const root = await webFiles.registerRoot(f.handle);
    await webFiles.writeText(`${root}/01-a.md`, 'v2');
    expect(f.read('01-a.md')).toBe('v2');
  });

  it('only reads real backups', async () => {
    const f = makeFolder('Novel', { '01-a.md': 'v1', '02-b.md': 'secret' });
    const root = await webFiles.registerRoot(f.handle);
    await webFiles.writeText(`${root}/01-a.md`, 'v2');
    for (const bad of ['../02-b.md', '02-b.md', `${webFiles.formatStamp(T0)}_x/../../02-b.md`, '']) {
      await expect(webFiles.readBackup(`${root}/01-a.md`, bad), bad).rejects.toThrow();
    }
  });

  it('writes and reads timestamps the way the desktop app does', () => {
    for (const secs of [0, 951_782_400, T0, 4_102_444_799]) {
      expect(webFiles.parseStamp(`${webFiles.formatStamp(secs)}_chapter.md`)).toBe(secs);
    }
    expect(webFiles.formatStamp(0)).toBe('1970-01-01_000000');
    expect(webFiles.parseStamp('not-a-backup.md')).toBeNull();
  });

  it('keeps no backups for a file opened on its own', async () => {
    const f = makeFolder('Elsewhere', { 'loose.md': 'a' });
    const loose = await webFiles.registerFile(await f.handle.getFileHandle('loose.md'));
    await webFiles.writeText(loose, 'b');
    expect(await webFiles.listBackups(loose)).toEqual([]);
    expect(await webFiles.saveBackupCopy(loose, 'mine')).toBe(false);
    expect(webFiles.supportsBackups(loose)).toBe(false);
    expect(fileService.supportsBackups(loose)).toBe(false);
  });

  it('is listed through the app\'s file service, not just in the desktop app', async () => {
    const f = makeFolder('Novel', { '01-a.md': 'v1' });
    const root = await webFiles.registerRoot(f.handle);
    await fileService.saveFile(`${root}/01-a.md`, 'v2');
    const list = await fileService.listBackups(`${root}/01-a.md`);
    expect(list).toHaveLength(1);
    expect(await fileService.readBackup(`${root}/01-a.md`, list[0].name)).toBe('v1');
    expect(fileService.supportsBackups(`${root}/01-a.md`)).toBe(true);
    expect(await fileService.listBackups('/Unopened/x.md')).toEqual([]);
  });
});

describe('changes made outside Noveler', () => {
  it('saves normally, including repeatedly, when nothing else touched the file', async () => {
    const f = makeFolder('Novel', { '01-a.md': 'v1' });
    const root = await webFiles.registerRoot(f.handle);
    const path = `${root}/01-a.md`;
    expect(await webFiles.readTextForEditing(path)).toBe('v1');
    await webFiles.writeText(path, 'v2');
    await webFiles.writeText(path, 'v3');
    expect(f.read('01-a.md')).toBe('v3');
    expect(await webFiles.hasChangedOnDisk(path)).toBe(false);
  });

  it('refuses to overwrite a file that something else changed, and leaves it alone', async () => {
    const f = makeFolder('Novel', { '01-a.md': 'v1' });
    const root = await webFiles.registerRoot(f.handle);
    const path = `${root}/01-a.md`;
    await webFiles.readTextForEditing(path);

    f.put('01-a.md', 'their version'); // another tab, the desktop app, a sync tool...
    expect(await webFiles.hasChangedOnDisk(path)).toBe(true);
    await expect(webFiles.writeText(path, 'my version')).rejects.toBeInstanceOf(webFiles.ExternalChangeError);
    expect(f.read('01-a.md')).toBe('their version');
    expect(fileService.isExternalChangeError(new webFiles.ExternalChangeError(path))).toBe(true);
    expect(fileService.isExternalChangeError(new Error('other'))).toBe(false);
  });

  it('lets the writer overwrite on purpose, and always backs up the other version first', async () => {
    const f = makeFolder('Novel', { '01-a.md': 'v1' });
    const root = await webFiles.registerRoot(f.handle);
    const path = `${root}/01-a.md`;
    await webFiles.readTextForEditing(path);
    await webFiles.writeText(path, 'v2'); // routine backup of v1 just now

    f.put('01-a.md', 'their version');
    advance(30); // well inside the ten-minute interval
    await webFiles.writeText(path, 'my version', { overwriteExternalChanges: true });

    expect(f.read('01-a.md')).toBe('my version');
    const list = await webFiles.listBackups(path);
    expect(list).toHaveLength(2);
    expect(await webFiles.readBackup(path, list[0].name)).toBe('their version');
    // ...and the guard is reset: the next normal save goes through.
    await webFiles.writeText(path, 'my version, edited');
    expect(f.read('01-a.md')).toBe('my version, edited');
  });

  it('only guards the file open in the editor', async () => {
    const f = makeFolder('Novel', { '01-a.md': 'v1', 'noveler.json': '{}' });
    const root = await webFiles.registerRoot(f.handle);
    await webFiles.readText(`${root}/noveler.json`); // an ordinary read does not start watching
    f.put('noveler.json', '{"changed":true}');
    await webFiles.writeText(`${root}/noveler.json`, '{"mine":true}');
    expect(f.read('noveler.json')).toBe('{"mine":true}');

    await webFiles.readTextForEditing(`${root}/01-a.md`);
    f.put('01-a.md', 'theirs');
    webFiles.untrackUnless(`${root}/02-b.md`); // another document was opened
    await webFiles.writeText(`${root}/01-a.md`, 'mine');
    expect(f.read('01-a.md')).toBe('mine');
  });

  it('keeps the writer\'s unsaved text in the backups on request', async () => {
    const f = makeFolder('Novel', { '01-a.md': 'v1' });
    const root = await webFiles.registerRoot(f.handle);
    expect(await webFiles.saveBackupCopy(`${root}/01-a.md`, 'unsaved edits')).toBe(true);
    const list = await webFiles.listBackups(`${root}/01-a.md`);
    expect(await webFiles.readBackup(`${root}/01-a.md`, list[0].name)).toBe('unsaved edits');
  });

  it('is watched through the app\'s file service, and not at all in the desktop app', async () => {
    const f = makeFolder('Novel', { '01-a.md': 'v1' });
    const root = await webFiles.registerRoot(f.handle);
    const path = `${root}/01-a.md`;
    expect((await fileService.readFileForEditing(path)).content).toBe('v1');
    expect(await fileService.fileChangedOnDisk(path)).toBe(false);
    f.put('01-a.md', 'theirs');
    expect(await fileService.fileChangedOnDisk(path)).toBe(true);
    fileService.stopTrackingExcept('/Novel/other.md');
    expect(await fileService.fileChangedOnDisk(path)).toBe(false);

    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    expect(await fileService.fileChangedOnDisk(path)).toBe(false);
    expect(await fileService.keepCopyOfUnsavedText(path, 'x')).toBe(false);
  });
});

describe('permission and recent novels', () => {
  const memoryStore = (): NovelStore & { all: Map<string, unknown> } => {
    const all = new Map<string, unknown>();
    return {
      all,
      getAll: async () => [...all.values()] as never,
      put: async (n) => void all.set(n.id, n),
      delete: async (id) => void all.delete(id),
    };
  };
  const folder = (name: string, access: string) => {
    const handle = makeFolder(name).handle as FakeDirHandle & {
      asked: number;
      queryPermission: () => Promise<string>;
      requestPermission: () => Promise<string>;
    };
    handle.asked = 0;
    handle.queryPermission = async () => (access === 'granted' ? 'granted' : 'prompt');
    handle.requestPermission = async () => {
      handle.asked += 1;
      return access === 'allow' ? 'granted' : 'denied';
    };
    return handle;
  };

  it('remembers novels, newest first, without duplicates, and at most eight', async () => {
    let clockMs = 1000;
    const recents = createRecents(memoryStore(), () => (clockMs += 1000), (() => { let n = 0; return () => `id${++n}`; })());
    const a = folder('A', 'granted');
    await recents.remember(a);
    await recents.remember(folder('B', 'granted'));
    await recents.remember(a); // opened again: moves to the top
    expect((await recents.list()).map((n) => n.name)).toEqual(['A', 'B']);

    for (let i = 0; i < 10; i++) await recents.remember(folder(`N${i}`, 'granted'));
    const names = (await recents.list()).map((n) => n.name);
    expect(names).toHaveLength(8);
    expect(names[0]).toBe('N9');
    expect(names).not.toContain('B');
  });

  it('reopens a novel after the writer allows access, and refuses when they do not', async () => {
    const recents = createRecents(memoryStore());
    const allowed = folder('Allowed', 'allow');
    const denied = folder('Denied', 'deny');
    const open = folder('Open', 'granted');
    await recents.remember(allowed);
    await recents.remember(denied);
    await recents.remember(open);
    const byName = Object.fromEntries((await recents.list()).map((n) => [n.name, n.id]));

    const reopened = await recents.reopen(byName.Allowed);
    expect(reopened?.path).toBe('/Allowed');
    expect(allowed.asked).toBe(1);
    expect(webFiles.owns('/Allowed/01-chapter.md')).toBe(true);

    await expect(recents.reopen(byName.Denied)).rejects.toThrow('needs your permission');
    expect(webFiles.owns('/Denied/01-chapter.md')).toBe(false);

    await recents.reopen(byName.Open);
    expect(open.asked).toBe(0); // already granted: no question
    expect(await recents.reopen('missing')).toBeNull();
  });

  it('forgets a novel without touching it, and survives a store that fails', async () => {
    const store = memoryStore();
    const recents = createRecents(store);
    await recents.remember(folder('A', 'granted'));
    const [{ id }] = await recents.list();
    await recents.forget(id);
    expect(await recents.list()).toEqual([]);

    const broken = createRecents({ getAll: async () => { throw new Error('no storage'); }, put: async () => undefined, delete: async () => undefined });
    await expect(broken.remember(folder('B', 'granted'))).resolves.toBeUndefined();
    expect(await broken.list()).toEqual([]);
  });

  it('asks for access only when told it may', async () => {
    const h = folder('H', 'allow');
    expect(await webFiles.ensureAccess(h, false)).toBe(false);
    expect(h.asked).toBe(0);
    expect(await webFiles.ensureAccess(h, true)).toBe(true);
    expect(await webFiles.ensureAccess({}, true)).toBe(true); // browsers without the permission API
  });
});

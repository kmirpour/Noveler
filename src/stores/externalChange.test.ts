import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from './editorStore';
import { useDialogStore } from '../services/dialogs';
import * as fileService from '../services/fileService';
import * as webFiles from '../services/webFiles';
import { makeFolder } from '../test/fakeFolder';

const store = () => useEditorStore.getState();

/** Answers the question on screen the way the dialog's buttons do. */
async function answer(choice: string | null) {
  await vi.waitFor(() => expect(useDialogStore.getState().queue.length).toBe(1));
  const request = useDialogStore.getState().queue[0];
  if (request.kind !== 'choice') throw new Error('expected a choice dialog');
  request.resolve(choice);
  useDialogStore.getState().shift();
  return request;
}

async function openChapter(text = 'v1') {
  const f = makeFolder('Novel', { '01-a.md': text });
  const root = await webFiles.registerRoot(f.handle);
  const path = `${root}/01-a.md`;
  await fileService.readFileForEditing(path); // the editor opens the file
  useEditorStore.setState({
    projectPath: null,
    novelProject: null,
    editorInstance: null,
    filePath: path,
    fileName: '01-a.md',
    markdownContent: text,
    isDirty: false,
    autoSaveEnabled: true,
  });
  return { f, path };
}

beforeEach(() => {
  webFiles.resetWebFilesForTests();
  useDialogStore.setState({ queue: [] });
});
afterEach(() => {
  useDialogStore.setState({ queue: [] });
  useEditorStore.setState({ filePath: null, fileName: null, isDirty: false });
});

describe('saving a file that was changed outside Noveler', () => {
  it('saves silently when nothing else touched the file', async () => {
    const { f } = await openChapter();
    useEditorStore.setState({ markdownContent: 'v2', isDirty: true });
    expect(await store().saveFileAction()).toBe(true);
    expect(f.read('01-a.md')).toBe('v2');
    expect(useDialogStore.getState().queue).toEqual([]);
  });

  it('asks what to keep, and "keep mine" overwrites while backing up the other version', async () => {
    const { f, path } = await openChapter();
    f.put('01-a.md', 'their version');
    useEditorStore.setState({ markdownContent: 'my version', isDirty: true });

    const saving = store().saveFileAction();
    const request = await answer('mine');
    expect(request.title).toContain('was changed outside Noveler');
    expect(await saving).toBe(true);

    expect(f.read('01-a.md')).toBe('my version');
    expect(store().isDirty).toBe(false);
    const backups = await webFiles.listBackups(path);
    expect(await webFiles.readBackup(path, backups[0].name)).toBe('their version');
  });

  it('"use the other version" loads it, and keeps the writer\'s text in the backups', async () => {
    const { f, path } = await openChapter();
    f.put('01-a.md', 'their version');
    useEditorStore.setState({ markdownContent: 'my version', isDirty: true });

    const saving = store().saveFileAction();
    await answer('theirs');
    expect(await saving).toBe(true);

    expect(f.read('01-a.md')).toBe('their version');
    expect(store().markdownContent).toBe('their version');
    expect(store().isDirty).toBe(false);
    const backups = await webFiles.listBackups(path);
    expect(await webFiles.readBackup(path, backups[0].name)).toBe('my version');
  });

  it('"decide later" changes nothing, and autosave does not stack up more questions', async () => {
    const { f } = await openChapter();
    f.put('01-a.md', 'their version');
    useEditorStore.setState({ markdownContent: 'my version', isDirty: true });

    const first = store().saveFileAction();
    await vi.waitFor(() => expect(useDialogStore.getState().queue.length).toBe(1));
    // Autosave fires again while the question is still on screen.
    expect(await store().saveFileAction()).toBe(false);
    expect(useDialogStore.getState().queue.length).toBe(1);

    await answer(null);
    expect(await first).toBe(false);
    expect(f.read('01-a.md')).toBe('their version');
    expect(store().isDirty).toBe(true);
    expect(store().markdownContent).toBe('my version');
  });

  it('offers "save as" instead of the other version for a file opened on its own', async () => {
    const f = makeFolder('Elsewhere', { 'loose.md': 'v1' });
    const path = await webFiles.registerFile(await f.handle.getFileHandle('loose.md'));
    await fileService.readFileForEditing(path);
    useEditorStore.setState({
      filePath: path,
      fileName: 'loose.md',
      markdownContent: 'mine',
      isDirty: true,
      editorInstance: null,
      novelProject: null,
      projectPath: null,
    });
    f.put('loose.md', 'theirs');

    const saving = store().saveFileAction();
    const request = await answer(null);
    expect(request.kind === 'choice' && request.choices.map((c) => c.id)).toEqual(['mine', 'saveas']);
    expect(request.message).toContain('replaces the other one for good');
    expect(await saving).toBe(false);
  });
});

describe('noticing outside changes when the tab regains focus', () => {
  it('loads the new version of a file with no unsaved edits', async () => {
    const { f } = await openChapter('v1');
    f.put('01-a.md', 'edited elsewhere');
    await store().checkForOutsideChangesAction();
    expect(store().markdownContent).toBe('edited elsewhere');
    expect(store().isDirty).toBe(false);
    expect(store().statusMessage).toContain('changed outside Noveler');
  });

  it('leaves a file with unsaved edits alone (the save will ask)', async () => {
    const { f } = await openChapter('v1');
    f.put('01-a.md', 'edited elsewhere');
    useEditorStore.setState({ markdownContent: 'my unsaved edits', isDirty: true });
    await store().checkForOutsideChangesAction();
    expect(store().markdownContent).toBe('my unsaved edits');
    expect(store().isDirty).toBe(true);
  });

  it('does nothing when the file is unchanged', async () => {
    await openChapter('v1');
    useEditorStore.setState({ statusMessage: null });
    await store().checkForOutsideChangesAction();
    expect(store().statusMessage).toBeNull();
  });
});

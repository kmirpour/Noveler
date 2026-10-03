import { beforeEach, describe, expect, it, vi } from 'vitest';

// Replace only the dialog-facing part of the file service.
vi.mock('../services/fileService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/fileService')>();
  return { ...actual, promptUnsavedChanges: vi.fn() };
});

import * as fileService from '../services/fileService';
import { loadRecovery, saveRecovery } from '../services/recovery';
import { useEditorStore } from './editorStore';

const prompt = vi.mocked(fileService.promptUnsavedChanges);

beforeEach(() => {
  localStorage.clear();
  prompt.mockReset();
  useEditorStore.setState({
    isDirty: false,
    fileName: 'ch1.md',
    filePath: 'C:/novel/ch1.md',
    markdownContent: 'Hello',
    editorInstance: null,
  });
});

describe('confirmDiscardIfDirty', () => {
  it('does not prompt when there are no unsaved changes', async () => {
    expect(await useEditorStore.getState().confirmDiscardIfDirty()).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
  });

  it('blocks the action when the user cancels', async () => {
    useEditorStore.setState({ isDirty: true });
    prompt.mockResolvedValue('cancel');
    expect(await useEditorStore.getState().confirmDiscardIfDirty()).toBe(false);
  });

  it('allows the action and clears recovery when the user discards', async () => {
    useEditorStore.setState({ isDirty: true });
    saveRecovery({ markdown: 'draft', fileName: null, filePath: null });
    prompt.mockResolvedValue('discard');
    expect(await useEditorStore.getState().confirmDiscardIfDirty()).toBe(true);
    expect(loadRecovery()).toBeNull();
  });

  it('saves first when the user chooses save', async () => {
    useEditorStore.setState({ isDirty: true });
    prompt.mockResolvedValue('save');
    const save = vi.fn().mockResolvedValue(true);
    useEditorStore.setState({ saveFileAction: save });
    expect(await useEditorStore.getState().confirmDiscardIfDirty()).toBe(true);
    expect(save).toHaveBeenCalledOnce();
  });

  it('blocks the action if the save fails or is cancelled', async () => {
    useEditorStore.setState({ isDirty: true });
    prompt.mockResolvedValue('save');
    useEditorStore.setState({ saveFileAction: vi.fn().mockResolvedValue(false) });
    expect(await useEditorStore.getState().confirmDiscardIfDirty()).toBe(false);
  });
});

describe('newFile', () => {
  it('keeps the current document when the user cancels', async () => {
    useEditorStore.setState({ isDirty: true });
    prompt.mockResolvedValue('cancel');
    expect(await useEditorStore.getState().newFile()).toBe(false);
    expect(useEditorStore.getState().markdownContent).toBe('Hello');
    expect(useEditorStore.getState().filePath).toBe('C:/novel/ch1.md');
  });

  it('resets the document when it is clean', async () => {
    expect(await useEditorStore.getState().newFile()).toBe(true);
    const s = useEditorStore.getState();
    expect(s.markdownContent).toBe('');
    expect(s.filePath).toBeNull();
    expect(s.isDirty).toBe(false);
  });
});

describe('openFileByPath', () => {
  it('rejects unsupported file types without prompting', async () => {
    useEditorStore.setState({ isDirty: true });
    expect(await useEditorStore.getState().openFileByPath('C:/novel/cover.png')).toBe(false);
    expect(prompt).not.toHaveBeenCalled();
  });
});

describe('loadDocument', () => {
  it('can load a restored document as dirty', () => {
    useEditorStore.getState().loadDocument({
      markdown: 'Recovered text',
      fileName: null,
      filePath: null,
      dirty: true,
    });
    const s = useEditorStore.getState();
    expect(s.isDirty).toBe(true);
    expect(s.markdownContent).toBe('Recovered text');
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { appMode, shortcutLabel, supportsGit } from './appMode';
import { useEditorStore } from '../stores/editorStore';

const w = window as unknown as Record<string, unknown>;

afterEach(() => {
  delete w.__TAURI_INTERNALS__;
  delete w.showDirectoryPicker;
  delete w.showOpenFilePicker;
  document.title = '';
});

describe('what the app can offer where it runs', () => {
  it('tells the desktop app, a browser that can open folders, and any other browser apart', () => {
    expect(appMode()).toBe('basic'); // a plain browser: no folder access

    w.showDirectoryPicker = () => undefined;
    expect(appMode()).toBe('basic'); // both pickers are needed
    w.showOpenFilePicker = () => undefined;
    expect(appMode()).toBe('folders');

    w.__TAURI_INTERNALS__ = {};
    expect(appMode()).toBe('desktop');
  });

  it('offers git only in the desktop app', () => {
    expect(supportsGit()).toBe(false);
    w.__TAURI_INTERNALS__ = {};
    expect(supportsGit()).toBe(true);
  });

  it('shows the shortcut that works where the app runs', () => {
    expect(shortcutLabel('Ctrl+N', 'Alt+Shift+N')).toBe('Alt+Shift+N');
    w.__TAURI_INTERNALS__ = {};
    expect(shortcutLabel('Ctrl+N', 'Alt+Shift+N')).toBe('Ctrl+N');
  });
});

describe('in a browser', () => {
  it('puts the open file in the tab title', () => {
    useEditorStore.getState().setFileName('02-letter.md');
    expect(document.title).toBe('02-letter.md — Noveler');
    useEditorStore.getState().setDirty(true);
    expect(document.title).toBe('02-letter.md • — Noveler');
    useEditorStore.getState().setFileName(null);
    useEditorStore.getState().setDirty(false);
    expect(document.title).toBe('Untitled — Noveler');
  });

  it('explains that saved versions and GitHub push need the desktop app, without trying them', async () => {
    useEditorStore.setState({ projectPath: '/Novel', statusMessage: null });
    expect(await useEditorStore.getState().commitVersionAction()).toBe(false);
    expect(useEditorStore.getState().statusMessage).toContain('desktop app');
    useEditorStore.setState({ statusMessage: null });
    expect(await useEditorStore.getState().syncGitAction()).toBe(false);
    expect(useEditorStore.getState().statusMessage).toContain('desktop app');
    useEditorStore.setState({ projectPath: null });
  });
});

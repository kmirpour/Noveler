import { beforeEach, describe, expect, it } from 'vitest';
import { addRecentFile, DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings';

beforeEach(() => {
  localStorage.clear();
});

describe('settings service', () => {
  it('loads default settings when nothing is saved', () => {
    const settings = loadSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('migrates legacy noveler-theme key if present', () => {
    localStorage.setItem('noveler-theme', 'dark');
    const settings = loadSettings();
    expect(settings.theme).toBe('dark');
  });

  it('saves and loads partial updates', () => {
    saveSettings({ theme: 'sepia', fontSize: 20, viewMode: 'split' });
    const loaded = loadSettings();
    expect(loaded.theme).toBe('sepia');
    expect(loaded.fontSize).toBe(20);
    expect(loaded.viewMode).toBe('split');
    expect(loaded.fontFamily).toBe(DEFAULT_SETTINGS.fontFamily);
  });

  it('saves and loads writing preference settings', () => {
    saveSettings({ focusMode: true, typewriterMode: true, dailyWordGoal: 2000 });
    const loaded = loadSettings();
    expect(loaded.focusMode).toBe(true);
    expect(loaded.typewriterMode).toBe(true);
    expect(loaded.dailyWordGoal).toBe(2000);
  });

  it('adds recent files without duplicates and caps at 10', () => {
    for (let i = 1; i <= 15; i++) {
      addRecentFile(`C:/novel/chapter${i}.md`);
    }
    const loaded = loadSettings();
    expect(loaded.recentFiles).toHaveLength(10);
    expect(loaded.recentFiles[0]).toBe('C:/novel/chapter15.md');

    // Adding existing file brings it to the top
    addRecentFile('C:/novel/chapter10.md');
    const updated = loadSettings();
    expect(updated.recentFiles[0]).toBe('C:/novel/chapter10.md');
    expect(updated.recentFiles.filter((f) => f === 'C:/novel/chapter10.md')).toHaveLength(1);
  });
});

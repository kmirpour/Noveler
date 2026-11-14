import { canOpenFolders, isTauri } from './fileService';

/**
 * Where Noveler is running, which decides what it can offer:
 *  - 'desktop': the desktop app (everything);
 *  - 'folders': a browser that can open a folder and save back into it (desktop Chrome, Edge, Opera);
 *  - 'basic': any other browser, which can only work on a copy and download the result.
 */
export type AppMode = 'desktop' | 'folders' | 'basic';

export function appMode(): AppMode {
  if (isTauri()) return 'desktop';
  return canOpenFolders() ? 'folders' : 'basic';
}

/** Saved versions (git) and GitHub push need the desktop app: a browser cannot run git. */
export function supportsGit(): boolean {
  return isTauri();
}

/**
 * A shortcut as it should be shown and used. Browsers keep some combinations for themselves
 * (Ctrl+N opens a window, Ctrl+Shift+T reopens a tab) and never pass them to a page, so the web
 * version uses an Alt+Shift alternative for those.
 */
export function shortcutLabel(desktop: string, web: string): string {
  return isTauri() ? desktop : web;
}

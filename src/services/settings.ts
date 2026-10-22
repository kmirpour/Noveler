export type Theme = 'sepia' | 'light' | 'dark' | 'forest' | 'nord';
export type ViewMode = 'editor' | 'split' | 'preview' | 'scratchpad';
export type FontFamily = 'serif' | 'sans' | 'mono';

export interface AppSettings {
  theme: Theme;
  viewMode: ViewMode;
  sidebarOpen: boolean;
  autoSaveEnabled: boolean;
  autoSaveIntervalMs: number;
  fontFamily: FontFamily;
  fontSize: number;
  paragraphIndent: boolean;
  focusMode: boolean;
  typewriterMode: boolean;
  dimUnfocused: boolean;
  spellCheckEnabled: boolean;
  dailyWordGoal: number;
  lastProjectPath: string | null;
  recentFiles: string[];
}

const SETTINGS_KEY = 'noveler-settings';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'sepia',
  viewMode: 'editor',
  sidebarOpen: false,
  autoSaveEnabled: true,
  autoSaveIntervalMs: 1500,
  fontFamily: 'serif',
  fontSize: 18,
  paragraphIndent: true,
  focusMode: false,
  typewriterMode: false,
  dimUnfocused: false,
  spellCheckEnabled: true,
  dailyWordGoal: 1000,
  lastProjectPath: null,
  recentFiles: [],
};

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      // Check legacy theme key
      const legacyTheme = localStorage.getItem('noveler-theme') as Theme | null;
      if (
        legacyTheme &&
        (legacyTheme === 'sepia' ||
          legacyTheme === 'light' ||
          legacyTheme === 'dark' ||
          legacyTheme === 'forest' ||
          legacyTheme === 'nord')
      ) {
        return { ...DEFAULT_SETTINGS, theme: legacyTheme };
      }
      return { ...DEFAULT_SETTINGS };
    }
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      recentFiles: Array.isArray(parsed.recentFiles) ? parsed.recentFiles : [],
    };
  } catch (err) {
    console.warn('Failed to parse saved settings, falling back to defaults:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(partial: Partial<AppSettings>): AppSettings {
  const current = loadSettings();
  const updated: AppSettings = { ...current, ...partial };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    // Also keep data-theme synchronized on the root element
    if (typeof document !== 'undefined' && updated.theme) {
      document.documentElement.setAttribute('data-theme', updated.theme);
    }
  } catch (err) {
    console.warn('Failed to persist settings:', err);
  }
  return updated;
}

export function addRecentFile(filePath: string): AppSettings {
  const current = loadSettings();
  const filtered = current.recentFiles.filter((p) => p !== filePath);
  const updatedRecent = [filePath, ...filtered].slice(0, 10);
  return saveSettings({ recentFiles: updatedRecent });
}

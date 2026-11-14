import { type Theme, applyTheme, isTheme } from './themes';

export type { Theme } from './themes';
export type ViewMode = 'editor' | 'split' | 'preview' | 'scratchpad' | 'reference';
export type SceneTitleMode = 'hide' | 'stars' | 'show';

/**
 * Typefaces for the writing canvas. All of them ship with Windows (most also with macOS), so
 * nothing is downloaded; each stack falls back gracefully where a face is missing.
 */
export const TYPEFACES = [
  { id: 'serif', label: 'Georgia', kind: 'Serif', stack: "Georgia, 'Palatino Linotype', Palatino, 'Sitka Text', serif" },
  { id: 'palatino', label: 'Palatino', kind: 'Serif', stack: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif" },
  { id: 'sitka', label: 'Sitka Text', kind: 'Serif', stack: "'Sitka Text', 'Palatino Linotype', Georgia, serif" },
  { id: 'cambria', label: 'Cambria', kind: 'Serif', stack: "Cambria, 'Hoefler Text', Georgia, serif" },
  { id: 'constantia', label: 'Constantia', kind: 'Serif', stack: "Constantia, 'Iowan Old Style', Georgia, serif" },
  { id: 'garamond', label: 'Garamond', kind: 'Serif', stack: "Garamond, 'EB Garamond', 'Adobe Garamond Pro', Georgia, serif" },
  { id: 'times', label: 'Times New Roman', kind: 'Serif', stack: "'Times New Roman', Times, serif" },
  { id: 'sans', label: 'System Sans', kind: 'Sans-serif', stack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { id: 'calibri', label: 'Calibri', kind: 'Sans-serif', stack: "Calibri, Candara, 'Segoe UI', sans-serif" },
  { id: 'verdana', label: 'Verdana', kind: 'Sans-serif', stack: 'Verdana, Geneva, sans-serif' },
  { id: 'mono', label: 'Consolas', kind: 'Monospace', stack: "Consolas, 'Courier New', Monaco, monospace" },
  { id: 'courier', label: 'Courier New', kind: 'Monospace', stack: "'Courier New', Courier, monospace" },
] as const;

export type FontFamily = (typeof TYPEFACES)[number]['id'];

export function typefaceInfo(id: FontFamily) {
  return TYPEFACES.find((t) => t.id === id) ?? TYPEFACES[0];
}

export const FONT_SIZE_RANGE = { min: 12, max: 32 };
export const LINE_HEIGHT_RANGE = { min: 1.3, max: 2.4 };
export const LINE_WIDTH_RANGE = { min: 520, max: 1100 };

export interface AppSettings {
  theme: Theme;
  viewMode: ViewMode;
  sidebarOpen: boolean;
  autoSaveEnabled: boolean;
  autoSaveIntervalMs: number;
  fontFamily: FontFamily;
  fontSize: number;
  /** Line spacing of the writing canvas (unitless multiplier). */
  lineHeight: number;
  /** Maximum width of the text column, in pixels. */
  lineWidth: number;
  paragraphIndent: boolean;
  sceneTitleMode: SceneTitleMode;
  /** Turn straight quotes into curly quotes as you type. */
  smartQuotes: boolean;
  focusMode: boolean;
  typewriterMode: boolean;
  dimUnfocused: boolean;
  /** Highlight words repeated within a few lines. */
  showEchoes: boolean;
  spellCheckEnabled: boolean;
  /** Sends paragraphs to the LanguageTool web service for grammar checking. Off unless the writer opts in. */
  onlineGrammarCheck: boolean;
  dailyWordGoal: number;
  lastProjectPath: string | null;
  recentFiles: string[];
  /** Novel folders opened recently, newest first. */
  recentProjects: string[];
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
  lineHeight: 1.85,
  lineWidth: 780,
  paragraphIndent: true,
  sceneTitleMode: 'show',
  smartQuotes: false,
  focusMode: false,
  typewriterMode: false,
  dimUnfocused: false,
  showEchoes: false,
  spellCheckEnabled: true,
  onlineGrammarCheck: false,
  dailyWordGoal: 1000,
  lastProjectPath: null,
  recentFiles: [],
  recentProjects: [],
};

const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      const legacyTheme = localStorage.getItem('noveler-theme');
      return isTheme(legacyTheme) ? { ...DEFAULT_SETTINGS, theme: legacyTheme } : { ...DEFAULT_SETTINGS };
    }
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    // Saved values are validated so a setting written by an older or newer version can't break the app.
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      theme: isTheme(parsed.theme) ? parsed.theme : DEFAULT_SETTINGS.theme,
      fontFamily: TYPEFACES.some((t) => t.id === parsed.fontFamily)
        ? (parsed.fontFamily as FontFamily)
        : DEFAULT_SETTINGS.fontFamily,
      fontSize: clamp(parsed.fontSize, FONT_SIZE_RANGE.min, FONT_SIZE_RANGE.max, DEFAULT_SETTINGS.fontSize),
      lineHeight: clamp(parsed.lineHeight, LINE_HEIGHT_RANGE.min, LINE_HEIGHT_RANGE.max, DEFAULT_SETTINGS.lineHeight),
      lineWidth: clamp(parsed.lineWidth, LINE_WIDTH_RANGE.min, LINE_WIDTH_RANGE.max, DEFAULT_SETTINGS.lineWidth),
      recentFiles: stringList(parsed.recentFiles),
      recentProjects: stringList(parsed.recentProjects),
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
    if (partial.theme) applyTheme(updated.theme);
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

export function addRecentProject(projectPath: string): AppSettings {
  const current = loadSettings();
  const filtered = current.recentProjects.filter((p) => p !== projectPath);
  return saveSettings({ recentProjects: [projectPath, ...filtered].slice(0, 8), lastProjectPath: projectPath });
}

export function removeRecentProject(projectPath: string): AppSettings {
  const current = loadSettings();
  return saveSettings({ recentProjects: current.recentProjects.filter((p) => p !== projectPath) });
}

// --- Window size and position ---------------------------------------------------------------------

const WINDOW_KEY = 'noveler-window';

export interface WindowState {
  width: number;
  height: number;
  x: number;
  y: number;
  maximized: boolean;
}

export function loadWindowState(): WindowState | null {
  try {
    const raw = localStorage.getItem(WINDOW_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<WindowState>;
    const nums = [s.width, s.height, s.x, s.y];
    if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
    if ((s.width as number) < 400 || (s.height as number) < 300) return null;
    return { width: s.width!, height: s.height!, x: s.x!, y: s.y!, maximized: Boolean(s.maximized) };
  } catch {
    return null;
  }
}

export function saveWindowState(state: WindowState): void {
  try {
    localStorage.setItem(WINDOW_KEY, JSON.stringify(state));
  } catch {
    // best effort
  }
}

import {
  type FontFamily,
  type SceneTitleMode,
  type Theme,
  type ViewMode,
  saveSettings,
  TYPEFACES,
  FONT_SIZE_RANGE,
  LINE_HEIGHT_RANGE,
  LINE_WIDTH_RANGE,
} from '../services/settings';
import { THEME_IDS } from '../services/themes';
import { setOnlineGrammarEnabled } from '../services/spellingService';
import type { SliceCreator, SettingsSlice } from './types';
import { initialSettings } from './shared';

/** Appearance and behaviour preferences, saved between sessions. */
export const createSettingsSlice: SliceCreator<SettingsSlice> = (set, get) => ({
  theme: initialSettings.theme,
  viewMode: initialSettings.viewMode,
  sidebarOpen: initialSettings.sidebarOpen,
  autoSaveEnabled: initialSettings.autoSaveEnabled,
  autoSaveIntervalMs: initialSettings.autoSaveIntervalMs,
  fontFamily: initialSettings.fontFamily,
  fontSize: initialSettings.fontSize,
  paragraphIndent: initialSettings.paragraphIndent,
  sceneTitleMode: initialSettings.sceneTitleMode,
  spellCheckEnabled: initialSettings.spellCheckEnabled,
  recentFiles: initialSettings.recentFiles,

  setTheme: (theme: Theme) => {
    saveSettings({ theme });
    set({ theme });
  },

  cycleTheme: () => {
    const currentIndex = THEME_IDS.indexOf(get().theme);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % THEME_IDS.length;
    get().setTheme(THEME_IDS[nextIndex]);
  },

  setViewMode: (viewMode: ViewMode) => {
    saveSettings({ viewMode });
    set({ viewMode });
  },

  setSidebarOpen: (sidebarOpen: boolean) => {
    saveSettings({ sidebarOpen });
    set({ sidebarOpen });
  },

  toggleSidebar: () => {
    const next = !get().sidebarOpen;
    saveSettings({ sidebarOpen: next });
    set({ sidebarOpen: next });
  },

  setAutoSaveEnabled: (autoSaveEnabled: boolean) => {
    saveSettings({ autoSaveEnabled });
    set({ autoSaveEnabled });
  },

  setFontFamily: (fontFamily: FontFamily) => {
    saveSettings({ fontFamily });
    set({ fontFamily });
  },

  cycleFontFamily: () => {
    const ids = TYPEFACES.map((t) => t.id);
    const next: FontFamily = ids[(ids.indexOf(get().fontFamily) + 1) % ids.length];
    get().setFontFamily(next);
    get().setStatusMessage(`Typeface: ${TYPEFACES.find((t) => t.id === next)?.label}`);
  },

  setFontSize: (value: number) => {
    const fontSize = Math.min(FONT_SIZE_RANGE.max, Math.max(FONT_SIZE_RANGE.min, Math.round(value)));
    saveSettings({ fontSize });
    set({ fontSize });
  },

  lineHeight: initialSettings.lineHeight,
  lineWidth: initialSettings.lineWidth,
  smartQuotes: initialSettings.smartQuotes,
  recentProjects: initialSettings.recentProjects,

  setLineHeight: (value: number) => {
    const lineHeight =
      Math.round(Math.min(LINE_HEIGHT_RANGE.max, Math.max(LINE_HEIGHT_RANGE.min, value)) * 100) / 100;
    saveSettings({ lineHeight });
    set({ lineHeight });
  },

  setLineWidth: (value: number) => {
    const lineWidth = Math.round(Math.min(LINE_WIDTH_RANGE.max, Math.max(LINE_WIDTH_RANGE.min, value)));
    saveSettings({ lineWidth });
    set({ lineWidth });
  },

  setSmartQuotes: (smartQuotes: boolean) => {
    // The editor is rebuilt for this setting; hand it the very latest text first.
    const { editorInstance } = get();
    if (editorInstance && !editorInstance.isDestroyed) {
      set({ markdownContent: editorInstance.getMarkdown() });
    }
    saveSettings({ smartQuotes });
    set({ smartQuotes });
  },

  toggleParagraphIndent: () => {
    const next = !get().paragraphIndent;
    saveSettings({ paragraphIndent: next });
    set({ paragraphIndent: next });
  },

  setSceneTitleMode: (sceneTitleMode: SceneTitleMode) => {
    saveSettings({ sceneTitleMode });
    set({ sceneTitleMode });
  },

  onlineGrammarCheck: initialSettings.onlineGrammarCheck,

  toggleOnlineGrammarCheck: () => {
    const next = !get().onlineGrammarCheck;
    saveSettings({ onlineGrammarCheck: next });
    setOnlineGrammarEnabled(next);
    set({
      onlineGrammarCheck: next,
      statusMessage: next
        ? 'Online grammar check ON: paragraphs are sent to LanguageTool'
        : 'Online grammar check OFF: spell check runs on this computer only',
    });
  },

  toggleSpellCheck: () => {
    const next = !get().spellCheckEnabled;
    saveSettings({ spellCheckEnabled: next });
    set({
      spellCheckEnabled: next,
      statusMessage: next ? 'Live Spell & Grammar Check enabled' : 'Live Spell & Grammar Check paused',
    });
  },
});

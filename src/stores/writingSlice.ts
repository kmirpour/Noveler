import { saveSettings } from '../services/settings';
import type { SliceCreator, WritingSlice } from './types';
import { initialSettings } from './shared';

/** Writing session state: focus modes, goals, and which panels are open. */
export const createWritingSlice: SliceCreator<WritingSlice> = (set, get) => ({
  focusMode: initialSettings.focusMode,
  typewriterMode: initialSettings.typewriterMode,
  dimUnfocused: initialSettings.dimUnfocused,
  dailyWordGoal: initialSettings.dailyWordGoal,
  sessionWords: 0,
  writingLog: {},
  countBaseline: null,
  skipNextCountDelta: false,
  selectedWordCount: 0,
  findReplaceOpen: false,
  commandPaletteOpen: false,
  goalsModalOpen: false,
  compileModalOpen: false,
  codexModalOpen: false,
  proseAnalysisOpen: false,

  toggleFocusMode: () => {
    const next = !get().focusMode;
    saveSettings({ focusMode: next });
    set({ focusMode: next });
  },

  setFocusMode: (val: boolean) => {
    saveSettings({ focusMode: val });
    set({ focusMode: val });
  },

  toggleTypewriterMode: () => {
    const next = !get().typewriterMode;
    saveSettings({ typewriterMode: next });
    set({ typewriterMode: next });
  },

  showEchoes: initialSettings.showEchoes,
  toggleEchoes: () => {
    const next = !get().showEchoes;
    saveSettings({ showEchoes: next });
    set({
      showEchoes: next,
      statusMessage: next ? 'Repeated words are highlighted' : 'Repeated-word highlighting is off',
    });
  },

  toggleDimUnfocused: () => {
    const next = !get().dimUnfocused;
    saveSettings({ dimUnfocused: next });
    set({ dimUnfocused: next });
    if (next) {
      get().editorInstance?.commands.focus();
    }
  },

  setDailyWordGoal: (dailyWordGoal: number) => {
    const valid = Math.max(0, Math.floor(dailyWordGoal));
    saveSettings({ dailyWordGoal: valid });
    set({ dailyWordGoal: valid });
  },

  resetSessionWords: () => {
    set({ sessionWords: 0 });
  },

  setSelectedWordCount: (selectedWordCount: number) => set({ selectedWordCount }),
  setFindReplaceOpen: (findReplaceOpen: boolean) => set({ findReplaceOpen }),
  setCommandPaletteOpen: (commandPaletteOpen: boolean) => set({ commandPaletteOpen }),
  setGoalsModalOpen: (goalsModalOpen: boolean) => set({ goalsModalOpen }),
  setCompileModalOpen: (compileModalOpen: boolean) => set({ compileModalOpen }),
  toggleCompileModal: () => set({ compileModalOpen: !get().compileModalOpen }),
  setCodexModalOpen: (codexModalOpen: boolean) => set({ codexModalOpen }),
  toggleCodexModal: () => set({ codexModalOpen: !get().codexModalOpen }),
  settingsOpen: false,
  backupsOpen: false,
  lastSavedAt: null,
  setSettingsOpen: (settingsOpen: boolean) => set({ settingsOpen }),
  setBackupsOpen: (backupsOpen: boolean) => set({ backupsOpen }),
  setProseAnalysisOpen: (proseAnalysisOpen: boolean) => set({ proseAnalysisOpen }),
  toggleProseAnalysis: () => set({ proseAnalysisOpen: !get().proseAnalysisOpen }),
});

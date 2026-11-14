import { create } from 'zustand';
import type { EditorState } from './types';
import { bindStore } from './shared';
import { createDocumentSlice } from './documentSlice';
import { createProjectFilesSlice } from './projectFilesSlice';
import { createProjectScenesSlice } from './projectScenesSlice';
import { createProjectToolsSlice } from './projectToolsSlice';
import { createSettingsSlice } from './settingsSlice';
import { createWritingSlice } from './writingSlice';

export type * from './types';
export { persistProject, flushProjectSave } from './shared';

/**
 * The application store. Its state and actions are defined in one file per area:
 * documentSlice, projectFilesSlice, projectScenesSlice, projectToolsSlice, settingsSlice, writingSlice.
 */
export const useEditorStore = create<EditorState>((set, get) => ({
  ...createDocumentSlice(set, get),
  ...createProjectFilesSlice(set, get),
  ...createProjectScenesSlice(set, get),
  ...createProjectToolsSlice(set, get),
  ...createSettingsSlice(set, get),
  ...createWritingSlice(set, get),
}));

bindStore(useEditorStore.getState);

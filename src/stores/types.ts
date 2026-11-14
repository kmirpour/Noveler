import type { Editor } from '@tiptap/react';
import type * as fileService from '../services/fileService';
import type { FontFamily, SceneTitleMode, Theme, ViewMode } from '../services/settings';
import type {
  NovelProject,
  SceneMetadata,
  CodexEntry,
  CompileSettings,
  ManuscriptComment,
} from '../services/projectService';
import type { WritingLog } from '../utils/writingLog';
import type { WikiImportPlan } from '../utils/storyBible';

/** A document to load into the editor, replacing the current one. */
export interface LoadDocumentInput {
  markdown: string;
  fileName: string | null;
  filePath: string | null;
  /** Mark the loaded document as having unsaved changes (e.g. restored from recovery). */
  dirty?: boolean;
  statusMessage?: string;
}

export interface DocumentSlice {
  markdownContent: string;
  fileName: string | null;
  filePath: string | null;
  isDirty: boolean;
  wordCount: number;
  charCount: number;
  statusMessage: string | null;
  editorInstance: Editor | null;

  setFileName: (name: string | null) => void;
  setFilePath: (path: string | null) => void;
  setDirty: (dirty: boolean) => void;
  setStatusMessage: (msg: string | null) => void;
  updateCounts: (text: string) => void;
  setEditorInstance: (editor: Editor | null) => void;
  setMarkdownContent: (markdown: string) => void;
  confirmDiscardIfDirty: () => Promise<boolean>;
  loadDocument: (doc: LoadDocumentInput) => void;
  newFile: () => Promise<boolean>;
  openFileAction: () => Promise<boolean>;
  openFileByPath: (path: string) => Promise<boolean>;
  /** Browser only: if the open file was changed outside Noveler, loads the new version (when there are no unsaved edits). */
  checkForOutsideChangesAction: () => Promise<void>;
  saveFileAction: () => Promise<boolean>;
  saveFileAsAction: () => Promise<boolean>;
  exportDocxAction: () => Promise<void>;
  printAction: () => void;
}

export interface ProjectSlice {
  projectPath: string | null;
  projectName: string | null;
  projectFiles: fileService.FileEntry[];
  novelProject: NovelProject | null;
  activeScenePath: string | null;
  activeSceneIndex: number;
  currentMetadata: SceneMetadata;
  novelWordCount: number;
  scratchpadContent: string;
  tagCategories: string[];
  tagAssignments: Record<string, string>;
  /** File shown read-only beside the editor in "reference" view. */
  referencePath: string | null;
  setReferencePath: (path: string | null) => void;
  /** Shows a file beside the editor (switches to the reference view). */
  openReferenceAction: (path: string) => void;
  corkboardOpen: boolean;
  inspectorOpen: boolean;
  scriveningsMode: boolean;

  openProjectFolderAction: () => Promise<boolean>;
  loadProjectByPath: (path: string) => Promise<boolean>;
  refreshProjectFiles: () => Promise<void>;
  createChapterAction: (customTitle?: string) => Promise<boolean>;
  createExtraFileAction: (titleInput?: string) => Promise<boolean>;
  createSceneAction: (parentFolder: string, title: string) => Promise<boolean>;
  createFolderAction: (parentFolder: string, name: string) => Promise<boolean>;
  renameBinderItemAction: (oldPath: string, newTitle: string) => Promise<boolean>;
  deleteBinderItemAction: (path: string) => Promise<boolean>;
  reorderBinderItemsAction: (fromIndex: number, toIndex: number) => Promise<boolean>;
  updateSceneMetadata: (metadata: Partial<SceneMetadata>) => void;
  updateSceneMetadataByPath: (scenePath: string, metadata: Partial<SceneMetadata>) => void;
  /** Updates the notes (synopsis, status, POV, target) of one scene in a chapter. */
  updateSceneNotesAction: (chapterPath: string, sceneIndex: number, partial: Partial<SceneMetadata>) => void;
  setActiveSceneIndex: (index: number) => void;
  jumpToSceneAction: (chapterPath: string, sceneIndex: number) => Promise<void>;
  renameChapterSceneAction: (chapterPath: string, sceneIndex: number, newTitle: string) => void;
  addSceneToChapterAction: (chapterPath: string, customTitle?: string) => Promise<number>;
  insertSceneAfterAction: (
    chapterPath: string,
    afterSceneIndex: number,
    customTitle?: string
  ) => Promise<number>;
  reorderChapterScenesAction: (chapterPath: string, fromIndex: number, toIndex: number) => Promise<boolean>;
  deleteSceneFromChapterAction: (
    chapterPath: string,
    sceneIndex: number,
    options?: { archive?: boolean }
  ) => Promise<boolean>;
  /** Moves a note file into a chapter as a new last scene; the note itself goes to the graveyard. */
  insertFileAsSceneAction: (notePath: string, chapterPath: string) => Promise<boolean>;
  /** Lifts a scene out of its chapter into its own note file under Other Files. */
  extractSceneToFileAction: (chapterPath: string, sceneIndex: number) => Promise<boolean>;
  addCustomDictionaryWordAction: (word: string) => Promise<void>;
  saveProjectConfigAction: () => Promise<void>;
  setScratchpadContent: (content: string) => void;
  /** Adds text to the end of the scratchpad (e.g. a passage cut from the manuscript). */
  appendToScratchpadAction: (text: string) => void;
  /** Replaces the open document's text (restore from a snapshot or backup). Undoable with Ctrl+Z. */
  replaceDocumentTextAction: (markdown: string, message: string) => void;
  /** Copies a briefing (story bible, outline, notes, current scene) to the clipboard. */
  copyContextPackAction: () => Promise<boolean>;
  /** Adds or fills in story-bible entries read from a notes file. */
  applyWikiImportAction: (plan: WikiImportPlan) => Promise<number>;
  addTagCategoryAction: (category: string) => Promise<void>;
  assignTagCategoryAction: (tagName: string, category: string) => Promise<void>;
  setCorkboardOpen: (open: boolean) => void;
  toggleCorkboard: () => void;
  setInspectorOpen: (open: boolean) => void;
  toggleInspector: () => void;
  setScriveningsMode: (enabled: boolean) => void;
  toggleScriveningsMode: () => void;
  loadSceneByPath: (path: string) => Promise<boolean>;
  addCodexEntryAction: (entry: Omit<CodexEntry, 'id'>) => Promise<void>;
  updateCodexEntryAction: (entry: CodexEntry) => Promise<void>;
  deleteCodexEntryAction: (id: string) => Promise<void>;
  createSceneSnapshotAction: (label: string) => Promise<void>;
  restoreSceneSnapshotAction: (snapshotId: string) => Promise<void>;
  deleteSceneSnapshotAction: (snapshotId: string) => Promise<void>;
  syncGitAction: () => Promise<boolean>;
  /** Files changed since the last saved version (git commit); null when the novel is not under git. */
  gitChangedFiles: string[] | null;
  refreshGitChangesAction: () => Promise<void>;
  /** Saves a version on this computer (git commit) without pushing anywhere. */
  commitVersionAction: () => Promise<boolean>;
  saveCompileSettingsAction: (settings: CompileSettings) => void;
  /** Leaves a note on a passage of the open file (stored with the project, never exported). */
  addCommentAction: (quote: string, text: string) => void;
  updateCommentAction: (id: string, partial: Partial<Pick<ManuscriptComment, 'text' | 'resolved'>>) => void;
  deleteCommentAction: (id: string) => void;
  flushScratchpadAction: () => Promise<boolean>;
}

export interface SettingsSlice {
  theme: Theme;
  viewMode: ViewMode;
  sidebarOpen: boolean;
  autoSaveEnabled: boolean;
  autoSaveIntervalMs: number;
  fontFamily: FontFamily;
  fontSize: number;
  paragraphIndent: boolean;
  sceneTitleMode: SceneTitleMode;
  spellCheckEnabled: boolean;
  /** Off by default: when on, paragraphs are sent to the LanguageTool web service for grammar checks. */
  onlineGrammarCheck: boolean;
  recentFiles: string[];
  recentProjects: string[];
  lineHeight: number;
  lineWidth: number;
  smartQuotes: boolean;

  setLineHeight: (lineHeight: number) => void;
  setLineWidth: (lineWidth: number) => void;
  setSmartQuotes: (enabled: boolean) => void;
  toggleOnlineGrammarCheck: () => void;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
  setViewMode: (mode: ViewMode) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  setFontFamily: (fontFamily: FontFamily) => void;
  cycleFontFamily: () => void;
  setFontSize: (fontSize: number) => void;
  toggleParagraphIndent: () => void;
  setSceneTitleMode: (mode: SceneTitleMode) => void;
  toggleSpellCheck: () => void;
}

export interface WritingSlice {
  focusMode: boolean;
  typewriterMode: boolean;
  dimUnfocused: boolean;
  showEchoes: boolean;
  toggleEchoes: () => void;
  dailyWordGoal: number;
  /** Net words added since the app started (or since the sprint was reset), across all chapters. */
  sessionWords: number;
  /** Net words written per calendar day; saved with the project so the daily goal and streak persist. */
  writingLog: WritingLog;
  /** Word count the next delta is measured against, tied to the file it was taken from. */
  countBaseline: { path: string | null; count: number } | null;
  /** Set before a structural change (restore, delete scene) so it isn't counted as writing. */
  skipNextCountDelta: boolean;
  selectedWordCount: number;
  findReplaceOpen: boolean;
  commandPaletteOpen: boolean;
  goalsModalOpen: boolean;
  compileModalOpen: boolean;
  codexModalOpen: boolean;
  proseAnalysisOpen: boolean;
  settingsOpen: boolean;
  backupsOpen: boolean;
  /** When the open document was last written to disk (epoch ms), for the "Saved" indicator. */
  lastSavedAt: number | null;
  setSettingsOpen: (open: boolean) => void;
  setBackupsOpen: (open: boolean) => void;

  toggleFocusMode: () => void;
  setFocusMode: (val: boolean) => void;
  toggleTypewriterMode: () => void;
  toggleDimUnfocused: () => void;
  setDailyWordGoal: (goal: number) => void;
  resetSessionWords: () => void;
  setSelectedWordCount: (count: number) => void;
  setFindReplaceOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setGoalsModalOpen: (open: boolean) => void;
  setCompileModalOpen: (open: boolean) => void;
  toggleCompileModal: () => void;
  setCodexModalOpen: (open: boolean) => void;
  toggleCodexModal: () => void;
  setProseAnalysisOpen: (open: boolean) => void;
  toggleProseAnalysis: () => void;
}

export type EditorState = DocumentSlice & ProjectSlice & SettingsSlice & WritingSlice;

/** How each slice of the store is created: it receives the store's `set` and `get`. */
export type SliceCreator<T> = (
  set: (partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>)) => void,
  get: () => EditorState
) => T;

export type ProjectFilesPart = Pick<
  ProjectSlice,
  | 'projectPath'
  | 'projectName'
  | 'projectFiles'
  | 'novelProject'
  | 'activeScenePath'
  | 'activeSceneIndex'
  | 'currentMetadata'
  | 'novelWordCount'
  | 'scratchpadContent'
  | 'tagCategories'
  | 'tagAssignments'
  | 'corkboardOpen'
  | 'inspectorOpen'
  | 'scriveningsMode'
  | 'openProjectFolderAction'
  | 'loadProjectByPath'
  | 'refreshProjectFiles'
  | 'createChapterAction'
  | 'createExtraFileAction'
  | 'createSceneAction'
  | 'createFolderAction'
  | 'renameBinderItemAction'
  | 'deleteBinderItemAction'
  | 'reorderBinderItemsAction'
>;
export type ProjectScenesPart = Pick<
  ProjectSlice,
  | 'updateSceneMetadata'
  | 'updateSceneMetadataByPath'
  | 'updateSceneNotesAction'
  | 'setActiveSceneIndex'
  | 'jumpToSceneAction'
  | 'renameChapterSceneAction'
  | 'addSceneToChapterAction'
  | 'insertSceneAfterAction'
  | 'reorderChapterScenesAction'
  | 'insertFileAsSceneAction'
  | 'extractSceneToFileAction'
  | 'deleteSceneFromChapterAction'
>;
export type ProjectToolsPart = Pick<
  ProjectSlice,
  | 'addCustomDictionaryWordAction'
  | 'saveProjectConfigAction'
  | 'setScratchpadContent'
  | 'appendToScratchpadAction'
  | 'replaceDocumentTextAction'
  | 'copyContextPackAction'
  | 'applyWikiImportAction'
  | 'flushScratchpadAction'
  | 'gitChangedFiles'
  | 'refreshGitChangesAction'
  | 'commitVersionAction'
  | 'addCommentAction'
  | 'updateCommentAction'
  | 'deleteCommentAction'
  | 'saveCompileSettingsAction'
  | 'syncGitAction'
  | 'addTagCategoryAction'
  | 'assignTagCategoryAction'
  | 'referencePath'
  | 'setReferencePath'
  | 'openReferenceAction'
  | 'setCorkboardOpen'
  | 'toggleCorkboard'
  | 'setInspectorOpen'
  | 'toggleInspector'
  | 'setScriveningsMode'
  | 'toggleScriveningsMode'
  | 'loadSceneByPath'
  | 'addCodexEntryAction'
  | 'updateCodexEntryAction'
  | 'deleteCodexEntryAction'
  | 'createSceneSnapshotAction'
  | 'restoreSceneSnapshotAction'
  | 'deleteSceneSnapshotAction'
>;

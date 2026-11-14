import * as fileService from '../services/fileService';
import { addRecentProject } from '../services/settings';
import {
  loadNovelProject,
  saveSnapshots,
  loadScratchpadFile,
  createSequentialChapter,
  createExtraFile,
  flattenScenes,
  moveFileToGraveyard,
  setChapterHeadingTitle,
} from '../services/projectService';
import { buildRenamedChapterFileName, extractChapterDisplayTitle } from '../utils/chapterNaming';
import { setChapterTitleInEditor } from '../utils/sceneDocOps';
import type { SliceCreator, ProjectFilesPart } from './types';
import {
  initialSettings,
  updateWindowTitle,
  errorMessage,
  countWords,
  outlineItem,
  withChapterOutline,
  persistProject,
  flushProjectSave,
} from './shared';

/** The novel folder: opening it, and creating, renaming, removing and ordering its files. */
export const createProjectFilesSlice: SliceCreator<ProjectFilesPart> = (set, get) => ({
  projectPath: initialSettings.lastProjectPath,
  projectName: null,
  projectFiles: [],
  novelProject: null,
  activeScenePath: null,
  activeSceneIndex: 0,
  currentMetadata: {},
  novelWordCount: 0,
  scratchpadContent: '',
  tagCategories: ['characters', 'locations', 'items', 'scenes'],
  tagAssignments: {},
  corkboardOpen: false,
  inspectorOpen: false,
  scriveningsMode: false,

  openProjectFolderAction: async () => {
    try {
      if (!(await get().confirmDiscardIfDirty())) return false;
      const res = await fileService.openFolder();
      if (!res) return false;
      return await get().loadProjectByPath(res.path);
    } catch (err) {
      console.error('Error opening project folder:', err);
      set({ statusMessage: `Error opening folder: ${errorMessage(err)}` });
      return false;
    }
  },

  loadProjectByPath: async (path: string) => {
    try {
      // Finish writing the project we're leaving before reading the next one.
      await flushProjectSave();
      await fileService.setProjectRoot(path);
      const project = await loadNovelProject(path);
      const scratchpadText = await loadScratchpadFile(path);
      set({ recentProjects: addRecentProject(path).recentProjects });
      const name = fileService.extractFileName(path);

      let totalWords = 0;
      for (const item of project.binder) {
        try {
          const f = await fileService.readFileDirect(item.path);
          const words = countWords(f.content);
          Object.assign(item, outlineItem(item, f.content));
          item.wordCount = words;
          totalWords += words;
        } catch {
          // ignore
        }
      }

      set({
        projectPath: path,
        projectName: project.title || name,
        novelProject: project,
        novelWordCount: totalWords,
        writingLog: project.writingLog || {},
        scratchpadContent: scratchpadText,
        tagCategories: project.tagCategories || ['characters', 'locations', 'items', 'scenes'],
        tagAssignments: project.tagAssignments || {},
        sidebarOpen: true,
        statusMessage: `Opened folder: ${project.title || name}`,
      });

      void get().refreshGitChangesAction();

      // Load first chapter if current document is empty or not in this project
      if (project.binder.length > 0) {
        const scenes = flattenScenes(project.binder);
        const currentInProject = scenes.some((s) => s.path === get().filePath);
        if (!currentInProject && scenes.length > 0) {
          void get().loadSceneByPath(scenes[0].path);
        }
      }
      return true;
    } catch (err) {
      console.error('Error loading project:', err);
      set({ statusMessage: `Error loading project: ${errorMessage(err)}` });
      return false;
    }
  },

  refreshProjectFiles: async () => {
    if (!get().projectPath) return;
    try {
      // The project is re-read from disk below, so pending changes must be written first.
      await flushProjectSave();
      const { projectPath, filePath, wordCount, markdownContent } = get();
      if (!projectPath) return;
      const project = await loadNovelProject(projectPath);
      let totalWords = 0;
      for (const item of project.binder) {
        if (item.path === filePath) {
          Object.assign(item, outlineItem(item, markdownContent));
          item.wordCount = wordCount;
          totalWords += wordCount;
        } else {
          try {
            const f = await fileService.readFileDirect(item.path);
            const words = countWords(f.content);
            Object.assign(item, outlineItem(item, f.content));
            item.wordCount = words;
            totalWords += words;
          } catch {
            // ignore
          }
        }
      }
      set({ novelProject: project, novelWordCount: totalWords });
    } catch {
      // ignore
    }
  },

  createChapterAction: async (customTitle?: string) => {
    try {
      const { projectPath, novelProject, confirmDiscardIfDirty, refreshProjectFiles } = get();
      if (!projectPath) return false;
      if (!(await confirmDiscardIfDirty())) return false;

      const existingNames = (novelProject?.binder || []).map((b) => fileService.extractFileName(b.path));
      const res = await createSequentialChapter(projectPath, existingNames, customTitle);
      await refreshProjectFiles();
      await get().loadSceneByPath(res.path);
      set({ statusMessage: `Created ${res.name}` });
      return true;
    } catch (err) {
      console.error('Error creating chapter:', err);
      set({ statusMessage: `Error creating chapter: ${errorMessage(err)}` });
      return false;
    }
  },

  createExtraFileAction: async (titleInput?: string) => {
    try {
      const { projectPath, novelProject, confirmDiscardIfDirty, refreshProjectFiles } = get();
      if (!projectPath) return false;
      if (!(await confirmDiscardIfDirty())) return false;

      const existingNames = [...(novelProject?.binder || []), ...(novelProject?.extraFiles || [])].map((b) =>
        fileService.extractFileName(b.path)
      );
      const res = await createExtraFile(projectPath, existingNames, titleInput);
      await refreshProjectFiles();
      await get().loadSceneByPath(res.path);
      set({ statusMessage: `Created ${res.name}` });
      return true;
    } catch (err) {
      console.error('Error creating file:', err);
      set({ statusMessage: `Error creating file: ${errorMessage(err)}` });
      return false;
    }
  },

  createSceneAction: async (_parentFolder: string, title: string) => {
    return await get().createChapterAction(title);
  },

  createFolderAction: async (_parentFolder: string, name: string) => {
    return await get().createChapterAction(name);
  },

  renameBinderItemAction: async (oldPath: string, newTitle: string) => {
    try {
      const { refreshProjectFiles, novelProject, projectPath } = get();
      const safeTitle = newTitle.trim();
      if (!safeTitle) return false;

      // A chapter's name is its own `# Heading`. Renaming a chapter rewrites that heading and
      // leaves the file name alone, so backups, snapshots and git history stay attached to it.
      const isChapter = Boolean(novelProject?.binder.some((b) => b.path === oldPath));
      if (isChapter) {
        const { filePath, editorInstance, markdownContent } = get();
        if (oldPath === filePath) {
          if (editorInstance && !editorInstance.isDestroyed) {
            // Goes through the editor, so it is undoable and autosaves like any other edit.
            setChapterTitleInEditor(editorInstance, safeTitle);
            get().setMarkdownContent(editorInstance.getMarkdown());
          } else {
            get().setMarkdownContent(setChapterHeadingTitle(markdownContent, safeTitle));
            get().setDirty(true);
            if (get().autoSaveEnabled && fileService.isTauri()) void get().saveFileAction();
          }
        } else {
          const file = await fileService.readFileDirect(oldPath);
          const nextMarkdown = setChapterHeadingTitle(file.content, safeTitle);
          await fileService.saveFile(oldPath, nextMarkdown);
          const latest = get().novelProject;
          if (latest) set({ novelProject: withChapterOutline(latest, oldPath, nextMarkdown) });
        }
        set({ statusMessage: `Renamed chapter to "${safeTitle}"` });
        return true;
      }

      // Notes and other files are named after their file, so renaming them renames the file.
      const parent = oldPath.substring(0, Math.max(oldPath.lastIndexOf('/'), oldPath.lastIndexOf('\\')));
      const sep = oldPath.includes('/') ? '/' : '\\';
      const oldName = fileService.extractFileName(oldPath);
      const newName = buildRenamedChapterFileName(oldName, safeTitle);
      const newPath = `${parent}${sep}${newName}`;
      if (newPath === oldPath) return true;

      // Make sure the latest text is on disk under the old name before the file moves.
      if (get().filePath === oldPath && get().isDirty) {
        if (!(await get().saveFileAction())) return false;
      }
      await fileService.renamePath(oldPath, newPath);

      const current = get().novelProject;
      if (current && projectPath) {
        const nextChapterMeta = { ...(current.chapterMetadata || {}) };
        if (nextChapterMeta[oldName]) {
          nextChapterMeta[newName] = nextChapterMeta[oldName];
          delete nextChapterMeta[oldName];
        }
        const snapshots = current.snapshots || [];
        const nextSnapshots = snapshots.map((s) =>
          s.scenePath === oldPath ? { ...s, scenePath: newPath } : s
        );
        const displayTitle = extractChapterDisplayTitle(newName);
        set({
          novelProject: {
            ...current,
            extraFiles: (current.extraFiles || []).map((b) =>
              b.path === oldPath ? { ...b, path: newPath, title: displayTitle } : b
            ),
            chapterMetadata: nextChapterMeta,
            snapshots: nextSnapshots,
          },
        });
        persistProject();
        if (snapshots.some((s) => s.scenePath === oldPath)) {
          await saveSnapshots(projectPath, nextSnapshots);
        }
      }

      if (get().filePath === oldPath) {
        set({
          filePath: newPath,
          fileName: newName,
          activeScenePath: newPath,
          countBaseline: { path: newPath, count: get().wordCount },
        });
        updateWindowTitle(newName, get().isDirty);
      }
      await refreshProjectFiles();
      set({ statusMessage: `Renamed to "${newName}"` });
      return true;
    } catch (err) {
      console.error('Error renaming item:', err);
      set({ statusMessage: `Error renaming: ${errorMessage(err)}` });
      return false;
    }
  },

  deleteBinderItemAction: async (path: string) => {
    try {
      const { refreshProjectFiles, projectPath } = get();
      if (!projectPath) return false;

      // Save first so the copy that lands in the graveyard is the latest text.
      if (get().filePath === path && get().isDirty) {
        if (!(await get().confirmDiscardIfDirty())) return false;
      }

      // Nothing is destroyed: the file moves to graveyard/ under a timestamped name.
      const moved = await moveFileToGraveyard(projectPath, path);

      const current = get().novelProject;
      if (current) {
        const deletedName = fileService.extractFileName(path);
        const nextChapterMeta = { ...(current.chapterMetadata || {}) };
        delete nextChapterMeta[deletedName];
        set({
          novelProject: {
            ...current,
            binder: current.binder.filter((b) => b.path !== path),
            extraFiles: (current.extraFiles || []).filter((b) => b.path !== path),
            chapterMetadata: nextChapterMeta,
          },
        });
        persistProject();
      }

      if (get().filePath === path) {
        get().loadDocument({ markdown: '', fileName: null, filePath: null });
      }
      await refreshProjectFiles();
      set({ statusMessage: `Moved to graveyard/${moved.fileName}` });
      return true;
    } catch (err) {
      console.error('Error deleting item:', err);
      set({ statusMessage: `Error deleting: ${errorMessage(err)}` });
      return false;
    }
  },

  reorderBinderItemsAction: async (fromIndex: number, toIndex: number) => {
    const { novelProject, projectPath } = get();
    if (!novelProject || !projectPath) return false;
    const items = [...novelProject.binder];
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= items.length ||
      toIndex >= items.length
    ) {
      return false;
    }

    // The order lives in noveler.json. Chapter files keep their names and contents untouched,
    // so reordering can't break backups, snapshots, git history, or an open editor.
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    set({ novelProject: { ...novelProject, binder: items }, statusMessage: 'Reordered chapters' });
    persistProject();
    return true;
  },
});

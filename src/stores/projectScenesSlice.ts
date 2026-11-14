import * as fileService from '../services/fileService';
import {
  type NovelProject,
  type SceneMetadata,
  type BinderItem,
  createExtraFile,
  parseSceneMarkdown,
  moveFileToGraveyard,
  archiveTextToGraveyard,
  extractChapterHeadingTitle,
} from '../services/projectService';
import { extractChapterDisplayTitle } from '../utils/chapterNaming';
import {
  countScenesInMarkdown,
  extractSceneTitlesFromMarkdown,
  splitChapterIntoScenes,
  updateSceneTitleAtIndex,
  reorderChapterScenes,
  insertSceneAfterIndex,
  deleteSceneFromChapter,
  findScenePositionInDoc,
} from '../utils/chapterScenes';
import {
  renameSceneInEditor,
  moveSceneInEditor,
  insertSceneInEditor,
  deleteSceneInEditor,
  appendMarkdownInEditor,
} from '../utils/sceneDocOps';
import { withSceneMeta } from '../utils/sceneMetadata';
import type { SliceCreator, ProjectScenesPart } from './types';
import { errorMessage, withChapterOutline, persistProject } from './shared';

/** Scenes inside chapters: notes, navigation, and structural edits. */
export const createProjectScenesSlice: SliceCreator<ProjectScenesPart> = (set, get) => ({
  updateSceneMetadata: (partial: Partial<SceneMetadata>) => {
    const { activeScenePath, filePath } = get();
    const targetPath = activeScenePath || filePath;
    if (targetPath) {
      get().updateSceneMetadataByPath(targetPath, partial);
    } else {
      const nextMeta = { ...get().currentMetadata, ...partial };
      set({ currentMetadata: nextMeta, isDirty: true });
    }
  },

  updateSceneMetadataByPath: (scenePath: string, partial: Partial<SceneMetadata>) => {
    const { novelProject, projectPath, activeScenePath, filePath, currentMetadata } = get();
    const isCurrent = scenePath === activeScenePath || scenePath === filePath;
    const sceneFileName = fileService.extractFileName(scenePath);

    if (isCurrent) {
      set({ currentMetadata: { ...currentMetadata, ...partial } });
    }

    if (novelProject && projectPath) {
      const updateItem = (item: BinderItem) => {
        if (item.path === scenePath) {
          return {
            ...item,
            synopsis: partial.synopsis !== undefined ? partial.synopsis : item.synopsis,
            pov: partial.pov !== undefined ? partial.pov : item.pov,
            status: partial.status !== undefined ? partial.status : item.status,
            targetWords: partial.targetWords !== undefined ? partial.targetWords : item.targetWords,
          };
        }
        return item;
      };
      const updatedBinder = novelProject.binder.map(updateItem);
      const updatedExtras = (novelProject.extraFiles || []).map(updateItem);

      const prevFileMeta = novelProject.chapterMetadata?.[sceneFileName] || {};
      const nextFileMeta: SceneMetadata = {
        ...prevFileMeta,
        ...(isCurrent ? currentMetadata : {}),
        ...partial,
      };

      const updatedProject: NovelProject = {
        ...novelProject,
        binder: updatedBinder,
        extraFiles: updatedExtras,
        chapterMetadata: {
          ...(novelProject.chapterMetadata || {}),
          [sceneFileName]: nextFileMeta,
        },
      };

      set({ novelProject: updatedProject });
      persistProject();
    }
  },

  updateSceneNotesAction: (chapterPath, sceneIndex, partial) => {
    const { novelProject } = get();
    if (!novelProject) return;
    const next = withSceneMeta(novelProject, chapterPath, sceneIndex, partial);
    if (next === novelProject) return;
    set({ novelProject: next });
    persistProject();
  },

  setActiveSceneIndex: (activeSceneIndex: number) => {
    if (get().activeSceneIndex !== activeSceneIndex) {
      set({ activeSceneIndex });
    }
  },

  jumpToSceneAction: async (chapterPath: string, sceneIndex: number) => {
    if (chapterPath && chapterPath !== get().filePath) {
      const loaded = await get().loadSceneByPath(chapterPath);
      if (!loaded) return;
    }

    set({ activeSceneIndex: sceneIndex });

    const { editorInstance } = get();
    if (editorInstance && !editorInstance.isDestroyed) {
      const pos = findScenePositionInDoc(editorInstance.state.doc, sceneIndex);
      editorInstance.chain().focus().setTextSelection(pos).scrollIntoView().run();
      try {
        const domAt = editorInstance.view.domAtPos(pos);
        const el = domAt.node instanceof HTMLElement ? domAt.node : domAt.node.parentElement;
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } catch {
        // ignore in non-DOM test environments
      }
    }

    // Also scroll Preview pane if open
    if (typeof document !== 'undefined') {
      const previewContainer = document.querySelector('.preview-content');
      if (previewContainer) {
        const h2s = previewContainer.querySelectorAll('.fiction-manuscript h2');
        const targetH2 = h2s[sceneIndex];
        const targetNode =
          targetH2 && window.getComputedStyle(targetH2).display === 'none'
            ? targetH2.nextElementSibling || targetH2
            : targetH2;
        if (targetNode && typeof targetNode.scrollIntoView === 'function') {
          targetNode.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (sceneIndex <= 0) {
          previewContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    }
  },

  renameChapterSceneAction: (chapterPath: string, sceneIndex: number, newTitle: string) => {
    const { filePath, activeScenePath, editorInstance, markdownContent, novelProject, updateCounts } = get();
    const isCurrent = !chapterPath || chapterPath === filePath || chapterPath === activeScenePath;

    // With a live editor the heading is edited in place: one precise undo step, cursor untouched.
    // The editor's own update handler then marks the file dirty, syncs the outline and autosaves.
    if (isCurrent && editorInstance && !editorInstance.isDestroyed) {
      renameSceneInEditor(editorInstance, sceneIndex, newTitle);
      return;
    }

    if (isCurrent) {
      const currentMd = editorInstance ? editorInstance.getMarkdown() : markdownContent;
      const nextMarkdown = updateSceneTitleAtIndex(currentMd, sceneIndex, newTitle);
      if (nextMarkdown === currentMd) return;

      if (editorInstance && !editorInstance.isDestroyed) {
        editorInstance.commands.setContent(nextMarkdown, { contentType: 'markdown', emitUpdate: false });
        updateCounts(editorInstance.getText());
      } else {
        updateCounts(nextMarkdown);
      }

      const targetPath = chapterPath || filePath;
      const parsedScenes = extractSceneTitlesFromMarkdown(nextMarkdown);
      set({
        markdownContent: nextMarkdown,
        ...(targetPath && novelProject
          ? {
              novelProject: {
                ...novelProject,
                binder: novelProject.binder.map((b) =>
                  b.path === targetPath ? { ...b, scenes: parsedScenes } : b
                ),
              },
            }
          : {}),
      });
      get().setDirty(true);

      if (targetPath && get().autoSaveEnabled && fileService.isTauri()) {
        void get().saveFileAction();
      }
      return;
    }

    // Renaming a scene in a non-active chapter file on disk
    void (async () => {
      try {
        const file = await fileService.readFileDirect(chapterPath);
        const nextMarkdown = updateSceneTitleAtIndex(file.content, sceneIndex, newTitle);
        await fileService.saveFile(chapterPath, nextMarkdown);
        const latestProject = get().novelProject;
        if (latestProject) {
          set({ novelProject: withChapterOutline(latestProject, chapterPath, nextMarkdown) });
        }
      } catch (err) {
        console.error('Error renaming chapter scene:', err);
      }
    })();
  },

  addSceneToChapterAction: async (chapterPath: string, customTitle?: string) => {
    if (chapterPath && chapterPath !== get().filePath) {
      const loaded = await get().loadSceneByPath(chapterPath);
      if (!loaded) return -1;
    }
    const { editorInstance, markdownContent } = get();
    const currentMd = editorInstance ? editorInstance.getMarkdown() : markdownContent;
    const totalScenes = countScenesInMarkdown(currentMd);
    return await get().insertSceneAfterAction(chapterPath, totalScenes - 1, customTitle);
  },

  insertSceneAfterAction: async (chapterPath: string, afterSceneIndex: number, customTitle?: string) => {
    if (chapterPath && chapterPath !== get().filePath) {
      const loaded = await get().loadSceneByPath(chapterPath);
      if (!loaded) return -1;
    }

    const { editorInstance, markdownContent, filePath, updateCounts } = get();

    if (editorInstance && !editorInstance.isDestroyed) {
      const insertedIndex = insertSceneInEditor(editorInstance, afterSceneIndex, customTitle);
      if (insertedIndex < 0) return -1;
      get().setMarkdownContent(editorInstance.getMarkdown());
      await get().jumpToSceneAction(chapterPath || filePath || '', insertedIndex);
      return insertedIndex;
    }

    const currentMd = editorInstance ? editorInstance.getMarkdown() : markdownContent;
    const { markdown: nextMarkdown, newSceneIndex } = insertSceneAfterIndex(
      currentMd,
      afterSceneIndex,
      customTitle
    );

    if (editorInstance && !editorInstance.isDestroyed) {
      editorInstance.commands.setContent(nextMarkdown, { contentType: 'markdown', emitUpdate: false });
      updateCounts(editorInstance.getText());
    } else {
      updateCounts(nextMarkdown);
    }

    const targetPath = chapterPath || filePath;
    const parsedScenes = extractSceneTitlesFromMarkdown(nextMarkdown);
    const { novelProject } = get();

    set({
      markdownContent: nextMarkdown,
      activeSceneIndex: newSceneIndex,
      ...(targetPath && novelProject
        ? {
            novelProject: {
              ...novelProject,
              binder: novelProject.binder.map((b) =>
                b.path === targetPath ? { ...b, scenes: parsedScenes } : b
              ),
            },
          }
        : {}),
    });
    get().setDirty(true);

    if (targetPath && get().autoSaveEnabled && fileService.isTauri()) {
      void get().saveFileAction();
    }

    await get().jumpToSceneAction(targetPath || '', newSceneIndex);
    return newSceneIndex;
  },

  reorderChapterScenesAction: async (chapterPath: string, fromIndex: number, toIndex: number) => {
    const { filePath, activeScenePath, editorInstance, markdownContent, novelProject, updateCounts } = get();
    const isCurrent = !chapterPath || chapterPath === filePath || chapterPath === activeScenePath;

    if (isCurrent && editorInstance && !editorInstance.isDestroyed) {
      if (!moveSceneInEditor(editorInstance, fromIndex, toIndex)) return false;
      get().setMarkdownContent(editorInstance.getMarkdown());
      set({ activeSceneIndex: toIndex });
      return true;
    }

    if (isCurrent) {
      const currentMd = editorInstance ? editorInstance.getMarkdown() : markdownContent;
      const nextMarkdown = reorderChapterScenes(currentMd, fromIndex, toIndex);
      if (nextMarkdown === currentMd && fromIndex === toIndex) return false;

      if (editorInstance && !editorInstance.isDestroyed) {
        editorInstance.commands.setContent(nextMarkdown, { contentType: 'markdown', emitUpdate: false });
        updateCounts(editorInstance.getText());
      } else {
        updateCounts(nextMarkdown);
      }

      const targetPath = chapterPath || filePath;
      const parsedScenes = extractSceneTitlesFromMarkdown(nextMarkdown);
      set({
        markdownContent: nextMarkdown,
        activeSceneIndex: toIndex,
        ...(targetPath && novelProject
          ? {
              novelProject: {
                ...novelProject,
                binder: novelProject.binder.map((b) =>
                  b.path === targetPath ? { ...b, scenes: parsedScenes } : b
                ),
              },
            }
          : {}),
      });
      get().setDirty(true);

      if (targetPath && get().autoSaveEnabled && fileService.isTauri()) {
        void get().saveFileAction();
      }
      return true;
    }

    // Reordering scenes in a non-active chapter file on disk
    try {
      const file = await fileService.readFileDirect(chapterPath);
      const nextMarkdown = reorderChapterScenes(file.content, fromIndex, toIndex);
      await fileService.saveFile(chapterPath, nextMarkdown);
      const latestProject = get().novelProject;
      if (latestProject) {
        set({ novelProject: withChapterOutline(latestProject, chapterPath, nextMarkdown) });
      }
      return true;
    } catch (err) {
      console.error('Error reordering chapter scenes:', err);
      return false;
    }
  },

  insertFileAsSceneAction: async (notePath: string, chapterPath: string) => {
    try {
      const { projectPath } = get();
      if (!projectPath || notePath === chapterPath) return false;

      // Latest text of the note, saved to disk if it is the open document.
      if (get().filePath === notePath && get().isDirty) {
        if (!(await get().saveFileAction())) return false;
      }
      const note = await fileService.readFileDirect(notePath);
      const { body: noteBody } = parseSceneMarkdown(note.content);
      const rawTitle =
        extractChapterHeadingTitle(noteBody) ||
        extractChapterDisplayTitle(fileService.extractFileName(notePath));
      const title = rawTitle.replace(/^scenes?\b[\s:\-–—]*/i, '').trim() || rawTitle;
      const text = noteBody.replace(/^\s*#[ \t]+.*(?:\r?\n|$)/, '').trim();
      const sceneMarkdown = text ? `## ${title}\n\n${text}\n` : `## ${title}\n`;

      if (!(await get().loadSceneByPath(chapterPath))) return false;
      const { editorInstance, markdownContent } = get();

      // Text moved in from a note was not written today.
      set({ skipNextCountDelta: true });
      if (editorInstance && !editorInstance.isDestroyed) {
        if (!appendMarkdownInEditor(editorInstance, sceneMarkdown)) return false;
        get().setMarkdownContent(editorInstance.getMarkdown());
      } else {
        const joined = `${markdownContent.replace(/\s+$/, '')}\n\n${sceneMarkdown}`;
        get().setMarkdownContent(joined);
        get().updateCounts(joined);
        get().setDirty(true);
      }
      // The chapter now holds the text: save it before the note leaves the folder.
      if (fileService.isTauri() && !(await get().saveFileAction())) return false;

      const moved = await moveFileToGraveyard(projectPath, notePath);
      await get().refreshProjectFiles();

      const total = countScenesInMarkdown(get().markdownContent);
      await get().jumpToSceneAction(chapterPath, Math.max(0, total - 1));
      get().setStatusMessage(`Added "${title}" as a scene; the note is kept in graveyard/${moved.fileName}`);
      return true;
    } catch (err) {
      console.error('Error inserting note as scene:', err);
      get().setStatusMessage(`Could not insert note: ${errorMessage(err)}`);
      return false;
    }
  },

  extractSceneToFileAction: async (chapterPath: string, sceneIndex: number) => {
    try {
      const { projectPath } = get();
      if (!projectPath) return false;
      if (chapterPath !== get().filePath && !(await get().loadSceneByPath(chapterPath))) return false;

      const { editorInstance, markdownContent, novelProject } = get();
      const md =
        editorInstance && !editorInstance.isDestroyed ? editorInstance.getMarkdown() : markdownContent;
      const scene = splitChapterIntoScenes(md).scenes[sceneIndex];
      if (!scene) return false;
      const title = scene.title.trim() || `Scene ${sceneIndex + 1}`;

      // Write the scene to its own standard Markdown file first...
      const existingNames = [...(novelProject?.binder || []), ...(novelProject?.extraFiles || [])].map((b) =>
        fileService.extractFileName(b.path)
      );
      const created = await createExtraFile(projectPath, existingNames, `scene ${title}`);
      await fileService.saveFile(created.path, `# ${title}\n\n${scene.body}\n`);

      // ...then take it out of the chapter (no graveyard copy needed: the file is the copy).
      if (!(await get().deleteSceneFromChapterAction(chapterPath, sceneIndex, { archive: false }))) {
        return false;
      }
      if (fileService.isTauri()) await get().saveFileAction();
      await get().refreshProjectFiles();
      get().setStatusMessage(`Moved scene "${title}" to Other Files as ${created.name}`);
      return true;
    } catch (err) {
      console.error('Error extracting scene:', err);
      get().setStatusMessage(`Could not extract scene: ${errorMessage(err)}`);
      return false;
    }
  },

  deleteSceneFromChapterAction: async (
    chapterPath: string,
    sceneIndex: number,
    options?: { archive?: boolean }
  ) => {
    const archive = options?.archive !== false;
    {
      const before = get();
      const isCurrent =
        !chapterPath || chapterPath === before.filePath || chapterPath === before.activeScenePath;
      if (!isCurrent) {
        const loaded = await get().loadSceneByPath(chapterPath);
        if (!loaded) return false;
      }
    }

    const { filePath, editorInstance, markdownContent, updateCounts, projectPath } = get();
    const hasEditor = Boolean(editorInstance && !editorInstance.isDestroyed);
    const currentMd = hasEditor ? editorInstance!.getMarkdown() : markdownContent;

    // Keep the removed scene: it goes to graveyard/ as an ordinary Markdown file.
    const removed = splitChapterIntoScenes(currentMd).scenes[sceneIndex];
    if (!removed) return false;
    if (archive && projectPath && removed.body.trim()) {
      const title = removed.title.trim() || `Scene ${sceneIndex + 1}`;
      try {
        await archiveTextToGraveyard(projectPath, title, `## ${title}\n\n${removed.body}\n`);
      } catch (err) {
        console.error('Could not archive scene before deleting:', err);
        get().setStatusMessage(`Scene not deleted: could not archive it (${errorMessage(err)})`);
        return false;
      }
    }

    // Cutting a scene is not "negative writing" for the daily goal.
    set({ skipNextCountDelta: true });

    if (hasEditor) {
      if (!deleteSceneInEditor(editorInstance!, sceneIndex)) return false;
      const md = editorInstance!.getMarkdown();
      get().setMarkdownContent(md);
      const remaining = countScenesInMarkdown(md);
      set({ activeSceneIndex: Math.max(0, Math.min(sceneIndex, remaining - 1)) });
      if (archive && projectPath) {
        get().setStatusMessage('Scene moved to graveyard (Ctrl+Z restores it here)');
      }
      return true;
    }

    const nextMarkdown = deleteSceneFromChapter(currentMd, sceneIndex);

    if (editorInstance && !editorInstance.isDestroyed) {
      editorInstance.commands.setContent(nextMarkdown, { contentType: 'markdown', emitUpdate: false });
      updateCounts(editorInstance.getText());
    } else {
      updateCounts(nextMarkdown);
    }

    const parsedScenes = extractSceneTitlesFromMarkdown(nextMarkdown);
    const nextActiveIdx = Math.max(0, Math.min(sceneIndex, Math.max(0, parsedScenes.length - 1)));
    const targetPath = chapterPath || filePath;
    const { novelProject } = get();

    set({
      markdownContent: nextMarkdown,
      activeSceneIndex: nextActiveIdx,
      ...(targetPath && novelProject
        ? {
            novelProject: {
              ...novelProject,
              binder: novelProject.binder.map((b) =>
                b.path === targetPath ? { ...b, scenes: parsedScenes } : b
              ),
            },
          }
        : {}),
    });
    get().setDirty(true);

    if (targetPath && get().autoSaveEnabled && fileService.isTauri()) {
      void get().saveFileAction();
    }
    return true;
  },
});

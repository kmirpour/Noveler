import * as fileService from '../services/fileService';
import { promptDialog } from '../services/dialogs';
import {
  type NovelProject,
  type CodexEntry,
  type SceneSnapshot,
  type CompileSettings,
  type ManuscriptComment,
  saveSnapshots,
  saveScratchpadFile,
  flushScratchpadToGraveyard,
} from '../services/projectService';
import { splitChapterIntoScenes } from '../utils/chapterScenes';
import { buildContextPack } from '../utils/contextPack';
import type { WikiImportPlan } from '../utils/storyBible';
import { getGitStatus, syncGit, getChangedFiles } from '../services/gitService';
import type { SliceCreator, ProjectToolsPart } from './types';
import { errorMessage, countWords, persistProject, flushProjectSave } from './shared';

/** Story tools: scratchpad, story bible, snapshots, comments, git, export presets. */
export const createProjectToolsSlice: SliceCreator<ProjectToolsPart> = (set, get) => ({
  addCustomDictionaryWordAction: async (word: string) => {
    const clean = word.trim().toLowerCase();
    if (!clean) return;
    const { novelProject, projectPath } = get();
    if (!novelProject || !projectPath) return;
    const existing = novelProject.customDictionary || [];
    if (existing.includes(clean)) return;
    const updatedProject: NovelProject = {
      ...novelProject,
      customDictionary: [...existing, clean],
    };
    set({ novelProject: updatedProject, statusMessage: `Added "${word.trim()}" to project dictionary` });
    persistProject();
  },

  saveProjectConfigAction: async () => {
    const { projectPath, novelProject } = get();
    if (!projectPath || !novelProject) return;
    persistProject();
    await flushProjectSave();
  },

  setScratchpadContent: (content: string) => {
    set({ scratchpadContent: content });
    const { projectPath } = get();
    if (projectPath) {
      void saveScratchpadFile(projectPath, content);
    }
  },

  appendToScratchpadAction: (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const current = get().scratchpadContent.replace(/\s+$/, '');
    get().setScratchpadContent(current ? `${current}\n\n${clean}\n` : `${clean}\n`);
    get().setStatusMessage('Moved to scratchpad');
  },

  replaceDocumentTextAction: (markdown: string, message: string) => {
    const { editorInstance, setMarkdownContent, updateCounts, setDirty, setStatusMessage } = get();
    // Bringing back an old version is not words written today.
    set({ skipNextCountDelta: true });
    setMarkdownContent(markdown);
    if (editorInstance && !editorInstance.isDestroyed) {
      editorInstance.commands.setContent(markdown, { contentType: 'markdown', emitUpdate: false });
      updateCounts(editorInstance.getText());
    } else {
      updateCounts(markdown);
    }
    setDirty(true);
    setStatusMessage(message);
    if (get().filePath && get().autoSaveEnabled && fileService.canWriteToDisk(get().filePath)) void get().saveFileAction();
  },

  copyContextPackAction: async () => {
    const { novelProject, filePath, activeSceneIndex, editorInstance, markdownContent } = get();
    if (!novelProject) {
      get().setStatusMessage('Open a novel folder to build a context pack');
      return false;
    }
    try {
      const hasEditor = Boolean(editorInstance && !editorInstance.isDestroyed);
      const md = hasEditor ? editorInstance!.getMarkdown() : markdownContent;
      const isChapter = novelProject.binder.some((b) => b.path === filePath);
      const scene = isChapter ? splitChapterIntoScenes(md).scenes[activeSceneIndex] : undefined;
      const currentText = scene
        ? `### ${scene.title || `Scene ${activeSceneIndex + 1}`}\n\n${scene.body}`
        : isChapter
          ? md
          : '';

      let selection = '';
      if (hasEditor) {
        const { from, to } = editorInstance!.state.selection;
        if (from !== to) selection = editorInstance!.state.doc.textBetween(from, to, '\n\n');
      }

      // World notes: files whose names say they hold the world, cast or lore.
      const notes: { title: string; markdown: string }[] = [];
      for (const file of novelProject.extraFiles || []) {
        if (!/wiki|world|character|cast|bible|lore|glossary/i.test(fileService.extractFileName(file.path)))
          continue;
        try {
          const content = file.path === filePath ? md : (await fileService.readFileDirect(file.path)).content;
          notes.push({ title: file.title, markdown: content });
        } catch {
          // skip unreadable notes
        }
      }

      const pack = buildContextPack({
        project: novelProject,
        activePath: filePath,
        activeSceneIndex,
        currentText,
        selection,
        notes,
      });
      await navigator.clipboard.writeText(pack);
      get().setStatusMessage(
        `Copied context to the clipboard (${countWords(pack).toLocaleString()} words): paste it into your assistant`
      );
      return true;
    } catch (err) {
      console.error('Error building context pack:', err);
      get().setStatusMessage(`Could not copy context: ${errorMessage(err)}`);
      return false;
    }
  },

  applyWikiImportAction: async (plan: WikiImportPlan) => {
    const { novelProject } = get();
    if (!novelProject) return 0;
    const stamp = Date.now();
    const added: CodexEntry[] = plan.toAdd.map((p, i) => ({
      id: `codex_${stamp}_${i}_${Math.random().toString(36).slice(2, 7)}`,
      name: p.name,
      category: p.category,
      aliases: p.aliases,
      summary: p.summary,
      description: p.description,
    }));
    const updates = new Map(plan.toUpdate.map((u) => [u.existing.id, u.parsed]));
    const codex = (novelProject.codex || []).map((entry) => {
      const parsed = updates.get(entry.id);
      if (!parsed) return entry;
      // Fill gaps only: anything the writer already typed is kept.
      return {
        ...entry,
        summary: entry.summary?.trim() ? entry.summary : parsed.summary,
        description: entry.description?.trim() ? entry.description : parsed.description,
        aliases: Array.from(new Set([...(entry.aliases || []), ...parsed.aliases])),
      };
    });
    set({ novelProject: { ...novelProject, codex: [...codex, ...added] } });
    persistProject();
    const total = added.length + updates.size;
    get().setStatusMessage(`Story bible: ${added.length} added, ${updates.size} filled in`);
    return total;
  },

  flushScratchpadAction: async () => {
    const { projectPath, scratchpadContent } = get();
    if (!projectPath) {
      get().setStatusMessage('Open a novel folder to flush scratchpad to graveyard');
      return false;
    }
    if (!scratchpadContent.trim()) return false;

    try {
      const res = await flushScratchpadToGraveyard(projectPath, scratchpadContent);
      set({ scratchpadContent: '' });
      await saveScratchpadFile(projectPath, '');
      get().setStatusMessage(`Flushed notes to graveyard/${res.fileName}`);
      return true;
    } catch (err) {
      console.error('Error flushing scratchpad:', err);
      get().setStatusMessage(`Error archiving notes: ${errorMessage(err)}`);
      return false;
    }
  },

  gitChangedFiles: null,

  refreshGitChangesAction: async () => {
    const { projectPath } = get();
    if (!projectPath || !fileService.isTauri()) {
      set({ gitChangedFiles: null });
      return;
    }
    const status = await getGitStatus(projectPath);
    set({ gitChangedFiles: status.is_repo ? await getChangedFiles(projectPath) : null });
  },

  commitVersionAction: async () => {
    if (!fileService.isTauri()) {
      get().setStatusMessage('Saved versions use git and are available in the desktop app');
      return false;
    }
    const { projectPath, isDirty, saveFileAction } = get();
    if (!projectPath) {
      get().setStatusMessage('Open a novel folder to save a version');
      return false;
    }
    const note = await promptDialog({
      title: 'Save a version of the novel',
      message:
        'Records the current state of every file on this computer (a git commit), so you can go back to it later. Nothing is uploaded.',
      placeholder: 'What changed? (optional)',
      confirmLabel: 'Save version',
    });
    if (note === null) return false;
    try {
      if (isDirty) await saveFileAction();
      await flushProjectSave();
      const status = await getGitStatus(projectPath);
      if (!status.git_installed) {
        get().setStatusMessage('Git is not installed on this computer, so versions cannot be saved.');
        return false;
      }
      get().setStatusMessage(await syncGit(projectPath, null, note.trim() || null, false));
      await get().refreshGitChangesAction();
      return true;
    } catch (err) {
      console.error('Git commit error:', err);
      get().setStatusMessage(`Could not save a version: ${errorMessage(err)}`);
      return false;
    }
  },

  addCommentAction: (quote: string, text: string) => {
    const { novelProject, fileName } = get();
    const cleanQuote = quote.trim();
    if (!novelProject || !fileName || !cleanQuote || !text.trim()) return;
    const comment: ManuscriptComment = {
      id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      quote: cleanQuote,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    const forFile = novelProject.comments?.[fileName] || [];
    set({
      novelProject: {
        ...novelProject,
        comments: { ...(novelProject.comments || {}), [fileName]: [...forFile, comment] },
      },
      inspectorOpen: true,
    });
    persistProject();
  },

  updateCommentAction: (id, partial) => {
    const { novelProject, fileName } = get();
    if (!novelProject || !fileName) return;
    const forFile = (novelProject.comments?.[fileName] || []).map((c) =>
      c.id === id ? { ...c, ...partial } : c
    );
    set({
      novelProject: { ...novelProject, comments: { ...(novelProject.comments || {}), [fileName]: forFile } },
    });
    persistProject();
  },

  deleteCommentAction: (id) => {
    const { novelProject, fileName } = get();
    if (!novelProject || !fileName) return;
    const forFile = (novelProject.comments?.[fileName] || []).filter((c) => c.id !== id);
    set({
      novelProject: { ...novelProject, comments: { ...(novelProject.comments || {}), [fileName]: forFile } },
    });
    persistProject();
  },

  saveCompileSettingsAction: (settings: CompileSettings) => {
    const { novelProject } = get();
    if (!novelProject) return;
    if (JSON.stringify(novelProject.compileSettings ?? {}) === JSON.stringify(settings)) return;
    set({ novelProject: { ...novelProject, compileSettings: settings } });
    persistProject();
  },

  syncGitAction: async () => {
    if (!fileService.isTauri()) {
      get().setStatusMessage('Pushing to GitHub uses git and is available in the desktop app');
      return false;
    }
    const { projectPath, novelProject, saveFileAction, isDirty } = get();
    if (!projectPath) {
      get().setStatusMessage('Open a novel folder to push to GitHub');
      return false;
    }

    if (isDirty) {
      await saveFileAction();
    }
    await flushProjectSave();

    try {
      get().setStatusMessage('Checking Git status...');
      const status = await getGitStatus(projectPath);
      if (!status.git_installed) {
        get().setStatusMessage('Git is not installed on this system. Install Git to push to GitHub.');
        return false;
      }

      let remoteUrl = status.remote_url || novelProject?.gitRemoteUrl || null;
      if (!remoteUrl) {
        const entered = await promptDialog({
          title: 'Where should the manuscript be pushed?',
          message: 'Paste the address of your GitHub repository. It is remembered for this novel.',
          placeholder: 'https://github.com/username/my-novel.git',
          confirmLabel: 'Push',
        });
        if (!entered || !entered.trim()) {
          get().setStatusMessage('GitHub push cancelled (no repository URL provided)');
          return false;
        }
        remoteUrl = entered.trim();
        if (novelProject) {
          const updated = { ...novelProject, gitRemoteUrl: remoteUrl };
          set({ novelProject: updated });
          persistProject();
        }
      }

      get().setStatusMessage('Pushing manuscript to GitHub...');
      const resultMsg = await syncGit(projectPath, remoteUrl);
      get().setStatusMessage(resultMsg);
      void get().refreshGitChangesAction();
      return true;
    } catch (err) {
      console.error('Git sync error:', err);
      get().setStatusMessage(`Git push failed: ${errorMessage(err)}`);
      return false;
    }
  },

  addTagCategoryAction: async (category: string) => {
    const { projectPath, novelProject, tagCategories } = get();
    const clean = category.trim().toLowerCase().replace(/^#/, '');
    if (!clean || tagCategories.includes(clean)) return;
    const updatedCats = [...tagCategories, clean];
    set({ tagCategories: updatedCats });
    if (projectPath && novelProject) {
      const updated = { ...novelProject, tagCategories: updatedCats };
      set({ novelProject: updated });
      persistProject();
    }
  },

  assignTagCategoryAction: async (tagName: string, category: string) => {
    const { tagAssignments, projectPath, novelProject } = get();
    const cleanTag = tagName.toLowerCase().replace(/^#/, '');
    const updatedAssignments = { ...tagAssignments, [cleanTag]: category };
    set({ tagAssignments: updatedAssignments });
    if (projectPath && novelProject) {
      const updated = { ...novelProject, tagAssignments: updatedAssignments };
      set({ novelProject: updated });
      persistProject();
    }
  },

  referencePath: null,
  setReferencePath: (referencePath) => set({ referencePath }),
  openReferenceAction: (path) => {
    set({ referencePath: path });
    get().setViewMode('reference');
  },

  setCorkboardOpen: (corkboardOpen: boolean) => set({ corkboardOpen }),
  toggleCorkboard: () => set({ corkboardOpen: !get().corkboardOpen }),
  setInspectorOpen: (inspectorOpen: boolean) => set({ inspectorOpen }),
  toggleInspector: () => set({ inspectorOpen: !get().inspectorOpen }),
  setScriveningsMode: (scriveningsMode: boolean) => set({ scriveningsMode }),
  toggleScriveningsMode: () => set({ scriveningsMode: !get().scriveningsMode }),

  loadSceneByPath: async (path: string) => {
    return await get().openFileByPath(path);
  },

  addCodexEntryAction: async (entry: Omit<CodexEntry, 'id'>) => {
    const { novelProject, projectPath } = get();
    if (!novelProject || !projectPath) return;
    const newEntry: CodexEntry = {
      ...entry,
      id: `codex_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    };
    const updatedProject: NovelProject = {
      ...novelProject,
      codex: [...(novelProject.codex || []), newEntry],
    };
    set({ novelProject: updatedProject });
    persistProject();
  },

  updateCodexEntryAction: async (entry: CodexEntry) => {
    const { novelProject, projectPath } = get();
    if (!novelProject || !projectPath) return;
    const codex = (novelProject.codex || []).map((e) => (e.id === entry.id ? entry : e));
    const updatedProject: NovelProject = { ...novelProject, codex };
    set({ novelProject: updatedProject });
    persistProject();
  },

  deleteCodexEntryAction: async (id: string) => {
    const { novelProject, projectPath } = get();
    if (!novelProject || !projectPath) return;
    const codex = (novelProject.codex || []).filter((e) => e.id !== id);
    const updatedProject: NovelProject = { ...novelProject, codex };
    set({ novelProject: updatedProject });
    persistProject();
  },

  createSceneSnapshotAction: async (label: string) => {
    const {
      novelProject,
      projectPath,
      filePath,
      editorInstance,
      markdownContent,
      wordCount,
      setStatusMessage,
    } = get();
    if (!novelProject || !projectPath || !filePath) return;
    const latestContent = editorInstance ? editorInstance.getMarkdown() : markdownContent;
    const newSnapshot: SceneSnapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      scenePath: filePath,
      timestamp: new Date().toISOString(),
      label: label.trim() || 'Manual Snapshot',
      wordCount,
      content: latestContent,
    };
    const updatedProject: NovelProject = {
      ...novelProject,
      snapshots: [newSnapshot, ...(novelProject.snapshots || [])],
    };
    set({ novelProject: updatedProject, markdownContent: latestContent });
    await saveSnapshots(projectPath, updatedProject.snapshots || []);
    setStatusMessage(`Saved snapshot: "${newSnapshot.label}"`);
  },

  restoreSceneSnapshotAction: async (snapshotId: string) => {
    const { novelProject } = get();
    if (!novelProject) return;
    const snap = (novelProject.snapshots || []).find((s) => s.id === snapshotId);
    if (!snap) return;
    get().replaceDocumentTextAction(snap.content, `Restored snapshot "${snap.label}" (Ctrl+Z undoes this)`);
  },

  deleteSceneSnapshotAction: async (snapshotId: string) => {
    const { novelProject, projectPath } = get();
    if (!novelProject || !projectPath) return;
    const snapshots = (novelProject.snapshots || []).filter((s) => s.id !== snapshotId);
    const updatedProject: NovelProject = { ...novelProject, snapshots };
    set({ novelProject: updatedProject });
    await saveSnapshots(projectPath, snapshots);
  },
});

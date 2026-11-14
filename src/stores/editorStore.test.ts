import { beforeEach, describe, expect, it, vi } from 'vitest';

// Replace only the dialog-facing part of the file service.
vi.mock('../services/fileService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/fileService')>();
  return { ...actual, promptUnsavedChanges: vi.fn() };
});

import * as fileService from '../services/fileService';
import { loadRecovery, saveRecovery } from '../services/recovery';
import { useEditorStore } from './editorStore';
import { wordsToday } from '../utils/writingLog';
import { THEME_IDS } from '../services/themes';

const prompt = vi.mocked(fileService.promptUnsavedChanges);

beforeEach(() => {
  localStorage.clear();
  prompt.mockReset();
  useEditorStore.setState({
    isDirty: false,
    fileName: 'ch1.md',
    filePath: 'C:/novel/ch1.md',
    markdownContent: 'Hello',
    editorInstance: null,
  });
});

describe('confirmDiscardIfDirty', () => {
  it('does not prompt when there are no unsaved changes', async () => {
    expect(await useEditorStore.getState().confirmDiscardIfDirty()).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
  });

  it('blocks the action when the user cancels', async () => {
    useEditorStore.setState({ isDirty: true });
    prompt.mockResolvedValue('cancel');
    expect(await useEditorStore.getState().confirmDiscardIfDirty()).toBe(false);
  });

  it('allows the action and clears recovery when the user discards', async () => {
    useEditorStore.setState({ isDirty: true });
    saveRecovery({ markdown: 'draft', fileName: null, filePath: null });
    prompt.mockResolvedValue('discard');
    expect(await useEditorStore.getState().confirmDiscardIfDirty()).toBe(true);
    expect(loadRecovery()).toBeNull();
  });

  it('saves first when the user chooses save', async () => {
    useEditorStore.setState({ isDirty: true });
    prompt.mockResolvedValue('save');
    const save = vi.fn().mockResolvedValue(true);
    useEditorStore.setState({ saveFileAction: save });
    expect(await useEditorStore.getState().confirmDiscardIfDirty()).toBe(true);
    expect(save).toHaveBeenCalledOnce();
  });

  it('blocks the action if the save fails or is cancelled', async () => {
    useEditorStore.setState({ isDirty: true });
    prompt.mockResolvedValue('save');
    useEditorStore.setState({ saveFileAction: vi.fn().mockResolvedValue(false) });
    expect(await useEditorStore.getState().confirmDiscardIfDirty()).toBe(false);
  });
});

describe('newFile', () => {
  it('keeps the current document when the user cancels', async () => {
    useEditorStore.setState({ isDirty: true });
    prompt.mockResolvedValue('cancel');
    expect(await useEditorStore.getState().newFile()).toBe(false);
    expect(useEditorStore.getState().markdownContent).toBe('Hello');
    expect(useEditorStore.getState().filePath).toBe('C:/novel/ch1.md');
  });

  it('resets the document when it is clean', async () => {
    expect(await useEditorStore.getState().newFile()).toBe(true);
    const s = useEditorStore.getState();
    expect(s.markdownContent).toBe('');
    expect(s.filePath).toBeNull();
    expect(s.isDirty).toBe(false);
  });
});

describe('openFileByPath', () => {
  it('rejects unsupported file types without prompting', async () => {
    useEditorStore.setState({ isDirty: true });
    expect(await useEditorStore.getState().openFileByPath('C:/novel/cover.png')).toBe(false);
    expect(prompt).not.toHaveBeenCalled();
  });
});

describe('loadDocument', () => {
  it('can load a restored document as dirty', () => {
    useEditorStore.getState().loadDocument({
      markdown: 'Recovered text',
      fileName: null,
      filePath: null,
      dirty: true,
    });
    const s = useEditorStore.getState();
    expect(s.isDirty).toBe(true);
    expect(s.markdownContent).toBe('Recovered text');
  });
});

describe('WritingSlice', () => {
  it('toggles focus mode and typewriter mode', () => {
    const store = useEditorStore.getState();
    expect(store.focusMode).toBe(false);
    expect(store.typewriterMode).toBe(false);

    store.toggleFocusMode();
    expect(useEditorStore.getState().focusMode).toBe(true);

    store.toggleTypewriterMode();
    expect(useEditorStore.getState().typewriterMode).toBe(true);

    store.toggleDimUnfocused();
    expect(useEditorStore.getState().dimUnfocused).toBe(true);
  });

  it('tracks session words and resets sprint', () => {
    useEditorStore.setState({ countBaseline: null, sessionWords: 0, writingLog: {}, novelProject: null });
    const store = useEditorStore.getState();
    store.updateCounts('First chapter begins here with seven words');
    expect(useEditorStore.getState().wordCount).toBe(7);
    expect(useEditorStore.getState().sessionWords).toBe(0);

    store.updateCounts('First chapter begins here with seven words and now six more');
    expect(useEditorStore.getState().wordCount).toBe(11);
    expect(useEditorStore.getState().sessionWords).toBe(4);
    expect(wordsToday(useEditorStore.getState().writingLog)).toBe(4);

    store.resetSessionWords();
    expect(useEditorStore.getState().sessionWords).toBe(0);
    // A new sprint does not erase what was written today.
    expect(wordsToday(useEditorStore.getState().writingLog)).toBe(4);
  });

  it("keeps today's words when switching chapters, and never counts a loaded file as writing", () => {
    useEditorStore.setState({ countBaseline: null, sessionWords: 0, writingLog: {}, novelProject: null });
    const store = useEditorStore.getState();
    store.loadDocument({ markdown: 'one two three', fileName: 'a.md', filePath: 'C:/novel/a.md' });
    store.updateCounts('one two three four five');
    expect(wordsToday(useEditorStore.getState().writingLog)).toBe(2);

    // Opening a much longer chapter adds nothing by itself...
    store.loadDocument({
      markdown: 'a long chapter with quite a few more words in it',
      fileName: 'b.md',
      filePath: 'C:/novel/b.md',
    });
    expect(wordsToday(useEditorStore.getState().writingLog)).toBe(2);
    expect(useEditorStore.getState().sessionWords).toBe(2);

    // ...and writing there adds to the same daily total.
    store.updateCounts('a long chapter with quite a few more words in it plus three');
    expect(wordsToday(useEditorStore.getState().writingLog)).toBe(4);
    expect(useEditorStore.getState().sessionWords).toBe(4);
  });

  it('moves a note into a chapter as a scene and lifts a scene out to its own file', async () => {
    const chapterPath = '/novel/01-chapter.md';
    const notePath = '/novel/scene-armageddon.md';
    const files = new Map<string, string>([
      [chapterPath, '# Chapter 1\n\n## One\n\nFirst scene.\n'],
      [notePath, '# Scene Armageddon\n\nThe *end* began on a Tuesday.\n'],
    ]);
    const read = vi.spyOn(fileService, 'readFileDirect').mockImplementation(async (path: string) => {
      if (!files.has(path)) throw new Error(`missing ${path}`);
      return { path, name: path.split('/').pop()!, content: files.get(path)! };
    });
    // Opening a chapter reads it through readFileForEditing, which reads via readFileDirect.
    const readEditing = vi
      .spyOn(fileService, 'readFileForEditing')
      .mockImplementation(async (path: string) => fileService.readFileDirect(path));
    const save = vi.spyOn(fileService, 'saveFile').mockImplementation(async (path: string, content: string) => {
      files.set(path, content);
    });
    const create = vi
      .spyOn(fileService, 'createFile')
      .mockImplementation(async (path: string, content?: string) => {
        files.set(path, content ?? '');
      });
    const rename = vi.spyOn(fileService, 'renamePath').mockImplementation(async (from: string, to: string) => {
      files.set(to, files.get(from)!);
      files.delete(from);
    });
    const tree = vi.spyOn(fileService, 'readDirTree').mockImplementation(async () =>
      [...files.keys()]
        .filter((p) => p.startsWith('/novel/') && !p.includes('/graveyard/') && p.endsWith('.md'))
        .map((p) => ({ name: p.split('/').pop()!, path: p, is_dir: false, children: [] }))
    );

    useEditorStore.setState({ editorInstance: null, isDirty: false, filePath: null, fileName: null });
    expect(await useEditorStore.getState().loadProjectByPath('/novel')).toBe(true);
    await vi.waitFor(() => expect(useEditorStore.getState().filePath).toBe(chapterPath));

    // Note -> last scene of the chapter; the note itself is kept in the graveyard.
    expect(await useEditorStore.getState().insertFileAsSceneAction(notePath, chapterPath)).toBe(true);
    const afterInsert = useEditorStore.getState().markdownContent;
    expect(afterInsert).toContain('## One\n\nFirst scene.');
    expect(afterInsert).toContain('## Armageddon\n\nThe *end* began on a Tuesday.');
    expect(files.has(notePath)).toBe(false);
    expect([...files.keys()].some((p) => p.includes('/graveyard/') && p.endsWith('scene-armageddon.md'))).toBe(true);
    expect(wordsToday(useEditorStore.getState().writingLog)).toBe(0);

    // Scene -> its own standard Markdown file under Other Files.
    expect(await useEditorStore.getState().extractSceneToFileAction(chapterPath, 0)).toBe(true);
    const afterExtract = useEditorStore.getState().markdownContent;
    expect(afterExtract).not.toContain('First scene.');
    expect(afterExtract).toContain('## Armageddon');
    expect(files.get('/novel/scene-one.md')).toBe('# One\n\nFirst scene.\n');
    expect(useEditorStore.getState().novelProject?.extraFiles?.map((f) => f.path)).toContain('/novel/scene-one.md');

    for (const spy of [read, readEditing, save, create, rename, tree]) spy.mockRestore();
    useEditorStore.setState({ projectPath: null, novelProject: null, writingLog: {}, isDirty: false });
  });

  it('reorders chapters without renaming any file', async () => {
    const mk = (name: string) => ({
      id: name,
      type: 'scene' as const,
      title: name,
      path: `C:/novel/${name}`,
    });
    useEditorStore.setState({
      projectPath: 'C:/novel',
      novelProject: {
        version: 1,
        title: 'T',
        author: 'A',
        targetWordCount: 1,
        dailyTarget: 1,
        createdAt: '',
        updatedAt: '',
        binder: [mk('01-a.md'), mk('02-b.md'), mk('03-c.md')],
      },
    });
    const rename = vi.spyOn(fileService, 'renamePath');
    expect(await useEditorStore.getState().reorderBinderItemsAction(2, 0)).toBe(true);
    expect(useEditorStore.getState().novelProject?.binder.map((b) => b.path)).toEqual([
      'C:/novel/03-c.md',
      'C:/novel/01-a.md',
      'C:/novel/02-b.md',
    ]);
    expect(rename).not.toHaveBeenCalled();
    rename.mockRestore();
    useEditorStore.setState({ projectPath: null, novelProject: null });
  });

  it('manages daily word goals and selected word count', () => {
    const store = useEditorStore.getState();
    store.setDailyWordGoal(1667);
    expect(useEditorStore.getState().dailyWordGoal).toBe(1667);

    store.setSelectedWordCount(42);
    expect(useEditorStore.getState().selectedWordCount).toBe(42);
  });

  it('toggles overlay modals correctly', () => {
    const store = useEditorStore.getState();
    expect(store.findReplaceOpen).toBe(false);
    expect(store.commandPaletteOpen).toBe(false);
    expect(store.goalsModalOpen).toBe(false);

    store.setFindReplaceOpen(true);
    expect(useEditorStore.getState().findReplaceOpen).toBe(true);

    store.setCommandPaletteOpen(true);
    expect(useEditorStore.getState().commandPaletteOpen).toBe(true);

    store.setGoalsModalOpen(true);
    expect(useEditorStore.getState().goalsModalOpen).toBe(true);
  });

  it('cycles through every theme and back to the first, marking light and dark surfaces', () => {
    const store = useEditorStore.getState();
    store.setTheme('sepia');
    expect(useEditorStore.getState().theme).toBe('sepia');
    expect(document.documentElement.getAttribute('data-theme-kind')).toBe('light');

    const seen: string[] = [];
    for (let i = 0; i < THEME_IDS.length - 1; i++) {
      store.cycleTheme();
      seen.push(useEditorStore.getState().theme);
    }
    expect(new Set(seen).size).toBe(THEME_IDS.length - 1);
    expect(seen).toContain('nord');
    expect(seen).toContain('dusk');

    store.setTheme('ink');
    expect(document.documentElement.getAttribute('data-theme')).toBe('ink');
    expect(document.documentElement.getAttribute('data-theme-kind')).toBe('dark');

    store.setTheme(THEME_IDS[THEME_IDS.length - 1]);
    store.cycleTheme();
    expect(useEditorStore.getState().theme).toBe('sepia');
  });

  it('manages scratchpad and tag categories in ProjectSlice', async () => {
    const store = useEditorStore.getState();
    store.setScratchpadContent('Important plot clues for mystery novel');
    expect(useEditorStore.getState().scratchpadContent).toBe('Important plot clues for mystery novel');

    await store.addTagCategoryAction('suspects');
    expect(useEditorStore.getState().tagCategories).toContain('suspects');

    await store.assignTagCategoryAction('morse', 'suspects');
    expect(useEditorStore.getState().tagAssignments['morse']).toBe('suspects');

    // flushScratchpadAction returns false when no project is open or content is empty
    expect(await store.flushScratchpadAction()).toBe(false);
  });

  it('synchronizes scene metadata across currentMetadata, binder, and chapterMetadata', () => {
    useEditorStore.setState({
      projectPath: 'C:/novel',
      filePath: 'C:/novel/01-chapter.md',
      fileName: '01-chapter.md',
      activeScenePath: 'C:/novel/01-chapter.md',
      novelProject: {
        version: 1,
        title: 'Test Novel',
        author: 'Author',
        targetWordCount: 80000,
        dailyTarget: 1000,
        createdAt: '',
        updatedAt: '',
        binder: [
          {
            id: 'b1',
            type: 'scene',
            title: 'Chapter 1',
            path: 'C:/novel/01-chapter.md',
            status: 'draft',
          },
        ],
        chapterMetadata: {},
      },
    });

    useEditorStore.getState().updateSceneMetadataByPath('C:/novel/01-chapter.md', {
      synopsis: 'Updated from corkboard',
      pov: 'Alice',
      status: 'revised',
    });

    const state = useEditorStore.getState();
    expect(state.currentMetadata.synopsis).toBe('Updated from corkboard');
    expect(state.currentMetadata.pov).toBe('Alice');
    expect(state.novelProject?.binder[0].synopsis).toBe('Updated from corkboard');
    expect(state.novelProject?.chapterMetadata?.['01-chapter.md']?.synopsis).toBe('Updated from corkboard');
  });

  it('manages chapter scene outline titles via ## Scene Headers in chapter markdown without storing in noveler.json', async () => {
    const chPath = 'C:/novel/01-chapter.md';
    useEditorStore.setState({
      projectPath: 'C:/novel',
      filePath: chPath,
      fileName: '01-chapter.md',
      activeScenePath: chPath,
      activeSceneIndex: 0,
      markdownContent: '# Chapter 1\n\n## Scene 1\n\nFirst scene prose.\n\n## Scene 2\n\nSecond scene prose.\n',
      currentMetadata: {},
      novelProject: {
        version: 1,
        title: 'Test Novel',
        author: 'Author',
        targetWordCount: 80000,
        dailyTarget: 1000,
        createdAt: '',
        updatedAt: '',
        binder: [
          {
            id: 'b1',
            type: 'scene',
            title: 'Chapter 1',
            path: chPath,
            status: 'draft',
            scenes: ['Scene 1', 'Scene 2'],
          },
        ],
        chapterMetadata: {},
      },
    });

    // Rename scenes in outline -> updates ## headers in markdown
    await useEditorStore.getState().renameChapterSceneAction(chPath, 0, 'The Arrival');
    await useEditorStore.getState().renameChapterSceneAction(chPath, 1, 'The Tavern');

    let state = useEditorStore.getState();
    expect(state.markdownContent).toContain('## The Arrival');
    expect(state.markdownContent).toContain('## The Tavern');
    expect(state.novelProject?.binder[0].scenes).toEqual(['The Arrival', 'The Tavern']);
    // Ensure scene titles are NOT stored in chapterMetadata in noveler.json
    expect(state.novelProject?.chapterMetadata?.['01-chapter.md']).toBeUndefined();

    // Reorder scenes via drag-and-drop
    await useEditorStore.getState().reorderChapterScenesAction(chPath, 1, 0);
    state = useEditorStore.getState();
    expect(state.novelProject?.binder[0].scenes).toEqual(['The Tavern', 'The Arrival']);
    expect(state.markdownContent).toBe(
      '# Chapter 1\n\n## The Tavern\n\nSecond scene prose.\n\n## The Arrival\n\nFirst scene prose.\n'
    );

    // Add a new scene from the outline
    const newIdx = await useEditorStore.getState().addSceneToChapterAction(chPath, 'The Escape');
    state = useEditorStore.getState();
    expect(newIdx).toBe(2);
    expect(state.activeSceneIndex).toBe(2);
    expect(state.novelProject?.binder[0].scenes).toEqual(['The Tavern', 'The Arrival', 'The Escape']);
    expect(state.markdownContent).toContain('## The Escape');

    // Delete a scene from the outline
    await useEditorStore.getState().deleteSceneFromChapterAction(chPath, 0);
    state = useEditorStore.getState();
    expect(state.novelProject?.binder[0].scenes).toEqual(['The Arrival', 'The Escape']);
  });

  it('inserts a scene in the middle using ## Scene Header and supports sceneTitleMode and separate scratchpad file', async () => {
    const chPath = 'C:/novel/01-chapter.md';
    useEditorStore.setState({
      projectPath: 'C:/novel',
      filePath: chPath,
      fileName: '01-chapter.md',
      activeScenePath: chPath,
      activeSceneIndex: 0,
      markdownContent: '# Chapter 1\n\n## Opening Scene\n\nPart A.\n\n## Final Scene\n\nFinale prose.\n',
      currentMetadata: {},
      novelProject: {
        version: 1,
        title: 'Test Novel',
        author: 'Author',
        targetWordCount: 80000,
        dailyTarget: 1000,
        createdAt: '',
        updatedAt: '',
        binder: [
          {
            id: 'b1',
            type: 'scene',
            title: 'Chapter 1',
            path: chPath,
            status: 'draft',
            scenes: ['Opening Scene', 'Final Scene'],
          },
        ],
        chapterMetadata: {},
      },
    });

    // User inserts a scene in the middle from the outline (after index 0)
    const insertedIdx = await useEditorStore
      .getState()
      .insertSceneAfterAction(chPath, 0, 'Bridge Scene');
    let state = useEditorStore.getState();
    expect(insertedIdx).toBe(1);
    expect(state.novelProject?.binder[0].scenes).toEqual([
      'Opening Scene',
      'Bridge Scene',
      'Final Scene',
    ]);
    expect(state.markdownContent).toBe(
      '# Chapter 1\n\n## Opening Scene\n\nPart A.\n\n## Bridge Scene\n\n## Final Scene\n\nFinale prose.\n'
    );

    // Scene display mode toggle
    useEditorStore.getState().setSceneTitleMode('stars');
    expect(useEditorStore.getState().sceneTitleMode).toBe('stars');
    useEditorStore.getState().setSceneTitleMode('hide');
    expect(useEditorStore.getState().sceneTitleMode).toBe('hide');
    useEditorStore.getState().setSceneTitleMode('show');
    expect(useEditorStore.getState().sceneTitleMode).toBe('show');

    // Scratchpad updates state without mutating novelProject
    useEditorStore.getState().setScratchpadContent('Separate scratchpad file note');
    state = useEditorStore.getState();
    expect(state.scratchpadContent).toBe('Separate scratchpad file note');
    expect('scratchpad' in (state.novelProject as unknown as Record<string, unknown>)).toBe(false);
  });
});


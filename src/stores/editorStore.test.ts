import { beforeEach, describe, expect, it, vi } from 'vitest';

// Replace only the dialog-facing part of the file service.
vi.mock('../services/fileService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/fileService')>();
  return { ...actual, promptUnsavedChanges: vi.fn() };
});

import * as fileService from '../services/fileService';
import { loadRecovery, saveRecovery } from '../services/recovery';
import { useEditorStore } from './editorStore';

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
    const store = useEditorStore.getState();
    store.updateCounts('First chapter begins here with seven words');
    expect(useEditorStore.getState().wordCount).toBe(7);
    expect(useEditorStore.getState().sessionWords).toBe(0);

    store.updateCounts('First chapter begins here with seven words and now six more');
    expect(useEditorStore.getState().wordCount).toBe(11);
    expect(useEditorStore.getState().sessionWords).toBe(4);

    store.resetSessionWords();
    expect(useEditorStore.getState().sessionWords).toBe(0);
    expect(useEditorStore.getState().sessionStartWordCount).toBe(11);
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

  it('cycles across all 5 themes per THEMES_SPECIFICATION.md', () => {
    const store = useEditorStore.getState();
    store.setTheme('sepia');
    expect(useEditorStore.getState().theme).toBe('sepia');

    store.cycleTheme();
    expect(useEditorStore.getState().theme).toBe('light');

    store.cycleTheme();
    expect(useEditorStore.getState().theme).toBe('dark');

    store.cycleTheme();
    expect(useEditorStore.getState().theme).toBe('forest');

    store.cycleTheme();
    expect(useEditorStore.getState().theme).toBe('nord');

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


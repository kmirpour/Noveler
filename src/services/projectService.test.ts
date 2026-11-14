import { describe, it, expect, vi } from 'vitest';
import {
  parseSceneMarkdown,
  serializeSceneMarkdown,
  buildBinderFromTree,
  flattenScenes,
  findEntityMentions,
  BinderItem,
} from './projectService';
import { BinderNode } from './fileService';

describe('projectService', () => {
  it('parses front-matter metadata from markdown', () => {
    const raw = `---
synopsis: "The detectives arrive at the abandoned warehouse."
pov: "Detective Miller"
status: draft
targetWords: 1200
---

The rain poured through the broken glass skylight. Miller stepped over the rubble.`;

    const { metadata, body } = parseSceneMarkdown(raw);
    expect(metadata.synopsis).toBe('The detectives arrive at the abandoned warehouse.');
    expect(metadata.pov).toBe('Detective Miller');
    expect(metadata.status).toBe('draft');
    expect(metadata.targetWords).toBe(1200);
    expect(body.trim()).toBe('The rain poured through the broken glass skylight. Miller stepped over the rubble.');
  });

  it('handles markdown without front-matter gracefully', () => {
    const raw = '# Chapter One\n\nNo front-matter here.';
    const { metadata, body } = parseSceneMarkdown(raw);
    expect(metadata).toEqual({});
    expect(body).toBe(raw);
  });

  it('produces clean standard markdown by default without YAML front-matter', () => {
    const body = 'A simple clean body paragraph without non-standard YAML tags.';
    const clean = serializeSceneMarkdown(
      { synopsis: 'A brief note.', pov: 'Sarah', status: 'revised', targetWords: 800 },
      body
    );
    expect(clean).toBe(body);
  });

  it('serializes scene metadata back to YAML front-matter when embedFrontMatter is true', () => {
    const body = 'A simple body paragraph.';
    const serialized = serializeSceneMarkdown(
      {
        synopsis: 'A brief note.',
        pov: 'Sarah',
        status: 'revised',
        targetWords: 800,
      },
      body,
      true
    );

    expect(serialized).toContain('synopsis: "A brief note."');
    expect(serialized).toContain('pov: "Sarah"');
    expect(serialized).toContain('status: revised');
    expect(serialized).toContain('targetWords: 800');
    expect(serialized).toContain(body);

    const reParsed = parseSceneMarkdown(serialized);
    expect(reParsed.metadata.synopsis).toBe('A brief note.');
    expect(reParsed.metadata.pov).toBe('Sarah');
    expect(reParsed.metadata.status).toBe('revised');
    expect(reParsed.metadata.targetWords).toBe(800);
    expect(reParsed.body).toBe(body);
  });

  it('builds a recursive binder tree from filesystem nodes', () => {
    const nodes: BinderNode[] = [
      {
        name: 'Act 1',
        path: '/novel/Act 1',
        is_dir: true,
        children: [
          {
            name: 'Chapter 1',
            path: '/novel/Act 1/Chapter 1',
            is_dir: true,
            children: [
              {
                name: 'Scene 1.md',
                path: '/novel/Act 1/Chapter 1/Scene 1.md',
                is_dir: false,
                children: [],
              },
            ],
          },
        ],
      },
    ];

    const binder = buildBinderFromTree(nodes);
    expect(binder).toHaveLength(1);
    expect(binder[0].title).toBe('Act 1');
    expect(binder[0].type).toBe('folder');
    expect(binder[0].children).toHaveLength(1);
    expect(binder[0].children![0].title).toBe('Chapter 1');
    expect(binder[0].children![0].children![0].title).toBe('Scene 1');
    expect(binder[0].children![0].children![0].type).toBe('scene');
  });

  it('flattens scenes in sequential order', () => {
    const items: BinderItem[] = [
      {
        id: '1',
        type: 'folder',
        title: 'Ch 1',
        path: '/ch1',
        children: [
          { id: '1a', type: 'scene', title: 'Scene 1', path: '/ch1/1.md' },
          { id: '1b', type: 'scene', title: 'Scene 2', path: '/ch1/2.md' },
        ],
      },
      { id: '2', type: 'scene', title: 'Interlude', path: '/int.md' },
    ];

    const flat = flattenScenes(items);
    expect(flat).toHaveLength(3);
    expect(flat.map((s) => s.title)).toEqual(['Scene 1', 'Scene 2', 'Interlude']);
  });

  it('finds entity mentions in scene text matching names and aliases', () => {
    const entries = [
      {
        id: 'c1',
        name: 'Elena Vance',
        category: 'character' as const,
        aliases: ['Ellie', 'The Raven'],
        summary: 'Protagonist',
      },
      {
        id: 'c2',
        name: 'Marcus Thorne',
        category: 'character' as const,
        aliases: ['Thorne'],
        summary: 'Antagonist',
      },
      {
        id: 'l1',
        name: 'Iron Citadel',
        category: 'location' as const,
        aliases: ['The Keep'],
        summary: 'Ancient fortress',
      },
    ];

    const sceneText = `Ellie adjusted her cloak and stared up at the Iron Citadel. She wondered if Thorne was inside.`;
    const mentions = findEntityMentions(sceneText, entries);

    expect(mentions.map((m) => m.name)).toEqual(['Elena Vance', 'Marcus Thorne', 'Iron Citadel']);
  });

  it('extracts unique dictionary words from codex entries including name tokens and aliases', async () => {
    const { extractWordsFromCodexEntry, extractWordsFromCodex } = await import('./projectService');
    const entry = {
      id: 'c1',
      name: 'Eldrin Moonshadow',
      category: 'character' as const,
      aliases: ['The Shadow-Walker', 'Eld'],
      summary: 'A rogue elf',
    };
    const words = extractWordsFromCodexEntry(entry);
    expect(words).toContain('eldrin moonshadow');
    expect(words).toContain('eldrin');
    expect(words).toContain('moonshadow');
    expect(words).toContain('the shadow-walker');
    expect(words).toContain('shadow');
    expect(words).toContain('walker');
    expect(words).toContain('eld');

    const allWords = extractWordsFromCodex([entry]);
    expect(allWords).toContain('eldrin');
    expect(allWords).toContain('moonshadow');
  });

  it('flushes scratchpad content into a timestamped graveyard file', async () => {
    const { flushScratchpadToGraveyard } = await import('./projectService');
    const res = await flushScratchpadToGraveyard('/my-novel', 'My scrapped scene notes');
    expect(res.fileName).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.md$/);
    expect(res.filePath).toContain('graveyard');
  });

  it('separates chapter files into binder and non-chapter files into extraFiles on loadNovelProject (excluding scratchpad.md)', async () => {
    const fileService = await import('./fileService');
    const { loadNovelProject, createExtraFile } = await import('./projectService');
    const spy = vi.spyOn(fileService, 'readDirTree').mockResolvedValue([
      { name: 'chapter-01.md', path: '/novel/chapter-01.md', is_dir: false, children: [] },
      { name: '02-the-harbor.md', path: '/novel/02-the-harbor.md', is_dir: false, children: [] },
      { name: 'outline.md', path: '/novel/outline.md', is_dir: false, children: [] },
      { name: 'scratchpad.md', path: '/novel/scratchpad.md', is_dir: false, children: [] },
      { name: 'worldbuilding.txt', path: '/novel/worldbuilding.txt', is_dir: false, children: [] },
    ]);

    const project = await loadNovelProject('/novel');
    expect(project.binder.map((b) => b.path)).toEqual([
      '/novel/chapter-01.md',
      '/novel/02-the-harbor.md',
    ]);
    expect(project.extraFiles?.map((b) => b.path)).toEqual([
      '/novel/outline.md',
      '/novel/worldbuilding.txt',
    ]);

    const created = await createExtraFile('/novel', ['outline.md'], 'outline');
    expect(created.name).toBe('outline-2.md');
    spy.mockRestore();
  });

  it('keeps the saved chapter order and metadata after the folder is moved, and saves portable paths', async () => {
    const fileService = await import('./fileService');
    const { loadNovelProject, saveNovelProject } = await import('./projectService');

    // noveler.json written at the old location, with the writer's own chapter order.
    const saved = {
      version: 1,
      title: 'Moved Novel',
      binder: [
        { id: 'keep-b', type: 'scene', title: 'B', path: 'D:\\Old\\Place\\02-b.md', status: 'revised' },
        { id: 'keep-a', type: 'scene', title: 'A', path: 'D:\\Old\\Place\\01-a.md' },
      ],
      snapshots: [
        { id: 's1', scenePath: 'D:\\Old\\Place\\01-a.md', timestamp: '2026-01-01', label: 'x', wordCount: 1, content: 'c' },
      ],
    };
    const tree = vi.spyOn(fileService, 'readDirTree').mockResolvedValue([
      { name: '01-a.md', path: '/new/01-a.md', is_dir: false, children: [] },
      { name: '02-b.md', path: '/new/02-b.md', is_dir: false, children: [] },
      { name: '03-c.md', path: '/new/03-c.md', is_dir: false, children: [] },
    ]);
    const read = vi.spyOn(fileService, 'readFileDirect').mockImplementation(async (path: string) => {
      if (path.endsWith('noveler.json')) return { path, name: 'noveler.json', content: JSON.stringify(saved) };
      throw new Error('not found');
    });
    const writes = new Map<string, string>();
    const write = vi.spyOn(fileService, 'saveFile').mockImplementation(async (path: string, content: string) => {
      writes.set(path, content);
    });

    const project = await loadNovelProject('/new');
    // Saved order first (b, a), then the chapter the project hasn't seen yet.
    expect(project.binder.map((b) => b.path)).toEqual(['/new/02-b.md', '/new/01-a.md', '/new/03-c.md']);
    expect(project.binder[0].id).toBe('keep-b');
    expect(project.binder[0].status).toBe('revised');
    // Snapshots follow the folder and are moved out of noveler.json.
    expect(project.snapshots?.[0].scenePath).toBe('/new/01-a.md');
    expect(JSON.parse(writes.get('/new/.noveler/snapshots.json')!)[0].scenePath).toBe('01-a.md');

    await saveNovelProject('/new', project);
    const json = JSON.parse(writes.get('/new/noveler.json')!);
    expect(json.binder.map((b: { path: string }) => b.path)).toEqual(['02-b.md', '01-a.md', '03-c.md']);
    expect(json.snapshots).toBeUndefined();

    tree.mockRestore();
    read.mockRestore();
    write.mockRestore();
  });

  it('reads and writes the chapter title as a plain Markdown # heading', async () => {
    const { extractChapterHeadingTitle, setChapterHeadingTitle } = await import('./projectService');
    expect(extractChapterHeadingTitle('# **Chapter 2: A-Z**\n\n## OTTO\n\nText')).toBe('Chapter 2: A-Z');
    expect(extractChapterHeadingTitle('## Only a scene\n\nText')).toBeNull();
    expect(extractChapterHeadingTitle('No heading at all')).toBeNull();

    expect(setChapterHeadingTitle('# Old\n\n## Scene\n\nText\n', 'New Title')).toBe('# New Title\n\n## Scene\n\nText\n');
    expect(setChapterHeadingTitle('## Scene\n\nText\n', 'Added')).toBe('# Added\n\n## Scene\n\nText\n');
    expect(setChapterHeadingTitle('', 'Fresh')).toBe('# Fresh\n');
  });
});

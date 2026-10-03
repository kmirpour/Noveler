import { describe, expect, it, vi } from 'vitest';
import type { NovelProject } from '../services/projectService';
import { compileNovel, type CompileOptions } from './compiler';

vi.mock('../services/fileService', () => ({
  readFileDirect: vi.fn(async (path: string) => {
    if (path === 'scene1.md') {
      return {
        path: 'scene1.md',
        name: 'scene1.md',
        content: `---
synopsis: "The opening scene"
pov: "Elena"
status: draft
targetWords: 1500
---
The sun rose over the quiet harbor. She stood on the dock waiting for the ship.`,
      };
    }
    if (path === 'scene2.md') {
      return {
        path: 'scene2.md',
        name: 'scene2.md',
        content: `---
synopsis: "Elena meets Marcus"
pov: "Elena"
status: revised
---
"You shouldn't have come," Marcus warned, stepping from the shadow.`,
      };
    }
    if (path === 'scene3.md') {
      return {
        path: 'scene3.md',
        name: 'scene3.md',
        content: `Without front-matter at all, just plain fiction prose here.`,
      };
    }
    throw new Error(`File not found: ${path}`);
  }),
}));

const mockProject: NovelProject = {
  version: 1,
  title: 'Whispers of the Deep',
  author: 'Jane Doe',
  targetWordCount: 80000,
  dailyTarget: 1000,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  binder: [
    {
      id: 'f1',
      type: 'folder',
      title: 'Act I',
      path: 'act1',
      children: [
        {
          id: 's1',
          type: 'scene',
          title: 'Chapter 1: The Harbor',
          path: 'scene1.md',
        },
        {
          id: 's2',
          type: 'scene',
          title: 'Chapter 2: The Meeting',
          path: 'scene2.md',
        },
      ],
    },
    {
      id: 's3',
      type: 'scene',
      title: 'Chapter 3: The Voyage',
      path: 'scene3.md',
    },
  ],
};

describe('compileNovel', () => {
  it('compiles selected scenes into a unified Markdown document', async () => {
    const options: CompileOptions = {
      title: 'Whispers of the Deep',
      author: 'Jane Doe',
      format: 'markdown',
      selectedPaths: ['scene1.md', 'scene2.md'],
    };

    const result = await compileNovel(mockProject, options);

    expect(result.fileName).toBe('Whispers of the Deep.md');
    expect(typeof result.data).toBe('string');
    const md = result.data as string;

    // Check title and author byline
    expect(md).toContain('# Whispers of the Deep');
    expect(md).toContain('by Jane Doe');

    // Check chapter headers
    expect(md).toContain('## Chapter 1: The Harbor');
    expect(md).toContain('## Chapter 2: The Meeting');

    // Front-matter YAML should be stripped out
    expect(md).not.toContain('synopsis: "The opening scene"');
    expect(md).not.toContain('targetWords: 1500');

    // Bodies should be present
    expect(md).toContain('The sun rose over the quiet harbor.');
    expect(md).toContain('"You shouldn\'t have come," Marcus warned');

    // Scene separator
    expect(md).toContain('#');

    // Scene 3 should not be included
    expect(md).not.toContain('Chapter 3: The Voyage');
  });

  it('compiles selected scenes into a Standard Manuscript (Shunn DOCX) Blob', async () => {
    const options: CompileOptions = {
      title: 'Whispers of the Deep',
      author: 'Jane Doe',
      contactInfo: 'jane@example.com\n555-0199',
      format: 'shunn-docx',
      selectedPaths: ['scene1.md', 'scene3.md'],
    };

    const result = await compileNovel(mockProject, options);

    expect(result.fileName).toBe('Whispers of the Deep.docx');
    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.data).toBeInstanceOf(Blob);
    const blob = result.data as Blob;
    expect(blob.size).toBeGreaterThan(500); // Valid zip archive
  });

  it('compiles into Standard DOCX format without title page', async () => {
    const options: CompileOptions = {
      title: 'Whispers of the Deep',
      author: 'Jane Doe',
      format: 'standard-docx',
      selectedPaths: ['scene1.md'],
    };

    const result = await compileNovel(mockProject, options);

    expect(result.fileName).toBe('Whispers of the Deep.docx');
    expect(result.data).toBeInstanceOf(Blob);
  });
});

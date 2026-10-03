import { describe, it, expect } from 'vitest';
import {
  parseSceneMarkdown,
  serializeSceneMarkdown,
  buildBinderFromTree,
  flattenScenes,
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

  it('serializes scene metadata back to YAML front-matter', () => {
    const body = 'A simple body paragraph.';
    const serialized = serializeSceneMarkdown(
      {
        synopsis: 'A brief note.',
        pov: 'Sarah',
        status: 'revised',
        targetWords: 800,
      },
      body
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
});

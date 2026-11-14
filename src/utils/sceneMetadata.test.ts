import { describe, expect, it } from 'vitest';
import type { NovelProject } from '../services/projectService';
import { migrateSceneKeys, sceneKeys, sceneMetaAt, withSceneMeta } from './sceneMetadata';
import { formatWordsCompact, groupFilesByPrefix, UNGROUPED_KEY } from './fileGroups';

const project = (scenes: string[]): NovelProject => ({
  version: 1,
  title: 'T',
  author: 'A',
  targetWordCount: 1,
  dailyTarget: 1,
  createdAt: '',
  updatedAt: '',
  binder: [{ id: 'c1', type: 'scene', title: 'Chapter 1', path: 'C:/novel/01-a.md', scenes }],
});

describe('scene notes', () => {
  it('builds keys from titles and numbers repeated titles', () => {
    expect(sceneKeys(['OTTO', 'Brodie', ' brodie '])).toEqual(['otto', 'brodie', 'brodie~2']);
  });

  it('stores and reads notes per scene, filed by chapter file name', () => {
    let p = project(['OTTO', 'Brodie']);
    p = withSceneMeta(p, 'C:/novel/01-a.md', 1, { synopsis: 'He calls', status: 'draft' });
    p = withSceneMeta(p, 'C:/novel/01-a.md', 1, { pov: 'Azie' });
    expect(sceneMetaAt(p, 'C:/novel/01-a.md', 1)).toEqual({ synopsis: 'He calls', status: 'draft', pov: 'Azie' });
    expect(sceneMetaAt(p, 'C:/novel/01-a.md', 0)).toEqual({});
    expect(p.sceneMetadata?.['01-a.md']).toBeDefined();
    // Out-of-range scene: nothing changes.
    expect(withSceneMeta(p, 'C:/novel/01-a.md', 9, { pov: 'x' })).toBe(p);
  });

  it('keeps notes with a scene when scenes are reordered', () => {
    const meta = { otto: { synopsis: 'bus' }, brodie: { synopsis: 'call' } };
    expect(migrateSceneKeys(meta, ['OTTO', 'Brodie'], ['Brodie', 'OTTO'])).toBe(meta);
  });

  it('moves notes to the new title when a scene is renamed in place', () => {
    const meta = { otto: { synopsis: 'bus' }, brodie: { synopsis: 'call' } };
    const next = migrateSceneKeys(meta, ['OTTO', 'Brodie'], ['OTTO', 'The Call']);
    expect(next).toEqual({ otto: { synopsis: 'bus' }, 'the call': { synopsis: 'call' } });
  });

  it('leaves notes alone when scenes are added or removed', () => {
    const meta = { otto: { synopsis: 'bus' } };
    expect(migrateSceneKeys(meta, ['OTTO'], ['OTTO', 'New'])).toBe(meta);
    expect(migrateSceneKeys(meta, ['OTTO', 'Gone'], ['OTTO'])).toBe(meta);
  });
});

describe('file grouping', () => {
  it('groups files that share a first word and leaves singles under Notes', () => {
    const names = [
      'Junk.md',
      'Plot_brainStorming_AR.md',
      'plot-twists-ar.md',
      'scene-armagedon.md',
      'scene call to brodie.md',
      'scenes - USEFUL.md',
      'World Wiki.md',
    ];
    const groups = groupFilesByPrefix(names, (n) => n);
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([
      ['Plot', 2],
      ['Scene', 3],
      ['Notes', 2],
    ]);
    expect(groups[2].key).toBe(UNGROUPED_KEY);
  });

  it('formats word counts compactly', () => {
    expect(formatWordsCompact(842)).toBe('842');
    expect(formatWordsCompact(1000)).toBe('1k');
    expect(formatWordsCompact(10404)).toBe('10.4k');
    expect(formatWordsCompact(86400)).toBe('86k');
  });
});

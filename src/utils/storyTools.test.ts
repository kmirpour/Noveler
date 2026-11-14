import { describe, expect, it } from 'vitest';
import type { CodexEntry, NovelProject } from '../services/projectService';
import { cleanPastedText } from './pasteCleanup';
import { countMentions, parseWikiEntries, planWikiImport } from './storyBible';
import { buildContextPack } from './contextPack';
import { THEMES, isTheme, themeInfo } from '../services/themes';
import { TYPEFACES, loadSettings } from '../services/settings';

describe('cleanPastedText', () => {
  it('decodes entities, strips bold from headings and invisible characters', () => {
    const zeroWidth = String.fromCharCode(0x200b);
    const input = `## **Option A: Billing &amp; NDAs**\r\n\r\nHe said &quot;no&quot;${zeroWidth}.   \n\n\n\nNext&#39;s line.`;
    expect(cleanPastedText(input)).toBe('## Option A: Billing & NDAs\n\nHe said "no".\n\nNext\'s line.');
  });

  it('drops a trailing assistant sign-off but keeps real questions in the text', () => {
    const input = 'Is anyone there?\n\nThe room was empty.\n\nWould you like me to write another section for this entry?';
    expect(cleanPastedText(input)).toBe('Is anyone there?\n\nThe room was empty.');
    expect(cleanPastedText('Would you like tea?')).toBe('Would you like tea?');
  });
});

describe('story bible from notes', () => {
  const wiki = [
    '# Introduction',
    '',
    'A satire. **Not an entry, just emphasis in the middle of a long sentence about things.**',
    '',
    '# characters',
    '',
    '**Azie, (Azar Zarin):** sometimes “A-Z” to other residents. She is a 5th year neurosurgery resident.',
    '',
    'When story starts, she is doing her functional rotation.',
    '',
    '**Prof. Micheal A. Brodie:** He is a real renaissance man.',
    '',
    '**Axel (Akcan Yüksel):** A Turkish grad student near graduation.',
    '',
    '# The Language: *Neurobabel*',
    '',
    '**Neural Catch:** the trap of needing a paper to graduate.',
  ].join('\n');

  it('reads bold lead-in entries with aliases, categories and follow-on paragraphs', () => {
    const entries = parseWikiEntries(wiki);
    expect(entries.map((e) => e.name)).toEqual(['Azie', 'Prof. Micheal A. Brodie', 'Axel', 'Neural Catch']);
    expect(entries[0].aliases).toEqual(['Azar Zarin']);
    expect(entries[0].category).toBe('character');
    expect(entries[0].description).toContain('functional rotation');
    expect(entries[0].summary.startsWith('sometimes')).toBe(true);
    expect(entries[2].aliases).toEqual(['Akcan Yüksel']);
    expect(entries[3].category).toBe('lore');
  });

  it('plans an import that adds new entries and only fills gaps in existing ones', () => {
    const existing: CodexEntry[] = [
      { id: '1', name: 'Axel', category: 'character', aliases: ['Akcan Yüksel'], summary: '' },
      { id: '2', name: 'Brodie', category: 'character', aliases: ['Prof. Micheal A. Brodie'], summary: 'Done', description: 'Full' },
    ];
    const plan = planWikiImport(existing, parseWikiEntries(wiki));
    expect(plan.toAdd.map((e) => e.name)).toEqual(['Azie', 'Neural Catch']);
    expect(plan.toUpdate.map((u) => u.existing.name)).toEqual(['Axel']);
    expect(plan.unchanged).toBe(1);
  });

  it('counts whole-word mentions of names and aliases, including accented names', () => {
    const entries: CodexEntry[] = [
      { id: 'a', name: 'Axel', category: 'character', aliases: ['Akcan Yüksel'], summary: '' },
      { id: 'p', name: 'Papa', category: 'character', aliases: [], summary: '' },
      { id: 'o', name: 'OTTO', category: 'item', aliases: [], summary: '' },
    ];
    const text = 'Axel waved. “Akcan Yüksel?” Axel’s badge said so. The papaya was Papa’s. Lotto. OTTO.';
    expect(countMentions(text, entries)).toEqual({ a: 3, p: 1, o: 1 });
    expect(countMentions('', entries)).toEqual({});
  });
});

describe('buildContextPack', () => {
  const project: NovelProject = {
    version: 1,
    title: 'Proviso 22',
    author: 'Author',
    targetWordCount: 80000,
    dailyTarget: 1000,
    createdAt: '',
    updatedAt: '',
    binder: [
      { id: 'c1', type: 'scene', title: 'Chapter 1: Beanery', path: '/n/01.md', scenes: ['Axel', 'Papa'], wordCount: 4000 },
      { id: 'c2', type: 'scene', title: 'Chapter 2: A-Z', path: '/n/02.md', scenes: ['OTTO'], wordCount: 10000 },
    ],
    codex: [{ id: 'a', name: 'Axel', category: 'character', aliases: ['Akcan Yüksel'], summary: 'Stuck PhD student.' }],
    sceneMetadata: { '02.md': { otto: { synopsis: 'Azie argues with the kiosk.', pov: 'Azie' } } },
  };

  it('includes the story bible, outline with synopses, trimmed notes and the current scene', () => {
    const pack = buildContextPack({
      project,
      activePath: '/n/02.md',
      activeSceneIndex: 0,
      currentText: '### OTTO\n\nThe bus was late.',
      notes: [{ title: 'World Wiki', markdown: `# Themes\n\n${'word '.repeat(400)}` }],
      notesBudget: 300,
    });
    expect(pack).toContain('# Context: Proviso 22');
    expect(pack).toContain('- **Axel** (Akcan Yüksel): Stuck PhD student.');
    expect(pack).toContain('2. **Chapter 2: A-Z** (10,000 words) ← working here');
    expect(pack).toContain('- OTTO: POV Azie. Azie argues with the kiosk. ← this scene');
    expect(pack).toContain('#### Themes');
    expect(pack).toContain('[…notes trimmed…]');
    expect(pack).toContain('## Current scene\n\n### OTTO\n\nThe bus was late.');
  });

  it('uses the selection instead of the whole scene when there is one', () => {
    const pack = buildContextPack({
      project,
      activePath: '/n/02.md',
      activeSceneIndex: 0,
      currentText: 'whole scene',
      selection: 'just this line',
      notes: [],
    });
    expect(pack).toContain('## Selected passage\n\njust this line');
    expect(pack).not.toContain('whole scene');
  });
});

describe('themes and typefaces', () => {
  it('offers light and dark themes with unique ids and complete swatches', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
    expect(THEMES.some((t) => t.kind === 'light') && THEMES.some((t) => t.kind === 'dark')).toBe(true);
    for (const t of THEMES) expect(t.swatch).toHaveLength(3);
    expect(isTheme('dusk')).toBe(true);
    expect(isTheme('neon')).toBe(false);
    expect(themeInfo('ink').kind).toBe('dark');
  });

  it('falls back to safe values when saved settings are unknown or out of range', () => {
    localStorage.setItem(
      'noveler-settings',
      JSON.stringify({ theme: 'neon', fontFamily: 'comic', fontSize: 400, lineHeight: 'x', lineWidth: 10, recentProjects: 'nope' })
    );
    const s = loadSettings();
    expect(s.theme).toBe('sepia');
    expect(s.fontFamily).toBe('serif');
    expect(s.fontSize).toBe(32);
    expect(s.lineHeight).toBe(1.85);
    expect(s.lineWidth).toBe(520);
    expect(s.recentProjects).toEqual([]);
    expect(TYPEFACES.some((t) => t.id === 'serif')).toBe(true);
    localStorage.clear();
  });
});

import * as fileService from './fileService';
import type { WritingLog } from '../utils/writingLog';
import {
  isChapterFileName,
  getNextChapterFileName,
  sortChapterFiles,
  extractChapterDisplayTitle,
  slugifyTitle,
} from '../utils/chapterNaming';

export type SceneStatus = 'idea' | 'draft' | 'revised' | 'final';

export interface SceneMetadata {
  synopsis?: string;
  pov?: string;
  status?: SceneStatus;
  targetWords?: number;
}

export interface BinderItem {
  id: string;
  type: 'folder' | 'scene';
  title: string;
  path: string;
  synopsis?: string;
  pov?: string;
  status?: SceneStatus;
  targetWords?: number;
  /** Runtime-parsed scene headers (`## Title`) inside this chapter; not persisted in noveler.json */
  scenes?: string[];
  /** Runtime word count of each scene, parallel to `scenes`; not persisted. */
  sceneWords?: number[];
  wordCount?: number;
  children?: BinderItem[];
  collapsed?: boolean;
}

export type CodexCategory = 'character' | 'location' | 'item' | 'lore';

export interface CodexEntry {
  id: string;
  name: string;
  category: CodexCategory;
  aliases: string[];
  summary: string;
  description?: string;
  tags?: string[];
  color?: string;
}

export interface SceneSnapshot {
  id: string;
  scenePath: string;
  timestamp: string;
  label: string;
  wordCount: number;
  content: string;
}

export interface NovelProject {
  version: 1;
  title: string;
  author: string;
  targetWordCount: number;
  dailyTarget: number;
  createdAt: string;
  updatedAt: string;
  binder: BinderItem[];
  extraFiles?: BinderItem[];
  chapterMetadata?: Record<string, SceneMetadata>;
  /** Notes per scene: chapter file name -> scene key (see utils/sceneMetadata) -> notes. */
  sceneMetadata?: Record<string, Record<string, SceneMetadata>>;
  tagCategories?: string[];
  tagAssignments?: Record<string, string>;
  customDictionary?: string[];
  codex?: CodexEntry[];
  /** Held in memory only; persisted separately in `.noveler/snapshots.json`. */
  snapshots?: SceneSnapshot[];
  gitRemoteUrl?: string;
  /** Net words written per local calendar day (`YYYY-MM-DD`). */
  writingLog?: WritingLog;
}

export const PROJECT_FILENAME = 'noveler.json';
export const SCRATCHPAD_FILENAME = 'scratchpad.md';
export const GRAVEYARD_DIRNAME = 'graveyard';

export function joinProjectPath(projectPath: string, ...parts: string[]): string {
  const sep = projectPath.includes('/') ? '/' : '\\';
  return [projectPath, ...parts].join(sep);
}

/**
 * Reads the chapter's own title from its first `# Heading` line, so the sidebar shows what the
 * manuscript says rather than what the file happens to be called. Inline emphasis is stripped.
 */
export function extractChapterHeadingTitle(markdown: string): string | null {
  const match = (markdown || '').match(/^[ \t]{0,3}#[ \t]+(.+?)[ \t]*#*[ \t]*$/m);
  if (!match) return null;
  const title = match[1]
    .replace(/\\([\\`*_{}[\]()#+\-.!~])/g, '$1')
    .replace(/(\*\*|__|\*|_|~~|`)/g, '')
    .trim();
  return title || null;
}

/**
 * Sets the chapter's `# Heading`: rewrites the first one if present, otherwise adds one at the top.
 * The result is ordinary Markdown.
 */
export function setChapterHeadingTitle(markdown: string, title: string): string {
  const clean = title.trim();
  if (!clean) return markdown;
  const headingRegex = /^[ \t]{0,3}#[ \t]+.*$/m;
  if (headingRegex.test(markdown)) {
    return markdown.replace(headingRegex, () => `# ${clean}`);
  }
  const body = markdown.replace(/^\s+/, '');
  return body ? `# ${clean}\n\n${body}` : `# ${clean}\n`;
}

/**
 * Parses front-matter metadata from scene markdown if present.
 * Preserves clean body text for standard markdown rendering.
 */
export function parseSceneMarkdown(raw: string): { metadata: SceneMetadata; body: string } {
  const frontMatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
  const match = raw.match(frontMatterRegex);
  if (!match) {
    return { metadata: {}, body: raw };
  }

  const yaml = match[1];
  const nonEmptyLines = yaml
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  // Only treat as YAML front-matter if non-empty lines exist and all follow `key: value` syntax
  if (
    nonEmptyLines.length === 0 ||
    !nonEmptyLines.every((line) => /^[a-zA-Z_][a-zA-Z0-9_]*\s*:/.test(line))
  ) {
    return { metadata: {}, body: raw };
  }

  const body = raw.slice(match[0].length);
  const metadata: SceneMetadata = {};

  const synopsisMatch = yaml.match(/synopsis:\s*(?:["'](.*?)["']|(.*))(?:\r?\n|$)/i);
  if (synopsisMatch) {
    metadata.synopsis = (synopsisMatch[1] ?? synopsisMatch[2] ?? '').trim();
  }

  const povMatch = yaml.match(/pov:\s*(?:["'](.*?)["']|(.*))(?:\r?\n|$)/i);
  if (povMatch) {
    metadata.pov = (povMatch[1] ?? povMatch[2] ?? '').trim();
  }

  const statusMatch = yaml.match(/status:\s*(\w+)/i);
  if (statusMatch) {
    const s = statusMatch[1].toLowerCase();
    if (s === 'idea' || s === 'draft' || s === 'revised' || s === 'final') {
      metadata.status = s as SceneStatus;
    }
  }

  const targetMatch = yaml.match(/targetWords:\s*(\d+)/i);
  if (targetMatch) {
    metadata.targetWords = parseInt(targetMatch[1], 10);
  }

  return { metadata, body };
}

/**
 * Serializes scene markdown.
 * Per GUIDE.md: Markdown files remain 100% clean standard markdown without
 * non-standard YAML frontmatter unless embedFrontMatter is explicitly set to true.
 */
export function serializeSceneMarkdown(
  metadata: SceneMetadata,
  body: string,
  embedFrontMatter = false
): string {
  if (!embedFrontMatter) {
    return body;
  }

  const hasMeta = Boolean(
    metadata.synopsis?.trim() ||
      metadata.pov?.trim() ||
      metadata.status ||
      (metadata.targetWords && metadata.targetWords > 0)
  );

  if (!hasMeta) return body;

  const lines = ['---'];
  if (metadata.synopsis?.trim()) {
    lines.push(`synopsis: "${metadata.synopsis.trim().replace(/"/g, '\\"')}"`);
  }
  if (metadata.pov?.trim()) {
    lines.push(`pov: "${metadata.pov.trim().replace(/"/g, '\\"')}"`);
  }
  if (metadata.status) {
    lines.push(`status: ${metadata.status}`);
  }
  if (metadata.targetWords && metadata.targetWords > 0) {
    lines.push(`targetWords: ${metadata.targetWords}`);
  }
  lines.push('---');
  lines.push('');

  return `${lines.join('\n')}${body}`;
}

/**
 * Converts filesystem binder tree into BinderItem hierarchy.
 */
export function buildBinderFromTree(
  nodes: fileService.BinderNode[],
  existingMap?: Map<string, BinderItem>
): BinderItem[] {
  return nodes
    .filter(
      (n) =>
        n.name !== PROJECT_FILENAME &&
        n.name.toLowerCase() !== SCRATCHPAD_FILENAME &&
        !n.name.startsWith('.')
    )
    .map((node) => {
      const existing = existingMap?.get(node.path);
      const isDir = node.is_dir;
      const cleanTitle = isDir ? node.name : extractChapterDisplayTitle(node.name);

      const item: BinderItem = {
        id: existing?.id || `node-${Math.random().toString(36).substring(2, 9)}`,
        type: isDir ? 'folder' : 'scene',
        title: existing?.title || cleanTitle,
        path: node.path,
        synopsis: existing?.synopsis || '',
        pov: existing?.pov || '',
        status: existing?.status || 'draft',
        targetWords: existing?.targetWords || 0,
        collapsed: existing?.collapsed ?? false,
      };

      if (isDir && node.children) {
        item.children = buildBinderFromTree(node.children, existingMap);
      }

      return item;
    });
}

export function normalizeProjectFilePath(projectPath: string): string {
  const sep = projectPath.includes('/') ? '/' : '\\';
  return `${projectPath}${sep}${PROJECT_FILENAME}`;
}

export function normalizeScratchpadFilePath(projectPath: string): string {
  const sep = projectPath.includes('/') ? '/' : '\\';
  return `${projectPath}${sep}${SCRATCHPAD_FILENAME}`;
}

export async function loadScratchpadFile(projectPath: string): Promise<string> {
  try {
    const raw = await fileService.readFileDirect(normalizeScratchpadFilePath(projectPath));
    return raw.content;
  } catch {
    return '';
  }
}

export async function saveScratchpadFile(projectPath: string, content: string): Promise<void> {
  const scratchpadPath = normalizeScratchpadFilePath(projectPath);
  await fileService.saveFile(scratchpadPath, content);
}

/**
 * Loads noveler.json or scans the project folder to create a new project structure.
 * Enforces the single-folder sequential chapter model per GUIDE.md:
 * - Scans folder for .md files
 * - If empty, generates 01-chapter.md immediately
 * - Sorts chapters ascending by numeric prefix (01-chapter.md, 02-the-beginning.md)
 */
export async function loadNovelProject(projectPath: string): Promise<NovelProject> {
  const projectConfigPath = normalizeProjectFilePath(projectPath);
  let existingProject: NovelProject | null = null;

  try {
    const raw = await fileService.readFileDirect(projectConfigPath);
    existingProject = JSON.parse(raw.content) as NovelProject;
  } catch {
    // Config does not exist yet; will synthesize from folder
  }

  // Scan current folder on disk to reflect real files
  const treeNodes = await fileService.readDirTree(projectPath);
  const sep = projectPath.includes('/') ? '/' : '\\';

  // Filter text files directly in project folder (exclude subdirectories and scratchpad.md per GUIDE.md)
  const textNodes = treeNodes.filter(
    (n) =>
      !n.is_dir &&
      n.name !== PROJECT_FILENAME &&
      n.name.toLowerCase() !== SCRATCHPAD_FILENAME &&
      !n.name.startsWith('.') &&
      (n.name.endsWith('.md') || n.name.endsWith('.markdown') || n.name.endsWith('.txt'))
  );

  let chapterNodes = textNodes.filter((n) => isChapterFileName(n.name));
  const extraNodes = textNodes.filter((n) => !isChapterFileName(n.name));

  // If folder contains no chapter files, auto-generate 01-chapter.md per GUIDE.md Section 1.3
  if (chapterNodes.length === 0) {
    const firstChapterName = '01-chapter.md';
    const firstChapterPath = `${projectPath}${sep}${firstChapterName}`;
    const initialContent = `# Chapter One\n\nStart writing your story here...\n`;
    try {
      await fileService.createFile(firstChapterPath, initialContent);
      chapterNodes = [
        {
          name: firstChapterName,
          path: firstChapterPath,
          is_dir: false,
          children: [],
        },
      ];
    } catch (err) {
      console.warn('Could not auto-generate initial chapter file:', err);
    }
  }

  // Items saved in noveler.json are matched by file name, so the project keeps working when the
  // folder is moved, renamed or cloned onto another machine.
  const existingMap = new Map<string, BinderItem>();
  for (const it of [...(existingProject?.binder || []), ...(existingProject?.extraFiles || [])]) {
    existingMap.set(fileService.extractFileName(it.path).toLowerCase(), it);
  }

  // Chapter order is whatever the writer arranged (saved in noveler.json); files are never renamed
  // to reorder them. Chapters not yet in the saved order follow, sorted by their numeric prefix.
  const savedOrder = new Map<string, number>();
  (existingProject?.binder || []).forEach((it, idx) => {
    savedOrder.set(fileService.extractFileName(it.path).toLowerCase(), idx);
  });
  const orderOf = (n: fileService.BinderNode) => savedOrder.get(n.name.toLowerCase());
  const knownChapters = chapterNodes
    .filter((n) => orderOf(n) !== undefined)
    .sort((a, b) => orderOf(a)! - orderOf(b)!);
  const newChapters = sortChapterFiles(chapterNodes.filter((n) => orderOf(n) === undefined));
  const sortedChapterNodes = [...knownChapters, ...newChapters];
  const sortedExtraNodes = sortChapterFiles(extraNodes);

  const chapterMetadata = existingProject?.chapterMetadata || {};

  const mapNodeToBinderItem = (node: fileService.BinderNode): BinderItem => {
    const existing = existingMap.get(node.name.toLowerCase());
    const meta = chapterMetadata[node.name] || chapterMetadata[node.path] || {};
    const displayTitle = extractChapterDisplayTitle(node.name);

    return {
      id: existing?.id || `node-${Math.random().toString(36).substring(2, 9)}`,
      type: 'scene',
      title: existing?.title || displayTitle,
      path: node.path,
      synopsis: meta.synopsis || existing?.synopsis || '',
      pov: meta.pov || existing?.pov || '',
      status: meta.status || existing?.status || 'draft',
      targetWords: meta.targetWords || existing?.targetWords || 0,
      collapsed: existing?.collapsed ?? false,
    };
  };

  const binderItems: BinderItem[] = sortedChapterNodes.map(mapNodeToBinderItem);
  const extraFileItems: BinderItem[] = sortedExtraNodes.map(mapNodeToBinderItem);

  const projectName = fileService.extractFileName(projectPath);

  const project: NovelProject = {
    version: 1,
    title: existingProject?.title || projectName || 'Untitled Novel',
    author: existingProject?.author || 'Author',
    targetWordCount: existingProject?.targetWordCount || 80000,
    dailyTarget: existingProject?.dailyTarget || 1000,
    createdAt: existingProject?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    binder: binderItems,
    extraFiles: extraFileItems,
    chapterMetadata,
    sceneMetadata: existingProject?.sceneMetadata || {},
    tagCategories: existingProject?.tagCategories || ['characters', 'locations', 'items', 'scenes'],
    tagAssignments: existingProject?.tagAssignments || {},
    // Only words the writer added by hand are stored. Names from the story bible are recognised
    // automatically at check time, so copies of them saved by older versions are dropped here.
    customDictionary: (() => {
      const fromCodex = new Set(extractWordsFromCodex(existingProject?.codex || []));
      return Array.from(new Set(existingProject?.customDictionary || [])).filter(
        (w) => typeof w === 'string' && w.trim() !== '' && !fromCodex.has(w)
      );
    })(),
    codex: existingProject?.codex || [],
    snapshots: await loadSnapshots(projectPath, existingProject?.snapshots || []),
    gitRemoteUrl: existingProject?.gitRemoteUrl,
    writingLog: existingProject?.writingLog || {},
  };

  return project;
}

function snapshotsFilePath(projectPath: string): string {
  return joinProjectPath(projectPath, '.noveler', 'snapshots.json');
}

/**
 * Loads scene snapshots from `.noveler/snapshots.json`, merging in any that an older version of
 * Noveler stored inside noveler.json. Snapshot paths are resolved against the current folder.
 */
async function loadSnapshots(projectPath: string, legacy: SceneSnapshot[]): Promise<SceneSnapshot[]> {
  let stored: SceneSnapshot[] = [];
  try {
    const raw = await fileService.readFileDirect(snapshotsFilePath(projectPath));
    const parsed = JSON.parse(raw.content) as unknown;
    if (Array.isArray(parsed)) stored = parsed as SceneSnapshot[];
  } catch {
    // No snapshots saved yet
  }

  const seen = new Set<string>();
  const merged: SceneSnapshot[] = [];
  for (const snap of [...stored, ...legacy]) {
    if (!snap || typeof snap.id !== 'string' || seen.has(snap.id)) continue;
    seen.add(snap.id);
    merged.push({
      ...snap,
      scenePath: joinProjectPath(projectPath, fileService.extractFileName(snap.scenePath)),
    });
  }
  merged.sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0));

  if (legacy.length > 0) {
    try {
      await saveSnapshots(projectPath, merged);
    } catch (err) {
      console.warn('Could not migrate snapshots out of noveler.json:', err);
    }
  }
  return merged;
}

/** Writes scene snapshots to `.noveler/snapshots.json`, keyed by file name rather than full path. */
export async function saveSnapshots(projectPath: string, snapshots: SceneSnapshot[]): Promise<void> {
  const portable = snapshots.map((s) => ({ ...s, scenePath: fileService.extractFileName(s.scenePath) }));
  await fileService.saveFile(snapshotsFilePath(projectPath), JSON.stringify(portable, null, 2));
}

/**
 * Creates the next sequential chapter file in the novel folder.
 * Example: if 01-chapter.md exists, creates 02-chapter.md.
 */
export async function createSequentialChapter(
  projectPath: string,
  existingFileNames: string[],
  customTitle?: string
): Promise<{ path: string; name: string; title: string }> {
  const fileName = getNextChapterFileName(existingFileNames, customTitle);
  const sep = projectPath.includes('/') ? '/' : '\\';
  const fullPath = `${projectPath}${sep}${fileName}`;
  const displayTitle = extractChapterDisplayTitle(fileName);
  const initialContent = `# ${displayTitle}\n\n`;

  await fileService.createFile(fullPath, initialContent);
  return { path: fullPath, name: fileName, title: displayTitle };
}

/**
 * Creates a general project note / non-chapter file in the novel folder (stored under Other Files).
 * Ensures the filename does not accidentally match a chapter prefix.
 */
export async function createExtraFile(
  projectPath: string,
  existingFileNames: string[],
  titleInput?: string
): Promise<{ path: string; name: string; title: string }> {
  const rawTitle = (titleInput || '').trim() || 'notes';
  let baseSlug = slugifyTitle(rawTitle);
  if (isChapterFileName(`${baseSlug}.md`)) {
    baseSlug = `note-${baseSlug}`;
  }

  let fileName = `${baseSlug}.md`;
  let counter = 2;
  const lowerExisting = new Set(existingFileNames.map((n) => n.toLowerCase()));
  while (lowerExisting.has(fileName.toLowerCase())) {
    fileName = `${baseSlug}-${counter}.md`;
    counter++;
  }

  const sep = projectPath.includes('/') ? '/' : '\\';
  const fullPath = `${projectPath}${sep}${fileName}`;
  const displayTitle = extractChapterDisplayTitle(fileName);
  const heading = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
  const initialContent = `# ${heading}\n\n`;

  await fileService.createFile(fullPath, initialContent);
  return { path: fullPath, name: fileName, title: displayTitle };
}

/**
 * Saves project configuration to noveler.json (excluding runtime-only scene lists and scratchpad).
 */
export async function saveNovelProject(projectPath: string, project: NovelProject): Promise<void> {
  // Paths are stored as bare file names (the folder is flat), so noveler.json stays valid when the
  // project folder is moved or synced to another machine. Snapshots live in their own file.
  const stripRuntimeItem = (item: BinderItem): BinderItem => {
    const { scenes: _scenes, sceneWords: _sceneWords, wordCount: _wordCount, ...rest } = item;
    return { ...rest, path: fileService.extractFileName(item.path) };
  };
  const { snapshots: _snapshots, ...persisted } = project;
  const cleanProject: Omit<NovelProject, 'snapshots'> = {
    ...persisted,
    binder: (project.binder || []).map(stripRuntimeItem),
    extraFiles: project.extraFiles ? project.extraFiles.map(stripRuntimeItem) : undefined,
  };
  const configPath = normalizeProjectFilePath(projectPath);
  const jsonContent = JSON.stringify(cleanProject, null, 2);
  await fileService.saveFile(configPath, jsonContent);
}

/**
 * Helper to flatten all scenes in reading order
 */
export function flattenScenes(items: BinderItem[]): BinderItem[] {
  const scenes: BinderItem[] = [];
  function traverse(list: BinderItem[]) {
    for (const item of list) {
      if (item.type === 'scene') {
        scenes.push(item);
      }
      if (item.children) {
        traverse(item.children);
      }
    }
  }
  traverse(items);
  return scenes;
}

/**
 * Scans a scene's text for mentions of Codex entities (names and aliases).
 */
export function findEntityMentions(text: string, entries: CodexEntry[]): CodexEntry[] {
  if (!text || !entries || entries.length === 0) return [];

  const found: CodexEntry[] = [];
  for (const entry of entries) {
    const terms = [entry.name, ...(entry.aliases || [])].filter((t) => t.trim().length > 0);
    const pattern = new RegExp(
      `\\b(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
      'i'
    );
    if (pattern.test(text)) {
      found.push(entry);
    }
  }
  return found;
}

/**
 * Flushes scratchpad contents into a timestamped markdown file inside the project's
 * `graveyard/` subfolder.
 */
export async function flushScratchpadToGraveyard(
  projectPath: string,
  content: string
): Promise<{ fileName: string; filePath: string }> {
  const fileName = `${graveyardTimestamp()}.md`;
  const graveyardDir = joinProjectPath(projectPath, GRAVEYARD_DIRNAME);
  const filePath = joinProjectPath(graveyardDir, fileName);

  await fileService.createDir(graveyardDir);
  await fileService.createFile(filePath, content);
  await fileService.saveFile(filePath, content);

  return { fileName, filePath };
}

function graveyardTimestamp(now: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

/**
 * "Deletes" a project file by moving it into `graveyard/` under a timestamped name.
 * Nothing the writer wrote is destroyed by the app; the graveyard can be emptied by hand.
 */
export async function moveFileToGraveyard(
  projectPath: string,
  filePath: string
): Promise<{ fileName: string; filePath: string }> {
  const graveyardDir = joinProjectPath(projectPath, GRAVEYARD_DIRNAME);
  const fileName = `${graveyardTimestamp()}_${fileService.extractFileName(filePath)}`;
  const target = joinProjectPath(graveyardDir, fileName);
  await fileService.createDir(graveyardDir);
  await fileService.renamePath(filePath, target);
  return { fileName, filePath: target };
}

/**
 * Saves a piece of removed text (e.g. a deleted scene) as a standard Markdown file in `graveyard/`.
 */
export async function archiveTextToGraveyard(
  projectPath: string,
  label: string,
  markdown: string
): Promise<{ fileName: string; filePath: string }> {
  const graveyardDir = joinProjectPath(projectPath, GRAVEYARD_DIRNAME);
  const slug = slugifyTitle(label).slice(0, 48) || 'scene';
  const fileName = `${graveyardTimestamp()}_${slug}.md`;
  const filePath = joinProjectPath(graveyardDir, fileName);
  await fileService.createDir(graveyardDir);
  await fileService.createFile(filePath, markdown.endsWith('\n') ? markdown : `${markdown}\n`);
  return { fileName, filePath };
}

/**
 * Extracts searchable and dictionary-ready lowercase words from a Codex entry,
 * including its full name, constituent name tokens, and aliases.
 */
export function extractWordsFromCodexEntry(entry: CodexEntry): string[] {
  const words = new Set<string>();
  const addTextTokens = (text: string) => {
    if (!text || !text.trim()) return;
    const cleanFull = text.replace(/^[^a-zA-Z0-9'-]+|[^a-zA-Z0-9'-]+$/g, '').trim().toLowerCase();
    if (cleanFull && cleanFull.length >= 2) {
      words.add(cleanFull);
    }
    const parts = text.split(/[\s-]+/);
    for (const part of parts) {
      const cleanPart = part.replace(/^[^a-zA-Z0-9'-]+|[^a-zA-Z0-9'-]+$/g, '').trim().toLowerCase();
      if (cleanPart && cleanPart.length >= 2) {
        words.add(cleanPart);
      }
    }
  };

  addTextTokens(entry.name);
  for (const alias of entry.aliases || []) {
    addTextTokens(alias);
  }
  return Array.from(words);
}

/**
 * Extracts all unique lowercase dictionary words from a list of Codex entries.
 */
export function extractWordsFromCodex(entries?: CodexEntry[]): string[] {
  if (!entries || entries.length === 0) return [];
  const words = new Set<string>();
  for (const entry of entries) {
    for (const word of extractWordsFromCodexEntry(entry)) {
      words.add(word);
    }
  }
  return Array.from(words);
}

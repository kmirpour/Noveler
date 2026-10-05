import * as fileService from './fileService';
import {
  getNextChapterFileName,
  sortChapterFiles,
  extractChapterDisplayTitle,
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
  chapterMetadata?: Record<string, SceneMetadata>;
  scratchpad?: string;
  tagCategories?: string[];
  codex?: CodexEntry[];
  snapshots?: SceneSnapshot[];
  gitRemoteUrl?: string;
}

export const PROJECT_FILENAME = 'noveler.json';

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
    .filter((n) => n.name !== PROJECT_FILENAME && !n.name.startsWith('.'))
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

function createMapByPath(items: BinderItem[]): Map<string, BinderItem> {
  const map = new Map<string, BinderItem>();
  function traverse(list: BinderItem[]) {
    for (const it of list) {
      map.set(it.path, it);
      if (it.children) traverse(it.children);
    }
  }
  traverse(items);
  return map;
}

export function normalizeProjectFilePath(projectPath: string): string {
  const sep = projectPath.includes('/') ? '/' : '\\';
  return `${projectPath}${sep}${PROJECT_FILENAME}`;
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

  // Filter markdown files directly in project folder (exclude subdirectories per GUIDE.md)
  let mdNodes = treeNodes.filter(
    (n) =>
      !n.is_dir &&
      n.name !== PROJECT_FILENAME &&
      !n.name.startsWith('.') &&
      (n.name.endsWith('.md') || n.name.endsWith('.markdown'))
  );

  // If folder contains no markdown files, auto-generate 01-chapter.md per GUIDE.md Section 1.3
  if (mdNodes.length === 0) {
    const firstChapterName = '01-chapter.md';
    const firstChapterPath = `${projectPath}${sep}${firstChapterName}`;
    const initialContent = `# Chapter One\n\nStart writing your story here...\n`;
    try {
      await fileService.createFile(firstChapterPath, initialContent);
      mdNodes = [
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

  // Naturally sort chapter files in ascending order (01-, 02-, 10-)
  const sortedNodes = sortChapterFiles(mdNodes);

  const existingMap = existingProject ? createMapByPath(existingProject.binder) : undefined;
  const chapterMetadata = existingProject?.chapterMetadata || {};

  const binderItems: BinderItem[] = sortedNodes.map((node) => {
    const existing = existingMap?.get(node.path);
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
      collapsed: false,
    };
  });

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
    chapterMetadata,
    scratchpad: existingProject?.scratchpad || '',
    tagCategories: existingProject?.tagCategories || ['characters', 'locations', 'items', 'scenes'],
    codex: existingProject?.codex || [],
    snapshots: existingProject?.snapshots || [],
    gitRemoteUrl: existingProject?.gitRemoteUrl,
  };

  return project;
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
 * Saves project configuration to noveler.json
 */
export async function saveNovelProject(projectPath: string, project: NovelProject): Promise<void> {
  const configPath = normalizeProjectFilePath(projectPath);
  const jsonContent = JSON.stringify(project, null, 2);
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
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const fileName = `${timestamp}.md`;
  const sep = projectPath.includes('/') ? '/' : '\\';
  const graveyardDir = `${projectPath}${sep}graveyard`;
  const filePath = `${graveyardDir}${sep}${fileName}`;

  await fileService.createDir(graveyardDir);
  await fileService.createFile(filePath, content);
  await fileService.saveFile(filePath, content);

  return { fileName, filePath };
}

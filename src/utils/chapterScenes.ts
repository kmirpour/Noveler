import { parseSceneMarkdown } from '../services/projectService';

export interface ChapterSceneItem {
  index: number;
  title: string;
  customTitle: string;
  wordCount: number;
  previewText: string;
}

export interface ParsedScene {
  title: string;
  body: string;
}

export interface SplitChapterResult {
  preamble: string;
  scenes: ParsedScene[];
}

const SCENE_HEADING_LINE_REGEX = /^[ \t]{0,3}##(?:[ \t]+(.*?))?[ \t]*$/;

/**
 * Strips TipTap empty-paragraph placeholders (`&nbsp;` / `\u00A0`) at boundaries so empty scene bodies
 * normalize cleanly.
 */
export function normalizeSceneSegment(raw: string): string {
  const trimmed = raw
    .replace(/^(?:[ \t]*(?:&nbsp;|\u00A0)[ \t]*\r?\n?)+/g, '')
    .replace(/(?:\r?\n?[ \t]*(?:&nbsp;|\u00A0)[ \t]*)+$/g, '')
    .trim();
  if (/^(?:&nbsp;|\u00A0|\s)*$/i.test(trimmed)) {
    return '';
  }
  return trimmed;
}

/**
 * Splits a chapter's markdown content into an optional preamble (e.g. `# Chapter Title` and any
 * text before the first `##` header) and an array of scenes defined by `## Scene Header` lines.
 */
export function splitChapterIntoScenes(rawMarkdown: string): SplitChapterResult {
  const { body } = parseSceneMarkdown(rawMarkdown || '');
  const normalized = body.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  const preambleLines: string[] = [];
  const rawScenes: { title: string; bodyLines: string[] }[] = [];
  let inCodeFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^[ \t]*```/.test(line)) {
      inCodeFence = !inCodeFence;
      if (rawScenes.length === 0) {
        preambleLines.push(line);
      } else {
        rawScenes[rawScenes.length - 1].bodyLines.push(line);
      }
      continue;
    }

    if (!inCodeFence) {
      const match = line.match(SCENE_HEADING_LINE_REGEX);
      if (match) {
        const rawTitle = (match[1] ?? '').trim();
        rawScenes.push({
          title: rawTitle,
          bodyLines: [],
        });
        continue;
      }
    }

    if (rawScenes.length === 0) {
      preambleLines.push(line);
    } else {
      rawScenes[rawScenes.length - 1].bodyLines.push(line);
    }
  }

  return {
    preamble: normalizeSceneSegment(preambleLines.join('\n')),
    scenes: rawScenes.map((s) => ({
      title: s.title,
      body: normalizeSceneSegment(s.bodyLines.join('\n')),
    })),
  };
}

/**
 * Joins a chapter preamble and an array of `ParsedScene` items back into clean Markdown
 * using `## <Scene Title>` headers.
 */
export function joinChapterScenes(preamble: string, scenes: ParsedScene[]): string {
  const parts: string[] = [];
  const cleanPreamble = normalizeSceneSegment(preamble);
  if (cleanPreamble) {
    parts.push(cleanPreamble);
  }

  scenes.forEach((scene, idx) => {
    const headingTitle = (scene.title || '').trim() || `Scene ${idx + 1}`;
    const cleanBody = normalizeSceneSegment(scene.body);
    if (cleanBody) {
      parts.push(`## ${headingTitle}\n\n${cleanBody}`);
    } else {
      parts.push(`## ${headingTitle}`);
    }
  });

  if (parts.length === 0) return '';
  return `${parts.join('\n\n')}\n`;
}

/**
 * Counts the number of `##` scene headers in a chapter's markdown.
 */
export function countScenesInMarkdown(rawMarkdown: string): number {
  return splitChapterIntoScenes(rawMarkdown).scenes.length;
}

/**
 * Extracts the list of scene titles from `##` headers in a chapter's markdown.
 */
export function extractSceneTitlesFromMarkdown(rawMarkdown: string): string[] {
  return getChapterScenes(rawMarkdown).map((s) => s.title);
}

/**
 * Returns structured scene outline items for a chapter by scanning for `##` scene headers.
 */
export function getChapterScenes(rawMarkdown: string): ChapterSceneItem[] {
  const { scenes } = splitChapterIntoScenes(rawMarkdown);

  return scenes.map((scene, index) => {
    const customTitle = scene.title.trim();
    const title = customTitle || `Scene ${index + 1}`;
    const cleanText = scene.body
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/[*_~`>#]/g, '')
      .trim();
    const wordCount = cleanText === '' ? 0 : cleanText.split(/\s+/).length;
    const previewText =
      cleanText.length > 60 ? `${cleanText.slice(0, 57)}...` : cleanText;

    return {
      index,
      title,
      customTitle,
      wordCount,
      previewText,
    };
  });
}

/**
 * Updates the `## <Title>` header of a specific scene index inside the chapter's markdown.
 */
export function updateSceneTitleAtIndex(
  rawMarkdown: string,
  sceneIndex: number,
  newTitle: string
): string {
  const { preamble, scenes } = splitChapterIntoScenes(rawMarkdown);
  if (sceneIndex < 0 || sceneIndex >= scenes.length) {
    return rawMarkdown;
  }

  const nextScenes = scenes.map((s, idx) =>
    idx === sceneIndex
      ? { ...s, title: newTitle.trim() || `Scene ${sceneIndex + 1}` }
      : s
  );

  return joinChapterScenes(preamble, nextScenes);
}

/**
 * Reorders a scene (`## <Title>` and its body) from `fromIndex` to `toIndex`.
 * Preserves any chapter preamble (e.g. `# Chapter Title`) at the top of the chapter.
 */
export function reorderChapterScenes(
  rawMarkdown: string,
  fromIndex: number,
  toIndex: number
): string {
  const { preamble, scenes } = splitChapterIntoScenes(rawMarkdown);
  const nextScenes = [...scenes];

  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= nextScenes.length ||
    toIndex >= nextScenes.length
  ) {
    return rawMarkdown;
  }

  const [movedScene] = nextScenes.splice(fromIndex, 1);
  nextScenes.splice(toIndex, 0, movedScene);

  return joinChapterScenes(preamble, nextScenes);
}

/**
 * Inserts a new `## <Title>` scene immediately after `afterIndex` (0-based).
 */
export function insertSceneAfterIndex(
  rawMarkdown: string,
  afterIndex: number,
  newSceneTitle?: string
): { markdown: string; newSceneIndex: number } {
  const { preamble, scenes } = splitChapterIntoScenes(rawMarkdown);
  const nextScenes = [...scenes];

  const insertAt =
    nextScenes.length === 0
      ? 0
      : Math.max(0, Math.min(afterIndex + 1, nextScenes.length));

  const title = (newSceneTitle ?? '').trim() || `Scene ${nextScenes.length + 1}`;
  nextScenes.splice(insertAt, 0, { title, body: '' });

  return {
    markdown: joinChapterScenes(preamble, nextScenes),
    newSceneIndex: insertAt,
  };
}

/**
 * Appends a new `## <Title>` scene to the end of a chapter.
 */
export function appendSceneToChapter(
  rawMarkdown: string,
  newSceneTitle?: string
): { markdown: string; newSceneIndex: number } {
  const { scenes } = splitChapterIntoScenes(rawMarkdown);
  return insertSceneAfterIndex(rawMarkdown, scenes.length - 1, newSceneTitle);
}

/**
 * Deletes the `## <Title>` scene and its body at `sceneIndex` from the chapter markdown.
 */
export function deleteSceneFromChapter(
  rawMarkdown: string,
  sceneIndex: number
): string {
  const { preamble, scenes } = splitChapterIntoScenes(rawMarkdown);
  if (sceneIndex < 0 || sceneIndex >= scenes.length) {
    return rawMarkdown;
  }

  const nextScenes = scenes.filter((_, idx) => idx !== sceneIndex);
  return joinChapterScenes(preamble, nextScenes);
}

/** Minimal interface for traversing a ProseMirror document node. */
export interface TraversableProseMirrorDoc {
  content: { size: number };
  forEach: (
    callback: (
      node: {
        type: { name: string };
        nodeSize: number;
        attrs?: Record<string, unknown>;
        textContent?: string;
      },
      offset: number,
      index: number
    ) => void
  ) => void;
}

/**
 * Finds the ProseMirror document position corresponding to the `sceneIndex`-th `##` (level 2) heading.
 */
export function findScenePositionInDoc(
  doc: TraversableProseMirrorDoc,
  sceneIndex: number
): number {
  let h2Count = 0;
  let targetPos: number | null = null;

  doc.forEach((node, offset) => {
    if (targetPos !== null) return;
    if (node.type.name === 'heading' && node.attrs?.level === 2) {
      if (h2Count === sceneIndex) {
        targetPos = offset + 1;
        return;
      }
      h2Count += 1;
    }
  });

  const resolved = targetPos ?? 1;
  return Math.min(Math.max(1, resolved), Math.max(1, doc.content.size));
}

/**
 * Determines which scene index (0-based) contains the given ProseMirror cursor position
 * based on preceding `##` (level 2) headings.
 */
export function getSceneIndexAtPosition(
  doc: TraversableProseMirrorDoc,
  pos: number
): number {
  let h2Count = 0;
  doc.forEach((node, offset) => {
    if (node.type.name === 'heading' && node.attrs?.level === 2 && offset <= pos) {
      h2Count += 1;
    }
  });
  return Math.max(0, h2Count - 1);
}

/**
 * Computes a lightweight signature of all level-2 (`##`) scene headings in a ProseMirror document
 * so the editor can immediately sync the Sidebar outline when scene headers are added, removed, or edited.
 */
export function getSceneHeadingsSignatureInDoc(doc: TraversableProseMirrorDoc): string {
  const headings: string[] = [];
  doc.forEach((node) => {
    if (node.type.name === 'heading' && node.attrs?.level === 2) {
      headings.push(node.textContent ?? '');
    }
  });
  return `${headings.length}:${headings.join('|')}`;
}

/**
 * Narrative Tag Engine per GUIDE.md Section 4:
 * - Detects in-text hashtags (e.g. #alice, #the-docks, #brass-key)
 * - Ignores markdown headings (e.g. # Heading 1, ## Heading 2)
 * - Aggregates tag frequency
 * - Supports category grouping
 */

export interface NarrativeTag {
  tag: string;
  name: string;
  count: number;
}

export interface TagCategoryMap {
  [category: string]: NarrativeTag[];
}

/**
 * Extracts hashtags from document text while excluding markdown headings.
 * Matches hashtags like #alice, #the-docks, #brass-key, #inspector-morse.
 */
export function extractNarrativeTags(text: string): NarrativeTag[] {
  if (!text || !text.trim()) return [];

  // Match #word where preceded by start of line or whitespace or punctuation,
  // followed by at least one letter, and letters/digits/hyphens/underscores.
  // Negative lookahead/lookbehind ensures we don't capture markdown headings like "# Title".
  const tagRegex = /(?:^|[\s.,!?;:()[\]{}"'“”‘’])#([a-zA-Z][a-zA-Z0-9\-_]*)/g;

  const countMap = new Map<string, { tag: string; name: string; count: number }>();

  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(text)) !== null) {
    const rawName = match[1];
    // Exclude if it looks like heading anchor or empty
    if (!rawName) continue;

    const normalized = rawName.toLowerCase();
    const fullTag = `#${normalized}`;

    const existing = countMap.get(normalized);
    if (existing) {
      existing.count += 1;
    } else {
      countMap.set(normalized, {
        tag: fullTag,
        name: normalized,
        count: 1,
      });
    }
  }

  return Array.from(countMap.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Categorizes extracted narrative tags according to user-defined category rules or prefix mappings.
 * If no category is assigned, tags are placed under "Uncategorized".
 */
export function categorizeTags(
  tags: NarrativeTag[],
  categories: string[],
  assignments: Record<string, string> = {}
): TagCategoryMap {
  const result: TagCategoryMap = {};

  for (const cat of categories) {
    result[cat] = [];
  }
  result['Uncategorized'] = [];

  for (const item of tags) {
    const assignedCat = assignments[item.name];
    if (assignedCat && result[assignedCat]) {
      result[assignedCat].push(item);
    } else {
      result['Uncategorized'].push(item);
    }
  }

  return result;
}

/**
 * Searches the TipTap editor ProseMirror document for a hashtag and returns its selection bounds.
 */
export function findTagPositionInEditor(
  doc: { descendants: (cb: (node: { isText: boolean; text?: string }, pos: number) => boolean | void) => void },
  tagName: string
): { from: number; to: number } | null {
  const clean = tagName.toLowerCase().replace(/^#/, '');
  const searchTag = `#${clean}`;
  let found: { from: number; to: number } | null = null;

  doc.descendants((node, pos) => {
    if (found) return false;
    if (node.isText && node.text) {
      const lower = node.text.toLowerCase();
      const idx = lower.indexOf(searchTag);
      if (idx !== -1) {
        found = { from: pos + idx, to: pos + idx + searchTag.length };
        return false;
      }
    }
    return true;
  });

  return found;
}

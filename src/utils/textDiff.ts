/**
 * Paragraph-level comparison of two versions of a text, for showing what changed between a
 * backup or snapshot and the current draft.
 */
export interface DiffBlock {
  type: 'same' | 'added' | 'removed';
  text: string;
}

const paragraphs = (text: string) =>
  text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

/** Longest-common-subsequence diff over paragraphs: `before` -> `after`. */
export function diffParagraphs(before: string, after: string): DiffBlock[] {
  const a = paragraphs(before);
  const b = paragraphs(after);
  const n = a.length;
  const m = b.length;

  // lcs[i][j] = length of the common subsequence of a[i..] and b[j..]
  const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const blocks: DiffBlock[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      blocks.push({ type: 'same', text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      blocks.push({ type: 'removed', text: a[i++] });
    } else {
      blocks.push({ type: 'added', text: b[j++] });
    }
  }
  while (i < n) blocks.push({ type: 'removed', text: a[i++] });
  while (j < m) blocks.push({ type: 'added', text: b[j++] });
  return blocks;
}

export interface DiffSummary {
  added: number;
  removed: number;
  /** True when the two versions have the same paragraphs. */
  identical: boolean;
}

export function summarizeDiff(blocks: DiffBlock[]): DiffSummary {
  const added = blocks.filter((b) => b.type === 'added').length;
  const removed = blocks.filter((b) => b.type === 'removed').length;
  return { added, removed, identical: added === 0 && removed === 0 };
}

export type DiffRow = DiffBlock | { type: 'skipped'; count: number };

/** Keeps changed paragraphs with a little unchanged context, collapsing long unchanged runs. */
export function collapseUnchanged(blocks: DiffBlock[], context = 1): DiffRow[] {
  const keep = new Array<boolean>(blocks.length).fill(false);
  blocks.forEach((block, idx) => {
    if (block.type === 'same') return;
    for (let k = Math.max(0, idx - context); k <= Math.min(blocks.length - 1, idx + context); k++) keep[k] = true;
  });

  const rows: DiffRow[] = [];
  let skipped = 0;
  blocks.forEach((block, idx) => {
    if (keep[idx]) {
      if (skipped > 0) rows.push({ type: 'skipped', count: skipped });
      skipped = 0;
      rows.push(block);
    } else {
      skipped += 1;
    }
  });
  if (skipped > 0) rows.push({ type: 'skipped', count: skipped });
  return rows;
}

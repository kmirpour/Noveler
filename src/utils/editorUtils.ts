import type { Node } from '@tiptap/pm/model';

export interface WordRange {
  word: string;
  from: number;
  to: number;
}

/**
 * Finds the word boundaries and clean text for a word under a given document position.
 * Returns null if the position is not inside or adjacent to an alphanumeric word.
 */
export function getWordRangeAtPos(doc: Node, pos: number): WordRange | null {
  if (pos < 0 || pos > doc.content.size) return null;

  const resolved = doc.resolve(pos);
  if (!resolved.parent.isTextblock) return null;

  const startOfBlock = resolved.start();
  const endOfBlock = resolved.end();
  const blockText = doc.textBetween(startOfBlock, endOfBlock, ' ');
  const offset = Math.min(Math.max(0, pos - startOfBlock), blockText.length);

  // If the position is directly on a whitespace character, it's not on a word
  if (offset < blockText.length && /\s/.test(blockText[offset])) {
    return null;
  }

  const textBefore = blockText.slice(0, offset);
  const textAfter = blockText.slice(offset);

  const beforeMatch = textBefore.match(/[a-zA-Z0-9'-]+$/);
  const afterMatch = textAfter.match(/^[a-zA-Z0-9'-]+/);

  const startOffset = beforeMatch ? offset - beforeMatch[0].length : offset;
  const endOffset = afterMatch ? offset + afterMatch[0].length : offset;

  if (startOffset === endOffset) return null;

  const rawWord = blockText.slice(startOffset, endOffset);
  const cleanWord = rawWord.replace(/^[^a-zA-Z0-9'-]+|[^a-zA-Z0-9'-]+$/g, '');

  if (!cleanWord) return null;

  return {
    word: cleanWord,
    from: startOfBlock + startOffset,
    to: startOfBlock + endOffset,
  };
}

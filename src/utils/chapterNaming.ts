/**
 * Chapter file naming and sorting helpers adhering to GUIDE.md specification:
 * - Sequential names: '01-chapter.md', '02-the-beginning.md', or 'chapter-01.md'
 * - Files starting with 'chapter' (case-insensitive) or numeric prefix are classified as chapters
 * - Natural ascending numeric sort
 * - Auto-incrementing next chapter name
 */

/**
 * Determines whether a filename belongs in the Chapters list.
 * Matches:
 *  - Files starting with the word "chapter" (case-insensitive), e.g. 'chapter-01.md', 'Chapter 1.md', 'chapter_two.md'
 *  - Numbered chapter files, e.g. '01-chapter.md', '02-the-beginning.md'
 */
export function isChapterFileName(fileName: string): boolean {
  const clean = fileName.replace(/\.(md|markdown|txt)$/i, '').trim();
  if (!clean) return false;
  if (/^chapter(?:\b|[\s\-_.\d]|$)/i.test(clean)) {
    return true;
  }
  if (/^(\d+)(?:[\s\-_.]|$)/.test(clean)) {
    return true;
  }
  return false;
}

/**
 * Extracts numeric chapter number from a chapter filename
 * (e.g., '01-chapter.md' -> 1, 'chapter-02-the-beginning.md' -> 2, 'Chapter 10.md' -> 10).
 */
export function parseChapterNumber(fileName: string): number | null {
  const clean = fileName.replace(/\.(md|markdown|txt)$/i, '').trim();
  const leadingNum = clean.match(/^(\d+)(?:[\s\-_.]|$)/);
  if (leadingNum) {
    return parseInt(leadingNum[1], 10);
  }
  const chapterPrefixNum = clean.match(/^chapter[\s\-_.]*(\d+)(?:[\s\-_.]|$)/i);
  if (chapterPrefixNum) {
    return parseInt(chapterPrefixNum[1], 10);
  }
  return null;
}

/**
 * Sanitizes a title string into a filename-safe slug or friendly name.
 */
export function slugifyTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return 'chapter';
  return trimmed
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '')
    .replace(/-+/g, '-');
}

/**
 * Formats a sequential chapter filename with zero-padded prefix (at least 2 digits).
 * Examples:
 *  - formatChapterFileName(1) -> '01-chapter.md'
 *  - formatChapterFileName(2, 'The Beginning') -> '02-the-beginning.md'
 */
export function formatChapterFileName(index: number, customTitle?: string): string {
  const numPrefix = index.toString().padStart(2, '0');
  const baseTitle = customTitle && customTitle.trim() ? slugifyTitle(customTitle) : 'chapter';
  return `${numPrefix}-${baseTitle}.md`;
}

/**
 * Determines the next sequential chapter filename based on existing filenames.
 * Defaults to '01-chapter.md' if no sequential chapters exist.
 */
export function getNextChapterFileName(existingFileNames: string[], title?: string): string {
  let maxNum = 0;
  for (const name of existingFileNames) {
    if (!name.endsWith('.md') && !name.endsWith('.markdown') && !name.endsWith('.txt')) continue;
    const num = parseChapterNumber(name);
    if (num !== null && num > maxNum) {
      maxNum = num;
    }
  }

  const nextIndex = maxNum + 1;
  return formatChapterFileName(nextIndex, title);
}

/**
 * Naturally sorts chapter files in ascending numerical order by their prefix,
 * followed by standard alphabetical sort for unnumbered files.
 */
export function sortChapterFiles<T extends { name: string }>(files: T[]): T[] {
  return [...files].sort((a, b) => {
    const numA = parseChapterNumber(a.name);
    const numB = parseChapterNumber(b.name);

    if (numA !== null && numB !== null) {
      if (numA !== numB) return numA - numB;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    }
    if (numA !== null) return -1;
    if (numB !== null) return 1;

    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
}

/**
 * Extracts a human-readable display title from a chapter or note filename.
 * E.g., '01-the-beginning.md' -> 'Chapter 1: The beginning'
 *       'chapter-02-harbor.md' -> 'Chapter 2: Harbor'
 */
export function extractChapterDisplayTitle(fileName: string): string {
  const clean = fileName.replace(/\.(md|markdown|txt)$/i, '');
  const num = parseChapterNumber(fileName);
  if (num !== null) {
    const rest = clean
      .replace(/^(?:chapter[\s\-_.]*)?\d+[\s\-_.:]*/i, '')
      .replace(/[-_]+/g, ' ')
      .trim();
    if (rest && rest.toLowerCase() !== 'chapter') {
      const capitalized = rest.charAt(0).toUpperCase() + rest.slice(1);
      return `Chapter ${num}: ${capitalized}`;
    }
    return `Chapter ${num}`;
  }
  if (/^chapter[\s\-_.:]+/i.test(clean)) {
    const rest = clean.replace(/^chapter[\s\-_.:]+/i, '').replace(/[-_]+/g, ' ').trim();
    if (rest) {
      const capitalized = rest.charAt(0).toUpperCase() + rest.slice(1);
      return `Chapter: ${capitalized}`;
    }
    return 'Chapter';
  }
  return clean.replace(/[-_]+/g, ' ');
}

/**
 * Formats a renamed chapter or note filename while preserving its numeric or 'chapter-' prefix if present.
 * Strips redundant leading "Chapter N:" from the user's input before slugifying.
 */
export function buildRenamedChapterFileName(oldFileName: string, newTitleInput: string): string {
  const num = parseChapterNumber(oldFileName);
  const extMatch = oldFileName.match(/\.(md|markdown|txt)$/i);
  const ext = extMatch ? extMatch[0].toLowerCase() : '.md';
  const startsWithChapterWord = /^chapter(?:\b|[\s\-_.\d])/i.test(oldFileName);

  // Strip optional leading "Chapter 1:" or "01 -" if the user left it in the input
  const cleanedTitle = newTitleInput
    .trim()
    .replace(/^chapter(?:\s+\d+)?\s*[:\-–—.]?\s*/i, '')
    .replace(/^\d+\s*[:\-–—.]\s*/, '')
    .trim();

  if (num !== null) {
    const numPrefix = num.toString().padStart(2, '0');
    const slug = cleanedTitle ? slugifyTitle(cleanedTitle) : 'chapter';
    if (startsWithChapterWord) {
      return slug === 'chapter' ? `chapter-${numPrefix}${ext}` : `chapter-${numPrefix}-${slug}${ext}`;
    }
    return `${numPrefix}-${slug}${ext}`;
  }

  if (startsWithChapterWord) {
    const slug = cleanedTitle ? slugifyTitle(cleanedTitle) : 'chapter';
    return slug.startsWith('chapter') ? `${slug}${ext}` : `chapter-${slug}${ext}`;
  }

  const fallback = newTitleInput.trim();
  if (!fallback) return oldFileName;
  return fallback.match(/\.(md|markdown|txt)$/i) ? fallback : `${fallback}${ext}`;
}



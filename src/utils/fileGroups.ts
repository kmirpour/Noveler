/**
 * Groups loose project files by the first word of their file name, so a pile of notes like
 * `scene-lab-meeting.md`, `scene-omegagon.md`, `plot-twists.md`, `Plot_brainstorm.md` reads as
 * "Scene" and "Plot" sections. A word only becomes a group when at least two files share it;
 * everything else is listed under "Notes". Nothing on disk is moved or renamed.
 */
export interface FileGroup<T> {
  key: string;
  label: string;
  items: T[];
}

export const UNGROUPED_KEY = '__notes__';

function firstWord(fileName: string): string {
  const base = fileName.replace(/\.(md|markdown|txt)$/i, '');
  const word = (base.split(/[\s\-_.]+/).find(Boolean) || '').toLowerCase();
  // Treat simple plurals as the same word ("scenes - useful" joins the "scene" group).
  return word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;
}

export function groupFilesByPrefix<T>(items: T[], getFileName: (item: T) => string): FileGroup<T>[] {
  const byWord = new Map<string, T[]>();
  for (const item of items) {
    const word = firstWord(getFileName(item));
    byWord.set(word, [...(byWord.get(word) || []), item]);
  }

  const groups: FileGroup<T>[] = [];
  const rest: T[] = [];
  // Keep the incoming order: a group appears where its first file would have been.
  const placed = new Set<string>();
  for (const item of items) {
    const word = firstWord(getFileName(item));
    const members = byWord.get(word) || [];
    if (word && members.length >= 2) {
      if (!placed.has(word)) {
        placed.add(word);
        groups.push({ key: word, label: word.charAt(0).toUpperCase() + word.slice(1), items: members });
      }
    } else {
      rest.push(item);
    }
  }

  groups.sort((a, b) => a.label.localeCompare(b.label));
  if (rest.length > 0) groups.push({ key: UNGROUPED_KEY, label: 'Notes', items: rest });
  return groups;
}

/** Compact word count for narrow spaces: 842, 1.2k, 10.4k, 86k. */
export function formatWordsCompact(words: number): string {
  if (words < 1000) return String(words);
  if (words < 20000) return `${(words / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${Math.round(words / 1000)}k`;
}

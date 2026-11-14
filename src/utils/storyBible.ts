import type { CodexCategory, CodexEntry } from '../services/projectService';

/**
 * Helpers that connect the story bible (Codex) to the writer's own notes and manuscript:
 *  - reading entries out of a wiki-style notes file,
 *  - counting where each character, place or term appears.
 */

export interface ParsedWikiEntry {
  name: string;
  aliases: string[];
  category: CodexCategory;
  /** First sentence or two, for cards and hover text. */
  summary: string;
  /** Everything written about the entry. */
  description: string;
}

function categoryForHeading(heading: string): CodexCategory | null {
  const h = heading.toLowerCase();
  if (/character|cast|people|person/.test(h)) return 'character';
  if (/location|place|setting|geograph/.test(h)) return 'location';
  if (/item|object|artifact|artefact|device|technolog/.test(h)) return 'item';
  if (/lore|term|language|glossary|concept|theor|histor|world/.test(h)) return 'lore';
  return null;
}

function summarize(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= 220) return flat;
  const cut = flat.slice(0, 220);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return lastStop > 80 ? cut.slice(0, lastStop + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
}

/** "Azie, (Azar Zarin)" -> { name: "Azie", aliases: ["Azar Zarin"] } */
function splitNameAndAliases(raw: string): { name: string; aliases: string[] } {
  const aliases: string[] = [];
  const name = raw
    .replace(/\(([^)]+)\)/g, (_, inner: string) => {
      for (const part of inner.split(/[,;/]| or /)) {
        const alias = part.replace(/^(?:aka|a\.k\.a\.|also)\s+/i, '').trim();
        if (alias) aliases.push(alias);
      }
      return ' ';
    })
    .replace(/[\s,;:]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { name, aliases };
}

/**
 * Finds entries written as a bold lead-in, the way most people keep a wiki:
 *
 *   **Azie (Azar Zarin):** a fifth-year neurosurgery resident…
 *
 * Following paragraphs belong to the same entry until the next bold lead-in or heading.
 * The nearest heading above decides the category (e.g. anything under "Characters").
 */
export function parseWikiEntries(markdown: string): ParsedWikiEntry[] {
  const leadIn = /^\*\*([^*\n]{2,80}?)\s*:?\*\*\s*:?\s*(.*)$/s;
  const entries: (ParsedWikiEntry & { parts: string[] })[] = [];
  let category: CodexCategory = 'character';
  let current: (ParsedWikiEntry & { parts: string[] }) | null = null;

  for (const block of markdown.replace(/\r\n?/g, '\n').split(/\n{2,}/)) {
    const para = block.trim();
    if (!para) continue;

    const heading = para.match(/^#{1,6}[ \t]+(.+)$/);
    if (heading && !para.includes('\n')) {
      category = categoryForHeading(heading[1]) ?? category;
      current = null;
      continue;
    }

    const match = para.match(leadIn);
    if (match && !para.startsWith('>')) {
      const { name, aliases } = splitNameAndAliases(match[1]);
      // A long bold run is emphasis inside prose, not an entry title.
      if (name && name.split(/\s+/).length <= 6) {
        current = { name, aliases, category, summary: '', description: '', parts: [match[2].trim()] };
        entries.push(current);
        continue;
      }
    }
    if (current) current.parts.push(para);
  }

  return entries.map(({ parts, ...entry }) => {
    const description = parts.filter(Boolean).join('\n\n');
    return { ...entry, description, summary: summarize(parts[0] || description) };
  });
}

export interface WikiImportPlan {
  toAdd: ParsedWikiEntry[];
  toUpdate: { existing: CodexEntry; parsed: ParsedWikiEntry }[];
  unchanged: number;
}

/** Compares parsed notes with the current story bible. Existing text is never overwritten. */
export function planWikiImport(existing: CodexEntry[], parsed: ParsedWikiEntry[]): WikiImportPlan {
  const byName = new Map<string, CodexEntry>();
  for (const entry of existing) {
    for (const term of [entry.name, ...(entry.aliases || [])]) {
      if (term.trim()) byName.set(term.trim().toLowerCase(), entry);
    }
  }

  const plan: WikiImportPlan = { toAdd: [], toUpdate: [], unchanged: 0 };
  const seen = new Set<string>();
  for (const p of parsed) {
    const key = p.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const match = byName.get(key) || p.aliases.map((a) => byName.get(a.toLowerCase())).find(Boolean);
    if (!match) plan.toAdd.push(p);
    else if (!match.summary?.trim() || !match.description?.trim()) plan.toUpdate.push({ existing: match, parsed: p });
    else plan.unchanged += 1;
  }
  return plan;
}

// --- Mentions -------------------------------------------------------------------------------------

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Matches the entry's name or any alias as whole words (Unicode-aware, case-sensitive). */
export function mentionRegExp(entry: Pick<CodexEntry, 'name' | 'aliases'>): RegExp | null {
  const terms = [entry.name, ...(entry.aliases || [])]
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .sort((a, b) => b.length - a.length);
  if (terms.length === 0) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${terms.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`, 'gu');
}

/** How many times each entry is mentioned in the text, keyed by entry id (zero counts omitted). */
export function countMentions(text: string, entries: CodexEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!text) return counts;
  for (const entry of entries) {
    const regex = mentionRegExp(entry);
    if (!regex) continue;
    const n = text.match(regex)?.length ?? 0;
    if (n > 0) counts[entry.id] = n;
  }
  return counts;
}

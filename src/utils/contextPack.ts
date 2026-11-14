import type { NovelProject } from '../services/projectService';
import { sceneMetaAt } from './sceneMetadata';

/**
 * Builds a single Markdown briefing to paste into an AI assistant (or hand to a human reader):
 * what the novel is, who is in it, how the chapters are laid out, and the passage in question.
 * Nothing is sent anywhere; the caller copies the result to the clipboard.
 */
export interface ContextPackInput {
  project: NovelProject;
  /** Path of the chapter being worked on, if any. */
  activePath: string | null;
  activeSceneIndex: number;
  /** Markdown of the scene the cursor is in (or the whole file when it has no scenes). */
  currentText: string;
  /** Text the writer has selected, if any; takes the place of the whole scene. */
  selection?: string;
  /** World notes to include: title and Markdown, most important first. */
  notes: { title: string; markdown: string }[];
  /** Upper bound for all notes together, in characters. */
  notesBudget?: number;
}

export function buildContextPack(input: ContextPackInput): string {
  const { project, activePath, activeSceneIndex, notes } = input;
  const out: string[] = [];
  const totalWords = project.binder.reduce((n, c) => n + (c.wordCount || 0), 0);

  out.push(`# Context: ${project.title}`);
  out.push(
    `A novel in progress${project.author && project.author !== 'Author' ? ` by ${project.author}` : ''}: ` +
      `${project.binder.length} chapters, about ${totalWords.toLocaleString()} words so far.`
  );

  // Cast and world, from the story bible
  const codex = project.codex || [];
  if (codex.length > 0) {
    out.push('## Story bible');
    const labels: Record<string, string> = { character: 'Characters', location: 'Places', item: 'Items', lore: 'Lore' };
    for (const category of ['character', 'location', 'item', 'lore']) {
      const entries = codex.filter((e) => e.category === category);
      if (entries.length === 0) continue;
      out.push(`### ${labels[category]}`);
      out.push(
        entries
          .map((e) => {
            const aka = e.aliases?.filter(Boolean).length ? ` (${e.aliases.filter(Boolean).join(', ')})` : '';
            const about = (e.summary || e.description || '').replace(/\s+/g, ' ').trim();
            return `- **${e.name}**${aka}${about ? `: ${about}` : ''}`;
          })
          .join('\n')
      );
    }
  }

  // Structure: chapters, scenes, and any synopses written on the corkboard
  out.push('## Outline');
  out.push(
    project.binder
      .map((chapter, i) => {
        const here = chapter.path === activePath ? ' ← working here' : '';
        const lines = [`${i + 1}. **${chapter.title}** (${(chapter.wordCount || 0).toLocaleString()} words)${here}`];
        (chapter.scenes || []).forEach((title, sceneIdx) => {
          const meta = sceneMetaAt(project, chapter.path, sceneIdx);
          const bits = [meta.pov ? `POV ${meta.pov}` : '', meta.synopsis?.replace(/\s+/g, ' ').trim() || '']
            .filter(Boolean)
            .join('. ');
          const marker = chapter.path === activePath && sceneIdx === activeSceneIndex ? ' ← this scene' : '';
          lines.push(`   - ${title}${bits ? `: ${bits}` : ''}${marker}`);
        });
        return lines.join('\n');
      })
      .join('\n')
  );

  // World notes, trimmed to a budget so the pack stays pasteable
  let budget = input.notesBudget ?? 24000;
  const included = notes.filter((n) => n.markdown.trim());
  if (included.length > 0) {
    out.push('## World notes');
    for (const note of included) {
      if (budget <= 0) break;
      let body = note.markdown.trim();
      if (body.length > budget) body = `${body.slice(0, budget).replace(/\s+\S*$/, '')}\n\n[…notes trimmed…]`;
      budget -= body.length;
      // Demote the note's own headings so they sit under this section.
      out.push(`### ${note.title}\n\n${body.replace(/^(#{1,4})[ \t]+/gm, '###$1 ')}`);
    }
  }

  const passage = (input.selection || '').trim() || input.currentText.trim();
  if (passage) {
    out.push(input.selection?.trim() ? '## Selected passage' : '## Current scene');
    out.push(passage);
  }

  return `${out.join('\n\n')}\n`;
}

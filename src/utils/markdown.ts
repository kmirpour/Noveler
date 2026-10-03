import { marked } from 'marked';
import TurndownService from 'turndown';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
  codeBlockStyle: 'fenced',
});

// Preserve underline tag if present
turndownService.addRule('underline', {
  filter: ['u'],
  replacement: (content) => `<u>${content}</u>`,
});

// Preserve mark/highlight tag if present
turndownService.addRule('highlight', {
  filter: ['mark'],
  replacement: (content) => `<mark>${content}</mark>`,
});

/**
 * Converts Markdown string to HTML for TipTap editor
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  return marked.parse(markdown, { async: false, breaks: true }) as string;
}

/**
 * Converts HTML from TipTap editor to Markdown string
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  return turndownService.turndown(html);
}

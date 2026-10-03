import { marked } from 'marked';
import TurndownService from 'turndown';
import DOMPurify from 'dompurify';

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
 * Converts Markdown string to HTML for TipTap editor, Preview and print.
 *
 * Output is sanitized: Markdown files may contain raw HTML, and the app's
 * webview has access to native file commands, so script-capable markup
 * (`<script>`, `on*=` handlers, `javascript:` URLs, iframes...) must never reach the DOM.
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  const html = marked.parse(markdown, { async: false, breaks: true }) as string;
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

/**
 * Converts HTML from TipTap editor to Markdown string
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  return turndownService.turndown(html);
}

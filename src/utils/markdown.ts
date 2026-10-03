import { marked } from 'marked';
import TurndownService from 'turndown';
import DOMPurify from 'dompurify';
import { MarkdownManager } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import type { JSONContent } from '@tiptap/core';

// Fiction-friendly Underline: supports both <u>...</u> and ++...++
export const FictionUnderline = Underline.extend({
  renderMarkdown: (node, h) => `<u>${h.renderChildren(node)}</u>`,
  markdownTokenizer: {
    name: 'underline',
    level: 'inline',
    start: (src) => {
      const uIndex = src.indexOf('<u>');
      const plusIndex = src.indexOf('++');
      if (uIndex === -1) return plusIndex;
      if (plusIndex === -1) return uIndex;
      return Math.min(uIndex, plusIndex);
    },
    tokenize(src, _tokens, lexer) {
      const match = /^(?:<u>([\s\S]+?)<\/u>|\+\+([\s\S]+?)\+\+)/i.exec(src);
      if (!match) return;
      const innerContent = (match[1] ?? match[2]).trim();
      return {
        type: 'underline',
        raw: match[0],
        text: innerContent,
        tokens: lexer.inlineTokens(innerContent),
      };
    },
  },
});

// Fiction-friendly Highlight: supports both <mark>...</mark> and ==...==
export const FictionHighlight = Highlight.extend({
  renderMarkdown: (node, h) => `<mark>${h.renderChildren(node)}</mark>`,
  markdownTokenizer: {
    name: 'highlight',
    level: 'inline',
    start: (src) => {
      const markIndex = src.indexOf('<mark>');
      const eqIndex = src.indexOf('==');
      if (markIndex === -1) return eqIndex;
      if (eqIndex === -1) return markIndex;
      return Math.min(markIndex, eqIndex);
    },
    tokenize(src, _tokens, lexer) {
      const match = /^(?:<mark>([\s\S]+?)<\/mark>|==([\s\S]+?)==)/i.exec(src);
      if (!match) return;
      const innerContent = (match[1] ?? match[2]).trim();
      return {
        type: 'highlight',
        raw: match[0],
        text: innerContent,
        tokens: lexer.inlineTokens(innerContent),
      };
    },
  },
});

export const markdownExtensions = [
  StarterKit.configure({ underline: false }),
  FictionUnderline,
  FictionHighlight,
];

export const markdownManager = new MarkdownManager({
  extensions: markdownExtensions,
});

/**
 * Converts a Markdown string to ProseMirror JSON using TipTap's MarkdownManager.
 */
export function markdownToProseMirror(markdown: string): JSONContent {
  if (!markdown) return { type: 'doc', content: [] };
  return markdownManager.parse(markdown);
}

/**
 * Serializes a ProseMirror JSON document to Markdown string.
 */
export function proseMirrorToMarkdown(doc: JSONContent): string {
  if (!doc) return '';
  return markdownManager.serialize(doc);
}

const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
  codeBlockStyle: 'fenced',
});

turndownService.addRule('underline', {
  filter: ['u'],
  replacement: (content) => `<u>${content}</u>`,
});

turndownService.addRule('highlight', {
  filter: ['mark'],
  replacement: (content) => `<mark>${content}</mark>`,
});

/**
 * Converts Markdown string to HTML for Preview and print.
 *
 * Output is sanitized: Markdown files may contain raw HTML, and the app's
 * webview has access to native file commands, so script-capable markup
 * (`<script>`, `on*=` handlers, `javascript:` URLs, iframes...) must never reach the DOM.
 * `breaks: false` ensures standard Markdown paragraph handling (soft-wrapped
 * lines do not gain spurious <br> tags).
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  const html = marked.parse(markdown, { async: false, breaks: false }) as string;
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

/**
 * Fallback converter from HTML to Markdown string
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  return turndownService.turndown(html);
}

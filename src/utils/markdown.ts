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
 * Converts straight ASCII quotes (" and ') in plain text into book-style
 * curly quotes (“ ” and ‘ ’), taking an optional preceding character for
 * multi-run inline sequences.
 */
export function smartQuotes(text: string, initialPrevChar: string = ''): string {
  if (!text || (!text.includes('"') && !text.includes("'"))) return text;

  const isOpeningContext = (ch: string) =>
    ch === '' || /[\s([{\u2014\u2013\-‘“]/.test(ch);

  let out = '';
  let prev = initialPrevChar;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      const rep = isOpeningContext(prev) ? '“' : '”';
      out += rep;
      prev = rep;
    } else if (ch === "'") {
      const nextTwoDigits = /^\d{2}s?\b/.test(text.slice(i + 1));
      const rep = isOpeningContext(prev) && !nextTwoDigits ? '‘' : '’';
      out += rep;
      prev = rep;
    } else {
      out += ch;
      prev = ch;
    }
  }
  return out;
}

/**
 * Applies smart quotes to text nodes inside an HTML string while skipping
 * HTML tags and <code> / <pre> blocks.
 */
export function applySmartQuotesToHtml(html: string): string {
  if (!html) return '';
  const tokens = html.split(/(<[^>]+>)/g);
  let codeDepth = 0;
  let prevTextChar = '';

  const blockBoundaryTag = /^<\/?(?:p|div|h[1-6]|li|blockquote|hr|br|pre|tr|td|th)\b/i;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.startsWith('<')) {
      if (/^<(?:code|pre)\b/i.test(token)) {
        codeDepth++;
      } else if (/^<\/(?:code|pre)\b/i.test(token)) {
        codeDepth = Math.max(0, codeDepth - 1);
      }
      if (blockBoundaryTag.test(token)) {
        prevTextChar = '';
      }
    } else if (codeDepth === 0 && token) {
      // Marked encodes raw " as &quot; and ' as &#39; in HTML text; normalize before smartQuotes
      const decoded = token
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      const converted = smartQuotes(decoded, prevTextChar);
      tokens[i] = converted;
      if (converted.length > 0) {
        prevTextChar = converted[converted.length - 1];
      }
    }
  }

  return tokens.join('');
}

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
  const sanitized = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  return applySmartQuotesToHtml(sanitized);
}

/**
 * Fallback converter from HTML to Markdown string
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  return turndownService.turndown(html);
}

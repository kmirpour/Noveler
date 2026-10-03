import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx';
import { saveBinaryAs, type SavedFile } from '../services/fileService';

export interface DocxExportOptions {
  title?: string;
  author?: string;
  fontFamily?: string; // Default: 'Times New Roman'
  doubleSpaced?: boolean; // Default: true (standard manuscript format)
}

const BODY_SIZE = 24; // half-points -> 12pt

/**
 * Converts the markdown manuscript into a paragraph list for DOCX generation.
 * Exported separately from the file-saving step so it can be unit-tested.
 */
export function markdownToDocxParagraphs(markdown: string, options: DocxExportOptions = {}): Paragraph[] {
  const font = options.fontFamily || 'Times New Roman';
  const lineSpacing = options.doubleSpaced !== false ? 480 : 240; // 480 = double, 240 = single
  const firstLineIndent = 720; // 0.5 inch in twips (standard fiction manuscript indent)

  const lines = markdown.split(/\r?\n/);
  const paragraphs: Paragraph[] = [];

  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Code block toggle
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: rawLine, font: 'Courier New', size: 20 })],
          spacing: { line: 240 },
        })
      );
      continue;
    }

    // Empty lines
    if (trimmed === '') {
      continue;
    }

    // H1 Heading (e.g. Book Title / Part)
    if (trimmed.startsWith('# ')) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          children: parseInlineFormatting(trimmed.substring(2).trim(), font, { size: 32, bold: true }), // 16pt
          spacing: { before: 720, after: 360, line: lineSpacing },
        })
      );
      continue;
    }

    // H2 Heading (e.g. Chapter Title)
    if (trimmed.startsWith('## ')) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          alignment: AlignmentType.CENTER,
          children: parseInlineFormatting(trimmed.substring(3).trim(), font, { size: 28, bold: true }), // 14pt
          spacing: { before: 600, after: 240, line: lineSpacing },
        })
      );
      continue;
    }

    // H3 Heading (e.g. Section Title)
    if (trimmed.startsWith('### ')) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: parseInlineFormatting(trimmed.substring(4).trim(), font, { size: 24, bold: true }), // 12pt
          spacing: { before: 360, after: 180, line: lineSpacing },
        })
      );
      continue;
    }

    // Scene Break: --- or ***
    if (trimmed === '---' || trimmed === '***' || trimmed === '* * *' || trimmed === '###') {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: '#',
              bold: true,
              font,
              size: BODY_SIZE, // Standard manuscript scene break glyph
            }),
          ],
          spacing: { before: 360, after: 360, line: lineSpacing },
        })
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const text = trimmed.replace(/^>\s?/, '');
      paragraphs.push(
        new Paragraph({
          indent: { left: 720, right: 720 },
          children: parseInlineFormatting(text, font, { italics: true }),
          spacing: { before: 180, after: 180, line: lineSpacing },
        })
      );
      continue;
    }

    // Lists: "- item", "* item", "1. item"
    const listMatch = /^(?:([-*+])|(\d+)\.)\s+(.*)$/.exec(trimmed);
    if (listMatch) {
      const marker = listMatch[1] ? '•' : `${listMatch[2]}.`;
      paragraphs.push(
        new Paragraph({
          indent: { left: 720, hanging: 360 },
          children: [
            new TextRun({ text: `${marker}\t`, font, size: BODY_SIZE }),
            ...parseInlineFormatting(listMatch[3], font),
          ],
          spacing: { line: lineSpacing },
        })
      );
      continue;
    }

    // Standard fiction paragraph: parse bold and italic inline markers
    paragraphs.push(
      new Paragraph({
        indent: { firstLine: firstLineIndent },
        children: parseInlineFormatting(trimmed, font),
        spacing: { line: lineSpacing },
      })
    );
  }

  return paragraphs;
}

/**
 * Builds a .docx from markdown and asks the user where to save it.
 * Resolves to the saved file, or null if the user cancelled.
 */
export async function exportToDocx(
  markdown: string,
  fileName: string = 'manuscript.docx',
  options: DocxExportOptions = {}
): Promise<SavedFile | null> {
  const doc = new Document({
    creator: options.author,
    title: options.title,
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        children: markdownToDocxParagraphs(markdown, options),
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const outName = fileName.endsWith('.docx') ? fileName : `${fileName.replace(/\.(md|markdown|txt)$/i, '')}.docx`;

  return saveBinaryAs(blob, outName, { name: 'Word Document', extensions: ['docx'] });
}

interface RunStyle {
  bold?: boolean;
  italics?: boolean;
  size?: number;
}

/** A styled slice of text, before conversion to a docx TextRun. */
export interface InlineSegment {
  text: string;
  bold: boolean;
  italics: boolean;
  underline: boolean;
  highlight: boolean;
  code: boolean;
}

/**
 * Tokenizes the inline markdown produced by our serializer (turndown):
 * `**bold**`, `*italic*`, `***both***`, `<u>underline</u>`, `<mark>highlight</mark>`,
 * `` `code` `` and backslash escapes. Markers toggle styles, so nesting works and
 * no characters are ever silently dropped.
 */
export function parseInlineSegments(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const state = { bold: false, italics: false, underline: false, highlight: false, code: false };
  let buffer = '';

  const flush = () => {
    if (buffer) {
      segments.push({ text: buffer, ...state });
      buffer = '';
    }
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const rest = text.slice(i);

    // Inside inline code everything is literal until the closing backtick.
    if (state.code) {
      if (ch === '`') {
        flush();
        state.code = false;
      } else {
        buffer += ch;
      }
      i++;
      continue;
    }

    if (ch === '\\' && i + 1 < text.length && /[\\`*_{}[\]()#+\-.!<>~|]/.test(text[i + 1])) {
      buffer += text[i + 1];
      i += 2;
      continue;
    }

    if (ch === '`') {
      flush();
      state.code = true;
      i++;
      continue;
    }

    if (ch === '*') {
      let run = 0;
      while (text[i + run] === '*') run++;
      flush();
      if (run >= 3) {
        state.bold = !state.bold;
        state.italics = !state.italics;
        i += 3;
      } else if (run === 2) {
        state.bold = !state.bold;
        i += 2;
      } else {
        state.italics = !state.italics;
        i += 1;
      }
      continue;
    }

    const tag = /^<(\/?)(u|mark)>/i.exec(rest);
    if (tag) {
      flush();
      const on = tag[1] !== '/';
      if (tag[2].toLowerCase() === 'u') state.underline = on;
      else state.highlight = on;
      i += tag[0].length;
      continue;
    }

    buffer += ch;
    i++;
  }
  flush();
  return segments;
}

function parseInlineFormatting(text: string, font: string, base: RunStyle = {}): TextRun[] {
  const size = base.size ?? BODY_SIZE;
  const runs = parseInlineSegments(text).map(
    (seg) =>
      new TextRun({
        text: seg.text,
        font: seg.code ? 'Courier New' : font,
        size: seg.code ? size - 2 : size,
        bold: base.bold || seg.bold || undefined,
        italics: base.italics ? !seg.italics : seg.italics || undefined, // italics inside an italic block flips back
        underline: seg.underline ? {} : undefined,
        highlight: seg.highlight ? 'yellow' : undefined,
      })
  );

  if (runs.length === 0) {
    runs.push(new TextRun({ text, font, size }));
  }
  return runs;
}

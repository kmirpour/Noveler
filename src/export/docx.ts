import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx';
import type { JSONContent } from '@tiptap/core';
import { saveBinaryAs, type SavedFile } from '../services/fileService';
import { markdownToProseMirror } from '../utils/markdown';

export interface DocxExportOptions {
  title?: string;
  author?: string;
  fontFamily?: string; // Default: 'Times New Roman'
  doubleSpaced?: boolean; // Default: true (standard manuscript format)
}

const BODY_SIZE = 24; // half-points -> 12pt

/**
 * Converts a ProseMirror text node's marks into a DOCX TextRun
 */
function textNodeToRun(
  node: JSONContent,
  font: string,
  baseStyle: { bold?: boolean; italics?: boolean; size?: number } = {}
): TextRun {
  const marks = node.marks || [];
  const isBold = baseStyle.bold || marks.some((m) => m.type === 'bold');
  const isItalic = baseStyle.italics || marks.some((m) => m.type === 'italic');
  const isUnderline = marks.some((m) => m.type === 'underline');
  const isStrike = marks.some((m) => m.type === 'strike');
  const isHighlight = marks.some((m) => m.type === 'highlight');
  const isCode = marks.some((m) => m.type === 'code');
  const size = baseStyle.size ?? BODY_SIZE;

  return new TextRun({
    text: node.text || '',
    font: isCode ? 'Courier New' : font,
    size: isCode ? size - 2 : size,
    bold: isBold || undefined,
    italics: isItalic || undefined,
    underline: isUnderline ? {} : undefined,
    strike: isStrike || undefined,
    highlight: isHighlight ? 'yellow' : undefined,
  });
}

function inlineContentToRuns(
  content: JSONContent[] | undefined,
  font: string,
  baseStyle: { bold?: boolean; italics?: boolean; size?: number } = {}
): TextRun[] {
  if (!content || content.length === 0) {
    return [new TextRun({ text: '', font, size: baseStyle.size ?? BODY_SIZE })];
  }

  const runs: TextRun[] = [];
  for (const child of content) {
    if (child.type === 'text') {
      runs.push(textNodeToRun(child, font, baseStyle));
    } else if (child.type === 'hardBreak') {
      runs.push(new TextRun({ break: 1 }));
    }
  }
  return runs.length > 0 ? runs : [new TextRun({ text: '', font, size: baseStyle.size ?? BODY_SIZE })];
}

/**
 * Converts a ProseMirror JSON document tree into structured blocks for DOCX generation.
 * Walking the ProseMirror tree directly avoids regex parsing errors and tag leaks.
 */
export function proseMirrorToDocxParagraphs(
  doc: JSONContent,
  options: DocxExportOptions = {}
): Paragraph[] {
  const font = options.fontFamily || 'Times New Roman';
  const lineSpacing = options.doubleSpaced !== false ? 480 : 240; // 480 = double, 240 = single
  const firstLineIndent = 720; // 0.5 inch in twips (standard fiction manuscript indent)

  const paragraphs: Paragraph[] = [];
  const nodes = doc.content || [];

  for (const node of nodes) {
    switch (node.type) {
      case 'heading': {
        const level = (node.attrs?.level as number) || 1;
        const headingMap = {
          1: { level: HeadingLevel.HEADING_1, size: 32, before: 720, after: 360, align: AlignmentType.CENTER },
          2: { level: HeadingLevel.HEADING_2, size: 28, before: 600, after: 240, align: AlignmentType.CENTER },
          3: { level: HeadingLevel.HEADING_3, size: 24, before: 360, after: 180, align: AlignmentType.LEFT },
        };
        const cfg = headingMap[level as 1 | 2 | 3] || headingMap[3];
        paragraphs.push(
          new Paragraph({
            heading: cfg.level,
            alignment: cfg.align,
            children: inlineContentToRuns(node.content, font, { size: cfg.size, bold: true }),
            spacing: { before: cfg.before, after: cfg.after, line: lineSpacing },
          })
        );
        break;
      }

      case 'horizontalRule': {
        // Standard manuscript scene break: centered '#' glyph
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: '#',
                bold: true,
                font,
                size: BODY_SIZE,
              }),
            ],
            spacing: { before: 360, after: 360, line: lineSpacing },
          })
        );
        break;
      }

      case 'blockquote': {
        const children = node.content || [];
        for (const child of children) {
          paragraphs.push(
            new Paragraph({
              indent: { left: 720, right: 720 },
              children: inlineContentToRuns(child.content, font, { italics: true }),
              spacing: { before: 180, after: 180, line: lineSpacing },
            })
          );
        }
        break;
      }

      case 'bulletList': {
        const items = node.content || [];
        for (const item of items) {
          const itemParas = item.content || [];
          for (const p of itemParas) {
            paragraphs.push(
              new Paragraph({
                indent: { left: 720, hanging: 360 },
                children: [
                  new TextRun({ text: '•\t', font, size: BODY_SIZE }),
                  ...inlineContentToRuns(p.content, font),
                ],
                spacing: { line: lineSpacing },
              })
            );
          }
        }
        break;
      }

      case 'orderedList': {
        const items = node.content || [];
        let index = (node.attrs?.order as number) || 1;
        for (const item of items) {
          const itemParas = item.content || [];
          for (const p of itemParas) {
            paragraphs.push(
              new Paragraph({
                indent: { left: 720, hanging: 360 },
                children: [
                  new TextRun({ text: `${index}.\t`, font, size: BODY_SIZE }),
                  ...inlineContentToRuns(p.content, font),
                ],
                spacing: { line: lineSpacing },
              })
            );
          }
          index++;
        }
        break;
      }

      case 'codeBlock': {
        const text = node.content?.[0]?.text || '';
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: line, font: 'Courier New', size: 20 })],
              spacing: { line: 240 },
            })
          );
        }
        break;
      }

      case 'paragraph':
      default: {
        paragraphs.push(
          new Paragraph({
            indent: { firstLine: firstLineIndent },
            children: inlineContentToRuns(node.content, font),
            spacing: { line: lineSpacing },
          })
        );
        break;
      }
    }
  }

  return paragraphs;
}

/**
 * Converts markdown string into structured DOCX paragraphs via ProseMirror parser.
 */
export function markdownToDocxParagraphs(
  markdown: string,
  options: DocxExportOptions = {}
): Paragraph[] {
  const doc = markdownToProseMirror(markdown);
  return proseMirrorToDocxParagraphs(doc, options);
}

/**
 * Builds a .docx from a ProseMirror JSON document or markdown string,
 * prompting the user where to save it.
 */
export async function exportToDocx(
  input: JSONContent | string,
  fileName: string = 'manuscript.docx',
  options: DocxExportOptions = {}
): Promise<SavedFile | null> {
  const paragraphs =
    typeof input === 'string'
      ? markdownToDocxParagraphs(input, options)
      : proseMirrorToDocxParagraphs(input, options);

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
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const outName = fileName.endsWith('.docx') ? fileName : `${fileName.replace(/\.(md|markdown|txt)$/i, '')}.docx`;

  return saveBinaryAs(blob, outName, { name: 'Word Document', extensions: ['docx'] });
}

// Retained for backward compatibility with inline string token tests
export interface InlineSegment {
  text: string;
  bold: boolean;
  italics: boolean;
  underline: boolean;
  highlight: boolean;
  code: boolean;
}

export function parseInlineSegments(text: string): InlineSegment[] {
  const json = markdownToProseMirror(text);
  const firstPara = json.content?.[0];
  if (!firstPara?.content) {
    return [{ text, bold: false, italics: false, underline: false, highlight: false, code: false }];
  }
  return firstPara.content.map((n) => {
    const marks = n.marks || [];
    return {
      text: n.text || '',
      bold: marks.some((m) => m.type === 'bold'),
      italics: marks.some((m) => m.type === 'italic'),
      underline: marks.some((m) => m.type === 'underline'),
      highlight: marks.some((m) => m.type === 'highlight'),
      code: marks.some((m) => m.type === 'code'),
    };
  });
}

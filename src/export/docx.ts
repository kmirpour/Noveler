import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx';
import { saveAs } from 'file-saver';
import { isTauri, saveFileAs } from '../services/fileService';

export interface DocxExportOptions {
  title?: string;
  author?: string;
  fontFamily?: string; // Default: 'Times New Roman'
  doubleSpaced?: boolean; // Default: true (standard manuscript format)
}

/**
 * Parses markdown into structured blocks for DOCX generation
 */
export async function exportToDocx(
  markdown: string,
  fileName: string = 'manuscript.docx',
  options: DocxExportOptions = {}
): Promise<void> {
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
      const text = trimmed.substring(2).trim();
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text,
              bold: true,
              font,
              size: 32, // 16pt
            }),
          ],
          spacing: { before: 720, after: 360, line: lineSpacing },
        })
      );
      continue;
    }

    // H2 Heading (e.g. Chapter Title)
    if (trimmed.startsWith('## ')) {
      const text = trimmed.substring(3).trim();
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text,
              bold: true,
              font,
              size: 28, // 14pt
            }),
          ],
          spacing: { before: 600, after: 240, line: lineSpacing },
        })
      );
      continue;
    }

    // H3 Heading (e.g. Section Title)
    if (trimmed.startsWith('### ')) {
      const text = trimmed.substring(4).trim();
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [
            new TextRun({
              text,
              bold: true,
              font,
              size: 24, // 12pt
            }),
          ],
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
              size: 24, // Standard manuscript scene break glyph
            }),
          ],
          spacing: { before: 360, after: 360, line: lineSpacing },
        })
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      const text = trimmed.substring(2).trim();
      paragraphs.push(
        new Paragraph({
          indent: { left: 720, right: 720 },
          children: [
            new TextRun({
              text,
              italics: true,
              font,
              size: 24,
            }),
          ],
          spacing: { before: 180, after: 180, line: lineSpacing },
        })
      );
      continue;
    }

    // Standard fiction paragraph: parse bold and italic inline markers
    const textRuns = parseInlineFormatting(trimmed, font);
    paragraphs.push(
      new Paragraph({
        indent: { firstLine: firstLineIndent },
        children: textRuns,
        spacing: { line: lineSpacing },
      })
    );
  }

  const doc = new Document({
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
  const outName = fileName.endsWith('.docx') ? fileName : `${fileName.replace(/\.md$/, '')}.docx`;

  if (isTauri()) {
    const arrayBuffer = await blob.arrayBuffer();
    // Convert to binary array for saving
    const uint8 = new Uint8Array(arrayBuffer);
    const binaryString = Array.from(uint8, (b) => String.fromCharCode(b)).join('');
    await saveFileAs(binaryString, outName);
  } else {
    saveAs(blob, outName);
  }
}

/**
 * Parses bold (**text**) and italic (*text*) into TextRuns
 */
function parseInlineFormatting(text: string, font: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|<u>[^<]+<\/u>|`[^`]+`|[^*<`]+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const part = match[0];
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(
        new TextRun({
          text: part.slice(2, -2),
          bold: true,
          font,
          size: 24, // 12pt
        })
      );
    } else if (part.startsWith('*') && part.endsWith('*')) {
      runs.push(
        new TextRun({
          text: part.slice(1, -1),
          italics: true,
          font,
          size: 24,
        })
      );
    } else if (part.startsWith('`') && part.endsWith('`')) {
      runs.push(
        new TextRun({
          text: part.slice(1, -1),
          font: 'Courier New',
          size: 22,
        })
      );
    } else {
      runs.push(
        new TextRun({
          text: part,
          font,
          size: 24,
        })
      );
    }
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text, font, size: 24 }));
  }

  return runs;
}

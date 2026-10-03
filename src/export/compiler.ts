import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Header,
  PageNumber,
} from 'docx';
import type { NovelProject, BinderItem } from '../services/projectService';
import { parseSceneMarkdown, flattenScenes } from '../services/projectService';
import * as fileService from '../services/fileService';
import { markdownToDocxParagraphs } from './docx';

export interface CompileOptions {
  title: string;
  author: string;
  contactInfo?: string;
  format: 'shunn-docx' | 'standard-docx' | 'markdown';
  sceneBreakSymbol?: string; // Default: '#' for Shunn, '* * *' for standard
  selectedPaths: string[];
}

export interface CompiledResult {
  fileName: string;
  wordCount: number;
  data: Blob | string;
}

/**
 * Compiles selected novel scenes into a unified manuscript.
 */
export async function compileNovel(
  project: NovelProject,
  options: CompileOptions
): Promise<CompiledResult> {
  const allScenes = flattenScenes(project.binder);
  const selectedScenes = allScenes.filter((s) => options.selectedPaths.includes(s.path));

  // Load and clean scene contents
  const loadedScenes: { item: BinderItem; body: string; words: number }[] = [];
  let totalWords = 0;

  for (const scene of selectedScenes) {
    try {
      const file = await fileService.readFileDirect(scene.path);
      const { body } = parseSceneMarkdown(file.content);
      const cleanBody = body.trim();
      const words = cleanBody === '' ? 0 : cleanBody.split(/\s+/).length;
      totalWords += words;
      loadedScenes.push({ item: scene, body: cleanBody, words });
    } catch (err) {
      console.warn(`Could not read scene ${scene.path} for compilation:`, err);
    }
  }

  const baseTitle = options.title.trim() || project.title || 'Manuscript';
  const authorName = options.author.trim() || project.author || 'Author';
  const sceneSymbol = options.sceneBreakSymbol || (options.format === 'shunn-docx' ? '#' : '* * *');

  // Format: Combined Markdown
  if (options.format === 'markdown') {
    const mdParts: string[] = [];
    mdParts.push(`# ${baseTitle}\n\nby ${authorName}\n\n`);

    for (let i = 0; i < loadedScenes.length; i++) {
      const { item, body } = loadedScenes[i];
      mdParts.push(`## ${item.title}\n\n${body}`);
      if (i < loadedScenes.length - 1) {
        mdParts.push(`\n\n${sceneSymbol}\n\n`);
      }
    }

    const fullMarkdown = mdParts.join('\n');
    return {
      fileName: `${baseTitle}.md`,
      wordCount: totalWords,
      data: fullMarkdown,
    };
  }

  // Format: DOCX (Standard Manuscript Format / Shunn or Standard)
  const isShunn = options.format === 'shunn-docx';
  const font = isShunn ? 'Times New Roman' : 'Georgia';
  const lineSpacing = 480; // double-spaced in DOCX (240 = single, 480 = double)

  const paragraphs: Paragraph[] = [];

  // --- Title Page (for Shunn format) ---
  if (isShunn) {
    const approxWords = Math.round(totalWords / 100) * 100;
    const contactLines = (options.contactInfo || '').split('\n').filter(Boolean);

    // Top Header: Contact (Left) and Word Count (Right)
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${authorName}\n${contactLines.join('\n')}`,
            font,
            size: 20, // 10pt
          }),
        ],
        spacing: { line: 240 },
      })
    );

    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: `About ${approxWords.toLocaleString()} words`,
            font,
            size: 20,
          }),
        ],
        spacing: { line: 240 },
      })
    );

    // Spacing down to center of title page
    for (let s = 0; s < 8; s++) {
      paragraphs.push(new Paragraph({ spacing: { line: 480 } }));
    }

    // Title & Byline (Centered)
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: baseTitle.toUpperCase(),
            font,
            size: 32, // 16pt
            bold: true,
          }),
        ],
        spacing: { line: 480, after: 240 },
      })
    );

    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `by\n${authorName}`,
            font,
            size: 24, // 12pt
          }),
        ],
        spacing: { line: 360 },
      })
    );

    // Page break after title page
    paragraphs.push(
      new Paragraph({
        pageBreakBefore: true,
        children: [],
      })
    );
  }

  // --- Body Chapters and Scenes ---
  for (let i = 0; i < loadedScenes.length; i++) {
    const { item, body } = loadedScenes[i];

    // Scene / Chapter Title Header
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: item.title,
            font,
            size: 28, // 14pt
            bold: true,
          }),
        ],
        spacing: { line: lineSpacing, before: 480, after: 240 },
      })
    );

    // Scene text body
    const sceneParagraphs = markdownToDocxParagraphs(body, {
      fontFamily: font,
      doubleSpaced: true,
    });
    paragraphs.push(...sceneParagraphs);

    // Scene break between consecutive scenes
    if (i < loadedScenes.length - 1) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: sceneSymbol,
              font,
              size: 24,
            }),
          ],
          spacing: { line: lineSpacing, before: 360, after: 360 },
          indent: { firstLine: 0 },
        })
      );
    }
  }

  // End mark
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: isShunn ? '# # #' : 'THE END',
          font,
          size: 24,
          bold: true,
        }),
      ],
      spacing: { line: lineSpacing, before: 480 },
      indent: { firstLine: 0 },
    })
  );

  // Document Headers: Surname / TITLE / Page
  const shortTitle = baseTitle.length > 20 ? `${baseTitle.substring(0, 18)}...` : baseTitle;
  const surname = authorName.split(' ').pop() || authorName;

  const doc = new Document({
    creator: authorName,
    title: baseTitle,
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }, // 1 inch
          },
        },
        headers: isShunn
          ? {
              default: new Header({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: `${surname} / ${shortTitle.toUpperCase()} / `,
                        font,
                        size: 20,
                      }),
                      new TextRun({
                        children: [PageNumber.CURRENT],
                        font,
                        size: 20,
                      }),
                    ],
                  }),
                ],
              }),
            }
          : undefined,
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return {
    fileName: `${baseTitle}.docx`,
    wordCount: totalWords,
    data: blob,
  };
}

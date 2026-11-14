import JSZip from 'jszip';
import { markdownToHtml } from '../utils/markdown';
import type { SceneTitleMode } from '../services/settings';

/**
 * Builds an EPUB 3 e-book (readable in Apple Books, Kobo, Calibre, and convertible for Kindle)
 * from the novel's chapters. Each chapter becomes one section with an entry in the table of
 * contents; `##` scene headings follow the same display choice as the editor and preview.
 */
export interface EpubChapter {
  title: string;
  markdown: string;
}

export interface EpubOptions {
  title: string;
  author: string;
  language?: string;
  /** How `##` scene headings appear: as titles, as a centred break, or not at all. */
  sceneTitleMode?: SceneTitleMode;
  sceneBreakSymbol?: string;
  /** Fixed identifier and date, for reproducible output in tests. */
  identifier?: string;
  modified?: string;
}

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STYLESHEET = `body { font-family: serif; line-height: 1.5; margin: 0 5%; }
h1 { font-size: 1.6em; text-align: center; margin: 3em 0 1.5em; page-break-before: always; }
h2 { font-size: 1.15em; text-align: center; margin: 2em 0 1em; }
h3 { font-size: 1em; margin: 1.5em 0 0.5em; }
p { margin: 0; text-indent: 1.5em; text-align: justify; }
h1 + p, h2 + p, h3 + p, .scene-break + p, blockquote + p, p.first { text-indent: 0; }
.scene-break { text-align: center; text-indent: 0; margin: 1.5em 0; }
blockquote { margin: 1em 1.5em; font-style: italic; }
blockquote p { text-indent: 0; }
.title-page { text-align: center; margin-top: 30%; }
.title-page h1 { page-break-before: auto; font-size: 2em; margin-bottom: 0.5em; }
.title-page p { text-indent: 0; text-align: center; }
`;

/** Converts a chapter's Markdown to an XHTML body fragment and reports whether it has its own title. */
export function chapterToXhtml(
  markdown: string,
  sceneTitleMode: SceneTitleMode = 'show',
  sceneBreakSymbol = '* * *'
): { body: string; hasTitle: boolean } {
  const doc = new DOMParser().parseFromString(`<div id="root">${markdownToHtml(markdown)}</div>`, 'text/html');
  const root = doc.getElementById('root')!;

  const sceneBreak = () => {
    const p = doc.createElement('p');
    p.className = 'scene-break';
    p.textContent = sceneBreakSymbol;
    return p;
  };

  if (sceneTitleMode !== 'show') {
    Array.from(root.querySelectorAll('h2')).forEach((h2, idx) => {
      // A scene that opens the chapter needs no break above it; every other scene is separated
      // from the text before it.
      const previous = h2.previousElementSibling;
      const opensChapter = idx === 0 && (!previous || previous.tagName === 'H1');
      if (opensChapter) h2.remove();
      else h2.replaceWith(sceneBreak());
    });
  }
  for (const hr of Array.from(root.querySelectorAll('hr'))) hr.replaceWith(sceneBreak());

  // E-readers ignore colour marks and scripts; keep the markup plain.
  for (const el of Array.from(root.querySelectorAll('mark'))) el.replaceWith(...Array.from(el.childNodes));

  const hasTitle = root.firstElementChild?.tagName === 'H1';
  const serializer = new XMLSerializer();
  const body = Array.from(root.childNodes)
    .map((node) => serializer.serializeToString(node))
    .join('\n')
    .replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '')
    .replace(/&nbsp;/g, '&#160;');
  return { body, hasTitle };
}

const xhtmlPage = (title: string, body: string, language: string) => `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}" lang="${language}">
<head>
  <meta charset="utf-8"/>
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
${body}
</body>
</html>
`;

export async function buildEpub(chapters: EpubChapter[], options: EpubOptions): Promise<Blob> {
  const language = options.language || 'en';
  const title = options.title.trim() || 'Untitled';
  const author = options.author.trim() || 'Unknown';
  const identifier =
    options.identifier ||
    `urn:uuid:${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  const modified = options.modified || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const pages = chapters.map((chapter, i) => {
    const { body, hasTitle } = chapterToXhtml(chapter.markdown, options.sceneTitleMode, options.sceneBreakSymbol);
    const heading = hasTitle ? '' : `<h1>${escapeXml(chapter.title)}</h1>\n`;
    return { id: `chapter-${i + 1}`, file: `chapter-${i + 1}.xhtml`, title: chapter.title, body: heading + body };
  });

  const zip = new JSZip();
  // The mimetype entry must come first and be stored uncompressed.
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`
  );

  const oebps = zip.folder('OEBPS')!;
  oebps.file('style.css', STYLESHEET);
  oebps.file(
    'title.xhtml',
    xhtmlPage(
      title,
      `<section class="title-page" epub:type="titlepage">\n<h1>${escapeXml(title)}</h1>\n<p>${escapeXml(author)}</p>\n</section>`,
      language
    )
  );
  for (const page of pages) {
    oebps.file(page.file, xhtmlPage(page.title, `<section epub:type="chapter">\n${page.body}\n</section>`, language));
  }

  oebps.file(
    'nav.xhtml',
    xhtmlPage(
      'Contents',
      `<nav epub:type="toc" id="toc">\n<h1>Contents</h1>\n<ol>\n${pages
        .map((p) => `  <li><a href="${p.file}">${escapeXml(p.title)}</a></li>`)
        .join('\n')}\n</ol>\n</nav>`,
      language
    )
  );

  // NCX: the table of contents older reading systems look for.
  oebps.file(
    'toc.ncx',
    `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${escapeXml(identifier)}"/></head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>
  <navMap>
${pages
  .map(
    (p, i) =>
      `    <navPoint id="${p.id}" playOrder="${i + 1}"><navLabel><text>${escapeXml(p.title)}</text></navLabel><content src="${p.file}"/></navPoint>`
  )
  .join('\n')}
  </navMap>
</ncx>
`
  );

  oebps.file(
    'content.opf',
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${language}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${escapeXml(identifier)}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>${language}</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
    <item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>
${pages.map((p) => `    <item id="${p.id}" href="${p.file}" media-type="application/xhtml+xml"/>`).join('\n')}
  </manifest>
  <spine toc="ncx">
    <itemref idref="title"/>
${pages.map((p) => `    <itemref idref="${p.id}"/>`).join('\n')}
  </spine>
</package>
`
  );

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
  });
}

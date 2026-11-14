/**
 * Tidies text pasted from chat assistants and web pages so it lands as clean, standard Markdown:
 * HTML entities decoded, invisible characters removed, bold markers stripped from headings, and a
 * trailing "Would you like me to…?" sign-off dropped.
 */
const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&rdquo;': '”',
  '&ldquo;': '“',
};

const SIGN_OFF = /^(?:>\s*)?(?:would you like|do you want me to|shall i|let me know if|want me to|should i)\b[^\n]*\?\s*$/i;

export function cleanPastedText(input: string): string {
  let text = input.replace(/\r\n?/g, '\n');

  // Invisible characters that chat UIs and web pages leave behind
  text = text.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').replace(/\u00A0/g, ' ');

  // Named and numeric HTML entities
  text = text.replace(/&(?:amp|lt|gt|quot|apos|nbsp|mdash|ndash|hellip|rsquo|lsquo|rdquo|ldquo|#39);/g, (m) => ENTITIES[m] ?? m);
  text = text.replace(/&#(\d{2,5});/g, (_, code: string) => String.fromCodePoint(Number(code)));

  // "## **Title**" -> "## Title" (a heading is already emphasised)
  text = text.replace(/^(#{1,6})[ \t]+\*\*(.+?)\*\*[ \t]*$/gm, '$1 $2');

  // Trailing spaces, and runs of blank lines
  text = text.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');

  // A closing offer from an assistant is not part of the material
  const paragraphs = text.trim().split(/\n{2,}/);
  while (paragraphs.length > 1 && SIGN_OFF.test(paragraphs[paragraphs.length - 1].trim())) {
    paragraphs.pop();
  }
  return paragraphs.join('\n\n');
}

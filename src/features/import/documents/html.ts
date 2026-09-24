import { decodeEntities, escapeMarkdown, joinParagraphs } from './markup';

const DROPPED_ELEMENTS = /<(script|style|head|noscript|template|svg|iframe|object)\b[\s\S]*?<\/\1\s*>/gi;
const BLOCK_BOUNDARY =
  /<\/?(p|div|section|article|header|footer|main|aside|blockquote|li|ul|ol|table|tr|pre|figure|figcaption|dd|dt|dl|hr)\b[^>]*>/gi;

/**
 * Converts an HTML document to Markdown text: headings keep their level,
 * bold/italic survive, block elements separate paragraphs, and everything
 * else (scripts, styles, attributes, links) is reduced to its visible text.
 * Nothing is rendered or executed.
 */
export function htmlToMarkdown(html: string): string {
  const PLACEHOLDER = '\uE000';
  const HEADING = '\uE003';
  const marked = html
    // Private-use characters mark structure below; the source never keeps its own.
    .replace(/[\uE000-\uE003]/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(DROPPED_ELEMENTS, '')
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi, (_match, level: string, inner: string) => {
      const text = decodeEntities(inner.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
      return text
        ? `${PLACEHOLDER}${HEADING}${'#'.repeat(Number(level))} ${escapeMarkdown(text)}${PLACEHOLDER}`
        : '';
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(BLOCK_BOUNDARY, PLACEHOLDER)
    .replace(/<(strong|b)\b[^>]*>/gi, '\uE001')
    .replace(/<\/(strong|b)\s*>/gi, '\uE001')
    .replace(/<(em|i)\b[^>]*>/gi, '\uE002')
    .replace(/<\/(em|i)\s*>/gi, '\uE002')
    .replace(/<[^>]+>/g, '');

  const paragraphs = marked.split(PLACEHOLDER).map((chunk) => {
    if (chunk.startsWith(HEADING)) return chunk.slice(HEADING.length);
    const text = decodeEntities(chunk).replace(/[ \t\r\n]+/g, ' ');
    return escapeMarkdown(text)
      .replace(/\uE001( ?)([^\uE001]*?)( ?)\uE001/g, (_m, lead: string, inner: string, trail: string) =>
        inner ? `${lead}**${inner}**${trail}` : lead + trail
      )
      .replace(/\uE002( ?)([^\uE002]*?)( ?)\uE002/g, (_m, lead: string, inner: string, trail: string) =>
        inner ? `${lead}*${inner}*${trail}` : lead + trail
      )
      .replace(/[\uE001\uE002]/g, '');
  });
  return joinParagraphs(paragraphs);
}

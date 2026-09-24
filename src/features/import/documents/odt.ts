import { attribute, decodeEntities, escapeMarkdown, joinParagraphs } from './markup';
import { readZipText } from './zip';

const BLOCK = /<text:(h|p)(\s[^>]*)?\/>|<text:(h|p)(\s[^>]*)?>([\s\S]*?)<\/text:\3>/g;

/** Inline OpenDocument text: spaces, tabs, and line breaks become characters. */
function inlineText(xml: string): string {
  return decodeEntities(
    xml
      .replace(/<text:s(\s[^>]*)?\/>/g, (tag) => ' '.repeat(Math.max(1, Number(attribute(tag, 'text:c')) || 1)))
      .replace(/<text:tab\s*\/>/g, ' ')
      .replace(/<text:line-break\s*\/>/g, '\n')
      .replace(/<[^>]+>/g, '')
  );
}

/** Converts OpenDocument text (`content.xml`) to Markdown headings and paragraphs. */
export function odfXmlToMarkdown(contentXml: string): string {
  const body = (
    /<office:text[^>]*>([\s\S]*)<\/office:text>/.exec(contentXml)?.[1] ?? contentXml
  ).replace(/<text:note\b[\s\S]*?<\/text:note>/g, '');
  const paragraphs: string[] = [];
  for (const block of body.matchAll(BLOCK)) {
    const kind = block[1] ?? block[3];
    const startAttributes = block[2] ?? block[4] ?? '';
    const text = inlineText(block[5] ?? '');
    if (kind === 'h') {
      const level = Math.min(6, Math.max(1, Number(attribute(startAttributes, 'text:outline-level')) || 1));
      const heading = text.replace(/\s+/g, ' ').trim();
      if (heading) paragraphs.push(`${'#'.repeat(level)} ${escapeMarkdown(heading)}`);
    } else {
      paragraphs.push(escapeMarkdown(text));
    }
  }
  return joinParagraphs(paragraphs);
}

export async function odtToMarkdown(buffer: ArrayBuffer): Promise<string> {
  const contentXml = await readZipText(buffer, 'content.xml');
  if (contentXml === null) throw new Error('This OpenDocument file has no readable text');
  return odfXmlToMarkdown(contentXml);
}

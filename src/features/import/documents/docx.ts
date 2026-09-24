import { attribute, decodeEntities, joinParagraphs, runsToMarkdown, type TextRun } from './markup';
import { readZipText } from './zip';

const PARAGRAPH = /<w:p(?:\s[^>]*)?\/>|<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
const RUN = /<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g;
const RUN_CONTENT = /<w:(t|tab|br|cr|noBreakHyphen)(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/w:t>)/g;

/** True unless the toggle property is explicitly off (`w:val="0"`/`false`). */
function toggleOn(properties: string, name: 'b' | 'i'): boolean {
  const match = new RegExp(`<w:${name}(\\s[^>]*)?/?>`).exec(properties);
  if (!match) return false;
  const value = attribute(match[0], 'w:val');
  return value === null || !/^(0|false|off)$/i.test(value);
}

/**
 * Heading level per paragraph style id. Built-in styles keep their English
 * names ("heading 1", "Title") in every Word locale, even when the id is
 * localized, and an outline level also marks a heading.
 */
export function headingStyles(stylesXml: string): Map<string, number> {
  const levels = new Map<string, number>();
  const styles = stylesXml.match(/<w:style\s[^>]*>[\s\S]*?<\/w:style>/g) ?? [];
  for (const style of styles) {
    const startTag = style.slice(0, style.indexOf('>') + 1);
    if (attribute(startTag, 'w:type') !== 'paragraph') continue;
    const id = attribute(startTag, 'w:styleId');
    if (!id) continue;
    const nameTag = /<w:name\s[^>]*>/.exec(style);
    const name = nameTag ? attribute(nameTag[0], 'w:val') ?? '' : '';
    const heading = /^heading\s*([1-6])$/i.exec(name);
    const outlineTag = /<w:outlineLvl\s[^>]*>/.exec(style);
    const outline = outlineTag ? Number(attribute(outlineTag[0], 'w:val')) : Number.NaN;
    if (heading) levels.set(id, Number(heading[1]));
    else if (/^(title)$/i.test(name)) levels.set(id, 1);
    else if (Number.isInteger(outline) && outline >= 0 && outline < 6) levels.set(id, outline + 1);
  }
  return levels;
}

function paragraphRuns(body: string): TextRun[] {
  const runs: TextRun[] = [];
  for (const run of body.matchAll(RUN)) {
    const content = run[1];
    const properties = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(content)?.[1] ?? '';
    const strong = toggleOn(properties, 'b');
    const emphasis = toggleOn(properties, 'i');
    let text = '';
    for (const piece of content.matchAll(RUN_CONTENT)) {
      if (piece[1] === 't') text += decodeEntities(piece[2] ?? '');
      else if (piece[1] === 'tab') text += ' ';
      else if (piece[1] === 'noBreakHyphen') text += '-';
      else text += '\n';
    }
    runs.push({ text, strong, emphasis });
  }
  return runs;
}

/** Converts WordprocessingML (`word/document.xml`) to Markdown. */
export function wordXmlToMarkdown(documentXml: string, stylesXml = ''): string {
  const levels = headingStyles(stylesXml);
  const body = /<w:body>([\s\S]*)<\/w:body>/.exec(documentXml)?.[1] ?? documentXml;
  const paragraphs: string[] = [];
  for (const paragraph of body.matchAll(PARAGRAPH)) {
    const content = paragraph[1] ?? '';
    const properties = /<w:pPr>([\s\S]*?)<\/w:pPr>/.exec(content)?.[1] ?? '';
    const styleTag = /<w:pStyle\s[^>]*>/.exec(properties);
    const styleId = styleTag ? attribute(styleTag[0], 'w:val') : null;
    const outlineTag = /<w:outlineLvl\s[^>]*>/.exec(properties);
    const outline = outlineTag ? Number(attribute(outlineTag[0], 'w:val')) : Number.NaN;
    const level =
      (styleId ? levels.get(styleId) : undefined) ??
      (Number.isInteger(outline) && outline >= 0 && outline < 6 ? outline + 1 : undefined);
    const runs = paragraphRuns(content);
    if (level) {
      const text = runsToMarkdown(runs.map((run) => ({ ...run, strong: false, emphasis: false })));
      const heading = text.replace(/\s+/g, ' ').trim();
      if (heading) paragraphs.push(`${'#'.repeat(level)} ${heading}`);
    } else {
      paragraphs.push(runsToMarkdown(runs));
    }
  }
  return joinParagraphs(paragraphs);
}

export async function docxToMarkdown(buffer: ArrayBuffer): Promise<string> {
  const documentXml = await readZipText(buffer, 'word/document.xml');
  if (documentXml === null) throw new Error('This Word document has no readable text');
  const stylesXml = (await readZipText(buffer, 'word/styles.xml')) ?? '';
  return wordXmlToMarkdown(documentXml, stylesXml);
}

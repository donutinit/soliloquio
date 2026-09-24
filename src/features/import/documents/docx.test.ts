import { describe, expect, it } from 'vitest';
import { docxToMarkdown, headingStyles, wordXmlToMarkdown } from './docx';
import { makeZip } from './testing/makeZip';

const STYLES = `<w:styles>
  <w:style w:type="paragraph" w:styleId="Ttulo1"><w:name w:val="heading 1"/></w:style>
  <w:style w:type="paragraph" w:styleId="Ttulo2"><w:name w:val="heading 2"/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/></w:style>
  <w:style w:type="paragraph" w:styleId="Custom"><w:name w:val="Scene"/><w:pPr><w:outlineLvl w:val="2"/></w:pPr></w:style>
  <w:style w:type="character" w:styleId="Strong"><w:name w:val="Strong"/></w:style>
</w:styles>`;

const DOCUMENT = `<w:document><w:body>
  <w:p><w:pPr><w:pStyle w:val="Ttulo1"/></w:pPr><w:r><w:t>Apertura</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Hola </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">a todos </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>hoy</w:t></w:r><w:r><w:t>.</w:t></w:r></w:p>
  <w:p/>
  <w:p><w:r><w:rPr><w:b w:val="0"/></w:rPr><w:t>No bold &amp; *literal* # text</w:t></w:r><w:r><w:tab/><w:t>tabbed</w:t></w:r></w:p>
  <w:p><w:r><w:t>- starts like a list</w:t></w:r></w:p>
  <w:p><w:r><w:delText>deleted</w:delText></w:r><w:ins><w:r><w:t>inserted</w:t></w:r></w:ins></w:p>
  <w:p><w:pPr><w:pStyle w:val="Custom"/></w:pPr><w:r><w:t>Scene</w:t></w:r></w:p>
</w:body></w:document>`;

describe('headingStyles', () => {
  it('maps localized style ids through their built-in names and outline levels', () => {
    const levels = headingStyles(STYLES);
    expect(levels.get('Ttulo1')).toBe(1);
    expect(levels.get('Ttulo2')).toBe(2);
    expect(levels.get('Title')).toBe(1);
    expect(levels.get('Custom')).toBe(3);
    expect(levels.has('Strong')).toBe(false);
  });
});

describe('wordXmlToMarkdown', () => {
  it('keeps headings, bold, and italic and escapes literal Markdown', () => {
    expect(wordXmlToMarkdown(DOCUMENT, STYLES)).toBe(
      [
        '# Apertura',
        'Hola **a todos** *hoy*.',
        'No bold & \\*literal\\* # text tabbed',
        '\\- starts like a list',
        'inserted',
        '### Scene'
      ].join('\n\n')
    );
  });
});

describe('docxToMarkdown', () => {
  it('reads the document and styles from the package', async () => {
    const zip = await makeZip([
      { name: '[Content_Types].xml', text: '<Types/>' },
      { name: 'word/document.xml', text: DOCUMENT, deflate: true },
      { name: 'word/styles.xml', text: STYLES, deflate: true }
    ]);
    await expect(docxToMarkdown(zip)).resolves.toMatch(/^# Apertura\n\nHola \*\*a todos\*\*/);
  });

  it('fails clearly when the package is not a Word document', async () => {
    const zip = await makeZip([{ name: 'content.xml', text: '<x/>' }]);
    await expect(docxToMarkdown(zip)).rejects.toThrow('no readable text');
  });
});

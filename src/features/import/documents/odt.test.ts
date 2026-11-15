import { describe, expect, it } from 'vitest';
import { odfXmlToMarkdown, odtToMarkdown } from './odt';
import { makeZip } from './testing/makeZip';

const CONTENT = `<office:document-content><office:body><office:text>
  <text:h text:style-name="H1" text:outline-level="2">Primer <text:span>acto</text:span></text:h>
  <text:p>Uno<text:s text:c="3"/>dos<text:tab/>tres<text:line-break/>cuatro</text:p>
  <text:p/>
  <text:list><text:list-item><text:p>&gt; not a note</text:p></text:list-item></text:list>
  <text:p>Con nota<text:note><text:note-body><text:p>al pie</text:p></text:note-body></text:note>.</text:p>
</office:text></office:body></office:document-content>`;

describe('odfXmlToMarkdown', () => {
  it('keeps heading levels and paragraph text', () => {
    expect(odfXmlToMarkdown(CONTENT)).toBe(
      ['## Primer acto', 'Uno dos tres\ncuatro', '\\> not a note', 'Con nota.'].join('\n\n')
    );
  });
});

describe('odfXmlToMarkdown with review marks', () => {
  it('drops comments and tracked deletions without cutting the paragraph', () => {
    const xml =
      '<office:text><text:tracked-changes><text:changed-region text:id="c1"><text:deletion>' +
      '<text:p>Borrado</text:p></text:deletion></text:changed-region></text:tracked-changes>' +
      '<text:p>Antes<office:annotation><dc:creator>Ana</dc:creator><text:p>Revisar</text:p>' +
      '</office:annotation> después.</text:p></office:text>';
    expect(odfXmlToMarkdown(xml)).toBe('Antes después.');
  });
});

describe('odtToMarkdown', () => {
  it('reads content.xml from the package', async () => {
    const zip = await makeZip([
      { name: 'mimetype', text: 'application/vnd.oasis.opendocument.text' },
      { name: 'content.xml', text: CONTENT, deflate: true }
    ]);
    await expect(odtToMarkdown(zip)).resolves.toMatch(/^## Primer acto/);
  });
});

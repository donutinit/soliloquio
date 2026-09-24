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

describe('odtToMarkdown', () => {
  it('reads content.xml from the package', async () => {
    const zip = await makeZip([
      { name: 'mimetype', text: 'application/vnd.oasis.opendocument.text' },
      { name: 'content.xml', text: CONTENT, deflate: true }
    ]);
    await expect(odtToMarkdown(zip)).resolves.toMatch(/^## Primer acto/);
  });
});

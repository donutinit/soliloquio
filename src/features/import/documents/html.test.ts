import { describe, expect, it } from 'vitest';
import { htmlToMarkdown } from './html';

describe('htmlToMarkdown', () => {
  it('keeps headings and emphasis and drops scripts, styles, and markup', () => {
    const html = `<!doctype html><html><head><title>x</title><style>p{}</style></head><body>
      <h1>Intro &amp; <em>tema</em></h1>
      <p>Hola <b>mundo</b>, <i>hoy</i>.<br>Otra línea</p>
      <script>alert(1)</script>
      <div>Uno <a href="https://example.com">enlace</a> &mdash; <span>fin</span></div>
      <ul><li># no heading</li><li>1. no list</li></ul>
      <!-- comment -->
    </body></html>`;
    expect(htmlToMarkdown(html)).toBe(
      [
        '# Intro & tema',
        'Hola **mundo**, *hoy*. Otra línea',
        'Uno enlace — fin',
        '\\# no heading',
        '1\\. no list'
      ].join('\n\n')
    );
  });
});

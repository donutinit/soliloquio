import { describe, expect, it } from 'vitest';
import { markdownToBlocks, scriptToBlocks, textToBlocks } from './flatten';

describe('markdownToBlocks', () => {
  it('conserva los headings con nivel e id de sección estable', () => {
    const blocks = markdownToBlocks('# Uno\n\ntexto\n\n## Dos\n\nmás texto');
    expect(blocks).toEqual([
      { type: 'heading', level: 1, text: 'Uno', sectionId: 'section-0' },
      { type: 'text', text: 'texto' },
      { type: 'heading', level: 2, text: 'Dos', sectionId: 'section-1' },
      { type: 'text', text: 'más texto' }
    ]);
  });

  it('aplana negrita, cursiva, tachado y código inline a texto', () => {
    const blocks = markdownToBlocks('Esto es **negrita**, *cursiva*, ~~tachado~~ y `código`.');
    expect(blocks).toEqual([
      { type: 'text', text: 'Esto es negrita, cursiva, tachado y código.' }
    ]);
  });

  it('convierte enlaces a su texto visible', () => {
    const blocks = markdownToBlocks('Visita [mi sitio](https://example.com) hoy.');
    expect(blocks).toEqual([{ type: 'text', text: 'Visita mi sitio hoy.' }]);
  });

  it('convierte imágenes a su texto alternativo', () => {
    const blocks = markdownToBlocks('![Un gato](cat.png) y ![](empty.png) fin.');
    expect(blocks).toEqual([{ type: 'text', text: 'Un gato y fin.' }]);
  });

  it('aplana blockquotes a texto normal', () => {
    const blocks = markdownToBlocks('> Cita famosa\n> segunda línea');
    expect(blocks).toEqual([{ type: 'text', text: 'Cita famosa segunda línea' }]);
  });

  it('aplana listas anidadas a bloques de texto', () => {
    const blocks = markdownToBlocks('- uno\n- dos\n  - dos punto uno\n\n1. tres');
    expect(blocks).toEqual([
      { type: 'text', text: 'uno' },
      { type: 'text', text: 'dos' },
      { type: 'text', text: 'dos punto uno' },
      { type: 'text', text: 'tres' }
    ]);
  });

  it('convierte tablas en líneas legibles', () => {
    const blocks = markdownToBlocks('| Nombre | Valor |\n| --- | --- |\n| Peso | 3 kg |');
    expect(blocks).toEqual([
      { type: 'text', text: 'Nombre — Valor' },
      { type: 'text', text: 'Peso — 3 kg' }
    ]);
  });

  it('elimina HTML de bloque e inline sin ejecutarlo', () => {
    const blocks = markdownToBlocks(
      '<script>alert(1)</script>\n\nHola <b>mundo</b> <img src=x onerror=alert(1)> fin'
    );
    expect(JSON.stringify(blocks)).not.toContain('<');
    expect(JSON.stringify(blocks)).not.toContain('alert');
    expect(blocks).toContainEqual({ type: 'text', text: 'Hola mundo fin' });
  });

  it('convierte bloques de código en texto plano', () => {
    const blocks = markdownToBlocks('```js\nconst x = 1;\n```');
    expect(blocks).toEqual([{ type: 'text', text: 'const x = 1;' }]);
  });

  it('ignora separadores horizontales', () => {
    const blocks = markdownToBlocks('uno\n\n---\n\ndos');
    expect(blocks).toEqual([
      { type: 'text', text: 'uno' },
      { type: 'text', text: 'dos' }
    ]);
  });
});

describe('textToBlocks', () => {
  it('separa párrafos por líneas en blanco', () => {
    expect(textToBlocks('uno\ndos\n\ntres\n\n\ncuatro')).toEqual([
      { type: 'text', text: 'uno dos' },
      { type: 'text', text: 'tres' },
      { type: 'text', text: 'cuatro' }
    ]);
  });

  it('no interpreta Markdown en formato texto', () => {
    expect(scriptToBlocks({ content: '# no es heading', format: 'text' })).toEqual([
      { type: 'text', text: '# no es heading' }
    ]);
  });
});

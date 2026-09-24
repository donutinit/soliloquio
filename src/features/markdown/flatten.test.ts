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

  it('conserva negrita y cursiva como tramos y aplana tachado y código', () => {
    const blocks = markdownToBlocks('Esto es **negrita**, *cursiva*, ~~tachado~~ y `código`.');
    expect(blocks).toEqual([
      {
        type: 'text',
        text: 'Esto es negrita, cursiva, tachado y código.',
        runs: [
          { text: 'Esto es ' },
          { text: 'negrita', strong: true },
          { text: ', ' },
          { text: 'cursiva', emphasis: true },
          { text: ', tachado y código.' }
        ]
      }
    ]);
  });

  it('combina marcas anidadas y colapsa espacios entre tramos', () => {
    const blocks = markdownToBlocks('  Muy ***importante***   ahora  ');
    expect(blocks).toEqual([
      {
        type: 'text',
        text: 'Muy importante ahora',
        runs: [
          { text: 'Muy ' },
          { text: 'importante', emphasis: true, strong: true },
          { text: ' ahora' }
        ]
      }
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

  it('convierte blockquotes en notas que no se leen', () => {
    const blocks = markdownToBlocks('> Mira a cámara\n> y **sonríe**\n\nHola');
    expect(blocks).toEqual([
      { type: 'note', text: 'Mira a cámara y sonríe' },
      { type: 'text', text: 'Hola' }
    ]);
  });

  it('las notas no abren secciones aunque contengan headings', () => {
    const blocks = markdownToBlocks('> # Recordatorio');
    expect(blocks).toEqual([{ type: 'note', text: 'Recordatorio' }]);
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

  it('convierte separadores horizontales en pausas', () => {
    const blocks = markdownToBlocks('uno\n\n---\n\ndos');
    expect(blocks).toEqual([
      { type: 'text', text: 'uno' },
      { type: 'pause' },
      { type: 'text', text: 'dos' }
    ]);
  });

  it('descarta pausas iniciales, finales y repetidas', () => {
    const blocks = markdownToBlocks('---\n\nuno\n\n---\n\n***\n\ndos\n\n---');
    expect(blocks).toEqual([
      { type: 'text', text: 'uno' },
      { type: 'pause' },
      { type: 'text', text: 'dos' }
    ]);
  });

  it('separa el texto alrededor de HTML inline en vez de pegar palabras', () => {
    const blocks = markdownToBlocks('línea uno<br>línea dos');
    expect(blocks).toEqual([{ type: 'text', text: 'línea uno línea dos' }]);
  });

  it('conserva el texto rodeado por etiquetas inline desconocidas', () => {
    const blocks = markdownToBlocks('antes <span>marcado</span> después');
    expect(blocks).toEqual([{ type: 'text', text: 'antes marcado después' }]);
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

  it('mantiene el contenido de un guion largo con un número acotado de bloques', () => {
    const content = 'Line\n\n'.repeat(50_000).trim();
    const blocks = scriptToBlocks({ content, format: 'text' });
    expect(blocks.length).toBeLessThan(100);
    expect(blocks.map((block) => ('text' in block ? block.text : '')).join('\n\n')).toBe(content);
  });

  it('divide un único párrafo muy largo sin perder texto', () => {
    const content = 'word '.repeat(50_000);
    const blocks = scriptToBlocks({ content, format: 'text' });
    expect(blocks.length).toBeGreaterThan(1);
    expect(blocks.every((block) => ('text' in block ? block.text : '').length <= 4_096)).toBe(true);
    expect(blocks.map((block) => ('text' in block ? block.text : '')).join('')).toBe(content.trim());
  });
});

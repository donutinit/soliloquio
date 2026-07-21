import { describe, expect, it } from 'vitest';
import {
  formatFromFileName,
  isSupportedScriptFile,
  readImportedFiles,
  stripFrontmatter,
  titleFromFileName
} from './importFiles';

describe('titleFromFileName', () => {
  it('elimina las extensiones conocidas', () => {
    expect(titleFromFileName('Mi guion.md')).toBe('Mi guion');
    expect(titleFromFileName('Notas.MARKDOWN')).toBe('Notas');
    expect(titleFromFileName('apuntes.txt')).toBe('apuntes');
  });

  it('conserva puntos interiores del nombre', () => {
    expect(titleFromFileName('acto.1.escena.2.md')).toBe('acto.1.escena.2');
  });

  it('no toca extensiones desconocidas y nunca deja el título vacío', () => {
    expect(titleFromFileName('datos.csv')).toBe('datos.csv');
    expect(titleFromFileName('.md')).toBe('Untitled');
  });
});

describe('formatFromFileName', () => {
  it('detecta markdown y texto', () => {
    expect(formatFromFileName('a.md')).toBe('markdown');
    expect(formatFromFileName('a.markdown')).toBe('markdown');
    expect(formatFromFileName('a.txt')).toBe('text');
    expect(formatFromFileName('a')).toBe('text');
  });
});

describe('isSupportedScriptFile', () => {
  it('accepts script extensions without trusting browser MIME filtering', () => {
    expect(isSupportedScriptFile('script.md')).toBe(true);
    expect(isSupportedScriptFile('SCRIPT.MARKDOWN')).toBe(true);
    expect(isSupportedScriptFile('notes.txt')).toBe(true);
    expect(isSupportedScriptFile('photo.png')).toBe(false);
  });
});

describe('stripFrontmatter', () => {
  it('elimina el frontmatter YAML de Obsidian al inicio del archivo', () => {
    const content = '---\ntitle: Nota\ntags: [obsidian]\n---\n\n# Hola\n\ntexto';
    expect(stripFrontmatter(content)).toBe('# Hola\n\ntexto');
  });

  it('soporta finales de línea CRLF', () => {
    expect(stripFrontmatter('---\r\ntitle: x\r\n---\r\ncuerpo')).toBe('cuerpo');
  });

  it('no toca contenido sin frontmatter', () => {
    expect(stripFrontmatter('# Hola\n\n---\n\nseparador normal')).toBe(
      '# Hola\n\n---\n\nseparador normal'
    );
    expect(stripFrontmatter('texto\n---\nno inicial')).toBe('texto\n---\nno inicial');
  });

  it('solo elimina el bloque inicial, no separadores posteriores', () => {
    const content = '---\na: 1\n---\nuno\n\n---\n\ndos';
    expect(stripFrontmatter(content)).toBe('uno\n\n---\n\ndos');
  });
});

describe('readImportedFiles', () => {
  it('lee UTF-8 y conserva el contenido original', async () => {
    const file = new File(['# Título\n\náéíóú ñ 中文'], 'guion.md', { type: 'text/markdown' });
    const [outcome] = await readImportedFiles([file]);
    expect(outcome).toEqual({
      ok: true,
      fileName: 'guion.md',
      title: 'guion',
      content: '# Título\n\náéíóú ñ 中文',
      format: 'markdown'
    });
  });

  it('el destino importado pierde el frontmatter de Obsidian', async () => {
    const file = new File(['---\ntags: [x]\n---\n\ncuerpo'], 'nota.md', {
      type: 'text/markdown'
    });
    const [outcome] = await readImportedFiles([file]);
    expect(outcome.ok && outcome.content).toBe('cuerpo');
  });

  it('aísla errores por archivo sin tumbar el lote', async () => {
    const good = new File(['hola'], 'ok.txt', { type: 'text/plain' });
    const bad = new File([''], 'malo.txt', { type: 'text/plain' });
    Object.defineProperty(bad, 'text', {
      value: () => Promise.reject(new Error('boom'))
    });
    const outcomes = await readImportedFiles([good, bad]);
    expect(outcomes[0].ok).toBe(true);
    expect(outcomes[1]).toEqual({
      ok: false,
      fileName: 'malo.txt',
      error: 'The file could not be read'
    });
  });

  it('rejects unsupported files selected by an unfiltered native picker', async () => {
    const [outcome] = await readImportedFiles([
      new File(['not an image'], 'photo.png', { type: 'image/png' })
    ]);
    expect(outcome).toEqual({
      ok: false,
      fileName: 'photo.png',
      error: 'Choose a Markdown (.md, .markdown), plain-text (.txt), or backup (.json) file'
    });
  });
});

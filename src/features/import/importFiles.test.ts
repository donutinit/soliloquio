import { describe, expect, it } from 'vitest';
import {
  formatFromFileName,
  isSupportedScriptFile,
  MAX_SCRIPT_IMPORT_FILES,
  MAX_SCRIPT_IMPORT_FILE_BYTES,
  MAX_SCRIPT_IMPORT_TOTAL_BYTES,
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
      code: 'read-failed',
      error: 'The file could not be read'
    });
  });

  it('lee secuencialmente para acotar el pico de memoria', async () => {
    const started: string[] = [];
    let finishFirst = (content: string): void => {
      throw new Error(`The first file did not start reading: ${content}`);
    };
    const first = new File(['uno'], 'uno.txt', { type: 'text/plain' });
    const second = new File(['dos'], 'dos.txt', { type: 'text/plain' });
    Object.defineProperty(first, 'text', {
      value: () => {
        started.push('uno');
        return new Promise<string>((resolve) => {
          finishFirst = resolve;
        });
      }
    });
    Object.defineProperty(second, 'text', {
      value: () => {
        started.push('dos');
        return Promise.resolve('dos');
      }
    });

    const reading = readImportedFiles([first, second]);
    expect(started).toEqual(['uno']);
    finishFirst('uno');

    expect((await reading).map((outcome) => outcome.ok)).toEqual([true, true]);
    expect(started).toEqual(['uno', 'dos']);
  });

  it('rechaza un archivo demasiado grande antes de leerlo', async () => {
    let readAttempted = false;
    const file = new File(['small fixture'], 'huge.md', { type: 'text/markdown' });
    Object.defineProperties(file, {
      size: { value: MAX_SCRIPT_IMPORT_FILE_BYTES + 1 },
      text: {
        value: () => {
          readAttempted = true;
          return Promise.resolve('content');
        }
      }
    });

    expect(await readImportedFiles([file])).toEqual([
      {
        ok: false,
        fileName: 'huge.md',
        code: 'file-too-large',
        error: 'Script files must be 5 MB or smaller'
      }
    ]);
    expect(readAttempted).toBe(false);
  });

  it('limita el tamaño acumulado aunque cada archivo individual sea válido', async () => {
    const fileSize = MAX_SCRIPT_IMPORT_FILE_BYTES;
    const files = Array.from({ length: MAX_SCRIPT_IMPORT_TOTAL_BYTES / fileSize + 1 }, (_, index) => {
      const file = new File(['x'], `${index}.txt`, { type: 'text/plain' });
      Object.defineProperty(file, 'size', { value: fileSize });
      return file;
    });

    const outcomes = await readImportedFiles(files);
    expect(outcomes.slice(0, -1).every((outcome) => outcome.ok)).toBe(true);
    expect(outcomes.at(-1)).toMatchObject({ ok: false, code: 'batch-too-large' });
  });

  it('devuelve un resultado claro para cada archivo que excede el máximo del lote', async () => {
    const files = Array.from(
      { length: MAX_SCRIPT_IMPORT_FILES + 2 },
      (_, index) => new File([''], `${index}.txt`, { type: 'text/plain' })
    );
    const outcomes = await readImportedFiles(files);

    expect(outcomes).toHaveLength(files.length);
    expect(outcomes[MAX_SCRIPT_IMPORT_FILES]).toMatchObject({
      ok: false,
      code: 'too-many-files'
    });
    expect(outcomes[MAX_SCRIPT_IMPORT_FILES + 1]).toMatchObject({
      ok: false,
      code: 'too-many-files'
    });
  });

  it('does not let unsupported files consume the script-file allowance', async () => {
    const unsupported = Array.from(
      { length: MAX_SCRIPT_IMPORT_FILES },
      (_, index) => new File([''], `${index}.png`, { type: 'image/png' })
    );
    const valid = new File(['kept'], 'kept.txt', { type: 'text/plain' });
    const outcomes = await readImportedFiles([...unsupported, valid]);

    expect(outcomes.slice(0, -1).every((outcome) => !outcome.ok)).toBe(true);
    expect(outcomes.at(-1)).toMatchObject({ ok: true, fileName: 'kept.txt' });
  });

  it('rejects unsupported files selected by an unfiltered native picker', async () => {
    const [outcome] = await readImportedFiles([
      new File(['not an image'], 'photo.png', { type: 'image/png' })
    ]);
    expect(outcome).toEqual({
      ok: false,
      fileName: 'photo.png',
      code: 'unsupported-type',
      error: 'Choose a Markdown (.md, .markdown) or plain-text (.txt) file'
    });
  });
});

import { describe, expect, it } from 'vitest';
import { formatFromFileName, readImportedFiles, titleFromFileName } from './importFiles';

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
    expect(titleFromFileName('.md')).toBe('Sin título');
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
      error: 'No se pudo leer el archivo'
    });
  });
});

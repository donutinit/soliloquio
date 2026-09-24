import { describe, expect, it } from 'vitest';
import { pdfPagesToText, type PdfTextItem } from './pdfText';

const line = (str: string, y: number, height = 12): PdfTextItem => ({ str, y, height, hasEOL: true });

describe('pdfPagesToText', () => {
  it('joins wrapped lines, splits paragraphs at wider gaps, and dehyphenates', () => {
    const page = [
      line('Hola a todos, bienvenidos', 700),
      line('al programa de hoy. Vamos a ha-', 686),
      line('blar de cosas.', 672),
      line('Segundo párrafo.', 640),
      line('12', 60)
    ];
    expect(pdfPagesToText([page])).toBe(
      'Hola a todos, bienvenidos al programa de hoy. Vamos a hablar de cosas.\n\nSegundo párrafo.'
    );
  });

  it('builds lines from runs on the same baseline and separates pages', () => {
    const first: PdfTextItem[] = [
      { str: 'Uno ', y: 700, height: 12, hasEOL: false },
      { str: 'dos', y: 700, height: 12, hasEOL: false },
      { str: 'Tres', y: 686, height: 12, hasEOL: true }
    ];
    expect(pdfPagesToText([first, [line('Página dos', 700)]])).toBe('Uno dos Tres\n\nPágina dos');
  });

  it('returns nothing for pages without text', () => {
    expect(pdfPagesToText([[], []])).toBe('');
  });
});

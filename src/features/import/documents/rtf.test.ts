import { describe, expect, it } from 'vitest';
import { rtfToText } from './rtf';

describe('rtfToText', () => {
  it('extracts paragraphs and decodes escapes while skipping metadata', () => {
    const rtf =
      "{\\rtf1\\ansi\\ansicpg1252{\\fonttbl{\\f0 Helvetica;}}{\\colortbl;\\red0\\green0\\blue0;}" +
      "{\\*\\generator Writer;}\\f0\\fs24 Hola, \\'e1rbol y \\u8364? euro.\\par\n" +
      "Segunda\\line l\\'ednea \\{llaves\\}\\par\\par {\\b negrita} fin\\emdash ok}";
    expect(rtfToText(rtf)).toBe('Hola, árbol y € euro.\n\nSegunda\nlínea {llaves}\n\nnegrita fin—ok');
  });

  it('rejects text that is not RTF', () => {
    expect(() => rtfToText('plain text')).toThrow();
  });
});

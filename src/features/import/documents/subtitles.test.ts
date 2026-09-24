import { describe, expect, it } from 'vitest';
import { subtitlesToText } from './subtitles';

describe('subtitlesToText', () => {
  it('keeps only spoken lines from SubRip captions', () => {
    const srt = '1\r\n00:00:01,000 --> 00:00:02,500\r\nHola a todos.\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\n<i>Bienvenidos</i>\r\nal programa.\r\n';
    expect(subtitlesToText(srt)).toBe('Hola a todos. Bienvenidos al programa.');
  });

  it('drops WebVTT headers, notes, and cue settings', () => {
    const vtt = 'WEBVTT\n\nNOTE internal\n\nintro\n00:01.000 --> 00:02.000 align:start\n<v Ana>Primera línea</v>\n\n00:02.000 --> 00:03.000\nSegunda';
    expect(subtitlesToText(vtt)).toBe('Primera línea Segunda');
  });
});

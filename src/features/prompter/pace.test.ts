import { describe, expect, it } from 'vitest';
import {
  countWords,
  estimateSpokenWords,
  formatReadingTime,
  formatWordCount,
  pixelsPerSecond,
  pixelsPerWord,
  readingSeconds,
  spokenWordCount
} from './pace';

describe('countWords', () => {
  it('counts words with letters or numbers and ignores punctuation', () => {
    expect(countWords('  Hola, mundo — 2026 ... ¡sí!  ')).toBe(4);
    expect(countWords('')).toBe(0);
    expect(countWords('— * #')).toBe(0);
  });
});

describe('spokenWordCount', () => {
  it('only counts text blocks', () => {
    expect(
      spokenWordCount([
        { type: 'heading', level: 1, text: 'Intro title', sectionId: 'section-0' },
        { type: 'text', text: 'one two three' },
        { type: 'note', text: 'smile here' },
        { type: 'pause' },
        { type: 'text', text: 'four' }
      ])
    ).toBe(4);
  });
});

describe('estimateSpokenWords', () => {
  it('skips headings, notes, and separators in Markdown', () => {
    const content = '# Title\n\nOne **two** three.\n\n> a note\n\n---\n\n- four\n#hashtag five';
    expect(estimateSpokenWords(content, 'markdown')).toBe(6);
  });

  it('counts every word in plain text', () => {
    expect(estimateSpokenWords('# not a heading\n> not a note', 'text')).toBe(6);
  });
});

describe('pace conversion', () => {
  it('converts words per minute through the measured distance per word', () => {
    expect(pixelsPerWord(4000, 100, 60)).toBe(40);
    expect(pixelsPerSecond(120, 40)).toBe(80);
    expect(readingSeconds(260, 130)).toBe(120);
  });

  it('falls back to a line-based distance when nothing is spoken', () => {
    expect(pixelsPerWord(0, 0, 60)).toBeCloseTo(40.5);
    expect(pixelsPerWord(500, 0, 40)).toBeCloseTo(27);
  });
});

describe('formatting', () => {
  it('formats compact reading times', () => {
    expect(formatReadingTime(0)).toBe('0:00');
    expect(formatReadingTime(0.2)).toBe('0:01');
    expect(formatReadingTime(125)).toBe('2:05');
    expect(formatReadingTime(3723)).toBe('1:02:03');
    expect(formatReadingTime(Number.NaN)).toBe('–');
  });

  it('pluralizes word counts', () => {
    expect(formatWordCount(1)).toBe('1 word');
    expect(formatWordCount(1200)).toBe('1,200 words');
  });
});

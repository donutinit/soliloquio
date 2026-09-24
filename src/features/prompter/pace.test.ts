import { describe, expect, it } from 'vitest';
import {
  countWords,
  estimateSpokenWords,
  formatReadingTime,
  formatWordCount,
  pixelsPerSecond,
  pixelsPerWord,
  readingSeconds,
  speedForDuration,
  spokenWordCount,
  timedPauseTotal
} from './pace';
import { SPEED_LIMITS } from '../settings/settings';

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

describe('timed pauses and fitting a duration', () => {
  it('does not count a timed separator as spoken words', () => {
    expect(estimateSpokenWords('one two\n\n--- 5s\n\nthree', 'markdown')).toBe(3);
  });

  it('adds up the seconds of timed pauses only', () => {
    expect(
      timedPauseTotal([
        { type: 'text', text: 'a' },
        { type: 'pause', seconds: 3 },
        { type: 'pause' },
        { type: 'pause', seconds: 2 }
      ])
    ).toBe(5);
  });

  it('finds the pace that fills the target time, snapped to the speed step', () => {
    // 130 words in 60 seconds.
    expect(speedForDuration(130, 60, 0, SPEED_LIMITS)).toBe(130);
    // 5 seconds of timed pauses leave 55 seconds to speak 121 words (132 wpm → 130).
    expect(speedForDuration(121, 60, 5, SPEED_LIMITS)).toBe(130);
  });

  it('clamps unreachable targets to the speed limits', () => {
    expect(speedForDuration(1000, 30, 0, SPEED_LIMITS)).toBe(SPEED_LIMITS.max);
    expect(speedForDuration(10, 180, 0, SPEED_LIMITS)).toBe(SPEED_LIMITS.min);
    expect(speedForDuration(100, 30, 40, SPEED_LIMITS)).toBe(SPEED_LIMITS.max);
  });
});

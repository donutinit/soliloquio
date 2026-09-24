import { describe, expect, it } from 'vitest';
import { titleFromText } from './titleFromText';

describe('titleFromText', () => {
  it('uses the first non-empty line without Markdown markers', () => {
    expect(titleFromText('\n\n## Launch video\n\nHello')).toBe('Launch video');
    expect(titleFromText('> Remember to smile\nHello')).toBe('Remember to smile');
    expect(titleFromText('Plain opening line\nSecond')).toBe('Plain opening line');
  });

  it('limits long titles and handles empty text', () => {
    expect(titleFromText('x'.repeat(200))).toHaveLength(80);
    expect(titleFromText('   \n  ')).toBe('');
  });
});

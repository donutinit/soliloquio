import { describe, expect, it } from 'vitest';
import {
  adjustmentProgress,
  formatDuration
} from './prompterDisplay';

describe('formatDuration', () => {
  it('renders an empty estimate for invalid inputs', () => {
    expect(formatDuration(Number.NaN)).toBe('--:--');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('--:--');
    expect(formatDuration(-1)).toBe('--:--');
  });

  it('formats minutes and seconds below one hour', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(4.2)).toBe('00:04');
    expect(formatDuration(59.6)).toBe('01:00');
    expect(formatDuration(601)).toBe('10:01');
  });

  it('keeps hours explicit above one hour', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(3661.6)).toBe('1:01:02');
    expect(formatDuration(7322)).toBe('2:02:02');
  });
});

describe('adjustmentProgress', () => {
  it('maps the setting value onto its meter span', () => {
    expect(adjustmentProgress('speed', 10)).toBe(0);
    expect(adjustmentProgress('speed', 155)).toBe(50);
    expect(adjustmentProgress('speed', 300)).toBe(100);
    expect(adjustmentProgress('fontSize', 20)).toBe(0);
    expect(adjustmentProgress('fontSize', 120)).toBe(100);
    expect(adjustmentProgress('horizontalMargin', 0)).toBe(0);
    expect(adjustmentProgress('horizontalMargin', 25)).toBe(100);
  });
});

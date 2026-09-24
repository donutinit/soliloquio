import { describe, expect, it } from 'vitest';
import { adjustmentProgress } from './prompterDisplay';

describe('adjustmentProgress', () => {
  it('maps the setting value onto its meter span', () => {
    expect(adjustmentProgress('speed', 40)).toBe(0);
    expect(adjustmentProgress('speed', 170)).toBe(50);
    expect(adjustmentProgress('speed', 300)).toBe(100);
    expect(adjustmentProgress('fontSize', 20)).toBe(0);
    expect(adjustmentProgress('fontSize', 120)).toBe(100);
    expect(adjustmentProgress('horizontalMargin', 0)).toBe(0);
    expect(adjustmentProgress('horizontalMargin', 25)).toBe(100);
  });
});

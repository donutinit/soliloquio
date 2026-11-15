import { describe, expect, it } from 'vitest';
import { positionAfterRelayout, type ReaderLayout } from './readingPlace';

const before: ReaderLayout = {
  maxPosition: 10_000,
  readingLine: 320,
  paddingTop: 360,
  anchors: [2_400, 6_000]
};

describe('positionAfterRelayout', () => {
  it('keeps the same fraction of the script on the reading line', () => {
    const after: ReaderLayout = { ...before, maxPosition: 11_000, anchors: [2_640, 6_600] };
    // The reading line was 4960 px into a 10000 px script; it becomes 5456 of 11000.
    expect(positionAfterRelayout(5_000, before, after)).toBeCloseTo(5_456 + 360 - 320);
  });

  it('follows the reading line when the viewport changes', () => {
    const after: ReaderLayout = {
      maxPosition: 10_000,
      readingLine: 160,
      paddingTop: 180,
      anchors: [2_220, 5_820]
    };
    expect(positionAfterRelayout(5_000, before, after)).toBeCloseTo(4_960 + 180 - 160);
  });

  it('stays on the pause or heading the reader rests on', () => {
    const after: ReaderLayout = { ...before, maxPosition: 12_000, anchors: [2_900, 7_100] };
    expect(positionAfterRelayout(6_000 - 320, before, after)).toBe(7_100 - 320);
  });

  it('leaves the start and unmeasured layouts alone', () => {
    const after: ReaderLayout = { ...before, maxPosition: 12_000 };
    expect(positionAfterRelayout(0, before, after)).toBe(0);
    const unmeasured = { ...before, maxPosition: Number.POSITIVE_INFINITY };
    expect(positionAfterRelayout(400, unmeasured, after)).toBe(400);
  });
});

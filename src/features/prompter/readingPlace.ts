/** What the reader measured the last time the script was laid out. */
export type ReaderLayout = {
  /** Scroll range, equal to the rendered script height. */
  maxPosition: number;
  /** Distance from the viewport top to the reading line. */
  readingLine: number;
  /** Space above the script title inside the scrolled content. */
  paddingTop: number;
  /** Offsets of the blocks the reader stops on: pauses, then section headings. */
  anchors: readonly number[];
};

/**
 * Scroll position that keeps the same text on the reading line after the
 * layout changes (text size, margins, rotation). A reader resting on a pause
 * or a heading stays on it, so a separator never stops twice; anything else
 * keeps its place as a fraction of the script height.
 */
export function positionAfterRelayout(
  position: number,
  before: ReaderLayout,
  after: ReaderLayout
): number {
  if (!(before.maxPosition > 0) || !Number.isFinite(before.maxPosition) || position <= 0) {
    return position;
  }
  if (before.anchors.length === after.anchors.length) {
    const index = before.anchors.findIndex(
      (offset) => Math.abs(offset - before.readingLine - position) < 1
    );
    if (index !== -1) return after.anchors[index] - after.readingLine;
  }
  const scriptOffset = position + before.readingLine - before.paddingTop;
  const scaled = scriptOffset * (Math.max(0, after.maxPosition) / before.maxPosition);
  return scaled + after.paddingTop - after.readingLine;
}

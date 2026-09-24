/** One positioned run of PDF text, as a PDF text layer reports it. */
export type PdfTextItem = {
  str: string;
  /** Baseline in PDF units; larger values are higher on the page. */
  y: number;
  height: number;
  hasEOL: boolean;
};

type Line = { text: string; y: number; height: number };

function pageLines(items: readonly PdfTextItem[]): Line[] {
  const lines: Line[] = [];
  let text = '';
  let y = Number.NaN;
  let height = 0;
  const flush = () => {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean) lines.push({ text: clean, y, height });
    text = '';
    y = Number.NaN;
    height = 0;
  };
  for (const item of items) {
    // A run on a clearly different baseline starts a new line even without an EOL flag.
    if (text && Number.isFinite(y) && Math.abs(item.y - y) > Math.max(item.height, height) * 0.5) {
      flush();
    }
    if (!Number.isFinite(y)) y = item.y;
    height = Math.max(height, item.height);
    text += item.str;
    if (item.hasEOL) flush();
  }
  flush();
  return lines;
}

function median(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Joins wrapped lines, removing hyphens that only split a word across lines. */
function joinLines(lines: readonly string[]): string {
  let out = '';
  for (const line of lines) {
    if (!out) out = line;
    else if (/[\p{L}]-$/u.test(out) && /^\p{Ll}/u.test(line)) out = out.slice(0, -1) + line;
    else out += ` ${line}`;
  }
  return out;
}

/**
 * Rebuilds paragraphs from a PDF's positioned text: lines closer than about
 * one and a half line spacings stay together, larger gaps and page breaks
 * start a new paragraph, and bare page numbers are dropped.
 */
export function pdfPagesToText(pages: readonly (readonly PdfTextItem[])[]): string {
  const paragraphs: string[] = [];
  for (const items of pages) {
    const lines = pageLines(items).filter((line) => !/^(?:page\s*)?\d{1,4}(?:\s*(?:of|\/)\s*\d{1,4})?$/i.test(line.text));
    const gaps: number[] = [];
    for (let index = 1; index < lines.length; index += 1) {
      const gap = lines[index - 1].y - lines[index].y;
      if (gap > 0) gaps.push(gap);
    }
    const spacing = median(gaps);
    let current: string[] = [];
    lines.forEach((line, index) => {
      const gap = index > 0 ? lines[index - 1].y - line.y : 0;
      const breaks =
        index > 0 &&
        (gap <= 0 || (Number.isFinite(spacing) ? gap > spacing * 1.45 : gap > line.height * 1.8));
      if (breaks && current.length > 0) {
        paragraphs.push(joinLines(current));
        current = [];
      }
      current.push(line.text);
    });
    if (current.length > 0) paragraphs.push(joinLines(current));
  }
  return paragraphs.filter(Boolean).join('\n\n');
}

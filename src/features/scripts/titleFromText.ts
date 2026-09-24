const MAX_DERIVED_TITLE = 80;

/** First non-empty line of pasted text, without Markdown heading or quote markers. */
export function titleFromText(text: string): string {
  for (const line of text.split('\n')) {
    const clean = line.replace(/^\s*(?:#{1,6}\s+|>\s*)/, '').trim();
    if (clean) return clean.slice(0, MAX_DERIVED_TITLE).trim();
  }
  return '';
}

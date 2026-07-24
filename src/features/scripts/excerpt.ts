const EXCERPT_LIMIT = 240;

export function scriptExcerpt(content: string): string {
  const cleaned = content.replace(/[#>*`|-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= EXCERPT_LIMIT) return cleaned;

  const candidate = cleaned.slice(0, EXCERPT_LIMIT + 1);
  const lastWordBoundary = candidate.lastIndexOf(' ');
  return candidate.slice(0, lastWordBoundary > 0 ? lastWordBoundary : EXCERPT_LIMIT).trimEnd();
}

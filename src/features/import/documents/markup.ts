const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  iexcl: '¡',
  iquest: '¿',
  copy: '©',
  reg: '®',
  trade: '™',
  deg: '°',
  bull: '•',
  middot: '·',
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  Aacute: 'Á',
  Eacute: 'É',
  Iacute: 'Í',
  Oacute: 'Ó',
  Uacute: 'Ú',
  ntilde: 'ñ',
  Ntilde: 'Ñ',
  uuml: 'ü',
  Uuml: 'Ü',
  agrave: 'à',
  egrave: 'è',
  ccedil: 'ç'
};

function codePointToString(code: number): string {
  return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
}

/** Decodes XML/HTML character references; unknown named entities stay as written. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10);
      return codePointToString(code) || match;
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

/** Value of one attribute inside an XML start tag, entity-decoded. */
export function attribute(tag: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`\\s${escaped}\\s*=\\s*("([^"]*)"|'([^']*)')`).exec(tag);
  if (!match) return null;
  return decodeEntities(match[2] ?? match[3] ?? '');
}

/**
 * Escapes text that must stay literal inside the Markdown a document becomes:
 * inline markers are backslash-escaped, and a line that would start a heading,
 * note, list, or pause keeps its first character literal.
 */
export function escapeMarkdown(text: string): string {
  return text
    .replace(/[\\`*_[\]<>|~]/g, '\\$&')
    .replace(/^(\s*)([#+=-])/gm, '$1\\$2')
    .replace(/^(\s*\d+)([.)])/gm, '$1\\$2');
}

export type TextRun = { text: string; strong: boolean; emphasis: boolean };

/**
 * Serializes runs as Markdown, merging runs with equal marks and moving edge
 * spaces outside `**`/`*` so emphasis stays valid.
 */
export function runsToMarkdown(runs: readonly TextRun[]): string {
  const merged: TextRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const previous = merged[merged.length - 1];
    if (previous && previous.strong === run.strong && previous.emphasis === run.emphasis) {
      previous.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }
  return merged
    .map((run) => {
      const escaped = escapeMarkdown(run.text);
      if (!run.strong && !run.emphasis) return escaped;
      const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(escaped);
      const [lead, body, trail] = match ? [match[1], match[2], match[3]] : ['', escaped, ''];
      if (!body) return escaped;
      const marker = run.strong && run.emphasis ? '***' : run.strong ? '**' : '*';
      return `${lead}${marker}${body}${marker}${trail}`;
    })
    .join('');
}

/** Joins paragraphs with blank lines, dropping empty ones and collapsing inner whitespace. */
export function joinParagraphs(paragraphs: readonly string[]): string {
  return paragraphs
    .map((paragraph) => paragraph.replace(/[ \t\u00a0]+/g, ' ').replace(/ *\n */g, '\n').trim())
    .filter(Boolean)
    .join('\n\n');
}

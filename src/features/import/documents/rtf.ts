/** Destinations whose content is metadata, never visible body text. */
const SKIPPED_DESTINATIONS = new Set([
  'fonttbl',
  'colortbl',
  'stylesheet',
  'info',
  'pict',
  'object',
  'header',
  'footer',
  'headerl',
  'headerr',
  'footerl',
  'footerr',
  'footnote',
  'field',
  'fldinst',
  'listtable',
  'listoverridetable',
  'rsidtbl',
  'generator',
  'xmlnstbl',
  'themedata',
  'colorschememapping',
  'latentstyles',
  'datastore'
]);

const WINDOWS_1252: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ',
  0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘', 0x92: '’', 0x93: '“',
  0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›',
  0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ'
};

function byteToChar(byte: number): string {
  return WINDOWS_1252[byte] ?? String.fromCharCode(byte);
}

/**
 * Extracts the visible text of an RTF document as plain paragraphs. Handles
 * groups, skipped destinations, `\par`/`\line`, hex escapes (Windows-1252),
 * and `\uN` Unicode escapes with their fallback characters.
 */
export function rtfToText(rtf: string): string {
  if (!/^\s*\{\\rtf/.test(rtf)) throw new Error('This is not an RTF document');
  let out = '';
  const stack: { skip: boolean; unicodeSkip: number }[] = [];
  let skip = false;
  let unicodeSkip = 1;
  let pendingFallback = 0;
  let index = 0;
  const emit = (text: string) => {
    if (skip) return;
    if (pendingFallback > 0) {
      pendingFallback -= 1;
      return;
    }
    out += text;
  };

  while (index < rtf.length) {
    const char = rtf[index];
    if (char === '{') {
      stack.push({ skip, unicodeSkip });
      pendingFallback = 0;
      index += 1;
      if (rtf.startsWith('\\*', index)) skip = true;
      continue;
    }
    if (char === '}') {
      const previous = stack.pop();
      if (previous) ({ skip, unicodeSkip } = previous);
      pendingFallback = 0;
      index += 1;
      continue;
    }
    if (char === '\\') {
      const next = rtf[index + 1];
      if (next === '\\' || next === '{' || next === '}') {
        emit(next);
        index += 2;
        continue;
      }
      if (next === "'") {
        const byte = Number.parseInt(rtf.slice(index + 2, index + 4), 16);
        if (Number.isFinite(byte)) emit(byteToChar(byte));
        index += 4;
        continue;
      }
      if (next === '~') {
        emit('\u00a0');
        index += 2;
        continue;
      }
      if (next === '\n' || next === '\r') {
        emit('\n');
        index += 2;
        continue;
      }
      const control = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(index, index + 40));
      if (!control) {
        index += 2;
        continue;
      }
      index += control[0].length;
      const word = control[1];
      const parameter = control[2] === undefined ? null : Number(control[2]);
      if (SKIPPED_DESTINATIONS.has(word)) skip = true;
      else if (word === 'par' || word === 'sect' || word === 'page') emit('\n\n');
      else if (word === 'line') emit('\n');
      else if (word === 'tab' || word === 'cell') emit(' ');
      else if (word === 'row') emit('\n\n');
      else if (word === 'emdash') emit('—');
      else if (word === 'endash') emit('–');
      else if (word === 'lquote') emit('‘');
      else if (word === 'rquote') emit('’');
      else if (word === 'ldblquote') emit('“');
      else if (word === 'rdblquote') emit('”');
      else if (word === 'bullet') emit('•');
      else if (word === 'uc' && parameter !== null) unicodeSkip = parameter;
      else if (word === 'u' && parameter !== null) {
        emit(String.fromCharCode(parameter < 0 ? parameter + 65536 : parameter));
        pendingFallback = unicodeSkip;
      }
      continue;
    }
    if (char === '\n' || char === '\r') {
      index += 1;
      continue;
    }
    emit(char);
    index += 1;
  }

  return out
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/[ \t\u00a0]+/g, ' ').replace(/ *\n */g, '\n').trim())
    .filter(Boolean)
    .join('\n\n');
}

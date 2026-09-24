const TIMECODE = /^\s*(?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->/;

/**
 * Keeps only the spoken lines of SubRip (.srt) or WebVTT (.vtt) captions:
 * cue numbers, timecodes, headers, notes, and styling tags are dropped, and
 * consecutive cues flow together into paragraphs split at longer gaps.
 */
export function subtitlesToText(content: string): string {
  const cues: string[] = [];
  for (const block of content.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    if (/^(WEBVTT|NOTE|STYLE|REGION)\b/.test(lines[0])) continue;
    const timecodeIndex = lines.findIndex((line) => TIMECODE.test(line));
    const spoken = (timecodeIndex >= 0 ? lines.slice(timecodeIndex + 1) : lines)
      .map((line) => line.replace(/<[^>]+>/g, '').replace(/\{\\[^}]*\}/g, '').trim())
      .filter(Boolean);
    if (spoken.length > 0) cues.push(spoken.join(' '));
  }
  // Group cues into readable paragraphs of a few sentences each.
  const paragraphs: string[] = [];
  let current = '';
  for (const cue of cues) {
    current = current ? `${current} ${cue}` : cue;
    if (current.length > 400 && /[.!?…]["”’)]?$/.test(cue)) {
      paragraphs.push(current);
      current = '';
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs.join('\n\n');
}

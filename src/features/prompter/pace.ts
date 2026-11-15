import type { PrompterBlock, ScriptFormat } from '../../types';
import { timedPauseSeconds } from '../markdown/timedPause';
import { clampToLimit, type Limit } from '../settings/settings';

const WORD_PATTERN = /[\p{L}\p{N}]/u;
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;

/** Counts words that contain at least one letter or number. */
export function countWords(text: string): number {
  let count = 0;
  for (const token of text.split(/\s+/)) {
    if (WORD_PATTERN.test(token)) count += 1;
  }
  return count;
}

/** Words the reader speaks: headings, notes, and pauses are not read aloud. */
export function spokenWordCount(blocks: readonly PrompterBlock[]): number {
  let count = 0;
  for (const block of blocks) {
    if (block.type === 'text') count += countWords(block.text);
  }
  return count;
}

const ATX_HEADING = /^ {0,3}#{1,6}(?:\s|$)/;
const QUOTE = /^ {0,3}>/;
const EMPTY_QUOTE = /^ {0,3}>\s*$/;
const SETEXT_UNDERLINE = /^ {0,3}(?:=+|-+)[ \t]*$/;
const LIST_MARKER = /^ {0,3}(?:[-*+]|\d{1,9}[.)])(?:[ \t]+(?:\[[ xX]\][ \t]+)?|$)/;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const LINK_DEFINITION = /^ {0,3}\[(?!\^)[^\]]+\]:\s*\S/;
const FOOTNOTE_LABEL = /\[\^[^\]\s]+\]:?/g;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const HTML_TAG = /<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>/g;

function closesFence(line: string, fence: string): boolean {
  const trimmed = line.trim();
  return (
    line.search(/\S/) <= 3 &&
    trimmed.length >= fence.length &&
    [...trimmed].every((char) => char === fence[0])
  );
}

/**
 * Cheap estimate for the library and editor, without a full Markdown parse.
 * It skips what the reader does not speak: headings (also `Title` underlined
 * with `---` or `===`), notes with their continuation lines, separators, list
 * markers, fence lines, HTML, and footnote or link labels.
 */
export function estimateSpokenWords(content: string, format: ScriptFormat): number {
  if (format === 'text') return countWords(content);
  let count = 0;
  let fence: string | null = null;
  let inNote = false;
  // An underline turns the open top-level paragraph into a heading.
  let paragraph: 'none' | 'top' | 'list' = 'none';
  let paragraphWords = 0;
  for (const rawLine of content.replace(HTML_COMMENT, ' ').split(/\r?\n/)) {
    if (fence !== null) {
      if (closesFence(rawLine, fence)) fence = null;
      else count += countWords(rawLine);
      continue;
    }
    const opening = FENCE_OPEN.exec(rawLine);
    if (opening) {
      fence = opening[1];
      inNote = false;
      paragraph = 'none';
      continue;
    }
    const line = rawLine.replace(HTML_TAG, ' ');
    if (!line.trim()) {
      inNote = false;
      paragraph = 'none';
      continue;
    }
    if (paragraph === 'top' && SETEXT_UNDERLINE.test(line)) {
      count -= paragraphWords;
      paragraph = 'none';
      continue;
    }
    if (QUOTE.test(line)) {
      inNote = !EMPTY_QUOTE.test(line);
      paragraph = 'none';
      continue;
    }
    if (
      ATX_HEADING.test(line) ||
      THEMATIC_BREAK.test(line) ||
      timedPauseSeconds(line) !== undefined ||
      LINK_DEFINITION.test(line)
    ) {
      inNote = false;
      paragraph = 'none';
      continue;
    }
    // A line right under a note continues it, as Markdown reads it.
    if (inNote) continue;
    const marker = LIST_MARKER.exec(line);
    const words = countWords((marker ? line.slice(marker[0].length) : line).replace(FOOTNOTE_LABEL, ' '));
    count += words;
    if (marker) {
      paragraph = 'list';
    } else if (paragraph === 'top') {
      paragraphWords += words;
    } else if (paragraph === 'none') {
      paragraph = 'top';
      paragraphWords = words;
    }
  }
  return count;
}

/** Seconds that timed separators (`--- 5s`) hold the reader in total. */
export function timedPauseTotal(blocks: readonly PrompterBlock[]): number {
  let seconds = 0;
  for (const block of blocks) {
    if (block.type === 'pause' && block.seconds) seconds += block.seconds;
  }
  return seconds;
}

/**
 * Words-per-minute pace that makes a script last `targetSeconds`, counting
 * timed pauses as fixed time. The result is clamped to the speed limits, so
 * a target that is too short or too long returns the nearest possible pace.
 */
export function speedForDuration(
  words: number,
  targetSeconds: number,
  fixedSeconds: number,
  limit: Limit
): number {
  const speakingSeconds = targetSeconds - fixedSeconds;
  if (words <= 0 || !(targetSeconds > 0)) return clampToLimit(limit.default, limit);
  if (speakingSeconds <= 0) return limit.max;
  return clampToLimit((words / speakingSeconds) * 60, limit);
}

export function readingSeconds(words: number, wordsPerMinute: number): number {
  return wordsPerMinute > 0 ? (words / wordsPerMinute) * 60 : Number.NaN;
}

/**
 * Average scroll distance per spoken word in the rendered layout. It changes
 * with text size and margins, so converting through it keeps the configured
 * words-per-minute pace when either changes.
 */
export function pixelsPerWord(textHeight: number, words: number, fontSize: number): number {
  if (words > 0 && textHeight > 0) return textHeight / words;
  // Nothing to speak: assume two words per 1.35-line-height line.
  return (fontSize * 1.35) / 2;
}

export function pixelsPerSecond(wordsPerMinute: number, distancePerWord: number): number {
  return (wordsPerMinute / 60) * distancePerWord;
}

/** Compact m:ss (or h:mm:ss) reading time for cards and the editor. */
export function formatReadingTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '–';
  // Any speech at all reads as at least one second.
  const rounded = seconds > 0 ? Math.max(1, Math.round(seconds)) : 0;
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainder = String(rounded % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${remainder}`
    : `${minutes}:${remainder}`;
}

export function formatWordCount(words: number): string {
  return `${words.toLocaleString('en-US')} ${words === 1 ? 'word' : 'words'}`;
}

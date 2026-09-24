import type { PrompterBlock, ScriptFormat } from '../../types';
import { timedPauseSeconds } from '../markdown/timedPause';
import { clampToLimit, type Limit } from '../settings/settings';

const WORD_PATTERN = /[\p{L}\p{N}]/u;
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const NOTE_OR_HEADING = /^ {0,3}(?:#{1,6}(?:\s|$)|>)/;

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

/**
 * Cheap estimate for the library and editor, without a full Markdown parse:
 * skips headings, blockquote notes, and separators, like the reader does.
 */
export function estimateSpokenWords(content: string, format: ScriptFormat): number {
  if (format === 'text') return countWords(content);
  let count = 0;
  for (const line of content.split('\n')) {
    if (
      NOTE_OR_HEADING.test(line) ||
      THEMATIC_BREAK.test(line) ||
      timedPauseSeconds(line) !== undefined
    ) {
      continue;
    }
    count += countWords(line);
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

/** Longest hold a timed separator can request. */
export const MAX_TIMED_PAUSE_SECONDS = 60;

/** A separator followed by seconds on its own line: `--- 5s`. */
const TIMED_PAUSE = /^ {0,3}-{3,}[ \t]*(\d{1,3})[ \t]*s[ \t]*$/i;
const TIMED_PAUSE_LINES = new RegExp(TIMED_PAUSE.source, 'gim');

/**
 * Seconds requested by a timed separator line, or undefined when the text is
 * not one. `--- 0s` stays a regular pause that waits for START.
 */
export function timedPauseSeconds(line: string): number | undefined {
  const match = TIMED_PAUSE.exec(line);
  if (!match) return undefined;
  return Math.min(MAX_TIMED_PAUSE_SECONDS, Number(match[1]));
}

/**
 * Surrounds timed separators with blank lines so Markdown never folds them
 * into the previous paragraph as a lazy continuation line.
 */
export function isolateTimedPauses(content: string): string {
  return content.replace(TIMED_PAUSE_LINES, (line) => `\n\n${line.trim()}\n\n`);
}

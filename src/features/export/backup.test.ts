import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../settings/settings';
import { makeBackup, parseBackup } from './backup';

const script = {
  id: 'one',
  title: 'One',
  content: '# Hello',
  format: 'markdown' as const,
  createdAt: 1,
  updatedAt: 2
};

describe('Teleprompter backups', () => {
  it('round-trips scripts and settings', () => {
    const backup = makeBackup(
      [script],
      { ...defaultSettings(), speed: 90, countdownSeconds: 4 },
      '2026-01-01T00:00:00Z'
    );
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup);
  });

  it('rejects unknown and malformed files', () => {
    expect(() => parseBackup('nope')).toThrow('valid JSON');
    expect(() => parseBackup('{"kind":"something-else"}')).toThrow('not a supported');
    const backup = makeBackup([script], defaultSettings());
    expect(() => parseBackup(JSON.stringify({ ...backup, scripts: [{ title: 'broken' }] }))).toThrow(
      'invalid scripts'
    );
  });
});

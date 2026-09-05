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

describe('Soliloquio backups', () => {
  it('round-trips scripts and settings', () => {
    const backup = makeBackup(
      [script],
      { ...defaultSettings(), speed: 90, countdownSeconds: 4 },
      '2026-01-01T00:00:00Z'
    );
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup);
  });

  it('accepts legacy and unknown script fields but returns only canonical data', () => {
    const backup = makeBackup([script], defaultSettings(), '2026-01-01T00:00:00Z');
    const parsed = parseBackup(
      JSON.stringify({
        ...backup,
        scripts: [{ ...script, lastPosition: 480.5, futureMetadata: { source: 'legacy' } }]
      })
    );

    expect(parsed.scripts).toEqual([script]);
    expect(parsed.scripts[0]).not.toHaveProperty('lastPosition');
    expect(parsed.scripts[0]).not.toHaveProperty('futureMetadata');
  });

  it('defaults the card-title size when restoring an older backup', () => {
    const backup = makeBackup([script], defaultSettings(), '2026-01-01T00:00:00Z');
    const legacySettings: Partial<typeof backup.settings> = { ...backup.settings };
    delete legacySettings.scriptCardTitleSize;

    const parsed = parseBackup(JSON.stringify({ ...backup, settings: legacySettings }));

    expect(parsed.settings.scriptCardTitleSize).toBe(25);
  });

  it('does not emit retired reading-position data in new backups', () => {
    const legacyRuntimeScript = { ...script, lastPosition: 480.5 };
    const backup = makeBackup([legacyRuntimeScript], defaultSettings());

    expect(backup.scripts).toEqual([script]);
    expect(backup.scripts[0]).not.toHaveProperty('lastPosition');
  });

  it('rejects unknown and malformed files', () => {
    expect(() => parseBackup('nope')).toThrow('valid JSON');
    expect(() => parseBackup('{"kind":"something-else"}')).toThrow('not a supported');
    const backup = makeBackup([script], defaultSettings());
    expect(() => parseBackup(JSON.stringify({ ...backup, scripts: [{ title: 'broken' }] }))).toThrow(
      'invalid scripts'
    );
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...backup,
          scripts: [{ ...script, updatedAt: Number.MAX_VALUE }]
        })
      )
    ).toThrow('invalid scripts');
    expect(() =>
      parseBackup(JSON.stringify({ ...backup, scripts: [{ ...script, id: '  ' }] }))
    ).toThrow('invalid scripts');
  });
});

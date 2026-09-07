import { describe, expect, it } from 'vitest';
import {
  CANONICAL_APP_ORIGIN,
  isLegacyAppOrigin
} from './originMigration';

describe('app origin migration', () => {
  it('recognizes only the retired public hostname', () => {
    expect(isLegacyAppOrigin('soli.vondiego.com')).toBe(true);
    expect(isLegacyAppOrigin('SOLI.VONDIEGO.COM')).toBe(true);
    expect(isLegacyAppOrigin('tele.vondiego.com')).toBe(false);
    expect(isLegacyAppOrigin('127.0.0.1')).toBe(false);
  });

  it('keeps the documented canonical origin explicit', () => {
    expect(CANONICAL_APP_ORIGIN).toBe('https://tele.vondiego.com');
  });
});

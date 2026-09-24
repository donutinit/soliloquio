import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestPersistentStorage } from './persistentStorage';

describe('requestPersistentStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when the Storage API is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('does not ask again when storage is already persistent', async () => {
    const persist = vi.fn(async () => true);
    vi.stubGlobal('navigator', { storage: { persist, persisted: async () => true } });
    await expect(requestPersistentStorage()).resolves.toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('requests persistence and survives a rejected request', async () => {
    vi.stubGlobal('navigator', {
      storage: { persist: async () => Promise.reject(new Error('denied')), persisted: async () => false }
    });
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });
});

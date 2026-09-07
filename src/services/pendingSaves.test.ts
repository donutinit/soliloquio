import { describe, expect, it, vi } from 'vitest';
import { flushPendingSaves, registerPendingSaveFlush } from './pendingSaves';

describe('pending save flushes', () => {
  it('waits for every registered save', async () => {
    const first = vi.fn(async () => undefined);
    const second = vi.fn(async () => undefined);
    const unregisterFirst = registerPendingSaveFlush(first);
    const unregisterSecond = registerPendingSaveFlush(second);

    await expect(flushPendingSaves()).resolves.toBeUndefined();
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();

    unregisterFirst();
    unregisterSecond();
  });

  it('rejects when any pending save fails', async () => {
    const failure = new Error('IndexedDB is full');
    const unregister = registerPendingSaveFlush(async () => {
      throw failure;
    });

    await expect(flushPendingSaves()).rejects.toBe(failure);
    unregister();
  });

  it('stops invoking a flush after it is unregistered', async () => {
    const flush = vi.fn(async () => undefined);
    const unregister = registerPendingSaveFlush(flush);
    unregister();

    await flushPendingSaves();
    expect(flush).not.toHaveBeenCalled();
  });
});

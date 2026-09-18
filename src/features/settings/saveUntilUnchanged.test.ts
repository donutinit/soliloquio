import { describe, expect, it, vi } from 'vitest';
import { saveUntilUnchanged } from './saveUntilUnchanged';

describe('saveUntilUnchanged', () => {
  it('stores a change made during an in-flight write before it resolves', async () => {
    const first = { speed: 55 };
    const second = { speed: 60 };
    let current = first;
    let finishFirst: (() => void) | undefined;
    const save = vi.fn((value: typeof first) =>
      value === first
        ? new Promise<void>((resolve) => { finishFirst = resolve; })
        : Promise.resolve()
    );

    const pending = saveUntilUnchanged(() => current, save);
    current = second;
    finishFirst?.();
    await pending;

    expect(save.mock.calls.map(([value]) => value)).toEqual([first, second]);
  });

  it('rejects when the newest value could not be stored', async () => {
    await expect(saveUntilUnchanged(() => 1, async () => {
      throw new Error('storage full');
    })).rejects.toThrow('storage full');
  });
});

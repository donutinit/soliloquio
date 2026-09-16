import { describe, expect, it, vi } from 'vitest';
import { DraftSaveQueue, type EditableScript } from './draftSaveQueue';

describe('editor draft saves', () => {
  it('waits for an in-flight write before accepting a reverted draft as saved', async () => {
    const original = { title: 'Original', content: 'First version' };
    let current: EditableScript = { title: 'Changed', content: 'Second version' };
    let releaseWrite: (() => void) | undefined;
    let notifyWriteStarted: (() => void) | undefined;
    const writeStarted = new Promise<void>((resolve) => { notifyWriteStarted = resolve; });
    const heldWrite = new Promise<void>((resolve) => { releaseWrite = resolve; });
    const writes: EditableScript[] = [];
    const queue = new DraftSaveQueue(
      original,
      () => current,
      async (draft) => {
        writes.push(draft);
        if (writes.length === 1) {
          notifyWriteStarted?.();
          await heldWrite;
        }
      },
      () => undefined
    );

    const firstFlush = queue.flush();
    await writeStarted;
    current = original;
    expect(queue.isCurrentSaved()).toBe(false);
    const secondFlush = queue.flush();
    releaseWrite?.();
    await Promise.all([firstFlush, secondFlush]);

    expect(writes).toEqual([
      { title: 'Changed', content: 'Second version' },
      original
    ]);
    expect(queue.isCurrentSaved()).toBe(true);
  });

  it('includes edits made while a write is pending in the same flush', async () => {
    let current: EditableScript = { title: 'Draft', content: 'One' };
    let releaseWrite: (() => void) | undefined;
    let notifyWriteStarted: (() => void) | undefined;
    const writeStarted = new Promise<void>((resolve) => { notifyWriteStarted = resolve; });
    const heldWrite = new Promise<void>((resolve) => { releaseWrite = resolve; });
    const save = vi.fn(async (draft: EditableScript) => {
      if (draft.content === 'One') {
        notifyWriteStarted?.();
        await heldWrite;
      }
    });
    const queue = new DraftSaveQueue(
      { title: 'Draft', content: '' },
      () => current,
      save,
      () => undefined
    );

    const flush = queue.flush();
    await writeStarted;
    current = { title: 'Draft', content: 'Two' };
    releaseWrite?.();
    await flush;

    expect(save.mock.calls.map(([draft]) => draft.content)).toEqual(['One', 'Two']);
    expect(queue.isCurrentSaved()).toBe(true);
  });

  it('allows a failed write to be retried', async () => {
    const current = { title: 'Draft', content: 'Unsaved' };
    const save = vi.fn(async (_draft: EditableScript) => undefined)
      .mockRejectedValueOnce(new Error('storage full'))
      .mockResolvedValue(undefined);
    const queue = new DraftSaveQueue(
      { title: 'Draft', content: '' },
      () => current,
      save,
      () => undefined
    );

    await expect(queue.flush()).rejects.toThrow('storage full');
    expect(queue.isCurrentSaved()).toBe(false);
    await expect(queue.flush()).resolves.toBeUndefined();
    expect(save).toHaveBeenCalledTimes(2);
    expect(queue.isCurrentSaved()).toBe(true);
  });
});

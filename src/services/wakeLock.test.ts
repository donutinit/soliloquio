import { describe, expect, it } from 'vitest';
import { createWakeLock } from './wakeLock';

class FakeDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';
}

class FakeSentinel extends EventTarget {
  released = false;
  type: WakeLockType = 'screen';

  async release(): Promise<void> {
    if (this.released) return;
    this.released = true;
    this.dispatchEvent(new Event('release'));
  }
}

describe('createWakeLock', () => {
  it('requests a new sentinel after the browser releases the old one while hidden', async () => {
    const currentDocument = new FakeDocument();
    const sentinels: FakeSentinel[] = [];
    const currentNavigator = {
      wakeLock: {
        request: async () => {
          const sentinel = new FakeSentinel();
          sentinels.push(sentinel);
          return sentinel;
        }
      }
    };
    const lock = createWakeLock(
      currentDocument as unknown as Document,
      currentNavigator as unknown as Navigator
    );

    await lock.acquire();
    expect(sentinels).toHaveLength(1);

    currentDocument.visibilityState = 'hidden';
    await sentinels[0].release();
    currentDocument.visibilityState = 'visible';
    currentDocument.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    await Promise.resolve();

    expect(sentinels).toHaveLength(2);
    lock.destroy();
  });
});

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

async function settleWakeLockRequests(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function createDeferred<T>() {
  let resolvePromise: (value: T) => void = () => {
    throw new Error('Deferred promise was resolved before initialization.');
  };
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

describe('createWakeLock', () => {
  it('reacquires after the browser releases the sentinel while the page remains visible', async () => {
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
    const lock = createWakeLock(currentDocument, currentNavigator);

    await lock.acquire();
    await sentinels[0].release();
    await settleWakeLockRequests();

    expect(sentinels).toHaveLength(2);
    lock.destroy();
  });

  it('waits for new activity after a consecutive visible release', async () => {
    const currentDocument = new FakeDocument();
    const currentPage = new EventTarget();
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
    const lock = createWakeLock(currentDocument, currentNavigator, currentPage);

    await lock.acquire();
    await sentinels[0].release();
    await settleWakeLockRequests();
    expect(sentinels).toHaveLength(2);

    await sentinels[1].release();
    await settleWakeLockRequests();
    expect(sentinels).toHaveLength(2);

    currentPage.dispatchEvent(new Event('click'));
    await settleWakeLockRequests();
    expect(sentinels).toHaveLength(3);
    lock.destroy();
  });

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
    const lock = createWakeLock(currentDocument, currentNavigator);

    await lock.acquire();
    expect(sentinels).toHaveLength(1);

    currentDocument.visibilityState = 'hidden';
    await sentinels[0].release();
    currentDocument.visibilityState = 'visible';
    currentDocument.dispatchEvent(new Event('visibilitychange'));
    await settleWakeLockRequests();

    expect(sentinels).toHaveLength(2);
    lock.destroy();
  });

  it('retries a transient denied request on the next page interaction', async () => {
    const currentDocument = new FakeDocument();
    const currentPage = new EventTarget();
    const sentinel = new FakeSentinel();
    let requests = 0;
    const currentNavigator = {
      wakeLock: {
        request: async () => {
          requests += 1;
          if (requests === 1) throw new Error('Temporarily denied');
          return sentinel;
        }
      }
    };
    const lock = createWakeLock(currentDocument, currentNavigator, currentPage);

    await lock.acquire();
    expect(requests).toBe(1);

    currentPage.dispatchEvent(new Event('click'));
    await settleWakeLockRequests();

    expect(requests).toBe(2);
    expect(sentinel.released).toBe(false);

    currentPage.dispatchEvent(new Event('click'));
    await settleWakeLockRequests();
    expect(requests).toBe(2);
    lock.destroy();
  });

  it('stays a no-op when the Screen Wake Lock API is unavailable', async () => {
    const currentDocument = new FakeDocument();
    const currentPage = new EventTarget();
    const lock = createWakeLock(currentDocument, {}, currentPage);

    await expect(lock.acquire()).resolves.toBeUndefined();
    currentPage.dispatchEvent(new Event('click'));
    currentDocument.dispatchEvent(new Event('visibilitychange'));
    await settleWakeLockRequests();
    await expect(lock.release()).resolves.toBeUndefined();

    lock.destroy();
  });

  it('releases a sentinel that arrives after the setting was disabled', async () => {
    const currentDocument = new FakeDocument();
    const deferredSentinel = createDeferred<FakeSentinel>();
    const currentNavigator = {
      wakeLock: {
        request: () => deferredSentinel.promise
      }
    };
    const lock = createWakeLock(currentDocument, currentNavigator);

    const acquiring = lock.acquire();
    const releasing = lock.release();
    const sentinel = new FakeSentinel();
    deferredSentinel.resolve(sentinel);
    await Promise.all([acquiring, releasing]);

    expect(sentinel.released).toBe(true);
    lock.destroy();
  });
});

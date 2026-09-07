import { beforeEach, describe, expect, it, vi } from 'vitest';

const serviceWorkerUpdate = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn(() => serviceWorkerUpdate)
}));

describe('PWA update application', () => {
  beforeEach(() => {
    vi.resetModules();
    serviceWorkerUpdate.mockClear();
  });

  it('does not reload when a pending save rejects', async () => {
    const { registerPendingSaveFlush } = await import('./pendingSaves');
    const { applyPendingPWAUpdate, setupPWA, subscribeToPWAUpdateError } = await import('./pwa');
    const errorMessages: Array<string | null> = [];
    const unregisterListener = subscribeToPWAUpdateError((message) => errorMessages.push(message));
    const unregisterSave = registerPendingSaveFlush(async () => {
      throw new Error('storage full');
    });
    setupPWA();

    await expect(applyPendingPWAUpdate()).rejects.toThrow('storage full');
    expect(serviceWorkerUpdate).not.toHaveBeenCalled();
    expect(errorMessages.at(-1)).toContain('Update paused');

    unregisterSave();
    unregisterListener();
  });

  it('reloads only after every pending save succeeds', async () => {
    const { registerPendingSaveFlush } = await import('./pendingSaves');
    const { applyPendingPWAUpdate, setupPWA } = await import('./pwa');
    const flush = vi.fn(async () => undefined);
    const unregister = registerPendingSaveFlush(flush);
    setupPWA();

    await applyPendingPWAUpdate();
    expect(flush).toHaveBeenCalledOnce();
    expect(serviceWorkerUpdate).toHaveBeenCalledWith(true);

    unregister();
  });
});

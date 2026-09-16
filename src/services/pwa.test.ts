import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const serviceWorkerUpdate = vi.hoisted(() => vi.fn(async () => undefined));
const registrationCheck = vi.hoisted(() => vi.fn(async () => 'up-to-date' as const));

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn(() => serviceWorkerUpdate)
}));
vi.mock('./pwaUpdate', () => ({ checkRegistrationForUpdate: registrationCheck }));

describe('PWA update application', () => {
  beforeEach(() => {
    vi.resetModules();
    serviceWorkerUpdate.mockClear();
    registrationCheck.mockReset();
    registrationCheck.mockResolvedValue('up-to-date');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
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

  it('checks on opening and foreground return without polling while open', async () => {
    const page = new EventTarget();
    let visibility: DocumentVisibilityState = 'visible';
    Object.defineProperty(page, 'visibilityState', { get: () => visibility });
    vi.stubGlobal('document', page);
    vi.useFakeTimers();

    const { setupPWA } = await import('./pwa');
    const { registerSW } = await import('virtual:pwa-register');
    setupPWA();
    const onRegistered = vi.mocked(registerSW).mock.calls[0]?.[0]?.onRegisteredSW;
    expect(onRegistered).toBeDefined();
    onRegistered?.('/sw.js', new EventTarget() as ServiceWorkerRegistration);
    expect(registrationCheck).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(registrationCheck).toHaveBeenCalledOnce();

    visibility = 'hidden';
    page.dispatchEvent(new Event('visibilitychange'));
    expect(registrationCheck).toHaveBeenCalledOnce();

    visibility = 'visible';
    page.dispatchEvent(new Event('visibilitychange'));
    expect(registrationCheck).toHaveBeenCalledTimes(2);
  });

  it('shares an in-flight automatic check with the manual action', async () => {
    const page = new EventTarget();
    Object.defineProperty(page, 'visibilityState', { value: 'visible' });
    vi.stubGlobal('document', page);
    vi.stubGlobal('navigator', { onLine: true, serviceWorker: {} });

    let finishCheck: ((result: 'up-to-date') => void) | undefined;
    registrationCheck.mockImplementation(
      () => new Promise<'up-to-date'>((resolve) => { finishCheck = resolve; })
    );

    const { checkForPWAUpdate, setupPWA } = await import('./pwa');
    const { registerSW } = await import('virtual:pwa-register');
    setupPWA();
    const onRegistered = vi.mocked(registerSW).mock.calls[0]?.[0]?.onRegisteredSW;
    const registration = new EventTarget() as ServiceWorkerRegistration;
    Object.defineProperty(registration, 'active', { value: { scriptURL: '/sw.js' } });
    onRegistered?.('/sw.js', registration);

    const manualCheck = checkForPWAUpdate();
    expect(registrationCheck).toHaveBeenCalledOnce();
    finishCheck?.('up-to-date');
    await expect(manualCheck).resolves.toBe('up-to-date');

    await checkForPWAUpdate();
    expect(registrationCheck).toHaveBeenCalledTimes(2);
  });
});

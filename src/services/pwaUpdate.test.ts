import { describe, expect, it, vi } from 'vitest';
import { checkRegistrationForUpdate } from './pwaUpdate';

function createRegistration(
  update: (registration: ServiceWorkerRegistration) => Promise<void> = async () => undefined
): ServiceWorkerRegistration {
  const registration = new EventTarget() as ServiceWorkerRegistration;
  Object.defineProperties(registration, {
    active: { configurable: true, value: {}, writable: true },
    installing: { configurable: true, value: null, writable: true },
    waiting: { configurable: true, value: null, writable: true },
    update: {
      configurable: true,
      value: vi.fn(async () => {
        await update(registration);
        return registration;
      })
    }
  });
  return registration;
}

const availableResponse = async () => ({ ok: true, status: 200 });

describe('checkRegistrationForUpdate', () => {
  it('bypasses the HTTP cache before asking the registration to update', async () => {
    const registration = createRegistration();
    const fetcher = vi.fn(availableResponse);

    await expect(checkRegistrationForUpdate(registration, '/sw.js', fetcher)).resolves.toBe(
      'up-to-date'
    );
    expect(fetcher).toHaveBeenCalledWith('/sw.js', {
      cache: 'no-store',
      headers: { cache: 'no-store', 'cache-control': 'no-cache' }
    });
    expect(registration.update).toHaveBeenCalledOnce();
  });

  it('reports when the browser starts installing a new worker', async () => {
    const registration = createRegistration(async (currentRegistration) => {
      Object.defineProperty(currentRegistration, 'installing', { value: {}, writable: true });
      currentRegistration.dispatchEvent(new Event('updatefound'));
    });

    await expect(
      checkRegistrationForUpdate(registration, '/sw.js', availableResponse)
    ).resolves.toBe('updating');
  });

  it('does not run a browser update when the worker cannot be fetched', async () => {
    const registration = createRegistration();
    const unavailableResponse = async () => ({ ok: false, status: 503 });

    await expect(
      checkRegistrationForUpdate(registration, '/sw.js', unavailableResponse)
    ).rejects.toThrow('Service worker request failed (503)');
    expect(registration.update).not.toHaveBeenCalled();
  });
});

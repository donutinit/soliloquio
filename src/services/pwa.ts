import { registerSW } from 'virtual:pwa-register';
import { checkRegistrationForUpdate } from './pwaUpdate';
import { flushPendingSaves } from './pendingSaves';

/** Sin backend no hay push: la app sondea el Service Worker con esta cadencia. */
const UPDATE_CHECK_INTERVAL_MS = 60_000;
const REGISTRATION_WAIT_MS = 5_000;

export type PWAUpdateResult = 'up-to-date' | 'updating' | 'unsupported' | 'not-ready';
export type PWAUpdateErrorListener = (message: string | null) => void;

let setupStarted = false;
let serviceWorkerUrl: string | null = null;
let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
let applyServiceWorkerUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null;
let updateError: string | null = null;
const updateErrorListeners = new Set<PWAUpdateErrorListener>();

const SAVE_FAILURE_MESSAGE =
  'Update paused because your latest changes could not be saved. Free device storage, then retry.';

function setUpdateError(message: string | null): void {
  updateError = message;
  for (const listener of updateErrorListeners) listener(message);
}

export function subscribeToPWAUpdateError(listener: PWAUpdateErrorListener): () => void {
  updateErrorListeners.add(listener);
  listener(updateError);
  return () => {
    updateErrorListeners.delete(listener);
  };
}

export async function applyPendingPWAUpdate(): Promise<void> {
  if (!applyServiceWorkerUpdate) throw new Error('The app update is not ready');
  try {
    await flushPendingSaves();
  } catch (error) {
    setUpdateError(SAVE_FAILURE_MESSAGE);
    throw error;
  }
  setUpdateError(null);
  await applyServiceWorkerUpdate(true);
}

async function findRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (serviceWorkerRegistration) return serviceWorkerRegistration;
  if (!('serviceWorker' in navigator)) return null;

  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (registration: ServiceWorkerRegistration | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(registration);
    };
    const timer = setTimeout(() => finish(null), REGISTRATION_WAIT_MS);
    void navigator.serviceWorker.ready.then(
      (registration) => finish(registration),
      () => finish(null)
    );
  });
}

/** Performs an explicit server check from the App Settings button. */
export async function checkForPWAUpdate(): Promise<PWAUpdateResult> {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  if (!navigator.onLine) throw new Error('The device is offline');

  const registration = await findRegistration();
  if (!registration) return 'not-ready';
  serviceWorkerRegistration = registration;
  if (!registration.active) return 'not-ready';
  const swUrl = serviceWorkerUrl ?? registration.active?.scriptURL;
  if (!swUrl) return 'not-ready';

  const result = await checkRegistrationForUpdate(registration, swUrl);
  if (result === 'updating' && registration.waiting && applyServiceWorkerUpdate) {
    await applyPendingPWAUpdate();
  }
  return result;
}

/**
 * Auto-update: cuando se detecta una versión nueva se vacían primero los
 * guardados pendientes y la página se recarga sola. La detección ocurre al
 * abrir la app, al volver a primer plano y periódicamente mientras está
 * abierta (solo en primer plano: el retorno ya dispara su propia comprobación).
 */
export function setupPWA(): void {
  if (setupStarted) return;
  setupStarted = true;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      void applyPendingPWAUpdate().catch((error) => {
        console.warn('App update paused until pending saves succeed', error);
      });
    },
    onOfflineReady() {
      // La app ya funciona sin conexión; no hace falta molestar al usuario.
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      serviceWorkerUrl = _swUrl;
      serviceWorkerRegistration = registration;
      const check = () => {
        if (document.visibilityState !== 'visible') return;
        checkRegistrationForUpdate(registration, _swUrl).catch((error) => {
          console.warn('Background update check failed', error);
        });
      };
      setInterval(check, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    }
  });
  applyServiceWorkerUpdate = updateSW;
}

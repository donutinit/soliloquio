/**
 * Mantiene la pantalla encendida mientras la app está abierta. Si la API no existe o falla
 * (Safari antiguo, ahorro de energía), la app sigue funcionando sin ella.
 */
type WakeLockPage = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
type WakeLockDocument = WakeLockPage & Pick<Document, 'visibilityState'>;
type WakeLockSentinelLike = {
  readonly released: boolean;
  addEventListener(
    type: 'release',
    listener: () => void,
    options?: AddEventListenerOptions
  ): void;
  release(): Promise<void>;
};
type WakeLockNavigator = {
  readonly wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinelLike>;
  };
};

export function createWakeLock(
  currentDocument: WakeLockDocument = document,
  currentNavigator: WakeLockNavigator = navigator,
  currentPage?: WakeLockPage
) {
  const page: WakeLockPage =
    currentPage ?? (typeof window === 'undefined' ? currentDocument : window);
  let sentinel: WakeLockSentinelLike | null = null;
  let wanted = false;
  let destroyed = false;
  let requestInFlight: Promise<void> | null = null;
  let requestScheduled = false;
  let releaseRetryAvailable = true;

  function shouldRequest(): boolean {
    return (
      wanted &&
      !destroyed &&
      Boolean(currentNavigator.wakeLock) &&
      currentDocument.visibilityState === 'visible' &&
      (!sentinel || sentinel.released)
    );
  }

  function scheduleRequest(): void {
    if (!shouldRequest() || requestScheduled) return;
    requestScheduled = true;
    queueMicrotask(() => {
      requestScheduled = false;
      if (shouldRequest()) void request();
    });
  }

  async function request(): Promise<void> {
    if (!shouldRequest()) return;
    if (requestInFlight) return requestInFlight;
    const wakeLockManager = currentNavigator.wakeLock;
    if (!wakeLockManager) return;
    if (sentinel?.released) sentinel = null;

    requestInFlight = (async () => {
      try {
        const acquired = await wakeLockManager.request('screen');
        if (
          !wanted ||
          destroyed ||
          currentDocument.visibilityState !== 'visible' ||
          acquired.released
        ) {
          if (!acquired.released) {
            try {
              await acquired.release();
            } catch {
              // Ignorado: el navegador pudo liberarlo durante la solicitud.
            }
          }
          return;
        }

        sentinel = acquired;
        acquired.addEventListener(
          'release',
          () => {
            if (sentinel !== acquired) return;
            sentinel = null;
            // iOS puede liberar el sentinel aun con la app visible. Se hace un
            // solo reintento ansioso por activación para evitar un bucle si la
            // política del sistema sigue rechazándolo; la próxima interacción,
            // vuelta a foreground o acquire() habilita otro intento.
            if (releaseRetryAvailable) {
              releaseRetryAvailable = false;
              scheduleRequest();
            }
          },
          { once: true }
        );
      } catch {
        sentinel = null;
      } finally {
        requestInFlight = null;
      }
    })();
    return requestInFlight;
  }

  function onPageActive(): void {
    releaseRetryAvailable = true;
    scheduleRequest();
  }

  currentDocument.addEventListener('visibilitychange', onPageActive);
  page.addEventListener('pageshow', onPageActive);
  page.addEventListener('focus', onPageActive);
  // También cubre acciones táctiles y los clicks sintéticos de navegación con mando.
  // Si el lock sigue activo, shouldRequest() hace que este listener no tenga costo.
  page.addEventListener('click', onPageActive);

  async function release(): Promise<void> {
    wanted = false;
    const current = sentinel;
    sentinel = null;
    if (current && !current.released) {
      try {
        await current.release();
      } catch {
        // Ignorado: el sentinel ya podía estar liberado.
      }
    }

    // Si se desactivó el ajuste durante request(), esa solicitud se libera al
    // resolverse. Esperarla evita que release() termine dejando un lock tardío.
    const pending = requestInFlight;
    if (pending) await pending;
    if (wanted) return;

    const acquiredWhileReleasing = sentinel;
    sentinel = null;
    if (acquiredWhileReleasing && !acquiredWhileReleasing.released) {
      try {
        await acquiredWhileReleasing.release();
      } catch {
        // Ignorado: el sentinel ya podía estar liberado.
      }
    }
  }

  return {
    async acquire() {
      if (destroyed) return;
      wanted = true;
      releaseRetryAvailable = true;
      if (!sentinel || sentinel.released) await request();
    },
    release,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      currentDocument.removeEventListener('visibilitychange', onPageActive);
      page.removeEventListener('pageshow', onPageActive);
      page.removeEventListener('focus', onPageActive);
      page.removeEventListener('click', onPageActive);
      void release();
    }
  };
}

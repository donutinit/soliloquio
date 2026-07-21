/**
 * Mantiene la pantalla encendida mientras la app está abierta. Si la API no existe o falla
 * (Safari antiguo, ahorro de energía), la app sigue funcionando sin ella.
 */
type WakeLockDocument = Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;
type WakeLockNavigator = Pick<Navigator, 'wakeLock'>;

export function createWakeLock(
  currentDocument: WakeLockDocument = document,
  currentNavigator: WakeLockNavigator = navigator
) {
  let sentinel: WakeLockSentinel | null = null;
  let wanted = false;
  let requestInFlight: Promise<void> | null = null;

  async function request(): Promise<void> {
    if (!currentNavigator.wakeLock || currentDocument.visibilityState !== 'visible') return;
    if (requestInFlight) return requestInFlight;
    requestInFlight = (async () => {
      try {
        const acquired = await currentNavigator.wakeLock.request('screen');
        sentinel = acquired;
        acquired.addEventListener(
          'release',
          () => {
            if (sentinel === acquired) sentinel = null;
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

  async function onVisibilityChange(): Promise<void> {
    if (
      wanted &&
      currentDocument.visibilityState === 'visible' &&
      (!sentinel || sentinel.released)
    ) {
      await request();
    }
  }

  currentDocument.addEventListener('visibilitychange', onVisibilityChange);

  return {
    async acquire() {
      wanted = true;
      if (!sentinel || sentinel.released) await request();
    },
    async release() {
      wanted = false;
      const current = sentinel;
      sentinel = null;
      if (current) {
        try {
          await current.release();
        } catch {
          // ignorado: el sentinel ya podía estar liberado
        }
      }
    },
    destroy() {
      currentDocument.removeEventListener('visibilitychange', onVisibilityChange);
      void this.release();
    }
  };
}

/**
 * Mantiene la pantalla encendida mientras se lee. Si la API no existe o falla
 * (Safari antiguo, ahorro de energía), la app sigue funcionando sin ella.
 */
export function createWakeLock() {
  let sentinel: WakeLockSentinel | null = null;
  let wanted = false;

  async function request(): Promise<void> {
    if (!('wakeLock' in navigator)) return;
    try {
      sentinel = await navigator.wakeLock.request('screen');
    } catch {
      sentinel = null;
    }
  }

  async function onVisibilityChange(): Promise<void> {
    if (wanted && document.visibilityState === 'visible' && !sentinel) {
      await request();
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange);

  return {
    async acquire() {
      wanted = true;
      if (!sentinel) await request();
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
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void this.release();
    }
  };
}

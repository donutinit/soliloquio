import { registerSW } from 'virtual:pwa-register';

/** Sin backend no hay push: la app sondea el Service Worker con esta cadencia. */
const UPDATE_CHECK_INTERVAL_MS = 60_000;

/**
 * Auto-update: cuando se detecta una versión nueva se aplica de inmediato y la
 * página se recarga sola (la posición de lectura se guarda en `pagehide`, así
 * que no se pierde). La detección ocurre al abrir la app, al volver a primer
 * plano y periódicamente mientras está abierta.
 */
export function setupPWA(): void {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateSW(true);
    },
    onOfflineReady() {
      // La app ya funciona sin conexión; no hace falta molestar al usuario.
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => {
        void registration.update().catch(() => undefined);
      };
      setInterval(check, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    }
  });
}

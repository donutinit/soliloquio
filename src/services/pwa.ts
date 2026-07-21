import { registerSW } from 'virtual:pwa-register';

/**
 * Registra el Service Worker en modo "prompt": cuando hay una versión nueva se
 * avisa a la UI y el usuario decide cuándo aplicarla.
 */
export function setupPWA(onNeedRefresh: () => void): () => Promise<void> {
  const updateSW = registerSW({
    onNeedRefresh,
    onOfflineReady() {
      // La app ya funciona sin conexión; no hace falta molestar al usuario.
    }
  });
  return () => updateSW(true);
}

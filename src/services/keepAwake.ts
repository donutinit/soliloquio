/**
 * Wake lock global de la app, gobernado por el ajuste keepScreenAwake.
 * Singleton porque la pantalla es una sola: cualquier panel que cambie el
 * ajuste actúa sobre el mismo lock, sin importar la página montada.
 */
import { createWakeLock } from './wakeLock';

let wakeLock: ReturnType<typeof createWakeLock> | null = null;

export function applyKeepScreenAwake(enabled: boolean): void {
  if (enabled) {
    wakeLock ??= createWakeLock();
    void wakeLock.acquire();
  } else if (wakeLock) {
    void wakeLock.release();
  }
}

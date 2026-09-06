/** Acceso al primer mando activo; mantiene la API Gamepad fuera de features/. */
export function getActiveGamepad(): Gamepad | null {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return null;
  }
  try {
    for (const pad of navigator.getGamepads()) {
      if (pad && pad.connected) return pad;
    }
  } catch {
    // algunos navegadores lanzan si el documento no está activo
  }
  return null;
}

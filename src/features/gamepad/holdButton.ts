export const HOLD_THRESHOLD_MS = 350;
export const REPEAT_DELAY_MS = 350;
export const REPEAT_INTERVAL_MS = 80;

export type HoldButtonEvents = {
  /** Se soltó antes del umbral: ejecutar la acción corta. */
  shortPress: boolean;
  /** Primer frame en el que la pulsación pasa a ser mantenida. */
  holdStart: boolean;
  /** La pulsación mantenida sigue activa en este frame. */
  holdActive: boolean;
  /** Tic de repetición (para acciones escalonadas mantenidas, p. ej. d-pad). */
  repeat: boolean;
  /** El botón se soltó en este frame. */
  released: boolean;
};

const IDLE: HoldButtonEvents = {
  shortPress: false,
  holdStart: false,
  holdActive: false,
  repeat: false,
  released: false
};

/**
 * Distingue pulsación corta y mantenida: la acción corta solo se dispara si el
 * botón se suelta antes de HOLD_THRESHOLD_MS; pasado el umbral se activa la
 * acción mantenida y la corta ya no se dispara al soltar.
 */
export class HoldButton {
  private pressedAtMs: number | null = null;
  private holdStartMs: number | null = null;
  private repeatCount = 0;

  update(pressed: boolean, nowMs: number): HoldButtonEvents {
    const events = { ...IDLE };
    if (pressed) {
      if (this.pressedAtMs === null) {
        this.pressedAtMs = nowMs;
        this.holdStartMs = null;
        this.repeatCount = 0;
      }
      if (nowMs - this.pressedAtMs >= HOLD_THRESHOLD_MS) {
        if (this.holdStartMs === null) {
          this.holdStartMs = nowMs;
          events.holdStart = true;
        }
        events.holdActive = true;
        const sinceHold = nowMs - this.holdStartMs;
        if (sinceHold >= REPEAT_DELAY_MS) {
          const due = Math.floor((sinceHold - REPEAT_DELAY_MS) / REPEAT_INTERVAL_MS) + 1;
          if (due > this.repeatCount) {
            this.repeatCount = due;
            events.repeat = true;
          }
        }
      }
    } else if (this.pressedAtMs !== null) {
      events.released = true;
      if (this.holdStartMs === null) events.shortPress = true;
      this.pressedAtMs = null;
      this.holdStartMs = null;
      this.repeatCount = 0;
    }
    return events;
  }
}

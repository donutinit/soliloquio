export const TRIGGER_DEADZONE = 0.12;
export const STICK_DEADZONE = 0.15;
export const DEFAULT_MANUAL_SCROLL_SPEED = 220;

/** Factores de los sticks: derecho = ajuste fino, izquierdo = desplazamiento rápido. */
export const RIGHT_STICK_FACTOR = 0.4;
export const LEFT_STICK_FACTOR = 2.5;

export type GamepadButtonState = { pressed: boolean; value: number };

/** Aplica una zona muerta y reescala el resto del recorrido a [0, 1]. */
export function applyDeadzone(value: number, deadzone: number): number {
  if (!Number.isFinite(value)) return 0;
  const magnitude = Math.abs(value);
  if (magnitude < deadzone) return 0;
  const scaled = (magnitude - deadzone) / (1 - deadzone);
  return Math.min(1, scaled) * Math.sign(value);
}

/**
 * Valor proporcional de un gatillo. Usa `button.value` si el gatillo es
 * analógico; si es digital (value 0/1 sin recorrido), devuelve 1 al estar
 * pulsado para que se use la velocidad manual por defecto.
 */
export function triggerValue(button: GamepadButtonState): number {
  const analog = applyDeadzone(button.value, TRIGGER_DEADZONE);
  if (analog > 0) return analog;
  return button.pressed ? 1 : 0;
}

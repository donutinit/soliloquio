export const TRIGGER_DEADZONE = 0.12;
export const STICK_DEADZONE = 0.15;
export const DEFAULT_MANUAL_SCROLL_SPEED = 220;

/** Stick izquierdo: desplazamiento rápido, en múltiplos de la velocidad manual. */
export const LEFT_STICK_FACTOR = 5;
/** Stick derecho a fondo hacia abajo: multiplicador máximo del autoscroll. */
export const RIGHT_STICK_MAX_MULTIPLIER = 3;

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

/**
 * Stick derecho como freno/acelerador del autoscroll. Hacia arriba frena hasta
 * detenerlo a fondo (nunca invierte el sentido); hacia abajo acelera hasta
 * RIGHT_STICK_MAX_MULTIPLIER.
 */
export function rightStickSpeedMultiplier(axis: number): number {
  const value = applyDeadzone(axis, STICK_DEADZONE);
  return value < 0 ? 1 + value : 1 + value * (RIGHT_STICK_MAX_MULTIPLIER - 1);
}

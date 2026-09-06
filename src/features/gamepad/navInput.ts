import { REPEAT_DELAY_MS, REPEAT_INTERVAL_MS } from './holdButton';
import { needs8BitDoFaceButtonNormalization } from './controllerIdentity';
import { translateNintendoFaceButtonIndex } from './faceButtonOrder';
import type { NavDirection } from './spatialNav';

export type NavFrame = {
  moves: NavDirection[];
  confirm: boolean;
  back: boolean;
  connected: boolean;
};

/** Botones fijos del modo navegación (convención de consola, no configurables). */
export const NAV_CONFIRM_BUTTON = 0; // Sur: Cross / A / B
export const NAV_BACK_BUTTON = 1; // Este: Circle / B / A

/** Umbral del stick para tratarlo como direccional digital (evita derivas). */
export const NAV_STICK_THRESHOLD = 0.5;

const DPAD_BUTTONS: [number, NavDirection][] = [
  [12, 'up'],
  [13, 'down'],
  [14, 'left'],
  [15, 'right']
];

/**
 * A diferencia de las acciones del lector, la navegación dispara en el flanco
 * de pulsación (respuesta inmediata) y repite mientras se mantiene.
 */
class RepeatPress {
  private pressedAtMs: number | null = null;
  private repeatCount = 0;

  update(pressed: boolean, nowMs: number): boolean {
    if (!pressed) {
      this.pressedAtMs = null;
      this.repeatCount = 0;
      return false;
    }
    if (this.pressedAtMs === null) {
      this.pressedAtMs = nowMs;
      this.repeatCount = 0;
      return true;
    }
    const held = nowMs - this.pressedAtMs;
    if (held >= REPEAT_DELAY_MS) {
      const due = Math.floor((held - REPEAT_DELAY_MS) / REPEAT_INTERVAL_MS) + 1;
      if (due > this.repeatCount) {
        this.repeatCount = due;
        return true;
      }
    }
    return false;
  }
}

/** Confirmar y volver no repiten: disparan solo en el flanco de pulsación. */
class EdgePress {
  private wasPressed = false;

  update(pressed: boolean): boolean {
    const fired = pressed && !this.wasPressed;
    this.wasPressed = pressed;
    return fired;
  }
}

const DIRECTION_KEYS = ['up', 'down', 'left', 'right'] as const;

/**
 * Traduce el estado crudo del mando a intenciones de navegación (mover foco,
 * confirmar, volver). El primer frame tras conectar o reactivar solo ceba las
 * máquinas: una pulsación ya en curso (p. ej. la que despierta el mando en
 * Safari, o una mantenida al abrir un panel) no dispara nada.
 */
export class GamepadNavReader {
  private directions = new Map<NavDirection, RepeatPress>();
  private confirmPress = new EdgePress();
  private backPress = new EdgePress();
  private hadPad = false;

  constructor() {
    this.resetMachines();
  }

  private resetMachines(): void {
    for (const key of DIRECTION_KEYS) this.directions.set(key, new RepeatPress());
    this.confirmPress = new EdgePress();
    this.backPress = new EdgePress();
  }

  /** Descarta el estado en curso; el siguiente frame vuelve a cebar. */
  reset(): void {
    this.resetMachines();
    this.hadPad = false;
  }

  update(pad: Gamepad | null | undefined, nowMs: number): NavFrame {
    if (!pad) {
      if (this.hadPad) this.reset();
      return { moves: [], confirm: false, back: false, connected: false };
    }

    const axisX = pad.axes[0] ?? 0;
    const axisY = pad.axes[1] ?? 0;
    const pressed: Record<NavDirection, boolean> = {
      up: (pad.buttons[12]?.pressed ?? false) || axisY < -NAV_STICK_THRESHOLD,
      down: (pad.buttons[13]?.pressed ?? false) || axisY > NAV_STICK_THRESHOLD,
      left: (pad.buttons[14]?.pressed ?? false) || axisX < -NAV_STICK_THRESHOLD,
      right: (pad.buttons[15]?.pressed ?? false) || axisX > NAV_STICK_THRESHOLD
    };

    const moves: NavDirection[] = [];
    for (const [, direction] of DPAD_BUTTONS) {
      const machine = this.directions.get(direction);
      if (machine && machine.update(pressed[direction], nowMs)) {
        moves.push(direction);
      }
    }
    const navButtonIndex = (index: number): number =>
      needs8BitDoFaceButtonNormalization(pad.id)
        ? translateNintendoFaceButtonIndex(index)
        : index;
    const confirm = this.confirmPress.update(
      pad.buttons[navButtonIndex(NAV_CONFIRM_BUTTON)]?.pressed ?? false
    );
    const back = this.backPress.update(
      pad.buttons[navButtonIndex(NAV_BACK_BUTTON)]?.pressed ?? false
    );

    if (!this.hadPad) {
      this.hadPad = true;
      return { moves: [], confirm: false, back: false, connected: true };
    }

    return { moves, confirm, back, connected: true };
  }
}

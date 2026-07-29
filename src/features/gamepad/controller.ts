import { HoldButton, type HoldButtonEvents } from './holdButton';
import {
  DEFAULT_MANUAL_SCROLL_SPEED,
  LEFT_STICK_FACTOR,
  RIGHT_STICK_FACTOR,
  STICK_DEADZONE,
  applyDeadzone,
  triggerValue
} from './gamepadInput';
import { GAMEPAD_ACTIONS, type GamepadAction, type GamepadBindings } from '../../types';

export type { GamepadAction } from '../../types';

export type GamepadFrame = {
  actions: GamepadAction[];
  /** Velocidad manual en px/s con signo (+ hacia abajo). */
  manualVelocity: number;
  connected: boolean;
};

type ActionTrigger = 'short' | 'release' | 'step';

/**
 * Semántica de disparo de cada acción, independiente del botón asignado:
 * - short: solo pulsación corta (el botón tiene además una acción mantenida).
 * - release: al soltar, también tras una pulsación larga.
 * - step: se repite mientras se mantiene (ajustes escalonados).
 */
export const ACTION_TRIGGERS: Record<GamepadAction, ActionTrigger> = {
  togglePlay: 'short',
  resetToStart: 'short',
  speedDown: 'short',
  speedUp: 'short',
  backToScripts: 'release',
  toggleControls: 'release',
  prevSection: 'release',
  nextSection: 'release',
  toggleSettings: 'release',
  toggleControllerGuide: 'release',
  toggleSections: 'release',
  fontUp: 'step',
  fontDown: 'step',
  marginDown: 'step',
  marginUp: 'step'
};

type ButtonLike = { pressed: boolean; value: number };

const RELEASED: ButtonLike = { pressed: false, value: 0 };

/**
 * Traduce el estado crudo del mando (leído dentro del mismo rAF que el motor
 * de scroll) a acciones discretas y a una velocidad de scroll manual continua.
 * Las acciones mantenidas (scroll manual) siguen a la acción, no al botón:
 * se disparan desde el botón que tenga asignado cada acción.
 */
export class GamepadController {
  private machines = new Map<GamepadAction, HoldButton>();
  private suppressed = new Set<GamepadAction>();
  private hadPad = false;
  // Al entrar al lector con un mando ya expuesto, descarta el botón que abrió
  // el guion. Tras observar una desconexión o recibir gamepadconnected dentro
  // del lector, la primera entrada sí pertenece al prompter.
  private suppressInitialInput = true;

  constructor(private bindings: GamepadBindings) {
    this.resetMachines();
  }

  setBindings(bindings: GamepadBindings): void {
    this.bindings = bindings;
  }

  /**
   * Descarta el estado en curso. El siguiente frame vuelve a cebar: cualquier
   * pulsación aún mantenida (la que cerró un panel navegando o la que abrió
   * este guion) queda suprimida hasta que se suelte, en vez de disparar su
   * acción al soltarse.
   */
  reset(): void {
    this.resetMachines();
    this.suppressed.clear();
    this.hadPad = false;
    this.suppressInitialInput = true;
  }

  /** Permite que la entrada que acaba de revelar un mando controle el lector. */
  acceptNextConnectionInput(): void {
    this.suppressInitialInput = false;
    // El evento puede llegar justo después de que un poll haya cebado el mando.
    // El siguiente frame debe empezar a medir la pulsación, no seguir omitiéndola.
    this.suppressed.clear();
  }

  private resetMachines(): void {
    for (const action of GAMEPAD_ACTIONS) this.machines.set(action, new HoldButton());
  }

  update(pad: Gamepad | null | undefined, nowMs: number): GamepadFrame {
    if (!pad) {
      // Al desconectar, descarta pulsaciones a medias sin disparar acciones.
      if (this.hadPad) {
        this.resetMachines();
        this.suppressed.clear();
        this.hadPad = false;
      }
      // Una conexión posterior ocurre ya dentro del lector: su primera entrada
      // debe poder manejarlo incluso si el navegador no emite el evento.
      this.suppressInitialInput = false;
      return { actions: [], manualVelocity: 0, connected: false };
    }

    const button = (action: GamepadAction): ButtonLike =>
      pad.buttons[this.bindings[action]] ?? RELEASED;
    const isPressed = (action: GamepadAction): boolean => {
      const b = button(action);
      return b.pressed || triggerValue(b) > 0;
    };

    if (!this.hadPad) {
      this.hadPad = true;
      if (this.suppressInitialInput) {
        this.suppressInitialInput = false;
        for (const action of GAMEPAD_ACTIONS) {
          if (isPressed(action)) this.suppressed.add(action);
        }
        return { actions: [], manualVelocity: 0, connected: true };
      }
    }

    const events = {} as Record<GamepadAction, HoldButtonEvents>;
    for (const action of GAMEPAD_ACTIONS) {
      let pressed = isPressed(action);
      if (this.suppressed.has(action)) {
        if (pressed) pressed = false;
        else this.suppressed.delete(action);
      }
      events[action] = this.machines.get(action)!.update(pressed, nowMs);
    }

    const actions: GamepadAction[] = [];
    for (const action of GAMEPAD_ACTIONS) {
      const e = events[action];
      const trigger = ACTION_TRIGGERS[action];
      const fired =
        trigger === 'short'
          ? e.shortPress
          : trigger === 'release'
            ? e.released
            : e.shortPress || e.holdStart || e.repeat;
      if (fired) actions.push(action);
    }

    let velocity = 0;
    if (events.togglePlay.holdActive) velocity += DEFAULT_MANUAL_SCROLL_SPEED;
    if (events.resetToStart.holdActive) velocity -= DEFAULT_MANUAL_SCROLL_SPEED;
    if (events.speedUp.holdActive) {
      velocity += triggerValue(button('speedUp')) * DEFAULT_MANUAL_SCROLL_SPEED;
    }
    if (events.speedDown.holdActive) {
      velocity -= triggerValue(button('speedDown')) * DEFAULT_MANUAL_SCROLL_SPEED;
    }
    velocity +=
      applyDeadzone(pad.axes[3] ?? 0, STICK_DEADZONE) *
      DEFAULT_MANUAL_SCROLL_SPEED *
      RIGHT_STICK_FACTOR;
    velocity +=
      applyDeadzone(pad.axes[1] ?? 0, STICK_DEADZONE) *
      DEFAULT_MANUAL_SCROLL_SPEED *
      LEFT_STICK_FACTOR;

    return { actions, manualVelocity: velocity, connected: true };
  }
}

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

import { HoldButton, type HoldButtonEvents } from './holdButton';
import {
  DEFAULT_MANUAL_SCROLL_SPEED,
  LEFT_STICK_FACTOR,
  RIGHT_STICK_FACTOR,
  STICK_DEADZONE,
  applyDeadzone,
  triggerValue
} from './gamepadInput';
import { DEFAULT_DUALSHOCK_MAPPING, type ControllerButton, type ControllerMapping } from '../../types';

export type GamepadAction =
  | 'togglePlay'
  | 'resetToStart'
  | 'backToScripts'
  | 'toggleControls'
  | 'prevSection'
  | 'nextSection'
  | 'speedDown'
  | 'speedUp'
  | 'fontUp'
  | 'fontDown'
  | 'marginDown'
  | 'marginUp'
  | 'toggleSettings'
  | 'toggleSections';

export type GamepadFrame = {
  actions: GamepadAction[];
  /** Velocidad manual en px/s con signo (+ hacia abajo). */
  manualVelocity: number;
  connected: boolean;
};

const BUTTON_NAMES = Object.keys(DEFAULT_DUALSHOCK_MAPPING) as ControllerButton[];

type ButtonLike = { pressed: boolean; value: number };

const RELEASED: ButtonLike = { pressed: false, value: 0 };

/**
 * Traduce el estado crudo del mando (leído dentro del mismo rAF que el motor
 * de scroll) a acciones discretas y a una velocidad de scroll manual continua.
 */
export class GamepadController {
  private machines = new Map<ControllerButton, HoldButton>();
  private hadPad = false;

  constructor(private mapping: ControllerMapping) {
    this.resetMachines();
  }

  setMapping(mapping: ControllerMapping): void {
    this.mapping = mapping;
  }

  private resetMachines(): void {
    for (const name of BUTTON_NAMES) this.machines.set(name, new HoldButton());
  }

  update(pad: Gamepad | null | undefined, nowMs: number): GamepadFrame {
    if (!pad) {
      // Al desconectar, descarta pulsaciones a medias sin disparar acciones.
      if (this.hadPad) {
        this.resetMachines();
        this.hadPad = false;
      }
      return { actions: [], manualVelocity: 0, connected: false };
    }
    this.hadPad = true;

    const button = (name: ControllerButton): ButtonLike =>
      pad.buttons[this.mapping[name]] ?? RELEASED;
    const isPressed = (name: ControllerButton): boolean => {
      const b = button(name);
      return b.pressed || triggerValue(b) > 0;
    };

    const events = {} as Record<ControllerButton, HoldButtonEvents>;
    for (const name of BUTTON_NAMES) {
      events[name] = this.machines.get(name)!.update(isPressed(name), nowMs);
    }

    const actions: GamepadAction[] = [];
    const onShort = (name: ControllerButton, action: GamepadAction) => {
      if (events[name].shortPress) actions.push(action);
    };
    const onStep = (name: ControllerButton, action: GamepadAction) => {
      const e = events[name];
      if (e.shortPress || e.holdStart || e.repeat) actions.push(action);
    };

    onShort('cross', 'togglePlay');
    onShort('triangle', 'resetToStart');
    onShort('circle', 'backToScripts');
    onShort('square', 'toggleControls');
    onShort('l1', 'prevSection');
    onShort('r1', 'nextSection');
    onShort('l2', 'speedDown');
    onShort('r2', 'speedUp');
    onShort('options', 'toggleSettings');
    onShort('share', 'toggleSections');
    onStep('dpadUp', 'fontUp');
    onStep('dpadDown', 'fontDown');
    onStep('dpadLeft', 'marginDown');
    onStep('dpadRight', 'marginUp');

    let velocity = 0;
    if (events.cross.holdActive) velocity += DEFAULT_MANUAL_SCROLL_SPEED;
    if (events.triangle.holdActive) velocity -= DEFAULT_MANUAL_SCROLL_SPEED;
    if (events.r2.holdActive) velocity += triggerValue(button('r2')) * DEFAULT_MANUAL_SCROLL_SPEED;
    if (events.l2.holdActive) velocity -= triggerValue(button('l2')) * DEFAULT_MANUAL_SCROLL_SPEED;
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

import {
  DEFAULT_DUALSHOCK_MAPPING,
  DEFAULT_GAMEPAD_BINDINGS,
  GAMEPAD_ACTIONS,
  type ControllerButton,
  type ControllerMapping,
  type GamepadAction,
  type GamepadBindings,
  type PrompterSettings
} from '../../types';

export type Limit = { min: number; max: number; step: number; default: number };

export const SPEED_LIMITS: Limit = { min: 10, max: 300, step: 5, default: 55 };
export const FONT_LIMITS: Limit = { min: 20, max: 120, step: 2, default: 60 };
export const MARGIN_LIMITS: Limit = { min: 0, max: 25, step: 1, default: 4 };
export const SCRIPT_CARD_TITLE_LIMITS: Limit = { min: 18, max: 48, step: 1, default: 25 };
export const COUNTDOWN_LIMITS: Limit = { min: 0, max: 10, step: 1, default: 0 };

export const SETTINGS_SCHEMA_VERSION = 4;

/** Máximo índice de botón aceptado; cubre mandos no estándar con botones extra. */
const MAX_BUTTON_INDEX = 31;

export function clampToLimit(value: number, limit: Limit): number {
  if (!Number.isFinite(value)) return limit.default;
  return Math.min(limit.max, Math.max(limit.min, value));
}

export function defaultSettings(): PrompterSettings {
  return {
    speed: SPEED_LIMITS.default,
    fontSize: FONT_LIMITS.default,
    horizontalMargin: MARGIN_LIMITS.default,
    scriptCardTitleSize: SCRIPT_CARD_TITLE_LIMITS.default,
    countdownSeconds: COUNTDOWN_LIMITS.default,
    keepScreenAwake: true,
    controllerBindings: { ...DEFAULT_GAMEPAD_BINDINGS }
  };
}

function isButtonIndex(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_BUTTON_INDEX
  );
}

/**
 * En el modelo antiguo cada acción estaba fija a un botón lógico; esta tabla
 * permite migrar un `controllerMapping` remapeado sin perder las preferencias.
 */
const LEGACY_ACTION_BUTTON: Record<GamepadAction, ControllerButton> = {
  togglePlay: 'cross',
  resetToStart: 'triangle',
  backToScripts: 'circle',
  toggleControls: 'square',
  prevSection: 'l1',
  nextSection: 'r1',
  speedDown: 'l2',
  speedUp: 'r2',
  fontUp: 'dpadUp',
  fontDown: 'dpadDown',
  marginDown: 'dpadLeft',
  marginUp: 'dpadRight',
  toggleSettings: 'options',
  toggleControllerGuide: 'share',
  toggleSections: 'rightStickButton'
};

function legacyMappingToBindings(mapping: object): GamepadBindings {
  const legacy: ControllerMapping = { ...DEFAULT_DUALSHOCK_MAPPING };
  for (const key of Object.keys(legacy) as ControllerButton[]) {
    const value = (mapping as Record<string, unknown>)[key];
    if (isButtonIndex(value)) legacy[key] = value;
  }
  const bindings = { ...DEFAULT_GAMEPAD_BINDINGS };
  for (const action of GAMEPAD_ACTIONS) bindings[action] = legacy[LEGACY_ACTION_BUTTON[action]];
  return bindings;
}

/**
 * Sanea unas asignaciones acción → botón: valores inválidos caen al valor por
 * defecto y los duplicados se resuelven de forma determinista (gana la primera
 * acción en orden canónico; la siguiente recupera su botón por defecto o el
 * primer índice libre).
 */
export function normalizeBindings(raw: unknown, legacyMapping?: unknown): GamepadBindings {
  const candidate = { ...DEFAULT_GAMEPAD_BINDINGS };
  if (raw && typeof raw === 'object') {
    for (const action of GAMEPAD_ACTIONS) {
      const value = (raw as Record<string, unknown>)[action];
      if (isButtonIndex(value)) candidate[action] = value;
    }

    // Settings saved before the controller guide existed have no key for it.
    // Reserve the standard Share/View/Minus/Select button for the new guide,
    // even if a custom v2 mapping had moved another action onto that button.
    // The displaced action falls back to its own default and the uniqueness
    // pass below resolves any secondary collision deterministically.
    const rawGuideButton = (raw as Record<string, unknown>).toggleControllerGuide;
    if (!isButtonIndex(rawGuideButton)) {
      const guideButton = DEFAULT_GAMEPAD_BINDINGS.toggleControllerGuide;
      for (const action of GAMEPAD_ACTIONS) {
        if (action !== 'toggleControllerGuide' && candidate[action] === guideButton) {
          candidate[action] = DEFAULT_GAMEPAD_BINDINGS[action];
        }
      }
      candidate.toggleControllerGuide = guideButton;
    }
  } else if (legacyMapping && typeof legacyMapping === 'object') {
    Object.assign(candidate, legacyMappingToBindings(legacyMapping));
  }

  const used = new Set<number>();
  for (const action of GAMEPAD_ACTIONS) {
    let index = candidate[action];
    if (used.has(index)) {
      index = DEFAULT_GAMEPAD_BINDINGS[action];
      if (used.has(index)) {
        index = 0;
        while (used.has(index)) index += 1;
      }
    }
    candidate[action] = index;
    used.add(index);
  }
  return candidate;
}

export function normalizeSettings(raw: unknown): PrompterSettings {
  const partial = (raw && typeof raw === 'object' ? raw : {}) as Partial<PrompterSettings> & {
    controllerMapping?: unknown;
  };
  return {
    speed: clampToLimit(Number(partial.speed), SPEED_LIMITS),
    fontSize: clampToLimit(Number(partial.fontSize), FONT_LIMITS),
    horizontalMargin: clampToLimit(Number(partial.horizontalMargin), MARGIN_LIMITS),
    scriptCardTitleSize: clampToLimit(
      Number(partial.scriptCardTitleSize),
      SCRIPT_CARD_TITLE_LIMITS
    ),
    countdownSeconds: Math.round(
      clampToLimit(Number(partial.countdownSeconds), COUNTDOWN_LIMITS)
    ),
    // Solo un false explícito lo desactiva: datos antiguos sin el campo quedan activados.
    keepScreenAwake: partial.keepScreenAwake !== false,
    controllerBindings: normalizeBindings(partial.controllerBindings, partial.controllerMapping)
  };
}

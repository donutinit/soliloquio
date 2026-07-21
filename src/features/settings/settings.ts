import {
  DEFAULT_DUALSHOCK_MAPPING,
  type ControllerMapping,
  type PrompterSettings
} from '../../types';

export type Limit = { min: number; max: number; step: number; default: number };

export const SPEED_LIMITS: Limit = { min: 10, max: 300, step: 5, default: 65 };
export const FONT_LIMITS: Limit = { min: 20, max: 120, step: 2, default: 52 };
export const MARGIN_LIMITS: Limit = { min: 0, max: 25, step: 1, default: 4 };
export const COUNTDOWN_LIMITS: Limit = { min: 0, max: 10, step: 1, default: 0 };

export const SETTINGS_SCHEMA_VERSION = 1;

export function clampToLimit(value: number, limit: Limit): number {
  if (!Number.isFinite(value)) return limit.default;
  return Math.min(limit.max, Math.max(limit.min, value));
}

export function defaultSettings(): PrompterSettings {
  return {
    speed: SPEED_LIMITS.default,
    fontSize: FONT_LIMITS.default,
    horizontalMargin: MARGIN_LIMITS.default,
    countdownSeconds: COUNTDOWN_LIMITS.default,
    keepScreenAwake: true,
    controllerMapping: { ...DEFAULT_DUALSHOCK_MAPPING }
  };
}

function normalizeMapping(mapping: unknown): ControllerMapping {
  const result: ControllerMapping = { ...DEFAULT_DUALSHOCK_MAPPING };
  if (mapping && typeof mapping === 'object') {
    for (const key of Object.keys(result) as (keyof ControllerMapping)[]) {
      const value = (mapping as Record<string, unknown>)[key];
      if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 32) {
        result[key] = value;
      }
    }
  }
  return result;
}

export function normalizeSettings(raw: unknown): PrompterSettings {
  const partial = (raw && typeof raw === 'object' ? raw : {}) as Partial<PrompterSettings>;
  return {
    speed: clampToLimit(Number(partial.speed), SPEED_LIMITS),
    fontSize: clampToLimit(Number(partial.fontSize), FONT_LIMITS),
    horizontalMargin: clampToLimit(Number(partial.horizontalMargin), MARGIN_LIMITS),
    countdownSeconds: Math.round(
      clampToLimit(Number(partial.countdownSeconds), COUNTDOWN_LIMITS)
    ),
    // Solo un false explícito lo desactiva: datos antiguos sin el campo quedan activados.
    keepScreenAwake: partial.keepScreenAwake !== false,
    controllerMapping: normalizeMapping(partial.controllerMapping)
  };
}

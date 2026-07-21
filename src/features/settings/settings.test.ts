import { describe, expect, it } from 'vitest';
import {
  COUNTDOWN_LIMITS,
  FONT_LIMITS,
  MARGIN_LIMITS,
  SPEED_LIMITS,
  clampToLimit,
  defaultSettings,
  normalizeSettings
} from './settings';
import { DEFAULT_DUALSHOCK_MAPPING } from '../../types';

describe('clampToLimit', () => {
  it('recorta a los límites de velocidad, fuente y márgenes', () => {
    expect(clampToLimit(5, SPEED_LIMITS)).toBe(SPEED_LIMITS.min);
    expect(clampToLimit(9999, SPEED_LIMITS)).toBe(SPEED_LIMITS.max);
    expect(clampToLimit(1, FONT_LIMITS)).toBe(FONT_LIMITS.min);
    expect(clampToLimit(500, FONT_LIMITS)).toBe(FONT_LIMITS.max);
    expect(clampToLimit(-3, MARGIN_LIMITS)).toBe(MARGIN_LIMITS.min);
    expect(clampToLimit(80, MARGIN_LIMITS)).toBe(MARGIN_LIMITS.max);
    expect(clampToLimit(-1, COUNTDOWN_LIMITS)).toBe(0);
    expect(clampToLimit(99, COUNTDOWN_LIMITS)).toBe(10);
  });

  it('valores no numéricos caen al valor por defecto', () => {
    expect(clampToLimit(Number.NaN, SPEED_LIMITS)).toBe(SPEED_LIMITS.default);
  });
});

describe('normalizeSettings', () => {
  it('completa ajustes ausentes con los valores por defecto', () => {
    expect(normalizeSettings(undefined)).toEqual(defaultSettings());
    expect(normalizeSettings({})).toEqual(defaultSettings());
  });

  it('conserva un mapeo personalizado válido y descarta el inválido', () => {
    const normalized = normalizeSettings({
      speed: 80,
      controllerMapping: { cross: 5, circle: 'x', triangle: -1, square: 99 }
    });
    expect(normalized.speed).toBe(80);
    expect(normalized.controllerMapping.cross).toBe(5);
    expect(normalized.controllerMapping.circle).toBe(DEFAULT_DUALSHOCK_MAPPING.circle);
    expect(normalized.controllerMapping.triangle).toBe(DEFAULT_DUALSHOCK_MAPPING.triangle);
    expect(normalized.controllerMapping.square).toBe(DEFAULT_DUALSHOCK_MAPPING.square);
  });

  it('mantiene la pantalla encendida por defecto y solo un false explícito lo apaga', () => {
    expect(defaultSettings().keepScreenAwake).toBe(true);
    expect(normalizeSettings({}).keepScreenAwake).toBe(true);
    expect(normalizeSettings({ keepScreenAwake: 'nope' }).keepScreenAwake).toBe(true);
    expect(normalizeSettings({ keepScreenAwake: false }).keepScreenAwake).toBe(false);
  });

  it('keeps the countdown disabled by default and normalizes whole seconds', () => {
    expect(defaultSettings().countdownSeconds).toBe(0);
    expect(normalizeSettings({ countdownSeconds: 4.6 }).countdownSeconds).toBe(5);
    expect(normalizeSettings({ countdownSeconds: 99 }).countdownSeconds).toBe(10);
  });
});

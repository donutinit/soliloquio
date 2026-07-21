import { describe, expect, it } from 'vitest';
import {
  COUNTDOWN_LIMITS,
  FONT_LIMITS,
  MARGIN_LIMITS,
  SPEED_LIMITS,
  clampToLimit,
  defaultSettings,
  normalizeBindings,
  normalizeSettings
} from './settings';
import { DEFAULT_GAMEPAD_BINDINGS, GAMEPAD_ACTIONS } from '../../types';

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

  it('conserva asignaciones válidas y descarta las inválidas', () => {
    const normalized = normalizeSettings({
      speed: 80,
      controllerBindings: { togglePlay: 5, backToScripts: 'x', resetToStart: -1, toggleControls: 99 }
    });
    expect(normalized.speed).toBe(80);
    expect(normalized.controllerBindings.togglePlay).toBe(5);
    expect(normalized.controllerBindings.backToScripts).toBe(DEFAULT_GAMEPAD_BINDINGS.backToScripts);
    expect(normalized.controllerBindings.resetToStart).toBe(DEFAULT_GAMEPAD_BINDINGS.resetToStart);
    expect(normalized.controllerBindings.toggleControls).toBe(DEFAULT_GAMEPAD_BINDINGS.toggleControls);
    // togglePlay ocupa el 5; nextSection (su dueño por defecto) recibe un índice libre.
    expect(normalized.controllerBindings.nextSection).not.toBe(5);
  });

  it('migra un controllerMapping heredado conservando el remapeo del usuario', () => {
    const normalized = normalizeSettings({
      controllerMapping: { cross: 5, r1: 0 }
    });
    // En el modelo antiguo cross disparaba play/pausa y r1 la sección siguiente.
    expect(normalized.controllerBindings.togglePlay).toBe(5);
    expect(normalized.controllerBindings.nextSection).toBe(0);
    expect(normalized.controllerBindings.backToScripts).toBe(DEFAULT_GAMEPAD_BINDINGS.backToScripts);
  });

  it('las asignaciones nuevas tienen prioridad sobre el formato heredado', () => {
    const normalized = normalizeSettings({
      controllerBindings: { togglePlay: 9, toggleSettings: 0 },
      controllerMapping: { cross: 5 }
    });
    expect(normalized.controllerBindings.togglePlay).toBe(9);
    expect(normalized.controllerBindings.toggleSettings).toBe(0);
  });

  it('resuelve duplicados de forma determinista sin dejar acciones repetidas', () => {
    // togglePlay roba el botón de backToScripts; este cae al primer índice libre.
    const bindings = normalizeBindings({ togglePlay: DEFAULT_GAMEPAD_BINDINGS.backToScripts });
    expect(bindings.togglePlay).toBe(DEFAULT_GAMEPAD_BINDINGS.backToScripts);
    expect(bindings.backToScripts).toBe(0);
    const values = GAMEPAD_ACTIONS.map((action) => bindings[action]);
    expect(new Set(values).size).toBe(values.length);
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

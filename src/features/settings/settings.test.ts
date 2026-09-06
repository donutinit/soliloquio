import { describe, expect, it } from 'vitest';
import {
  COUNTDOWN_LIMITS,
  FONT_LIMITS,
  MARGIN_LIMITS,
  SCRIPT_CARD_TITLE_LIMITS,
  SPEED_LIMITS,
  clampToLimit,
  defaultSettings,
  normalizeBindings,
  normalizeSettings,
  SETTINGS_SCHEMA_VERSION
} from './settings';
import { DEFAULT_GAMEPAD_BINDINGS, GAMEPAD_ACTIONS } from '../../types';

describe('clampToLimit', () => {
  it('recorta a los límites de velocidad, fuentes y márgenes', () => {
    expect(clampToLimit(5, SPEED_LIMITS)).toBe(SPEED_LIMITS.min);
    expect(clampToLimit(9999, SPEED_LIMITS)).toBe(SPEED_LIMITS.max);
    expect(clampToLimit(1, FONT_LIMITS)).toBe(FONT_LIMITS.min);
    expect(clampToLimit(500, FONT_LIMITS)).toBe(FONT_LIMITS.max);
    expect(clampToLimit(-3, MARGIN_LIMITS)).toBe(MARGIN_LIMITS.min);
    expect(clampToLimit(80, MARGIN_LIMITS)).toBe(MARGIN_LIMITS.max);
    expect(clampToLimit(2, SCRIPT_CARD_TITLE_LIMITS)).toBe(SCRIPT_CARD_TITLE_LIMITS.min);
    expect(clampToLimit(80, SCRIPT_CARD_TITLE_LIMITS)).toBe(SCRIPT_CARD_TITLE_LIMITS.max);
    expect(clampToLimit(-1, COUNTDOWN_LIMITS)).toBe(0);
    expect(clampToLimit(99, COUNTDOWN_LIMITS)).toBe(10);
  });

  it('valores no numéricos caen al valor por defecto', () => {
    expect(clampToLimit(Number.NaN, SPEED_LIMITS)).toBe(SPEED_LIMITS.default);
  });

  it('alinea valores fuera de rejilla con el paso del límite', () => {
    expect(clampToLimit(12.3, SPEED_LIMITS)).toBe(10);
    expect(clampToLimit(57.4, SPEED_LIMITS)).toBe(55);
    expect(clampToLimit(21, FONT_LIMITS)).toBe(22);
    expect(clampToLimit(23, FONT_LIMITS)).toBe(24);
    expect(clampToLimit(2.6, MARGIN_LIMITS)).toBe(3);
  });
});

describe('normalizeSettings', () => {
  it('uses schema version 4 for script-card typography', () => {
    expect(SETTINGS_SCHEMA_VERSION).toBe(4);
  });

  it('completa ajustes ausentes con los valores por defecto', () => {
    expect(normalizeSettings(undefined)).toEqual(defaultSettings());
    expect(normalizeSettings({})).toEqual(defaultSettings());
    expect(defaultSettings()).toMatchObject({
      speed: 55,
      fontSize: 60,
      scriptCardTitleSize: 25
    });
  });

  it('normalizes the script-card title size independently from prompter text', () => {
    expect(normalizeSettings({ scriptCardTitleSize: 31 }).scriptCardTitleSize).toBe(31);
    expect(normalizeSettings({ scriptCardTitleSize: 500 }).scriptCardTitleSize).toBe(
      SCRIPT_CARD_TITLE_LIMITS.max
    );
  });

  it('rechaza valores no numéricos en lugar de coercerlos', () => {
    const normalized = normalizeSettings({
      speed: '55',
      fontSize: null,
      horizontalMargin: true,
      scriptCardTitleSize: '',
      countdownSeconds: undefined
    });
    expect(normalized.speed).toBe(SPEED_LIMITS.default);
    expect(normalized.fontSize).toBe(FONT_LIMITS.default);
    expect(normalized.horizontalMargin).toBe(MARGIN_LIMITS.default);
    expect(normalized.scriptCardTitleSize).toBe(SCRIPT_CARD_TITLE_LIMITS.default);
    expect(normalized.countdownSeconds).toBe(COUNTDOWN_LIMITS.default);
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

  it('conserva los índices virtuales del perfil Pro 3', () => {
    const normalized = normalizeSettings({
      controllerBindings: { toggleSections: 31 }
    });
    expect(normalized.controllerBindings.toggleSections).toBe(31);
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

  it('migra asignaciones v2 reservando Share para la guía y R3 para secciones', () => {
    const v2Bindings = {
      ...DEFAULT_GAMEPAD_BINDINGS,
      toggleSections: 8
    } as Record<string, number>;
    delete v2Bindings.toggleControllerGuide;

    const normalized = normalizeSettings({ controllerBindings: v2Bindings });
    expect(normalized.controllerBindings.toggleControllerGuide).toBe(8);
    expect(normalized.controllerBindings.toggleSections).toBe(11);
    const values = GAMEPAD_ACTIONS.map((action) => normalized.controllerBindings[action]);
    expect(new Set(values).size).toBe(values.length);
  });

  it('reserves Share for the guide when a custom v2 mapping used it elsewhere', () => {
    const v2Bindings = {
      ...DEFAULT_GAMEPAD_BINDINGS,
      toggleSettings: 8,
      toggleSections: 9
    } as Record<string, number>;
    delete v2Bindings.toggleControllerGuide;

    const normalized = normalizeSettings({ controllerBindings: v2Bindings });
    expect(normalized.controllerBindings.toggleControllerGuide).toBe(8);
    expect(normalized.controllerBindings.toggleSettings).not.toBe(8);
    const values = GAMEPAD_ACTIONS.map((action) => normalized.controllerBindings[action]);
    expect(new Set(values).size).toBe(values.length);
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

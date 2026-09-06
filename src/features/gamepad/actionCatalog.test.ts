import { describe, expect, it } from 'vitest';
import { ACTION_GROUPS, actionLabel, assignBinding, buttonLabel } from './actionCatalog';
import { DEFAULT_GAMEPAD_BINDINGS, GAMEPAD_ACTIONS } from '../../types';

describe('ACTION_GROUPS', () => {
  it('lista cada acción asignable exactamente una vez', () => {
    const listed = ACTION_GROUPS.flatMap((group) => group.actions.map((info) => info.action));
    expect([...listed].sort()).toEqual([...GAMEPAD_ACTIONS].sort());
    expect(new Set(listed).size).toBe(listed.length);
  });
});

describe('buttonLabel', () => {
  it('nombra los botones estándar y numera los desconocidos', () => {
    expect(buttonLabel(0)).toBe('Cross');
    expect(buttonLabel(15)).toBe('D-pad Right');
    expect(buttonLabel(25)).toBe('Button 25');
  });

  it('usa la serigrafía de cada familia para el mismo índice físico', () => {
    expect(buttonLabel(0, 'playstation')).toBe('Cross');
    expect(buttonLabel(0, 'xbox')).toBe('A');
    expect(buttonLabel(0, 'nintendo')).toBe('B');
    expect(buttonLabel(0, '8bitdo')).toBe('B');
    expect(buttonLabel(4, 'xbox')).toBe('LB');
    expect(buttonLabel(6, 'nintendo')).toBe('ZL');
    expect(buttonLabel(9, 'xbox')).toBe('Menu');
    expect(buttonLabel(9, '8bitdo')).toBe('Start');
    expect(buttonLabel(8, 'playstation')).toBe('Share / Create');
    expect(buttonLabel(8, 'xbox')).toBe('View');
    expect(buttonLabel(8, 'nintendo')).toBe('Minus');
    expect(buttonLabel(8, '8bitdo')).toBe('Select');
    expect(buttonLabel(13, 'xbox')).toBe('D-pad Down');
    expect(buttonLabel(28, '8bitdo')).toBe('L4');
    expect(buttonLabel(29, '8bitdo')).toBe('R4');
    expect(buttonLabel(30, '8bitdo')).toBe('PL');
    expect(buttonLabel(31, '8bitdo')).toBe('PR');
  });

  it('la familia genérica y los índices extra numeran el botón', () => {
    expect(buttonLabel(0, 'generic')).toBe('Button 0');
    expect(buttonLabel(17, 'generic')).toBe('Button 17');
    expect(buttonLabel(25, 'xbox')).toBe('Button 25');
  });
});

describe('assignBinding', () => {
  it('asigna un botón libre sin tocar el resto', () => {
    const result = assignBinding({ ...DEFAULT_GAMEPAD_BINDINGS }, 'togglePlay', 16);
    expect(result.bindings.togglePlay).toBe(16);
    expect(result.swappedWith).toBeUndefined();
    expect(result.bindings.nextSection).toBe(DEFAULT_GAMEPAD_BINDINGS.nextSection);
  });

  it('intercambia las asignaciones cuando el botón ya está ocupado', () => {
    const result = assignBinding(
      { ...DEFAULT_GAMEPAD_BINDINGS },
      'togglePlay',
      DEFAULT_GAMEPAD_BINDINGS.nextSection
    );
    expect(result.swappedWith).toBe('nextSection');
    expect(result.bindings.togglePlay).toBe(DEFAULT_GAMEPAD_BINDINGS.nextSection);
    expect(result.bindings.nextSection).toBe(DEFAULT_GAMEPAD_BINDINGS.togglePlay);
    const values = GAMEPAD_ACTIONS.map((action) => result.bindings[action]);
    expect(new Set(values).size).toBe(values.length);
  });

  it('reasignar la misma acción a su botón actual no es un conflicto', () => {
    const result = assignBinding(
      { ...DEFAULT_GAMEPAD_BINDINGS },
      'togglePlay',
      DEFAULT_GAMEPAD_BINDINGS.togglePlay
    );
    expect(result.swappedWith).toBeUndefined();
    expect(result.bindings).toEqual(DEFAULT_GAMEPAD_BINDINGS);
  });

  it('ignora índices de botón fuera del rango admisible', () => {
    for (const index of [-1, 1.5, 32, 99]) {
      const result = assignBinding({ ...DEFAULT_GAMEPAD_BINDINGS }, 'togglePlay', index);
      expect(result.swappedWith).toBeUndefined();
      expect(result.bindings).toEqual(DEFAULT_GAMEPAD_BINDINGS);
    }
  });
});

describe('actionLabel', () => {
  it('devuelve la etiqueta visible de una acción', () => {
    expect(actionLabel('togglePlay')).toBe('Play / Pause');
    expect(actionLabel('toggleControllerGuide')).toBe('Controller guide');
  });
});

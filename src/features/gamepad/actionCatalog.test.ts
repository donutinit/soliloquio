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
});

describe('actionLabel', () => {
  it('devuelve la etiqueta visible de una acción', () => {
    expect(actionLabel('togglePlay')).toBe('Play / Pause');
  });
});

import { describe, expect, it } from 'vitest';
import { GamepadController } from './controller';
import { HOLD_THRESHOLD_MS } from './holdButton';
import { DEFAULT_MANUAL_SCROLL_SPEED } from './gamepadInput';
import { DEFAULT_GAMEPAD_BINDINGS, GAMEPAD_ACTIONS } from '../../types';

function fakePad(overrides: {
  buttons?: Record<number, { pressed: boolean; value: number }>;
  axes?: number[];
}): Gamepad {
  const buttons = Array.from({ length: 18 }, (_, i) => ({
    pressed: overrides.buttons?.[i]?.pressed ?? false,
    touched: false,
    value: overrides.buttons?.[i]?.value ?? 0
  }));
  return {
    id: 'fake',
    index: 0,
    connected: true,
    mapping: 'standard',
    timestamp: 0,
    axes: overrides.axes ?? [0, 0, 0, 0],
    buttons
  } as unknown as Gamepad;
}

describe('asignaciones por defecto', () => {
  it('cubren todas las acciones con índices únicos', () => {
    const values = GAMEPAD_ACTIONS.map((action) => DEFAULT_GAMEPAD_BINDINGS[action]);
    expect(values).toHaveLength(14);
    expect(new Set(values).size).toBe(14);
    expect(DEFAULT_GAMEPAD_BINDINGS.togglePlay).toBe(0);
    expect(DEFAULT_GAMEPAD_BINDINGS.marginUp).toBe(15);
  });
});

describe('GamepadController', () => {
  it('pulsación corta del botón de play emite togglePlay', () => {
    const controller = new GamepadController({ ...DEFAULT_GAMEPAD_BINDINGS });
    controller.update(fakePad({ buttons: { 0: { pressed: true, value: 1 } } }), 0);
    const frame = controller.update(fakePad({}), 100);
    expect(frame.actions).toContain('togglePlay');
  });

  it('mantener el botón de play no emite togglePlay y genera velocidad manual', () => {
    const controller = new GamepadController({ ...DEFAULT_GAMEPAD_BINDINGS });
    const pressed = fakePad({ buttons: { 0: { pressed: true, value: 1 } } });
    controller.update(pressed, 0);
    const held = controller.update(pressed, HOLD_THRESHOLD_MS + 10);
    expect(held.manualVelocity).toBe(DEFAULT_MANUAL_SCROLL_SPEED);
    const released = controller.update(fakePad({}), HOLD_THRESHOLD_MS + 100);
    expect(released.actions).not.toContain('togglePlay');
    expect(released.manualVelocity).toBe(0);
  });

  it('a long press still triggers actions that have no hold behavior', () => {
    const controller = new GamepadController({ ...DEFAULT_GAMEPAD_BINDINGS });
    const pressed = fakePad({ buttons: { 5: { pressed: true, value: 1 } } });
    controller.update(pressed, 0);
    controller.update(pressed, HOLD_THRESHOLD_MS + 10);
    const released = controller.update(fakePad({}), HOLD_THRESHOLD_MS + 100);
    expect(released.actions).toContain('nextSection');
  });

  it('un gatillo analógico mantenido escala la velocidad manual', () => {
    const controller = new GamepadController({ ...DEFAULT_GAMEPAD_BINDINGS });
    const half = fakePad({ buttons: { 7: { pressed: true, value: 0.56 } } });
    controller.update(half, 0);
    const frame = controller.update(half, HOLD_THRESHOLD_MS + 10);
    expect(frame.manualVelocity).toBeCloseTo(DEFAULT_MANUAL_SCROLL_SPEED * 0.5);
  });

  it('respeta una acción reasignada a otro botón', () => {
    const controller = new GamepadController({
      ...DEFAULT_GAMEPAD_BINDINGS,
      togglePlay: 5,
      nextSection: 0
    });
    controller.update(fakePad({ buttons: { 5: { pressed: true, value: 1 } } }), 0);
    const frame = controller.update(fakePad({}), 100);
    expect(frame.actions).toContain('togglePlay');
    expect(frame.actions).not.toContain('nextSection');
  });

  it('la acción mantenida sigue a la acción reasignada, no al botón original', () => {
    const controller = new GamepadController({
      ...DEFAULT_GAMEPAD_BINDINGS,
      togglePlay: 5,
      nextSection: 0
    });
    const pressed = fakePad({ buttons: { 5: { pressed: true, value: 1 } } });
    controller.update(pressed, 0);
    const held = controller.update(pressed, HOLD_THRESHOLD_MS + 10);
    expect(held.manualVelocity).toBe(DEFAULT_MANUAL_SCROLL_SPEED);
  });

  it('al desconectar el mando no dispara acciones pendientes', () => {
    const controller = new GamepadController({ ...DEFAULT_GAMEPAD_BINDINGS });
    controller.update(fakePad({ buttons: { 0: { pressed: true, value: 1 } } }), 0);
    const frame = controller.update(null, 100);
    expect(frame.connected).toBe(false);
    expect(frame.actions).toEqual([]);
    // al reconectar, la pulsación anterior quedó descartada
    const after = controller.update(fakePad({}), 200);
    expect(after.actions).toEqual([]);
  });

  it('los sticks aportan scroll fino y rápido con zona muerta', () => {
    const controller = new GamepadController({ ...DEFAULT_GAMEPAD_BINDINGS });
    controller.update(fakePad({}), 0);
    expect(controller.update(fakePad({ axes: [0, 0.1, 0, 0.1] }), 16).manualVelocity).toBe(0);
    const fine = controller.update(fakePad({ axes: [0, 0, 0, 1] }), 32).manualVelocity;
    const fast = controller.update(fakePad({ axes: [0, 1, 0, 0] }), 48).manualVelocity;
    expect(fine).toBeGreaterThan(0);
    expect(fast).toBeGreaterThan(fine);
  });
});

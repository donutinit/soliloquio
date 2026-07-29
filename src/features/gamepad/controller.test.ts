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
    expect(values).toHaveLength(15);
    expect(new Set(values).size).toBe(15);
    expect(DEFAULT_GAMEPAD_BINDINGS.togglePlay).toBe(0);
    expect(DEFAULT_GAMEPAD_BINDINGS.marginUp).toBe(15);
    expect(DEFAULT_GAMEPAD_BINDINGS.toggleControllerGuide).toBe(8);
    expect(DEFAULT_GAMEPAD_BINDINGS.toggleSections).toBe(11);
  });
});

/** Controller con el frame de cebado ya consumido (mando conectado en reposo). */
function primedController(bindings = { ...DEFAULT_GAMEPAD_BINDINGS }): GamepadController {
  const controller = new GamepadController(bindings);
  controller.update(fakePad({}), -100);
  return controller;
}

describe('GamepadController', () => {
  it('pulsación corta del botón de play emite togglePlay', () => {
    const controller = primedController();
    controller.update(fakePad({ buttons: { 0: { pressed: true, value: 1 } } }), 0);
    const frame = controller.update(fakePad({}), 100);
    expect(frame.actions).toContain('togglePlay');
  });

  it('mantener el botón de play no emite togglePlay y genera velocidad manual', () => {
    const controller = primedController();
    const pressed = fakePad({ buttons: { 0: { pressed: true, value: 1 } } });
    controller.update(pressed, 0);
    const held = controller.update(pressed, HOLD_THRESHOLD_MS + 10);
    expect(held.manualVelocity).toBe(DEFAULT_MANUAL_SCROLL_SPEED);
    const released = controller.update(fakePad({}), HOLD_THRESHOLD_MS + 100);
    expect(released.actions).not.toContain('togglePlay');
    expect(released.manualVelocity).toBe(0);
  });

  it('a long press still triggers actions that have no hold behavior', () => {
    const controller = primedController();
    const pressed = fakePad({ buttons: { 5: { pressed: true, value: 1 } } });
    controller.update(pressed, 0);
    controller.update(pressed, HOLD_THRESHOLD_MS + 10);
    const released = controller.update(fakePad({}), HOLD_THRESHOLD_MS + 100);
    expect(released.actions).toContain('nextSection');
  });

  it('Share abre la guía al soltar y no abre la lista de secciones', () => {
    const controller = primedController();
    const pressed = fakePad({ buttons: { 8: { pressed: true, value: 1 } } });
    controller.update(pressed, 0);
    controller.update(pressed, HOLD_THRESHOLD_MS + 10);
    const released = controller.update(fakePad({}), HOLD_THRESHOLD_MS + 100);
    expect(released.actions).toContain('toggleControllerGuide');
    expect(released.actions).not.toContain('toggleSections');
  });

  it('un gatillo analógico mantenido escala la velocidad manual', () => {
    const controller = primedController();
    const half = fakePad({ buttons: { 7: { pressed: true, value: 0.56 } } });
    controller.update(half, 0);
    const frame = controller.update(half, HOLD_THRESHOLD_MS + 10);
    expect(frame.manualVelocity).toBeCloseTo(DEFAULT_MANUAL_SCROLL_SPEED * 0.5);
  });

  it('respeta una acción reasignada a otro botón', () => {
    const controller = primedController({
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
    const controller = primedController({
      ...DEFAULT_GAMEPAD_BINDINGS,
      togglePlay: 5,
      nextSection: 0
    });
    const pressed = fakePad({ buttons: { 5: { pressed: true, value: 1 } } });
    controller.update(pressed, 0);
    const held = controller.update(pressed, HOLD_THRESHOLD_MS + 10);
    expect(held.manualVelocity).toBe(DEFAULT_MANUAL_SCROLL_SPEED);
  });

  it('una pulsación sostenida al abrir el guion queda suprimida hasta soltarse', () => {
    // El botón que abrió el guion navegando no debe disparar su acción del
    // lector cuando se suelta ya dentro del prompter.
    const controller = new GamepadController({ ...DEFAULT_GAMEPAD_BINDINGS });
    const pressed = fakePad({ buttons: { 0: { pressed: true, value: 1 } } });
    controller.update(pressed, 0);
    const held = controller.update(pressed, HOLD_THRESHOLD_MS + 10);
    expect(held.manualVelocity).toBe(0);
    const released = controller.update(fakePad({}), HOLD_THRESHOLD_MS + 100);
    expect(released.actions).toEqual([]);
    // La siguiente pulsación ya funciona con normalidad.
    controller.update(pressed, HOLD_THRESHOLD_MS + 200);
    const after = controller.update(fakePad({}), HOLD_THRESHOLD_MS + 300);
    expect(after.actions).toContain('togglePlay');
  });

  it('la pulsación que revela un mando dentro del lector controla el prompter', () => {
    const controller = new GamepadController({ ...DEFAULT_GAMEPAD_BINDINGS });
    controller.update(null, -16);
    const pressed = fakePad({ buttons: { 0: { pressed: true, value: 1 } } });
    controller.update(pressed, 0);
    const released = controller.update(fakePad({}), 100);
    expect(released.actions).toContain('togglePlay');
  });

  it('gamepadconnected recupera la primera entrada aunque un poll ya la hubiera cebado', () => {
    const controller = new GamepadController({ ...DEFAULT_GAMEPAD_BINDINGS });
    const pressed = fakePad({ buttons: { 0: { pressed: true, value: 1 } } });
    controller.update(pressed, 0);
    controller.acceptNextConnectionInput();
    controller.update(pressed, 16);
    const released = controller.update(fakePad({}), 100);
    expect(released.actions).toContain('togglePlay');
  });

  it('reset() vuelve a cebar y descarta la pulsación mantenida', () => {
    const controller = primedController();
    const pressed = fakePad({ buttons: { 0: { pressed: true, value: 1 } } });
    controller.update(pressed, 0);
    controller.reset();
    controller.update(pressed, 50);
    const released = controller.update(fakePad({}), 150);
    expect(released.actions).toEqual([]);
  });

  it('al desconectar el mando no dispara acciones pendientes', () => {
    const controller = primedController();
    controller.update(fakePad({ buttons: { 0: { pressed: true, value: 1 } } }), 0);
    const frame = controller.update(null, 100);
    expect(frame.connected).toBe(false);
    expect(frame.actions).toEqual([]);
    // La pulsación anterior queda descartada, pero una nueva conexión sí puede
    // usar su primera entrada.
    const pressed = fakePad({ buttons: { 0: { pressed: true, value: 1 } } });
    controller.update(pressed, 200);
    const after = controller.update(fakePad({}), 300);
    expect(after.actions).toContain('togglePlay');
  });

  it('los sticks aportan scroll fino y rápido con zona muerta', () => {
    const controller = primedController();
    expect(controller.update(fakePad({ axes: [0, 0.1, 0, 0.1] }), 16).manualVelocity).toBe(0);
    const fine = controller.update(fakePad({ axes: [0, 0, 0, 1] }), 32).manualVelocity;
    const fast = controller.update(fakePad({ axes: [0, 1, 0, 0] }), 48).manualVelocity;
    expect(fine).toBeGreaterThan(0);
    expect(fast).toBeGreaterThan(fine);
  });
});

import { describe, expect, it } from 'vitest';
import { GamepadController } from './controller';
import { HOLD_THRESHOLD_MS } from './holdButton';
import { DEFAULT_MANUAL_SCROLL_SPEED } from './gamepadInput';
import { DEFAULT_GAMEPAD_BINDINGS, GAMEPAD_ACTIONS } from '../../types';

const MICRO_ID = '8BitDo Micro gamepad Gamepad';
const PRO_3_ID = '8BitDo Pro 3 Extended Gamepad';

function fakePad(overrides: {
  id?: string;
  buttons?: Record<number, { pressed: boolean; value: number }>;
  axes?: number[];
}): Gamepad {
  const buttons = Array.from({ length: 18 }, (_, i) => ({
    pressed: overrides.buttons?.[i]?.pressed ?? false,
    touched: false,
    value: overrides.buttons?.[i]?.value ?? 0
  }));
  return {
    id: overrides.id ?? 'fake',
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
    expect(DEFAULT_GAMEPAD_BINDINGS.backToScripts).toBe(1);
    expect(DEFAULT_GAMEPAD_BINDINGS.toggleControls).toBe(2);
    expect(DEFAULT_GAMEPAD_BINDINGS.resetToStart).toBe(3);
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

function microPad(buttons: Record<number, { pressed: boolean; value: number }> = {}): Gamepad {
  return fakePad({ id: MICRO_ID, buttons });
}

function primedMicroController(): GamepadController {
  const controller = new GamepadController({ ...DEFAULT_GAMEPAD_BINDINGS });
  controller.update(microPad(), -100);
  return controller;
}

describe('GamepadController', () => {
  it('pulsación corta del botón de play emite togglePlay', () => {
    const controller = primedController();
    controller.update(fakePad({ buttons: { 0: { pressed: true, value: 1 } } }), 0);
    const frame = controller.update(fakePad({}), 100);
    expect(frame.actions).toContain('togglePlay');
  });

  it('el Pro 3 usa B abajo para Play/Pause y A derecha para salir', () => {
    const pro3 = (buttons: Record<number, { pressed: boolean; value: number }> = {}) =>
      fakePad({ id: PRO_3_ID, buttons });
    const cases: { button: number; action: (typeof GAMEPAD_ACTIONS)[number] }[] = [
      { button: 1, action: 'togglePlay' },
      { button: 0, action: 'backToScripts' },
      { button: 3, action: 'toggleControls' },
      { button: 2, action: 'resetToStart' }
    ];

    for (const [index, testCase] of cases.entries()) {
      const controller = new GamepadController({ ...DEFAULT_GAMEPAD_BINDINGS });
      controller.update(pro3(), -100);
      const start = index * 200;
      controller.update(pro3({ [testCase.button]: { pressed: true, value: 1 } }), start);
      const released = controller.update(pro3(), start + 100);
      expect(released.actions).toContain(testCase.action);
    }
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

  it('el Micro usa izquierda/derecha para scroll manual y prioriza horizontal', () => {
    const controller = primedMicroController();
    const left = controller.update(
      microPad({ 14: { pressed: true, value: 1 } }),
      0
    );
    expect(left.manualVelocity).toBe(-DEFAULT_MANUAL_SCROLL_SPEED);
    expect(left.temporarySpeedMultiplier).toBe(1);

    const right = controller.update(
      microPad({ 15: { pressed: true, value: 1 } }),
      16
    );
    expect(right.manualVelocity).toBe(DEFAULT_MANUAL_SCROLL_SPEED);

    const diagonal = controller.update(
      microPad({
        12: { pressed: true, value: 1 },
        14: { pressed: true, value: 1 }
      }),
      32
    );
    expect(diagonal.manualVelocity).toBe(-DEFAULT_MANUAL_SCROLL_SPEED);
    expect(diagonal.temporarySpeedMultiplier).toBe(1);
  });

  it('el Micro aplica 20%/200% temporal con arriba/abajo', () => {
    const controller = primedMicroController();
    const slow = controller.update(
      microPad({ 12: { pressed: true, value: 1 } }),
      0
    );
    expect(slow.manualVelocity).toBe(0);
    expect(slow.temporarySpeedMultiplier).toBe(0.2);

    const fast = controller.update(
      microPad({ 13: { pressed: true, value: 1 } }),
      16
    );
    expect(fast.temporarySpeedMultiplier).toBe(2);
    expect(controller.update(microPad(), 32).temporarySpeedMultiplier).toBe(1);
  });

  it('el Micro traduce A/B/X/Y crudos a las posiciones equivalentes de DualShock', () => {
    const cases: { button: number; action: (typeof GAMEPAD_ACTIONS)[number] }[] = [
      { button: 1, action: 'togglePlay' },
      { button: 0, action: 'backToScripts' },
      { button: 3, action: 'toggleControls' },
      { button: 2, action: 'resetToStart' }
    ];

    for (const [index, testCase] of cases.entries()) {
      const controller = primedMicroController();
      const start = index * 200;
      controller.update(
        microPad({ [testCase.button]: { pressed: true, value: 1 } }),
        start
      );
      const released = controller.update(microPad(), start + 100);
      expect(released.actions).toContain(testCase.action);
    }
  });

  it('Select + D-pad ajusta texto y márgenes sin abrir la guía', () => {
    const controller = primedMicroController();
    const select = { 8: { pressed: true, value: 1 } };
    controller.update(microPad(select), 0);

    controller.update(
      microPad({ ...select, 12: { pressed: true, value: 1 } }),
      16
    );
    const font = controller.update(microPad(select), 100);
    expect(font.actions).toContain('fontUp');
    expect(font.manualVelocity).toBe(0);
    expect(font.temporarySpeedMultiplier).toBe(1);

    controller.update(
      microPad({ ...select, 14: { pressed: true, value: 1 } }),
      120
    );
    const margin = controller.update(microPad(select), 200);
    expect(margin.actions).toContain('marginDown');

    const released = controller.update(microPad(), 220);
    expect(released.actions).not.toContain('toggleControllerGuide');
  });

  it('Select + B alterna la lista de secciones sin activar Play/Pause ni la guía', () => {
    const controller = primedMicroController();
    const select = { 8: { pressed: true, value: 1 } };
    controller.update(microPad(select), 0);
    controller.update(
      microPad({ ...select, 1: { pressed: true, value: 1 } }),
      16
    );
    const bReleased = controller.update(microPad(select), 100);
    expect(bReleased.actions).toContain('toggleSections');
    expect(bReleased.actions).not.toContain('togglePlay');

    const selectReleased = controller.update(microPad(), 120);
    expect(selectReleased.actions).not.toContain('toggleControllerGuide');

    controller.update(microPad(select), 140);
    controller.update(
      microPad({ ...select, 1: { pressed: true, value: 1 } }),
      160
    );
    const modifierReleased = controller.update(
      microPad({ 1: { pressed: true, value: 1 } }),
      200
    );
    expect(modifierReleased.actions).toContain('toggleSections');
    const secondBReleased = controller.update(microPad(), 220);
    expect(secondBReleased.actions).not.toContain('togglePlay');

    controller.update(microPad({ 1: { pressed: true, value: 1 } }), 240);
    expect(controller.update(microPad(), 340).actions).toContain('togglePlay');
  });

  it('Select solo conserva la acción normal y Start 9 sigue funcionando', () => {
    const controller = primedMicroController();
    controller.update(microPad({ 8: { pressed: true, value: 1 } }), 0);
    expect(controller.update(microPad(), 100).actions).toContain('toggleControllerGuide');

    controller.update(microPad({ 9: { pressed: true, value: 1 } }), 120);
    expect(controller.update(microPad(), 220).actions).toContain('toggleSettings');
  });

  it('no aplica el perfil Micro a otros controles 8BitDo', () => {
    const controller = new GamepadController({ ...DEFAULT_GAMEPAD_BINDINGS });
    const other = (buttons: Record<number, { pressed: boolean; value: number }> = {}) =>
      fakePad({ id: '8BitDo Pro 2', buttons });
    controller.update(other(), -100);
    controller.update(other({ 12: { pressed: true, value: 1 } }), 0);
    const released = controller.update(other(), 100);
    expect(released.actions).toContain('fontUp');
    expect(released.temporarySpeedMultiplier).toBe(1);
  });
});

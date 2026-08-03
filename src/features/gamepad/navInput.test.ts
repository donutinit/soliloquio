import { describe, expect, it } from 'vitest';
import { GamepadNavReader } from './navInput';
import { REPEAT_DELAY_MS, REPEAT_INTERVAL_MS } from './holdButton';

function fakePad(overrides: {
  id?: string;
  buttons?: Record<number, boolean>;
  axes?: number[];
}): Gamepad {
  const buttons = Array.from({ length: 18 }, (_, i) => ({
    pressed: overrides.buttons?.[i] ?? false,
    touched: false,
    value: overrides.buttons?.[i] ? 1 : 0
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

describe('GamepadNavReader', () => {
  it('el primer frame solo ceba: una pulsación en curso no dispara nada', () => {
    const reader = new GamepadNavReader();
    const frame = reader.update(fakePad({ buttons: { 0: true, 13: true } }), 0);
    expect(frame.confirm).toBe(false);
    expect(frame.moves).toEqual([]);
    // Al soltar y volver a pulsar, sí dispara.
    reader.update(fakePad({}), 16);
    const second = reader.update(fakePad({ buttons: { 0: true } }), 32);
    expect(second.confirm).toBe(true);
  });

  it('el d-pad mueve en el flanco de pulsación y repite al mantener', () => {
    const reader = new GamepadNavReader();
    reader.update(fakePad({}), 0);
    const pressed = fakePad({ buttons: { 13: true } });
    expect(reader.update(pressed, 16).moves).toEqual(['down']);
    // Mantener por debajo del retardo no repite.
    expect(reader.update(pressed, 100).moves).toEqual([]);
    // Pasado el retardo, repite a intervalos.
    expect(reader.update(pressed, 16 + REPEAT_DELAY_MS + 1).moves).toEqual(['down']);
    expect(
      reader.update(pressed, 16 + REPEAT_DELAY_MS + REPEAT_INTERVAL_MS + 1).moves
    ).toEqual(['down']);
    // Al soltar, se detiene.
    expect(reader.update(fakePad({}), 1000).moves).toEqual([]);
  });

  it('el stick izquierdo actúa como direccional digital con umbral', () => {
    const reader = new GamepadNavReader();
    reader.update(fakePad({}), 0);
    expect(reader.update(fakePad({ axes: [0, 0.3, 0, 0] }), 16).moves).toEqual([]);
    expect(reader.update(fakePad({ axes: [0, 0.9, 0, 0] }), 32).moves).toEqual(['down']);
    reader.update(fakePad({}), 48);
    expect(reader.update(fakePad({ axes: [-0.9, 0, 0, 0] }), 64).moves).toEqual(['left']);
  });

  it('confirmar y volver disparan en el flanco, no al soltar', () => {
    const reader = new GamepadNavReader();
    reader.update(fakePad({}), 0);
    expect(reader.update(fakePad({ buttons: { 1: true } }), 16).back).toBe(true);
    expect(reader.update(fakePad({ buttons: { 1: true } }), 32).back).toBe(false);
    expect(reader.update(fakePad({}), 48).back).toBe(false);
  });

  it('el Micro usa B físico para confirmar y A físico para volver', () => {
    const reader = new GamepadNavReader();
    const micro = (buttons: Record<number, boolean> = {}) =>
      fakePad({ id: '8BitDo Micro gamepad Gamepad', buttons });
    reader.update(micro(), 0);

    const b = reader.update(micro({ 1: true }), 16);
    expect(b.confirm).toBe(true);
    expect(b.back).toBe(false);

    reader.update(micro(), 32);
    const a = reader.update(micro({ 0: true }), 48);
    expect(a.confirm).toBe(false);
    expect(a.back).toBe(true);
  });

  it('el Pro 3 usa B abajo para confirmar y A derecha para volver', () => {
    const reader = new GamepadNavReader();
    const pro3 = (buttons: Record<number, boolean> = {}) =>
      fakePad({ id: '8BitDo Pro 3 Extended Gamepad', buttons });
    reader.update(pro3(), 0);

    const b = reader.update(pro3({ 1: true }), 16);
    expect(b.confirm).toBe(true);
    expect(b.back).toBe(false);

    reader.update(pro3(), 32);
    const a = reader.update(pro3({ 0: true }), 48);
    expect(a.confirm).toBe(false);
    expect(a.back).toBe(true);
  });

  it('mantener confirmar no repite el clic', () => {
    const reader = new GamepadNavReader();
    reader.update(fakePad({}), 0);
    const pressed = fakePad({ buttons: { 0: true } });
    expect(reader.update(pressed, 16).confirm).toBe(true);
    expect(reader.update(pressed, 16 + REPEAT_DELAY_MS + 1).confirm).toBe(false);
    expect(
      reader.update(pressed, 16 + REPEAT_DELAY_MS + REPEAT_INTERVAL_MS * 3).confirm
    ).toBe(false);
  });

  it('al desconectar descarta el estado y vuelve a cebar al reconectar', () => {
    const reader = new GamepadNavReader();
    reader.update(fakePad({}), 0);
    reader.update(fakePad({ buttons: { 0: true } }), 16);
    expect(reader.update(null, 32).connected).toBe(false);
    // Reconectar con el botón aún pulsado: solo ceba.
    expect(reader.update(fakePad({ buttons: { 0: true } }), 48).confirm).toBe(false);
  });

  it('reset() hace que el siguiente frame solo cebe', () => {
    const reader = new GamepadNavReader();
    reader.update(fakePad({}), 0);
    reader.reset();
    expect(reader.update(fakePad({ buttons: { 13: true } }), 16).moves).toEqual([]);
    reader.update(fakePad({}), 32);
    expect(reader.update(fakePad({ buttons: { 13: true } }), 48).moves).toEqual(['down']);
  });
});

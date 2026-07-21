import { describe, expect, it } from 'vitest';
import {
  HOLD_THRESHOLD_MS,
  REPEAT_DELAY_MS,
  REPEAT_INTERVAL_MS,
  HoldButton
} from './holdButton';

describe('HoldButton', () => {
  it('dispara la acción corta solo si se suelta antes del umbral', () => {
    const button = new HoldButton();
    button.update(true, 0);
    const events = button.update(false, HOLD_THRESHOLD_MS - 1);
    expect(events.shortPress).toBe(true);
    expect(events.released).toBe(true);
  });

  it('pasado el umbral activa la acción mantenida', () => {
    const button = new HoldButton();
    button.update(true, 0);
    let events = button.update(true, HOLD_THRESHOLD_MS - 1);
    expect(events.holdActive).toBe(false);
    events = button.update(true, HOLD_THRESHOLD_MS);
    expect(events.holdStart).toBe(true);
    expect(events.holdActive).toBe(true);
    events = button.update(true, HOLD_THRESHOLD_MS + 16);
    expect(events.holdStart).toBe(false);
    expect(events.holdActive).toBe(true);
  });

  it('no dispara la acción corta al soltar tras una mantenida', () => {
    const button = new HoldButton();
    button.update(true, 0);
    button.update(true, HOLD_THRESHOLD_MS + 100);
    const events = button.update(false, HOLD_THRESHOLD_MS + 200);
    expect(events.shortPress).toBe(false);
    expect(events.released).toBe(true);
  });

  it('el movimiento se detiene al soltar (deja de estar holdActive)', () => {
    const button = new HoldButton();
    button.update(true, 0);
    expect(button.update(true, 1000).holdActive).toBe(true);
    expect(button.update(false, 1100).holdActive).toBe(false);
    expect(button.update(false, 1200).holdActive).toBe(false);
  });

  it('repite tras REPEAT_DELAY_MS a intervalos de REPEAT_INTERVAL_MS', () => {
    const button = new HoldButton();
    button.update(true, 0);
    const holdStart = HOLD_THRESHOLD_MS;
    button.update(true, holdStart);
    expect(button.update(true, holdStart + REPEAT_DELAY_MS - 1).repeat).toBe(false);
    expect(button.update(true, holdStart + REPEAT_DELAY_MS).repeat).toBe(true);
    expect(button.update(true, holdStart + REPEAT_DELAY_MS + 10).repeat).toBe(false);
    expect(
      button.update(true, holdStart + REPEAT_DELAY_MS + REPEAT_INTERVAL_MS).repeat
    ).toBe(true);
  });

  it('una nueva pulsación tras soltar vuelve a empezar de cero', () => {
    const button = new HoldButton();
    button.update(true, 0);
    button.update(false, 100); // corta
    button.update(true, 200);
    const events = button.update(false, 300);
    expect(events.shortPress).toBe(true);
  });
});

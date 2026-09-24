import { describe, expect, it } from 'vitest';
import {
  RIGHT_STICK_MAX_MULTIPLIER,
  TRIGGER_DEADZONE,
  applyDeadzone,
  rightStickSpeedMultiplier,
  triggerValue
} from './gamepadInput';

describe('applyDeadzone', () => {
  it('anula valores dentro de la zona muerta', () => {
    expect(applyDeadzone(0.05, 0.12)).toBe(0);
    expect(applyDeadzone(-0.11, 0.12)).toBe(0);
    expect(applyDeadzone(0, 0.12)).toBe(0);
  });

  it('reescala el recorrido restante conservando el signo', () => {
    expect(applyDeadzone(1, 0.12)).toBeCloseTo(1);
    expect(applyDeadzone(-1, 0.12)).toBeCloseTo(-1);
    expect(applyDeadzone(0.56, 0.12)).toBeCloseTo(0.5);
    expect(applyDeadzone(-0.56, 0.12)).toBeCloseTo(-0.5);
  });

  it('ignora valores no finitos', () => {
    expect(applyDeadzone(Number.NaN, 0.12)).toBe(0);
  });
});

describe('triggerValue', () => {
  it('usa el valor analógico proporcional cuando existe', () => {
    expect(triggerValue({ pressed: true, value: 0.56 })).toBeCloseTo(0.5);
  });

  it('respeta la zona muerta del gatillo', () => {
    expect(triggerValue({ pressed: false, value: TRIGGER_DEADZONE - 0.01 })).toBe(0);
  });

  it('con gatillo digital devuelve 1 al estar pulsado', () => {
    expect(triggerValue({ pressed: true, value: 0 })).toBe(1);
    expect(triggerValue({ pressed: false, value: 0 })).toBe(0);
  });
});

describe('rightStickSpeedMultiplier', () => {
  it('conserva la velocidad dentro de la zona muerta', () => {
    expect(rightStickSpeedMultiplier(0)).toBe(1);
    expect(rightStickSpeedMultiplier(-0.1)).toBe(1);
  });

  it('frena hasta detenerse sin invertir el sentido', () => {
    expect(rightStickSpeedMultiplier(-1)).toBe(0);
    expect(rightStickSpeedMultiplier(-0.575)).toBeCloseTo(0.5);
    expect(rightStickSpeedMultiplier(-5)).toBe(0);
  });

  it('acelera hasta el máximo', () => {
    expect(rightStickSpeedMultiplier(1)).toBe(RIGHT_STICK_MAX_MULTIPLIER);
    expect(rightStickSpeedMultiplier(0.575)).toBeCloseTo((1 + RIGHT_STICK_MAX_MULTIPLIER) / 2);
  });
});

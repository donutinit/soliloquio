import { describe, expect, it } from 'vitest';
import {
  activePro3VirtualButtons,
  PRO3_VIRTUAL_BUTTONS,
  pro3VirtualButton
} from './pro3Profile';

function buttons(...pressed: number[]): { pressed: boolean; value: number }[] {
  return Array.from({ length: 17 }, (_, index) => ({
    pressed: pressed.includes(index),
    value: pressed.includes(index) ? 1 : 0
  }));
}

describe('perfil virtual 8BitDo Pro 3', () => {
  it('reserva cuatro índices únicos para L4/R4/PL/PR', () => {
    expect(PRO3_VIRTUAL_BUTTONS.map(({ index }) => index)).toEqual([28, 29, 30, 31]);
    expect(PRO3_VIRTUAL_BUTTONS.map(({ label }) => label)).toEqual(['L4', 'R4', 'PL', 'PR']);
    expect(pro3VirtualButton(30)?.label).toBe('PL');
    expect(pro3VirtualButton(17)).toBeUndefined();
  });

  it('reconoce cada combinación y no acepta botones individuales', () => {
    expect(activePro3VirtualButtons(buttons(8))).toEqual([]);
    expect(activePro3VirtualButtons(buttons(0))).toEqual([]);
    expect(activePro3VirtualButtons(buttons(8, 0)).map(({ label }) => label)).toEqual(['L4']);
    expect(activePro3VirtualButtons(buttons(8, 1)).map(({ label }) => label)).toEqual(['R4']);
    expect(activePro3VirtualButtons(buttons(8, 2)).map(({ label }) => label)).toEqual(['PL']);
    expect(activePro3VirtualButtons(buttons(8, 3)).map(({ label }) => label)).toEqual(['PR']);
  });
});

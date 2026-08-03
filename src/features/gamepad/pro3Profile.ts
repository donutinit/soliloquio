type ButtonLike = { pressed: boolean; value: number };

export type Pro3VirtualButton = {
  index: number;
  label: 'L4' | 'R4' | 'PL' | 'PR';
  /** Botones crudos que el control extra debe emitir mediante su remapeo interno. */
  chord: readonly [number, number];
  chordLabel: string;
};

/**
 * WebKit descarta los cuatro controles extra aunque GameController.framework
 * sí los conozca. El Pro 3 puede remapearlos internamente a combinaciones; se
 * reservan índices altos para reconstruir cuatro botones virtuales sin chocar
 * con entradas que un navegador pueda añadir al arreglo Gamepad.buttons.
 */
export const PRO3_VIRTUAL_BUTTONS: readonly Pro3VirtualButton[] = [
  { index: 28, label: 'L4', chord: [8, 0], chordLabel: 'Select + A' },
  { index: 29, label: 'R4', chord: [8, 1], chordLabel: 'Select + B' },
  { index: 30, label: 'PL', chord: [8, 2], chordLabel: 'Select + X' },
  { index: 31, label: 'PR', chord: [8, 3], chordLabel: 'Select + Y' }
];

function isPressed(button: ButtonLike | undefined): boolean {
  return button?.pressed === true || (button?.value ?? 0) > 0.5;
}

export function activePro3VirtualButtons(buttons: readonly ButtonLike[]): Pro3VirtualButton[] {
  return PRO3_VIRTUAL_BUTTONS.filter(({ chord }) =>
    chord.every((index) => isPressed(buttons[index]))
  );
}

export function pro3VirtualButton(index: number): Pro3VirtualButton | undefined {
  return PRO3_VIRTUAL_BUTTONS.find((button) => button.index === index);
}

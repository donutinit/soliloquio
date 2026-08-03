import type { GamepadAction } from '../../types';

export const MICRO_SELECT_BUTTON = 8;
export const MICRO_B_BUTTON = 1;

export const MICRO_DPAD = {
  up: 12,
  down: 13,
  left: 14,
  right: 15
} as const;

export const MICRO_SLOW_MULTIPLIER = 0.2;
export const MICRO_FAST_MULTIPLIER = 2;

export const MICRO_RESERVED_BUTTONS: readonly number[] = [
  MICRO_SELECT_BUTTON,
  MICRO_DPAD.up,
  MICRO_DPAD.down,
  MICRO_DPAD.left,
  MICRO_DPAD.right
];

export const MICRO_FIXED_ACTION_LABELS: Partial<Record<GamepadAction, string>> = {
  toggleControllerGuide: 'Select',
  toggleSections: 'Select + B',
  fontUp: 'Select + D-pad Up',
  fontDown: 'Select + D-pad Down',
  marginDown: 'Select + D-pad Left',
  marginUp: 'Select + D-pad Right'
};

export function isMicroFixedAction(action: GamepadAction): boolean {
  return MICRO_FIXED_ACTION_LABELS[action] !== undefined;
}

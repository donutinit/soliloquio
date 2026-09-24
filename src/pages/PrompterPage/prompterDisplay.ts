import {
  FONT_LIMITS,
  MARGIN_LIMITS,
  SPEED_LIMITS
} from '../../features/settings/settings';

export type AdjustableSetting = 'speed' | 'fontSize' | 'horizontalMargin';
export type AdjustmentFeedback = {
  key: AdjustableSetting;
  value: number;
  phase: 'visible' | 'exiting';
};

export const ADJUSTMENT_FEEDBACK_HOLD_MS = 720;
export const ADJUSTMENT_FEEDBACK_EXIT_MS = 220;

export const ADJUSTMENT_DISPLAY: Record<
  AdjustableSetting,
  { label: string; unit: string; min: number; max: number }
> = {
  speed: {
    label: 'Speed',
    unit: ' wpm',
    min: SPEED_LIMITS.min,
    max: SPEED_LIMITS.max
  },
  fontSize: {
    label: 'Text size',
    unit: 'px',
    min: FONT_LIMITS.min,
    max: FONT_LIMITS.max
  },
  horizontalMargin: {
    label: 'Margins',
    unit: '%',
    min: MARGIN_LIMITS.min,
    max: MARGIN_LIMITS.max
  }
};

export function adjustmentProgress(key: AdjustableSetting, value: number): number {
  const display = ADJUSTMENT_DISPLAY[key];
  return ((value - display.min) / (display.max - display.min)) * 100;
}

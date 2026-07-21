export type ScriptFormat = 'markdown' | 'text';

export type Script = {
  id: string;
  title: string;
  content: string;
  format: ScriptFormat;
  createdAt: number;
  updatedAt: number;
  lastPosition?: number;
};

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type PrompterBlock =
  | { type: 'heading'; level: HeadingLevel; text: string; sectionId: string }
  | { type: 'text'; text: string };

export const DEFAULT_DUALSHOCK_MAPPING = {
  cross: 0,
  circle: 1,
  square: 2,
  triangle: 3,
  l1: 4,
  r1: 5,
  l2: 6,
  r2: 7,
  share: 8,
  options: 9,
  leftStickButton: 10,
  rightStickButton: 11,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
  ps: 16,
  touchpad: 17
} as const;

export type ControllerButton = keyof typeof DEFAULT_DUALSHOCK_MAPPING;

export type ControllerMapping = Record<ControllerButton, number>;

export type PrompterSettings = {
  speed: number;
  fontSize: number;
  horizontalMargin: number;
  countdownSeconds: number;
  keepScreenAwake: boolean;
  controllerMapping: ControllerMapping;
};

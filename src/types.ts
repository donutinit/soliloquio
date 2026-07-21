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

/** Formato heredado (versión 1 de settings): botón lógico → índice físico. */
export type ControllerMapping = Record<ControllerButton, number>;

export type GamepadAction =
  | 'togglePlay'
  | 'resetToStart'
  | 'backToScripts'
  | 'toggleControls'
  | 'prevSection'
  | 'nextSection'
  | 'speedDown'
  | 'speedUp'
  | 'fontUp'
  | 'fontDown'
  | 'marginDown'
  | 'marginUp'
  | 'toggleSettings'
  | 'toggleSections';

/** Orden canónico: también decide la prioridad al resolver duplicados. */
export const GAMEPAD_ACTIONS: readonly GamepadAction[] = [
  'togglePlay',
  'resetToStart',
  'backToScripts',
  'toggleControls',
  'prevSection',
  'nextSection',
  'speedDown',
  'speedUp',
  'fontUp',
  'fontDown',
  'marginDown',
  'marginUp',
  'toggleSettings',
  'toggleSections'
];

/** Acción de la app → índice de botón físico del layout estándar del Gamepad API. */
export type GamepadBindings = Record<GamepadAction, number>;

export const DEFAULT_GAMEPAD_BINDINGS: GamepadBindings = {
  togglePlay: DEFAULT_DUALSHOCK_MAPPING.cross,
  resetToStart: DEFAULT_DUALSHOCK_MAPPING.triangle,
  backToScripts: DEFAULT_DUALSHOCK_MAPPING.circle,
  toggleControls: DEFAULT_DUALSHOCK_MAPPING.square,
  prevSection: DEFAULT_DUALSHOCK_MAPPING.l1,
  nextSection: DEFAULT_DUALSHOCK_MAPPING.r1,
  speedDown: DEFAULT_DUALSHOCK_MAPPING.l2,
  speedUp: DEFAULT_DUALSHOCK_MAPPING.r2,
  fontUp: DEFAULT_DUALSHOCK_MAPPING.dpadUp,
  fontDown: DEFAULT_DUALSHOCK_MAPPING.dpadDown,
  marginDown: DEFAULT_DUALSHOCK_MAPPING.dpadLeft,
  marginUp: DEFAULT_DUALSHOCK_MAPPING.dpadRight,
  toggleSettings: DEFAULT_DUALSHOCK_MAPPING.options,
  toggleSections: DEFAULT_DUALSHOCK_MAPPING.share
};

export type PrompterSettings = {
  speed: number;
  fontSize: number;
  horizontalMargin: number;
  countdownSeconds: number;
  keepScreenAwake: boolean;
  controllerBindings: GamepadBindings;
};

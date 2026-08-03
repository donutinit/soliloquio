import { GAMEPAD_ACTIONS, type GamepadAction, type GamepadBindings } from '../../types';
import type { ControllerFamily } from './controllerIdentity';
import { pro3VirtualButton } from './pro3Profile';

export type ActionInfo = {
  action: GamepadAction;
  label: string;
  /** Comportamiento extra del mismo botón (mantener, repetición…). */
  hint?: string;
};

export type ActionGroup = { id: string; title: string; actions: ActionInfo[] };

/** Todas las acciones asignables, agrupadas tal y como se muestran en la UI. */
export const ACTION_GROUPS: ActionGroup[] = [
  {
    id: 'playback',
    title: 'Playback',
    actions: [
      { action: 'togglePlay', label: 'Play / Pause', hint: 'Hold to scroll down' },
      { action: 'resetToStart', label: 'Back to start', hint: 'Hold to scroll up' },
      { action: 'speedUp', label: 'Faster', hint: 'Hold to scroll down; analog on triggers' },
      { action: 'speedDown', label: 'Slower', hint: 'Hold to scroll up; analog on triggers' }
    ]
  },
  {
    id: 'sections',
    title: 'Sections',
    actions: [
      { action: 'prevSection', label: 'Previous section' },
      { action: 'nextSection', label: 'Next section' },
      { action: 'toggleSections', label: 'Section list' }
    ]
  },
  {
    id: 'text',
    title: 'Text layout',
    actions: [
      { action: 'fontUp', label: 'Larger text', hint: 'Hold to repeat' },
      { action: 'fontDown', label: 'Smaller text', hint: 'Hold to repeat' },
      { action: 'marginUp', label: 'Wider margins', hint: 'Hold to repeat' },
      { action: 'marginDown', label: 'Narrower margins', hint: 'Hold to repeat' }
    ]
  },
  {
    id: 'interface',
    title: 'Interface',
    actions: [
      { action: 'toggleControls', label: 'Show / hide controls' },
      { action: 'toggleSettings', label: 'Reader settings' },
      { action: 'toggleControllerGuide', label: 'Controller guide' },
      { action: 'backToScripts', label: 'Exit to scripts' }
    ]
  }
];

const DPAD_LABELS = ['D-pad Up', 'D-pad Down', 'D-pad Left', 'D-pad Right'];

/**
 * Etiquetas por familia para los 18 botones del layout estándar del Gamepad
 * API, en orden de índice físico. La posición es la misma en todos los mandos;
 * solo cambia la serigrafía (en Nintendo/8BitDo, A/B y X/Y van cruzadas).
 */
const FAMILY_BUTTON_LABELS: Partial<Record<ControllerFamily, string[]>> = {
  playstation: [
    'Cross',
    'Circle',
    'Square',
    'Triangle',
    'L1',
    'R1',
    'L2',
    'R2',
    'Share / Create',
    'Options',
    'L3',
    'R3',
    ...DPAD_LABELS,
    'PS',
    'Touchpad'
  ],
  xbox: [
    'A',
    'B',
    'X',
    'Y',
    'LB',
    'RB',
    'LT',
    'RT',
    'View',
    'Menu',
    'LS',
    'RS',
    ...DPAD_LABELS,
    'Xbox',
    'Share'
  ],
  nintendo: [
    'B',
    'A',
    'Y',
    'X',
    'L',
    'R',
    'ZL',
    'ZR',
    'Minus',
    'Plus',
    'LS',
    'RS',
    ...DPAD_LABELS,
    'Home',
    'Capture'
  ],
  '8bitdo': [
    'B',
    'A',
    'Y',
    'X',
    'L',
    'R',
    'L2',
    'R2',
    'Select',
    'Start',
    'LS',
    'RS',
    ...DPAD_LABELS,
    'Home',
    'Star'
  ]
};

export function buttonLabel(index: number, family: ControllerFamily = 'playstation'): string {
  if (family === '8bitdo') {
    const virtualButton = pro3VirtualButton(index);
    if (virtualButton) return virtualButton.label;
  }
  return FAMILY_BUTTON_LABELS[family]?.[index] ?? `Button ${index}`;
}

export type AssignResult = {
  bindings: GamepadBindings;
  /** Acción que ya usaba el botón y recibió el botón anterior a cambio. */
  swappedWith?: GamepadAction;
};

/**
 * Asigna un botón físico a una acción. Si otro botón activo ya lo usaba, las
 * dos asignaciones se intercambian para que ninguna acción quede duplicada.
 */
export function assignBinding(
  bindings: GamepadBindings,
  action: GamepadAction,
  index: number
): AssignResult {
  const conflict = GAMEPAD_ACTIONS.find(
    (other) => other !== action && bindings[other] === index
  );
  const next = { ...bindings, [action]: index };
  if (conflict) next[conflict] = bindings[action];
  return { bindings: next, swappedWith: conflict };
}

export function actionLabel(action: GamepadAction): string {
  for (const group of ACTION_GROUPS) {
    const found = group.actions.find((info) => info.action === action);
    if (found) return found.label;
  }
  return action;
}

import type { IconName } from '../../components/Icon';

export type ControllerFamily = 'playstation' | 'xbox' | 'nintendo' | '8bitdo' | 'generic';

export type ControllerIdentity = { family: ControllerFamily; name: string };

const FAMILY_NAMES: Record<ControllerFamily, string> = {
  playstation: 'PlayStation controller',
  xbox: 'Xbox controller',
  nintendo: 'Nintendo controller',
  '8bitdo': '8BitDo controller',
  generic: 'Controller'
};

const EIGHT_BITDO_MICRO_PATTERN = /8bitdo\s+micro|^2dc8-3106-/;

export function is8BitDoMicro(id: string | null | undefined): boolean {
  return EIGHT_BITDO_MICRO_PATTERN.test((id ?? '').toLowerCase());
}

/**
 * Vendor IDs USB tal y como aparecen en `Gamepad.id`: Chrome usa
 * "Vendor: 054c", Firefox antepone "054c-". Se comprueban ambas formas.
 */
const VENDOR_PATTERNS: [ControllerFamily, RegExp][] = [
  ['8bitdo', /vendor:\s*2dc8|^2dc8-/],
  ['playstation', /vendor:\s*054c|^054c-/],
  ['xbox', /vendor:\s*045e|^045e-/],
  ['nintendo', /vendor:\s*057e|^057e-/]
];

/**
 * El orden importa: 8BitDo va antes que Xbox porque en modo XInput muchos de
 * sus mandos se anuncian también como "Xbox 360". La detección es best-effort:
 * un mando en modo compatibilidad sin marca en el id se clasifica como Xbox.
 */
const KEYWORD_PATTERNS: [ControllerFamily, RegExp][] = [
  ['8bitdo', /8bitdo/],
  ['playstation', /dualshock|dualsense|playstation|\bsony\b|\bps[345]\b/],
  ['xbox', /xbox|xinput/],
  ['nintendo', /nintendo|switch|joy-?con|pro controller/]
];

export function identifyController(id: string | null | undefined): ControllerIdentity {
  const normalized = (id ?? '').toLowerCase();
  if (is8BitDoMicro(normalized)) {
    return { family: '8bitdo', name: '8BitDo Micro controller' };
  }
  for (const [family, pattern] of [...KEYWORD_PATTERNS, ...VENDOR_PATTERNS]) {
    if (pattern.test(normalized)) return { family, name: FAMILY_NAMES[family] };
  }
  return { family: 'generic', name: FAMILY_NAMES.generic };
}

export function gamepadIconName(family: ControllerFamily): IconName {
  switch (family) {
    case 'playstation':
      return 'gamepadPlaystation';
    case 'xbox':
      return 'gamepadXbox';
    case 'nintendo':
      return 'gamepadNintendo';
    case '8bitdo':
      return 'gamepadRetro';
    default:
      return 'gamepad';
  }
}

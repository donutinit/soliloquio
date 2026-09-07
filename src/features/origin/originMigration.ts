export const CANONICAL_APP_ORIGIN = 'https://tele.vondiego.com';
export const LEGACY_APP_HOSTNAME = 'soli.vondiego.com';

export function isLegacyAppOrigin(hostname: string): boolean {
  return hostname.toLowerCase() === LEGACY_APP_HOSTNAME;
}

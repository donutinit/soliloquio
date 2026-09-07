export const CANONICAL_APP_ORIGIN = 'https://soli.vondiego.com';
export const LEGACY_APP_HOSTNAME = 'tele.vondiego.com';

export function isLegacyAppOrigin(hostname: string): boolean {
  return hostname.toLowerCase() === LEGACY_APP_HOSTNAME;
}

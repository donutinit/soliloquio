import type { CSSProperties } from 'react';

/**
 * Tipa variables CSS personalizadas para la prop `style` de React sin recurrir
 * a casts sueltos por todo el árbol.
 */
export function cssVars(vars: Record<`--${string}`, string | number>): CSSProperties {
  return vars as CSSProperties;
}

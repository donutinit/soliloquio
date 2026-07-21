export type NavDirection = 'up' | 'down' | 'left' | 'right';

export type NavRect = { left: number; top: number; width: number; height: number };

/** Penalización por desalineación en el eje perpendicular al movimiento. */
const MISALIGNMENT_FACTOR = 2;
/** Avance mínimo en la dirección pedida para considerar un candidato (px). */
const MIN_ADVANCE = 1;

function center(rect: NavRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * Elige el siguiente elemento al moverse en una dirección, al estilo de las
 * interfaces de TV: gana el candidato con menor distancia en el eje del
 * movimiento, penalizando el desvío lateral. Sin envolver en los bordes.
 * Con `fromIndex` nulo devuelve el elemento más arriba a la izquierda.
 */
export function pickNext(
  rects: NavRect[],
  fromIndex: number | null,
  direction: NavDirection
): number | null {
  if (rects.length === 0) return null;
  if (fromIndex === null || fromIndex < 0 || fromIndex >= rects.length) {
    let best = 0;
    for (let i = 1; i < rects.length; i += 1) {
      const a = rects[i];
      const b = rects[best];
      if (a.top < b.top - 1 || (Math.abs(a.top - b.top) <= 1 && a.left < b.left)) best = i;
    }
    return best;
  }

  const from = center(rects[fromIndex]);
  let best: number | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let i = 0; i < rects.length; i += 1) {
    if (i === fromIndex) continue;
    const to = center(rects[i]);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const advance =
      direction === 'up' ? -dy : direction === 'down' ? dy : direction === 'left' ? -dx : dx;
    if (advance < MIN_ADVANCE) continue;
    const drift = direction === 'up' || direction === 'down' ? Math.abs(dx) : Math.abs(dy);
    const score = advance + drift * MISALIGNMENT_FACTOR;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

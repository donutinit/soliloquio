import type { PrompterBlock } from '../../types';

export type Section = {
  id: string;
  title: string;
  startBlockIndex: number;
};

export const IMPLICIT_SECTION_ID = 'section-implicit';

/** Cada heading abre una sección; sin headings hay una única sección implícita. */
export function buildSections(blocks: PrompterBlock[]): Section[] {
  const sections: Section[] = [];
  blocks.forEach((block, index) => {
    if (block.type === 'heading') {
      sections.push({ id: block.sectionId, title: block.text, startBlockIndex: index });
    }
  });
  if (sections.length === 0) {
    return [{ id: IMPLICIT_SECTION_ID, title: '', startBlockIndex: 0 }];
  }
  return sections;
}

/**
 * Índice de la sección activa según la posición de lectura: la última sección
 * cuyo offset (medido en el DOM) queda por encima de la línea de lectura.
 */
export function currentSectionIndex(
  offsets: readonly number[],
  position: number,
  readingLine = 0
): number {
  if (offsets.length === 0) return 0;
  let current = 0;
  for (let i = 0; i < offsets.length; i++) {
    if (offsets[i] <= position + readingLine) current = i;
    else break;
  }
  return current;
}

/**
 * Section that Previous or Next moves to from the reading position, or
 * undefined when there is none that way. Text before the first heading counts
 * as before section 0, and a script without headings has nothing to step
 * through, so a stray press never sends the reader back to a heading or the start.
 */
export function sectionStepTarget(
  sections: readonly Section[],
  offsets: readonly number[],
  position: number,
  readingLine: number,
  delta: -1 | 1
): number | undefined {
  if (sections.length === 0 || sections[0].id === IMPLICIT_SECTION_ID) return undefined;
  // Only spoken text before the first heading makes a cold open; a script that
  // starts with a heading is already in its first section at the top.
  const beforeFirst =
    sections[0].startBlockIndex > 0 && offsets.length > 0 && position + readingLine < offsets[0];
  const current = beforeFirst ? -1 : currentSectionIndex(offsets, position, readingLine);
  const target = current + delta;
  return target >= 0 && target < sections.length ? target : undefined;
}

/** Índice destino al saltar `delta` secciones, respetando los límites. */
export function stepSection(current: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, current + delta));
}

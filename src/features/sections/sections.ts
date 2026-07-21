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
export function currentSectionIndex(offsets: number[], position: number, readingLine = 0): number {
  if (offsets.length === 0) return 0;
  let current = 0;
  for (let i = 0; i < offsets.length; i++) {
    if (offsets[i] <= position + readingLine) current = i;
    else break;
  }
  return current;
}

/** Índice destino al saltar `delta` secciones, respetando los límites. */
export function stepSection(current: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, current + delta));
}

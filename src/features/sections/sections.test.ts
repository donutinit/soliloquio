import { describe, expect, it } from 'vitest';
import { buildSections, currentSectionIndex, stepSection, IMPLICIT_SECTION_ID } from './sections';
import type { PrompterBlock } from '../../types';

const blocks: PrompterBlock[] = [
  { type: 'heading', level: 1, text: 'Intro', sectionId: 'section-0' },
  { type: 'text', text: 'a' },
  { type: 'heading', level: 2, text: 'Medio', sectionId: 'section-1' },
  { type: 'text', text: 'b' },
  { type: 'heading', level: 2, text: 'Final', sectionId: 'section-2' }
];

describe('buildSections', () => {
  it('crea una sección por heading con índice de bloque', () => {
    const sections = buildSections(blocks);
    expect(sections).toEqual([
      { id: 'section-0', title: 'Intro', startBlockIndex: 0 },
      { id: 'section-1', title: 'Medio', startBlockIndex: 2 },
      { id: 'section-2', title: 'Final', startBlockIndex: 4 }
    ]);
  });

  it('sin headings crea una única sección implícita', () => {
    const sections = buildSections([{ type: 'text', text: 'solo texto' }]);
    expect(sections).toEqual([{ id: IMPLICIT_SECTION_ID, title: '', startBlockIndex: 0 }]);
  });
});

describe('currentSectionIndex', () => {
  const offsets = [0, 500, 1200];

  it('detecta la sección según la posición y la línea de lectura', () => {
    expect(currentSectionIndex(offsets, 0, 100)).toBe(0);
    expect(currentSectionIndex(offsets, 450, 100)).toBe(1);
    expect(currentSectionIndex(offsets, 1200, 100)).toBe(2);
  });

  it('nunca se sale de los límites', () => {
    expect(currentSectionIndex(offsets, -50, 0)).toBe(0);
    expect(currentSectionIndex(offsets, 99999, 0)).toBe(2);
    expect(currentSectionIndex([], 100, 0)).toBe(0);
  });
});

describe('stepSection', () => {
  it('avanza y retrocede respetando los límites', () => {
    expect(stepSection(0, 1, 3)).toBe(1);
    expect(stepSection(2, 1, 3)).toBe(2);
    expect(stepSection(0, -1, 3)).toBe(0);
    expect(stepSection(1, -1, 3)).toBe(0);
    expect(stepSection(5, 1, 0)).toBe(0);
  });
});

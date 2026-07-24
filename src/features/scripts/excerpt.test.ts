import { describe, expect, it } from 'vitest';
import { scriptExcerpt } from './excerpt';

describe('scriptExcerpt', () => {
  it('normaliza Markdown y espacios para la vista previa', () => {
    expect(scriptExcerpt('# Heading\n\nSome **important** text.')).toBe(
      'Heading Some important text.'
    );
  });

  it('recorta contenido largo sin partir la última palabra', () => {
    const excerpt = scriptExcerpt(`${'complete '.repeat(40)}unfinished`);

    expect(excerpt.length).toBeLessThanOrEqual(240);
    expect(excerpt.endsWith('complete')).toBe(true);
    expect(excerpt.endsWith('complet')).toBe(false);
  });
});

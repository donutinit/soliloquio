import { describe, expect, it } from 'vitest';
import type { Script } from '../../types';
import { buildScriptLibraryIndex, filterScriptLibraryIndex } from './libraryIndex';

const scripts: Script[] = [
  {
    id: 'one',
    title: 'Opening remarks',
    content: '# Welcome\n\nThank **everyone** for joining.',
    format: 'markdown',
    createdAt: 1,
    updatedAt: 2
  },
  {
    id: 'two',
    title: 'Empty card',
    content: '',
    format: 'text',
    createdAt: 3,
    updatedAt: 4
  }
];

describe('script library index', () => {
  it('derives each search body and excerpt once when the collection changes', () => {
    const index = buildScriptLibraryIndex(scripts);

    expect(index[0]?.excerpt).toBe('Welcome Thank everyone for joining.');
    expect(index[0]?.searchText).toContain('opening remarks');
    expect(index[1]?.excerpt).toBe('Empty');
  });

  it('filters the cached index by title or body without rebuilding it', () => {
    const index = buildScriptLibraryIndex(scripts);

    expect(filterScriptLibraryIndex(index, '  REMARKS ')).toEqual([index[0]]);
    expect(filterScriptLibraryIndex(index, 'everyone')).toEqual([index[0]]);
    expect(filterScriptLibraryIndex(index, '')).toBe(index);
  });
});

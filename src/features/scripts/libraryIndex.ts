import type { Script } from '../../types';
import { scriptExcerpt } from './excerpt';

export type ScriptLibraryEntry = {
  script: Script;
  excerpt: string;
  searchText: string;
};

export function buildScriptLibraryIndex(scripts: readonly Script[]): ScriptLibraryEntry[] {
  return scripts.map((script) => ({
    script,
    excerpt: scriptExcerpt(script.content) || 'Empty',
    searchText: `${script.title}\n${script.content}`.toLowerCase()
  }));
}

export function filterScriptLibraryIndex(
  entries: readonly ScriptLibraryEntry[],
  query: string
): readonly ScriptLibraryEntry[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return entries;
  return entries.filter(({ searchText }) => searchText.includes(normalizedQuery));
}

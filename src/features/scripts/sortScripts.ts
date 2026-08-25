import type { Script } from '../../types';

const titleCollator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base',
  usage: 'sort'
});

function compareExactText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Orders titles alphabetically while treating digit sequences as numbers. */
export function compareScriptsByTitle(left: Script, right: Script): number {
  return (
    titleCollator.compare(left.title, right.title) ||
    compareExactText(left.title, right.title) ||
    right.updatedAt - left.updatedAt ||
    right.createdAt - left.createdAt ||
    compareExactText(left.id, right.id)
  );
}

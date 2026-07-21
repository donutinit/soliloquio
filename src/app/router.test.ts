import { describe, expect, it } from 'vitest';
import { editorHash, parseHash, prompterHash } from './router';

describe('hash routing', () => {
  it('round-trips prompter and editor script ids', () => {
    expect(parseHash(prompterHash('a/b'))).toEqual({ page: 'prompter', scriptId: 'a/b' });
    expect(parseHash(editorHash('a/b'))).toEqual({ page: 'scripts', editScriptId: 'a/b' });
  });

  it('falls back safely for malformed or trailing paths', () => {
    expect(parseHash('#/prompter/%')).toEqual({ page: 'scripts' });
    expect(parseHash('#/prompter/id/extra')).toEqual({ page: 'scripts' });
  });
});

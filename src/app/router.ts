import { useCallback, useEffect, useState } from 'react';

export type Route =
  | { page: 'scripts'; editScriptId?: string }
  | { page: 'prompter'; scriptId: string };

export function parseHash(hash: string): Route {
  const prompterMatch = /^#\/prompter\/([^/]+)$/.exec(hash);
  if (prompterMatch) {
    try {
      return { page: 'prompter', scriptId: decodeURIComponent(prompterMatch[1]) };
    } catch {
      return { page: 'scripts' };
    }
  }
  const editMatch = /^#\/edit\/([^/]+)$/.exec(hash);
  if (editMatch) {
    try {
      return { page: 'scripts', editScriptId: decodeURIComponent(editMatch[1]) };
    } catch {
      return { page: 'scripts' };
    }
  }
  return { page: 'scripts' };
}

export function prompterHash(scriptId: string): string {
  return `#/prompter/${encodeURIComponent(scriptId)}`;
}

export function editorHash(scriptId: string): string {
  return `#/edit/${encodeURIComponent(scriptId)}`;
}

/** Navegación cliente mínima basada en hash: dos páginas, sin recargas. */
export function useRoute(): [Route, (hash: string) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((hash: string) => {
    window.location.hash = hash;
  }, []);

  return [route, navigate];
}

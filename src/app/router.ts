import { useCallback, useEffect, useState } from 'react';

export type Route = { page: 'scripts' } | { page: 'prompter'; scriptId: string };

export function parseHash(hash: string): Route {
  const match = /^#\/prompter\/([^/]+)/.exec(hash);
  if (match) return { page: 'prompter', scriptId: decodeURIComponent(match[1]) };
  return { page: 'scripts' };
}

export function prompterHash(scriptId: string): string {
  return `#/prompter/${encodeURIComponent(scriptId)}`;
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

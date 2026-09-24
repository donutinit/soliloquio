import { useCallback, useEffect, useState } from 'react';
import type { PrompterBlock, PrompterSettings, Script } from '../../types';
import { getScript, getSettings } from '../../services/database';

type LoadState =
  | { kind: 'loading'; scriptId: string }
  | { kind: 'missing'; scriptId: string }
  | { kind: 'error'; scriptId: string }
  | {
      kind: 'ready';
      scriptId: string;
      script: Script;
      settings: PrompterSettings;
      blocks: PrompterBlock[];
    };

/** Loads local data and parses large scripts away from the UI thread when possible. */
export function useLoadedPrompterScript(scriptId: string): {
  state: LoadState;
  retry: () => void;
} {
  const [state, setState] = useState<LoadState>({ kind: 'loading', scriptId });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    let parserWorker: Worker | null = null;
    setState({ kind: 'loading', scriptId });
    void Promise.all([getScript(scriptId), getSettings()])
      .then(([script, settings]) => {
        if (cancelled) return;
        if (!script) {
          setState({ kind: 'missing', scriptId });
          return;
        }
        const ready = (blocks: PrompterBlock[]) => {
          if (!cancelled) setState({ kind: 'ready', scriptId, script, settings, blocks });
        };
        const parseOnMainThread = () => {
          void import('../../features/markdown/flatten')
            .then(({ scriptToBlocks }) => ready(scriptToBlocks(script)))
            .catch(() => {
              if (!cancelled) setState({ kind: 'error', scriptId });
            });
        };
        try {
          parserWorker = new Worker(
            new URL('../../features/markdown/parse.worker.ts', import.meta.url),
            { type: 'module' }
          );
          parserWorker.onmessage = (event: MessageEvent<{ blocks?: PrompterBlock[]; error?: true }>) => {
            parserWorker?.terminate();
            parserWorker = null;
            if (event.data.blocks) ready(event.data.blocks);
            else if (!cancelled) setState({ kind: 'error', scriptId });
          };
          parserWorker.onerror = () => {
            parserWorker?.terminate();
            parserWorker = null;
            if (!cancelled) parseOnMainThread();
          };
          parserWorker.postMessage({ content: script.content, format: script.format });
        } catch {
          parserWorker?.terminate();
          parserWorker = null;
          parseOnMainThread();
        }
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error', scriptId });
      });
    return () => {
      cancelled = true;
      parserWorker?.terminate();
    };
  }, [scriptId, attempt]);

  return {
    state: state.scriptId === scriptId ? state : { kind: 'loading', scriptId },
    retry
  };
}

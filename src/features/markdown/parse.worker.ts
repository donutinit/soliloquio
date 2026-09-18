/// <reference lib="webworker" />

import { scriptToBlocks } from './flatten';
import type { ScriptFormat } from '../../types';

type ParseRequest = { content: string; format: ScriptFormat };

self.addEventListener('message', (event: MessageEvent<ParseRequest>) => {
  try {
    self.postMessage({ blocks: scriptToBlocks(event.data) });
  } catch {
    self.postMessage({ error: true });
  }
});

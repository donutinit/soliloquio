import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportBackupFile, exportScriptFile } from './exportFiles';
import { makeBackup } from '../features/export/backup';
import { defaultSettings } from '../features/settings/settings';
import type { Script } from '../types';

const script: Script = {
  id: 'one',
  title: 'One',
  content: 'hello',
  format: 'markdown',
  createdAt: 1,
  updatedAt: 2
};

type AnchorStub = {
  href: string;
  download: string;
  hidden: boolean;
  clicked: number;
  removed: boolean;
  click(): void;
  remove(): void;
}

type DocumentStub = {
  createElement(tag: string): AnchorStub;
  body: { appendChild(anchor: AnchorStub): AnchorStub };
};

type NavigatorStub = {
  share?: (data: { files: File[]; title?: string }) => Promise<void>;
  canShare?: (data: { files: File[] }) => boolean;
};

const urlStatics = URL as unknown as {
  createObjectURL?: (file: File) => string;
  revokeObjectURL?: (url: string) => void;
};

function installDocumentStub(): AnchorStub[] {
  const anchors: AnchorStub[] = [];
  const documentStub: DocumentStub = {
    createElement() {
      const anchor: AnchorStub = {
        href: '',
        download: '',
        hidden: false,
        clicked: 0,
        removed: false,
        click() {
          this.clicked += 1;
        },
        remove() {
          this.removed = true;
        }
      };
      anchors.push(anchor);
      return anchor;
    },
    body: { appendChild: (anchor: AnchorStub) => anchor }
  };
  vi.stubGlobal('document', documentStub);
  return anchors;
}

function installObjectUrls(): string[] {
  const urls: string[] = [];
  urlStatics.createObjectURL = (file: File) => {
    const url = `blob:stub-${file.name}-${urls.length}`;
    urls.push(url);
    return url;
  };
  urlStatics.revokeObjectURL = (url: string) => {
    const at = urls.indexOf(url);
    if (at >= 0) urls.splice(at, 1);
  };
  return urls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete urlStatics.createObjectURL;
  delete urlStatics.revokeObjectURL;
});

describe('exportFiles', () => {
  it('descarga mediante ancla oculta cuando no hay Web Share', async () => {
    const anchors = installDocumentStub();
    const urls = installObjectUrls();
    vi.stubGlobal('navigator', {});
    vi.useFakeTimers();

    await exportScriptFile({ ...script, title: 'Mi guion' });

    const anchor = anchors[0];
    expect(anchor?.clicked).toBe(1);
    expect(anchor?.hidden).toBe(true);
    expect(anchor?.download).toBe('Mi guion.md');
    expect(anchor?.href).toContain('blob:stub-');
    expect(urls).toHaveLength(1);

    vi.advanceTimersByTime(1000);
    expect(anchor?.removed).toBe(true);
    expect(urls).toHaveLength(0);
  });

  it('comparte cuando la API acepta archivos', async () => {
    installDocumentStub();
    const urls = installObjectUrls();
    const shared: { title?: string; files: File[] }[] = [];
    const navigatorStub: NavigatorStub = {
      share: async (data) => {
        shared.push(data);
      },
      canShare: () => true
    };
    vi.stubGlobal('navigator', navigatorStub);

    await exportScriptFile(script);

    expect(shared).toHaveLength(1);
    expect(urls).toHaveLength(0);
  });

  it('una cancelación del usuario no descarga nada', async () => {
    const anchors = installDocumentStub();
    installObjectUrls();
    const navigatorStub: NavigatorStub = {
      share: async () => {
        throw new DOMException('aborted', 'AbortError');
      },
      canShare: () => true
    };
    vi.stubGlobal('navigator', navigatorStub);

    await exportScriptFile(script);

    expect(anchors).toHaveLength(0);
  });

  it('un fallo de share cae a la descarga', async () => {
    const anchors = installDocumentStub();
    const urls = installObjectUrls();
    const navigatorStub: NavigatorStub = {
      share: async () => {
        throw new Error('share broke');
      },
      canShare: () => true
    };
    vi.stubGlobal('navigator', navigatorStub);

    await exportScriptFile(script);

    expect(anchors[0]?.clicked).toBe(1);
    expect(urls).toHaveLength(1);
  });

  it('exporta el backup con la fecha en el nombre', async () => {
    const anchors = installDocumentStub();
    installObjectUrls();
    vi.stubGlobal('navigator', {});

    await exportBackupFile(makeBackup([script], defaultSettings(), '2026-09-05T10:00:00Z'));

    expect(anchors[0]?.download).toBe('soliloquio-backup-2026-09-05.json');
  });
});

import type { Script } from '../types';
import type { SoliloquioBackup } from '../features/export/backup';

function safeFileName(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80) || 'untitled';
}

/**
 * Entrega un archivo al usuario: Web Share API con archivos cuando está
 * disponible y acepta el tipo, y descarga por ancla oculta en el resto.
 */
export async function shareOrDownload(file: File): Promise<void> {
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  // Safari and headless Chromium can cancel a blob navigation if the anchor is
  // removed in the same task that triggered it.
  setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

export function exportScriptFile(script: Script): Promise<void> {
  const extension = script.format === 'markdown' ? 'md' : 'txt';
  const type = script.format === 'markdown' ? 'text/markdown' : 'text/plain';
  return shareOrDownload(
    new File([script.content], `${safeFileName(script.title)}.${extension}`, { type })
  );
}

export function exportBackupFile(backup: SoliloquioBackup): Promise<void> {
  const date = backup.exportedAt.slice(0, 10) || 'backup';
  return shareOrDownload(
    new File([JSON.stringify(backup, null, 2)], `soliloquio-backup-${date}.json`, {
      type: 'application/json'
    })
  );
}

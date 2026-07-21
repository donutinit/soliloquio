import type { PrompterSettings, Script } from '../../types';
import { normalizeSettings } from '../settings/settings';

export const BACKUP_KIND = 'teleprompter-backup';
export const BACKUP_VERSION = 1;

export type TeleprompterBackup = {
  kind: typeof BACKUP_KIND;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  scripts: Script[];
  settings: PrompterSettings;
};

function isScript(value: unknown): value is Script {
  if (!value || typeof value !== 'object') return false;
  const script = value as Partial<Script>;
  return (
    typeof script.id === 'string' &&
    typeof script.title === 'string' &&
    typeof script.content === 'string' &&
    (script.format === 'markdown' || script.format === 'text') &&
    typeof script.createdAt === 'number' &&
    Number.isFinite(script.createdAt) &&
    typeof script.updatedAt === 'number' &&
    Number.isFinite(script.updatedAt) &&
    (script.lastPosition === undefined ||
      (typeof script.lastPosition === 'number' && Number.isFinite(script.lastPosition)))
  );
}

export function makeBackup(
  scripts: Script[],
  settings: PrompterSettings,
  exportedAt = new Date().toISOString()
): TeleprompterBackup {
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt,
    scripts,
    settings: normalizeSettings(settings)
  };
}

export function parseBackup(raw: string): TeleprompterBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('This is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid backup file.');
  const backup = parsed as Partial<TeleprompterBackup>;
  if (backup.kind !== BACKUP_KIND || backup.version !== BACKUP_VERSION) {
    throw new Error('This is not a supported Teleprompter backup.');
  }
  if (!Array.isArray(backup.scripts) || !backup.scripts.every(isScript)) {
    throw new Error('The backup contains invalid scripts.');
  }
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: typeof backup.exportedAt === 'string' ? backup.exportedAt : '',
    scripts: backup.scripts,
    settings: normalizeSettings(backup.settings)
  };
}

function safeFileName(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80) || 'untitled';
}

async function shareOrDownload(file: File): Promise<void> {
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
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportScriptFile(script: Script): Promise<void> {
  const extension = script.format === 'markdown' ? 'md' : 'txt';
  const type = script.format === 'markdown' ? 'text/markdown' : 'text/plain';
  return shareOrDownload(
    new File([script.content], `${safeFileName(script.title)}.${extension}`, { type })
  );
}

export function exportBackupFile(backup: TeleprompterBackup): Promise<void> {
  const date = backup.exportedAt.slice(0, 10) || 'backup';
  return shareOrDownload(
    new File([JSON.stringify(backup, null, 2)], `teleprompter-backup-${date}.json`, {
      type: 'application/json'
    })
  );
}

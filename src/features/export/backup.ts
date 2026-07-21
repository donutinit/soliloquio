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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidTimestamp(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && Number.isFinite(new Date(value).getTime());
}

/**
 * Validates a script at the backup boundary and copies only canonical fields.
 * Version 1 backups may contain retired or future extra properties; accepting
 * those properties keeps old files restorable without persisting them again.
 */
function parseScript(value: unknown): Script | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    value.id.trim() === '' ||
    typeof value.title !== 'string' ||
    typeof value.content !== 'string' ||
    (value.format !== 'markdown' && value.format !== 'text') ||
    !isValidTimestamp(value.createdAt) ||
    !isValidTimestamp(value.updatedAt)
  ) {
    return undefined;
  }

  return {
    id: value.id,
    title: value.title,
    content: value.content,
    format: value.format,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  };
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
    scripts: scripts.map((script) => ({
      id: script.id,
      title: script.title,
      content: script.content,
      format: script.format,
      createdAt: script.createdAt,
      updatedAt: script.updatedAt
    })),
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
  if (!isRecord(parsed)) throw new Error('Invalid backup file.');
  if (parsed.kind !== BACKUP_KIND || parsed.version !== BACKUP_VERSION) {
    throw new Error('This is not a supported Teleprompter backup.');
  }
  if (!Array.isArray(parsed.scripts)) {
    throw new Error('The backup contains invalid scripts.');
  }
  const scripts: Script[] = [];
  for (const value of parsed.scripts) {
    const script = parseScript(value);
    if (!script) throw new Error('The backup contains invalid scripts.');
    scripts.push(script);
  }
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
    scripts,
    settings: normalizeSettings(parsed.settings)
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

export function exportBackupFile(backup: TeleprompterBackup): Promise<void> {
  const date = backup.exportedAt.slice(0, 10) || 'backup';
  return shareOrDownload(
    new File([JSON.stringify(backup, null, 2)], `teleprompter-backup-${date}.json`, {
      type: 'application/json'
    })
  );
}

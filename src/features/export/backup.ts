import type { PrompterSettings, Script } from '../../types';
import { normalizeSettings } from '../settings/settings';
import { isValidTimestamp } from '../scripts/validTimestamp';

export const BACKUP_KIND = 'soliloquio-backup';
export const BACKUP_VERSION = 1;

export type SoliloquioBackup = {
  kind: typeof BACKUP_KIND;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  scripts: Script[];
  settings: PrompterSettings;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
  exportedAt: string
): SoliloquioBackup {
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

export function parseBackup(raw: string): SoliloquioBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('This is not valid JSON.');
  }
  if (!isRecord(parsed)) throw new Error('Invalid backup file.');
  if (parsed.kind !== BACKUP_KIND || parsed.version !== BACKUP_VERSION) {
    throw new Error('This is not a supported Soliloquio backup.');
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

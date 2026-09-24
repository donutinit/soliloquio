import type { PrompterSettings } from '../types';
import { createScript, getSettings, restoreBackup } from './database';
import { MAX_BACKUP_IMPORT_FILE_BYTES, readImportedFiles } from '../features/import/importFiles';
import { parseBackup } from '../features/export/backup';
import { readPdfText } from './pdfDocuments';

export type ImportSummary = {
  importedCount: number;
  errors: string[];
  restoredSettings: PrompterSettings | null;
};

/** Reads each selected file independently, keeping backup writes atomic. */
export async function importSelectedFiles(files: File[]): Promise<ImportSummary> {
  const errors: string[] = [];
  let importedCount = 0;
  let restoredBackup = false;
  const backupFiles = files.filter((file) => /\.json$/i.test(file.name));
  const scriptFiles = files.filter((file) => !/\.json$/i.test(file.name));

  for (const file of backupFiles) {
    if (file.size > MAX_BACKUP_IMPORT_FILE_BYTES) {
      errors.push(
        `${file.name}: Backup files must be ${MAX_BACKUP_IMPORT_FILE_BYTES / (1024 * 1024)} MB or smaller.`
      );
      continue;
    }

    let raw: string;
    try {
      raw = await file.text();
    } catch {
      errors.push(`${file.name}: The backup file could not be read.`);
      continue;
    }

    let backup: ReturnType<typeof parseBackup>;
    try {
      backup = parseBackup(raw);
    } catch (error) {
      errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Invalid backup file.'}`);
      continue;
    }

    try {
      await restoreBackup(backup.scripts, backup.settings);
      importedCount += backup.scripts.length;
      restoredBackup = true;
    } catch {
      errors.push(
        `${file.name}: The backup could not be restored. Check available device storage and try again.`
      );
    }
  }

  let restoredSettings: PrompterSettings | null = null;
  if (restoredBackup) {
    try {
      restoredSettings = await getSettings();
    } catch {
      errors.push('The backup was restored, but its screen setting could not be applied.');
    }
  }

  for (const outcome of await readImportedFiles(scriptFiles, readPdfText)) {
    if (!outcome.ok) {
      errors.push(`${outcome.fileName}: ${outcome.error}`);
      continue;
    }
    try {
      await createScript({
        title: outcome.title,
        content: outcome.content,
        format: outcome.format
      });
      importedCount += 1;
    } catch {
      errors.push(
        `${outcome.fileName}: The imported script could not be saved. Check available device storage and try again.`
      );
    }
  }

  return { importedCount, errors, restoredSettings };
}

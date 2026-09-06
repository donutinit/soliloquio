import type { ScriptFormat } from '../../types';

const KNOWN_EXTENSIONS = /\.(md|markdown|txt)$/i;

export const MAX_SCRIPT_IMPORT_FILES = 50;
export const MAX_SCRIPT_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_SCRIPT_IMPORT_TOTAL_BYTES = 20 * 1024 * 1024;
/** Los backups agrupan muchos guiones y por eso tienen un tope independiente. */
export const MAX_BACKUP_IMPORT_FILE_BYTES = 25 * 1024 * 1024;

export function isSupportedScriptFile(fileName: string): boolean {
  return KNOWN_EXTENSIONS.test(fileName);
}

export function titleFromFileName(fileName: string): string {
  const title = fileName.replace(KNOWN_EXTENSIONS, '').trim();
  return title || 'Untitled';
}

export function formatFromFileName(fileName: string): ScriptFormat {
  return /\.(md|markdown)$/i.test(fileName) ? 'markdown' : 'text';
}

/**
 * Elimina el frontmatter YAML de Obsidian (`--- … ---` al inicio del archivo).
 * Se aplica SOLO al importar y solo sobre el contenido que se guarda; el
 * archivo de origen nunca se modifica.
 */
export function stripFrontmatter(content: string): string {
  const match = /^\uFEFF?---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(content);
  if (!match) return content;
  return content.slice(match[0].length).replace(/^\s*\n/, '');
}

export type ImportErrorCode =
  | 'too-many-files'
  | 'unsupported-type'
  | 'file-too-large'
  | 'batch-too-large'
  | 'read-failed';

export type ImportOutcome =
  | { ok: true; fileName: string; title: string; content: string; format: ScriptFormat }
  | {
      ok: false;
      fileName: string;
      code: ImportErrorCode;
      error: string;
    };

/**
 * Lee los archivos seleccionados (UTF-8) sin bloquear la UI ni subir nada a
 * ningún servidor. Devuelve un resultado por archivo, con errores aislados.
 */
export async function readImportedFiles(files: File[]): Promise<ImportOutcome[]> {
  const outcomes: ImportOutcome[] = [];
  let selectedBytes = 0;
  let scriptFileCount = 0;

  // La lectura deliberadamente secuencial mantiene acotado el pico de memoria
  // en móviles; cada archivo conserva su propio resultado y no tumba el lote.
  for (const file of files) {
    if (!isSupportedScriptFile(file.name)) {
      outcomes.push({
        ok: false,
        fileName: file.name,
        code: 'unsupported-type',
        error: 'Choose a Markdown (.md, .markdown) or plain-text (.txt) file'
      });
      continue;
    }
    scriptFileCount += 1;
    if (scriptFileCount > MAX_SCRIPT_IMPORT_FILES) {
      outcomes.push({
        ok: false,
        fileName: file.name,
        code: 'too-many-files',
        error: `Choose no more than ${MAX_SCRIPT_IMPORT_FILES} script files at a time`
      });
      continue;
    }
    if (file.size > MAX_SCRIPT_IMPORT_FILE_BYTES) {
      outcomes.push({
        ok: false,
        fileName: file.name,
        code: 'file-too-large',
        error: 'Script files must be 5 MB or smaller'
      });
      continue;
    }
    if (selectedBytes + file.size > MAX_SCRIPT_IMPORT_TOTAL_BYTES) {
      outcomes.push({
        ok: false,
        fileName: file.name,
        code: 'batch-too-large',
        error: 'The selected script files must total 20 MB or less'
      });
      continue;
    }

    selectedBytes += file.size;
    try {
      const content = await file.text();
      outcomes.push({
        ok: true,
        fileName: file.name,
        title: titleFromFileName(file.name),
        content: stripFrontmatter(content),
        format: formatFromFileName(file.name)
      });
    } catch {
      outcomes.push({
        ok: false,
        fileName: file.name,
        code: 'read-failed',
        error: 'The file could not be read'
      });
    }
  }

  return outcomes;
}

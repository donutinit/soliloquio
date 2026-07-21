import type { ScriptFormat } from '../../types';

const KNOWN_EXTENSIONS = /\.(md|markdown|txt)$/i;

export function titleFromFileName(fileName: string): string {
  const title = fileName.replace(KNOWN_EXTENSIONS, '').trim();
  return title || 'Sin título';
}

export function formatFromFileName(fileName: string): ScriptFormat {
  return /\.(md|markdown)$/i.test(fileName) ? 'markdown' : 'text';
}

export type ImportOutcome =
  | { ok: true; fileName: string; title: string; content: string; format: ScriptFormat }
  | { ok: false; fileName: string; error: string };

/**
 * Lee los archivos seleccionados (UTF-8) sin bloquear la UI ni subir nada a
 * ningún servidor. Devuelve un resultado por archivo, con errores aislados.
 */
export async function readImportedFiles(files: File[]): Promise<ImportOutcome[]> {
  return Promise.all(
    files.map(async (file): Promise<ImportOutcome> => {
      try {
        const content = await file.text();
        return {
          ok: true,
          fileName: file.name,
          title: titleFromFileName(file.name),
          content,
          format: formatFromFileName(file.name)
        };
      } catch {
        return { ok: false, fileName: file.name, error: 'No se pudo leer el archivo' };
      }
    })
  );
}

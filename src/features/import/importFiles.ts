import type { ScriptFormat } from '../../types';

const KNOWN_EXTENSIONS = /\.(md|markdown|txt)$/i;

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
      if (!isSupportedScriptFile(file.name)) {
        return {
          ok: false,
          fileName: file.name,
          error: 'Choose a Markdown (.md, .markdown), plain-text (.txt), or backup (.json) file'
        };
      }
      try {
        const content = await file.text();
        return {
          ok: true,
          fileName: file.name,
          title: titleFromFileName(file.name),
          content: stripFrontmatter(content),
          format: formatFromFileName(file.name)
        };
      } catch {
        return { ok: false, fileName: file.name, error: 'The file could not be read' };
      }
    })
  );
}

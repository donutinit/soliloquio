import type { ScriptFormat } from '../../types';
import { docxToMarkdown } from './documents/docx';
import { htmlToMarkdown } from './documents/html';
import { odtToMarkdown } from './documents/odt';
import { rtfToText } from './documents/rtf';
import { subtitlesToText } from './documents/subtitles';

export const MAX_SCRIPT_IMPORT_FILES = 50;
/** Plain-text scripts: the file is the script. */
export const MAX_SCRIPT_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
/** Word, OpenDocument, RTF, and PDF files carry layout and images around their text. */
export const MAX_DOCUMENT_IMPORT_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_SCRIPT_IMPORT_TOTAL_BYTES = 50 * 1024 * 1024;
/** Extracted text of any single import, whatever its source format. */
export const MAX_SCRIPT_TEXT_CHARS = 5 * 1024 * 1024;
/** Los backups agrupan muchos guiones y por eso tienen un tope independiente. */
export const MAX_BACKUP_IMPORT_FILE_BYTES = 25 * 1024 * 1024;
/** How much of an unknown file is inspected to decide whether it is text. */
const TEXT_SNIFF_BYTES = 64 * 1024;

export type DocumentKind =
  | 'markdown'
  | 'text'
  | 'html'
  | 'rtf'
  | 'docx'
  | 'odt'
  | 'pdf'
  | 'subtitles'
  | 'unknown';

const KIND_BY_EXTENSION: Record<string, DocumentKind> = {
  md: 'markdown',
  markdown: 'markdown',
  mdown: 'markdown',
  mkd: 'markdown',
  mkdn: 'markdown',
  txt: 'text',
  text: 'text',
  fountain: 'text',
  html: 'html',
  htm: 'html',
  xhtml: 'html',
  rtf: 'rtf',
  docx: 'docx',
  docm: 'docx',
  dotx: 'docx',
  odt: 'odt',
  ott: 'odt',
  pdf: 'pdf',
  srt: 'subtitles',
  vtt: 'subtitles'
};

/** Formats that cannot be read here, with the export that makes them importable. */
const CONVERT_FIRST: Record<string, string> = {
  doc: 'Save this Word document as .docx or PDF, then import it',
  pages: 'Export this Pages document as Word (.docx) or PDF, then import it',
  wps: 'Save this document as .docx or PDF, then import it',
  key: 'Export this presentation as PDF, then import it',
  ppt: 'Export this presentation as PDF, then import it',
  pptx: 'Export this presentation as PDF, then import it',
  odp: 'Export this presentation as PDF, then import it'
};

/** Media, archives, and binaries never hold a script, even when they happen to decode. */
const NEVER_TEXT = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif', 'avif', 'bmp', 'tif', 'tiff', 'ico', 'psd',
  'mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'opus', 'aif', 'aiff', 'caf',
  'mp4', 'mov', 'm4v', 'avi', 'mkv', 'webm', '3gp',
  'zip', 'rar', '7z', 'gz', 'tgz', 'bz2', 'xz', 'dmg', 'iso', 'pkg', 'ipa', 'apk', 'exe', 'dll',
  'xls', 'xlsx', 'numbers', 'ods', 'epub', 'sqlite', 'db', 'ttf', 'otf', 'woff', 'woff2'
]);

const SUPPORTED_FORMATS_HINT =
  'Supported: Word (.docx), PDF, OpenDocument (.odt), RTF, HTML, Markdown, plain text, and subtitles';

function extensionOf(fileName: string): string {
  const match = /\.([^./\\]{1,12})$/.exec(fileName);
  return match ? match[1].toLowerCase() : '';
}

export function documentKind(fileName: string): DocumentKind {
  return KIND_BY_EXTENSION[extensionOf(fileName)] ?? 'unknown';
}

/** False only for formats that are known not to contain importable text. */
export function isSupportedScriptFile(fileName: string): boolean {
  const extension = extensionOf(fileName);
  return !(extension in CONVERT_FIRST) && !NEVER_TEXT.has(extension);
}

export function titleFromFileName(fileName: string): string {
  const title = fileName.replace(/\.[^./\\]{1,12}$/, '').trim();
  return title || 'Untitled';
}

export function formatFromFileName(fileName: string): ScriptFormat {
  const kind = documentKind(fileName);
  return kind === 'markdown' || kind === 'html' || kind === 'docx' || kind === 'odt'
    ? 'markdown'
    : 'text';
}

function isBinaryDocument(kind: DocumentKind): boolean {
  return kind === 'docx' || kind === 'odt' || kind === 'pdf' || kind === 'rtf';
}

/** Decodes bytes as strict UTF-8 text, or returns null for binary data. */
export function decodeTextBytes(bytes: Uint8Array): string | null {
  const sample = bytes.subarray(0, TEXT_SNIFF_BYTES);
  if (sample.includes(0)) return null;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    // Control characters other than whitespace mark a binary format.
    let controls = 0;
    const limit = Math.min(text.length, TEXT_SNIFF_BYTES);
    for (let index = 0; index < limit; index += 1) {
      const code = text.charCodeAt(index);
      if ((code < 9 || (code > 13 && code < 32)) && ++controls > 8) return null;
    }
    return text;
  } catch {
    return null;
  }
}

/** Reads a PDF's text; supplied by the browser layer so this module stays pure. */
export type PdfTextReader = (buffer: ArrayBuffer) => Promise<string>;

type Converted = { content: string; format: ScriptFormat };

class ConversionError extends Error {}

async function convertFile(
  file: File,
  kind: DocumentKind,
  readPdf: PdfTextReader | undefined
): Promise<Converted> {
  switch (kind) {
    case 'markdown':
      return { content: stripFrontmatter(await file.text()), format: 'markdown' };
    case 'text':
      return { content: await file.text(), format: 'text' };
    case 'html':
      return { content: htmlToMarkdown(await file.text()), format: 'markdown' };
    case 'subtitles':
      return { content: subtitlesToText(await file.text()), format: 'text' };
    case 'rtf':
      try {
        return { content: rtfToText(await file.text()), format: 'text' };
      } catch {
        throw new ConversionError('This RTF document could not be read');
      }
    case 'docx':
      try {
        return { content: await docxToMarkdown(await file.arrayBuffer()), format: 'markdown' };
      } catch {
        throw new ConversionError('This Word document could not be read');
      }
    case 'odt':
      try {
        return { content: await odtToMarkdown(await file.arrayBuffer()), format: 'markdown' };
      } catch {
        throw new ConversionError('This OpenDocument file could not be read');
      }
    case 'pdf':
      if (!readPdf) throw new ConversionError('PDF import is not available here');
      try {
        return { content: await readPdf(await file.arrayBuffer()), format: 'text' };
      } catch (error) {
        throw new ConversionError(
          error instanceof Error && /password/i.test(error.message)
            ? 'Password-protected PDFs cannot be imported'
            : 'This PDF could not be read'
        );
      }
    case 'unknown': {
      const text = decodeTextBytes(new Uint8Array(await file.arrayBuffer()));
      if (text === null) {
        throw new ConversionError(`This file does not contain readable text. ${SUPPORTED_FORMATS_HINT}`);
      }
      return { content: stripFrontmatter(text), format: 'text' };
    }
  }
}

function emptyResultMessage(kind: DocumentKind): string {
  return kind === 'pdf'
    ? 'This PDF has no selectable text; it may be a scanned image'
    : 'No readable text was found in this file';
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
  | 'read-failed'
  | 'no-text';

export type ImportOutcome =
  | { ok: true; fileName: string; title: string; content: string; format: ScriptFormat }
  | {
      ok: false;
      fileName: string;
      code: ImportErrorCode;
      error: string;
    };

/**
 * Lee y convierte los archivos seleccionados sin bloquear la UI ni subir nada
 * a ningún servidor. Devuelve un resultado por archivo, con errores aislados.
 */
export async function readImportedFiles(
  files: File[],
  readPdf?: PdfTextReader,
  onFileStart?: (index: number) => void
): Promise<ImportOutcome[]> {
  const outcomes: ImportOutcome[] = [];
  let selectedBytes = 0;
  let scriptFileCount = 0;

  // La lectura deliberadamente secuencial mantiene acotado el pico de memoria
  // en móviles; cada archivo conserva su propio resultado y no tumba el lote.
  for (const [index, file] of files.entries()) {
    onFileStart?.(index);
    const extension = extensionOf(file.name);
    if (!isSupportedScriptFile(file.name)) {
      outcomes.push({
        ok: false,
        fileName: file.name,
        code: 'unsupported-type',
        error: CONVERT_FIRST[extension] ?? `This file type cannot be imported. ${SUPPORTED_FORMATS_HINT}`
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
    const kind = documentKind(file.name);
    const limit = isBinaryDocument(kind) ? MAX_DOCUMENT_IMPORT_FILE_BYTES : MAX_SCRIPT_IMPORT_FILE_BYTES;
    if (file.size > limit) {
      outcomes.push({
        ok: false,
        fileName: file.name,
        code: 'file-too-large',
        error: isBinaryDocument(kind)
          ? `Documents must be ${MAX_DOCUMENT_IMPORT_FILE_BYTES / (1024 * 1024)} MB or smaller`
          : 'Script files must be 5 MB or smaller'
      });
      continue;
    }
    if (selectedBytes + file.size > MAX_SCRIPT_IMPORT_TOTAL_BYTES) {
      outcomes.push({
        ok: false,
        fileName: file.name,
        code: 'batch-too-large',
        error: `The selected files must total ${MAX_SCRIPT_IMPORT_TOTAL_BYTES / (1024 * 1024)} MB or less`
      });
      continue;
    }

    selectedBytes += file.size;
    let converted: Converted;
    try {
      converted = await convertFile(file, kind, readPdf);
    } catch (error) {
      outcomes.push(
        error instanceof ConversionError
          ? { ok: false, fileName: file.name, code: 'unsupported-type', error: error.message }
          : { ok: false, fileName: file.name, code: 'read-failed', error: 'The file could not be read' }
      );
      continue;
    }
    if (converted.content.length > MAX_SCRIPT_TEXT_CHARS) {
      outcomes.push({
        ok: false,
        fileName: file.name,
        code: 'file-too-large',
        error: 'The text in this file is larger than 5 MB'
      });
      continue;
    }
    // Plain-text and Markdown files may be intentionally empty; converted
    // documents without text are almost always scans or unsupported layouts.
    if (kind !== 'markdown' && kind !== 'text' && !converted.content.trim()) {
      outcomes.push({ ok: false, fileName: file.name, code: 'no-text', error: emptyResultMessage(kind) });
      continue;
    }
    outcomes.push({
      ok: true,
      fileName: file.name,
      title: titleFromFileName(file.name),
      content: converted.content,
      format: converted.format
    });
  }

  return outcomes;
}

/**
 * Minimal ZIP reader for Office/OpenDocument packages: finds one entry by name
 * through the central directory and inflates it with the platform
 * DecompressionStream. No ZIP64, encryption, or spanning — documents never
 * need them, and anything else is rejected as unreadable.
 */

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
const MAX_COMMENT_BYTES = 0xffff;
/** Guards against zip bombs: document XML is never anywhere near this. */
export const MAX_ZIP_ENTRY_BYTES = 64 * 1024 * 1024;

export class ZipError extends Error {}

function findEndOfCentralDirectory(view: DataView): number {
  const lowest = Math.max(0, view.byteLength - 22 - MAX_COMMENT_BYTES);
  for (let offset = view.byteLength - 22; offset >= lowest; offset -= 1) {
    if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY) return offset;
  }
  throw new ZipError('Not a ZIP package');
}

async function inflateRaw(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new ZipError('This browser cannot unpack compressed documents');
  }
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_ZIP_ENTRY_BYTES) {
      await reader.cancel();
      throw new ZipError('Document content is too large');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Names of every entry in the package, in central-directory order. */
export function listZipEntries(buffer: ArrayBuffer): string[] {
  return readDirectory(buffer).map((entry) => entry.name);
}

type DirectoryEntry = {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

function readDirectory(buffer: ArrayBuffer): DirectoryEntry[] {
  const view = new DataView(buffer);
  if (view.byteLength < 22) throw new ZipError('Not a ZIP package');
  const end = findEndOfCentralDirectory(view);
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const entries: DirectoryEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== CENTRAL_DIRECTORY_ENTRY) {
      throw new ZipError('Damaged ZIP directory');
    }
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    entries.push({
      name: decoder.decode(new Uint8Array(buffer, offset + 46, nameLength)),
      method: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      uncompressedSize: view.getUint32(offset + 24, true),
      localHeaderOffset: view.getUint32(offset + 42, true)
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Reads one entry as UTF-8 text, or returns null when the package lacks it. */
export async function readZipText(buffer: ArrayBuffer, name: string): Promise<string | null> {
  const entry = readDirectory(buffer).find((candidate) => candidate.name === name);
  if (!entry) return null;
  if (entry.uncompressedSize > MAX_ZIP_ENTRY_BYTES) throw new ZipError('Document content is too large');
  const view = new DataView(buffer);
  const header = entry.localHeaderOffset;
  if (header + 30 > view.byteLength || view.getUint32(header, true) !== LOCAL_FILE_HEADER) {
    throw new ZipError('Damaged ZIP entry');
  }
  const start = header + 30 + view.getUint16(header + 26, true) + view.getUint16(header + 28, true);
  if (start + entry.compressedSize > view.byteLength) throw new ZipError('Damaged ZIP entry');
  const data = new Uint8Array(buffer, start, entry.compressedSize);
  let bytes: Uint8Array;
  if (entry.method === 0) bytes = data;
  else if (entry.method === 8) bytes = await inflateRaw(data);
  else throw new ZipError('Unsupported ZIP compression');
  return new TextDecoder().decode(bytes);
}

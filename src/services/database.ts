import Dexie, { type EntityTable } from 'dexie';
import type { PrompterSettings, Script } from '../types';
import { defaultSettings, normalizeSettings } from '../features/settings/settings';
import { SAMPLE_SCRIPTS } from '../features/scripts/sampleScripts';
import { compareScriptsByTitle } from '../features/scripts/sortScripts';

type KvEntry = { key: string; value: unknown };
type LegacyScript = Script & { lastPosition?: unknown };

const SCRIPT_STORE_SCHEMA = 'id, updatedAt, title';

export class TeleprompterDB extends Dexie {
  scripts!: EntityTable<Script, 'id'>;
  kv!: EntityTable<KvEntry, 'key'>;

  constructor(name = 'teleprompter') {
    super(name);
    // Migraciones: añadir aquí nuevas versiones con upgrade() sin borrar datos.
    this.version(1).stores({
      scripts: SCRIPT_STORE_SCHEMA,
      kv: 'key'
    });
    this.version(2)
      .stores({
        scripts: SCRIPT_STORE_SCHEMA,
        kv: 'key'
      })
      .upgrade((transaction) =>
        transaction
          .table<LegacyScript, string>('scripts')
          .toCollection()
          .modify((script) => {
            delete script.lastPosition;
          })
      );
  }
}

export const db = new TeleprompterDB();

function newId(): string {
  return crypto.randomUUID();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function validTimestamp(value: unknown): number | undefined {
  if (
    typeof value !== 'number' ||
    value < 0 ||
    !Number.isFinite(new Date(value).getTime())
  ) {
    return undefined;
  }
  return value;
}

/**
 * Convierte datos persistidos no confiables a la forma pública de Script.
 * La normalización de lectura no reescribe el registro fuente: un valor
 * inesperado sigue disponible en IndexedDB para una recuperación posterior.
 */
function normalizeScript(value: unknown): Script | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.trim() === '') return undefined;

  const rawCreatedAt = validTimestamp(value.createdAt);
  const rawUpdatedAt = validTimestamp(value.updatedAt);
  const createdAt = rawCreatedAt ?? rawUpdatedAt ?? 0;

  return {
    id: value.id,
    title: typeof value.title === 'string' ? value.title : 'Untitled',
    content: typeof value.content === 'string' ? value.content : '',
    format: value.format === 'text' ? 'text' : 'markdown',
    createdAt,
    updatedAt: rawUpdatedAt ?? createdAt
  };
}

function factoryScripts(now = Date.now()): Script[] {
  return SAMPLE_SCRIPTS.map((sample, index) => ({
    id: newId(),
    createdAt: now - index,
    updatedAt: now - index,
    ...sample
  }));
}

export async function listScripts(database: TeleprompterDB = db): Promise<Script[]> {
  const scripts: Script[] = [];
  // `orderBy('updatedAt')` omite silenciosamente registros sin ese índice.
  // Recorremos toda la tabla para poder recuperar también datos antiguos o dañados.
  for (const stored of await database.scripts.toArray()) {
    const script = normalizeScript(stored);
    if (script) scripts.push(script);
  }
  return scripts.sort(compareScriptsByTitle);
}

export async function getScript(
  id: string,
  database: TeleprompterDB = db
): Promise<Script | undefined> {
  return normalizeScript(await database.scripts.get(id));
}

export async function createScript(
  data: Pick<Script, 'title' | 'content' | 'format'>,
  database: TeleprompterDB = db
): Promise<Script> {
  const now = Date.now();
  const script: Script = { id: newId(), createdAt: now, updatedAt: now, ...data };
  await database.scripts.add(script);
  return script;
}

export async function updateScript(
  id: string,
  changes: Partial<Pick<Script, 'title' | 'content' | 'format'>>,
  database: TeleprompterDB = db
): Promise<void> {
  await database.scripts.update(id, { ...changes, updatedAt: Date.now() });
}

export async function deleteScript(id: string, database: TeleprompterDB = db): Promise<void> {
  await database.scripts.delete(id);
}

export async function duplicateScript(
  id: string,
  database: TeleprompterDB = db
): Promise<Script | undefined> {
  const original = normalizeScript(await database.scripts.get(id));
  if (!original) return undefined;
  const now = Date.now();
  const copy: Script = {
    id: newId(),
    title: `${original.title} (copy)`,
    content: original.content,
    format: original.format,
    createdAt: now,
    updatedAt: now
  };
  await database.scripts.add(copy);
  return copy;
}

export async function getSettings(database: TeleprompterDB = db): Promise<PrompterSettings> {
  const entry = await database.kv.get('settings');
  return entry ? normalizeSettings(entry.value) : defaultSettings();
}

export async function saveSettings(
  settings: PrompterSettings,
  database: TeleprompterDB = db
): Promise<void> {
  await database.kv.put({ key: 'settings', value: normalizeSettings(settings) });
}

/** Merges a backup into the local library and restores its settings atomically. */
export async function restoreBackup(
  scripts: Script[],
  settings: PrompterSettings,
  database: TeleprompterDB = db
): Promise<void> {
  const normalizedScripts: Script[] = [];
  for (const script of scripts) {
    const normalized = normalizeScript(script);
    if (!normalized) throw new Error('The backup contains invalid scripts.');
    normalizedScripts.push(normalized);
  }

  await database.transaction('rw', database.scripts, database.kv, async () => {
    await database.scripts.bulkPut(normalizedScripts);
    await database.kv.put({ key: 'settings', value: normalizeSettings(settings) });
    await database.kv.put({ key: 'seeded', value: true });
  });
}

/** Atomically erases all local data and recreates the first-run state. */
export async function resetToFactoryDefaults(database: TeleprompterDB = db): Promise<void> {
  await database.transaction('rw', database.scripts, database.kv, async () => {
    await database.scripts.clear();
    await database.kv.clear();
    await database.scripts.bulkAdd(factoryScripts());
    await database.kv.bulkPut([
      { key: 'settings', value: defaultSettings() },
      { key: 'seeded', value: true }
    ]);
  });
}

/** Siembra los guiones de ejemplo solo en el primer arranque. */
export async function seedSampleScripts(database: TeleprompterDB = db): Promise<void> {
  const seeded = await database.kv.get('seeded');
  if (seeded) return;
  const count = await database.scripts.count();
  if (count === 0) {
    await database.scripts.bulkAdd(factoryScripts());
  }
  await database.kv.put({ key: 'seeded', value: true });
}

import Dexie, { type EntityTable } from 'dexie';
import type { PrompterSettings, Script } from '../types';
import { defaultSettings, normalizeSettings } from '../features/settings/settings';
import { SAMPLE_SCRIPTS } from '../features/scripts/sampleScripts';

type KvEntry = { key: string; value: unknown };

export class TeleprompterDB extends Dexie {
  scripts!: EntityTable<Script, 'id'>;
  kv!: EntityTable<KvEntry, 'key'>;

  constructor(name = 'teleprompter') {
    super(name);
    // Migraciones: añadir aquí nuevas versiones con upgrade() sin borrar datos.
    this.version(1).stores({
      scripts: 'id, updatedAt, title',
      kv: 'key'
    });
  }
}

export const db = new TeleprompterDB();

function newId(): string {
  return crypto.randomUUID();
}

export async function listScripts(database: TeleprompterDB = db): Promise<Script[]> {
  return database.scripts.orderBy('updatedAt').reverse().toArray();
}

export async function getScript(
  id: string,
  database: TeleprompterDB = db
): Promise<Script | undefined> {
  return database.scripts.get(id);
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

/** Guarda la posición de lectura sin tocar updatedAt. */
export async function savePosition(
  id: string,
  lastPosition: number,
  database: TeleprompterDB = db
): Promise<void> {
  await database.scripts.update(id, { lastPosition });
}

export async function deleteScript(id: string, database: TeleprompterDB = db): Promise<void> {
  await database.scripts.delete(id);
}

export async function duplicateScript(
  id: string,
  database: TeleprompterDB = db
): Promise<Script | undefined> {
  const original = await database.scripts.get(id);
  if (!original) return undefined;
  const now = Date.now();
  const copy: Script = {
    ...original,
    id: newId(),
    title: `${original.title} (copia)`,
    createdAt: now,
    updatedAt: now,
    lastPosition: undefined
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

/** Siembra los guiones de ejemplo solo en el primer arranque. */
export async function seedSampleScripts(database: TeleprompterDB = db): Promise<void> {
  const seeded = await database.kv.get('seeded');
  if (seeded) return;
  const count = await database.scripts.count();
  if (count === 0) {
    const now = Date.now();
    await database.scripts.bulkAdd(
      SAMPLE_SCRIPTS.map((sample, index) => ({
        id: newId(),
        createdAt: now - index,
        updatedAt: now - index,
        ...sample
      }))
    );
  }
  await database.kv.put({ key: 'seeded', value: true });
}

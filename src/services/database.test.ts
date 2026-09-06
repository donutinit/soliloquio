import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import {
  SoliloquioDB,
  createScript,
  deleteScript,
  duplicateScript,
  getScript,
  getSettings,
  listScripts,
  openDatabase,
  resetToFactoryDefaults,
  saveSettings,
  restoreBackup,
  updateScript
} from './database';
import { defaultSettings } from '../features/settings/settings';
import type { Script } from '../types';

let counter = 0;
const dbs: Dexie[] = [];

type UntrustedScriptRecord = {
  id: string;
  title?: unknown;
  content?: unknown;
  format?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  lastPosition?: unknown;
  recoveryData?: unknown;
};

function freshDbName(): string {
  return `test-${Date.now()}-${counter++}`;
}

function freshDb(): SoliloquioDB {
  const db = new SoliloquioDB(freshDbName());
  dbs.push(db);
  return db;
}

afterEach(async () => {
  const openDatabases = dbs.splice(0);
  const names = new Set(openDatabases.map((database) => database.name));
  for (const database of openDatabases) database.close();
  for (const name of names) await Dexie.delete(name);
});

describe('guiones', () => {
  it('crea, lista, edita y borra guiones', async () => {
    const db = freshDb();
    const script = await createScript({ title: 'Uno', content: 'hola', format: 'markdown' }, db);
    expect(script.id).toBeTruthy();

    await updateScript(script.id, { content: 'adiós' }, db);
    const updated = await getScript(script.id, db);
    expect(updated?.content).toBe('adiós');
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(script.updatedAt);

    await deleteScript(script.id, db);
    expect(await listScripts(db)).toHaveLength(0);
  });

  it('updateScript falla en vez de resurrectar un guion borrado', async () => {
    const db = freshDb();
    const script = await createScript({ title: 'Uno', content: 'hola', format: 'markdown' }, db);
    await deleteScript(script.id, db);
    await expect(updateScript(script.id, { content: 'cambio tardío' }, db)).rejects.toThrow(
      /no longer exists/
    );
    expect(await getScript(script.id, db)).toBeUndefined();
  });

  it('lista los títulos en orden natural, incluyendo secuencias numéricas', async () => {
    const db = freshDb();
    const titles = ['VID143', 'VID2', 'VID001', 'VID4', 'VID02'];
    await db.scripts.bulkPut(
      titles.map((title, index) => ({
        id: `video-${index}`,
        title,
        content: '',
        format: 'text' as const,
        createdAt: index,
        updatedAt: index
      }))
    );

    expect((await listScripts(db)).map((script) => script.title)).toEqual([
      'VID001',
      'VID02',
      'VID2',
      'VID4',
      'VID143'
    ]);
  });

  it('duplica un guion con título «(copy)» y solo campos canónicos', async () => {
    const db = freshDb();
    const original = await createScript({ title: 'Base', content: 'x', format: 'text' }, db);
    await db.table<UntrustedScriptRecord, string>('scripts').put({
      ...original,
      lastPosition: 123,
      recoveryData: { preserved: true }
    });
    const copy = await duplicateScript(original.id, db);
    expect(copy?.title).toBe('Base (copy)');
    expect(copy?.content).toBe('x');
    expect(copy).not.toHaveProperty('lastPosition');
    expect(copy).not.toHaveProperty('recoveryData');
    expect(copy?.id).not.toBe(original.id);
  });

  it('normaliza registros no confiables sin ocultar los que carecen de updatedAt', async () => {
    const db = freshDb();
    const current = await createScript({ title: 'Current', content: 'ok', format: 'text' }, db);
    const rawTable = db.table<UntrustedScriptRecord, string>('scripts');
    await rawTable.put({
      id: 'recovered',
      title: 42,
      content: '# Still recoverable',
      format: 'unknown',
      createdAt: 'yesterday',
      lastPosition: 456.5,
      recoveryData: { originalTitle: 42 }
    });

    expect(await getScript('recovered', db)).toEqual({
      id: 'recovered',
      title: 'Untitled',
      content: '# Still recoverable',
      format: 'markdown',
      createdAt: 0,
      updatedAt: 0
    });
    expect((await listScripts(db)).map((script) => script.id)).toEqual([
      current.id,
      'recovered'
    ]);

    // Normalizar la lectura no destruye información que pudiera recuperarse manualmente.
    expect(await rawTable.get('recovered')).toMatchObject({
      title: 42,
      lastPosition: 456.5,
      recoveryData: { originalTitle: 42 }
    });
  });

  it('normaliza fechas fuera del rango de Date y omite identificadores vacíos', async () => {
    const db = freshDb();
    const rawTable = db.table<UntrustedScriptRecord, string>('scripts');
    await rawTable.bulkPut([
      {
        id: 'invalid-date',
        title: 'Still readable',
        content: 'Content',
        format: 'text',
        createdAt: 10,
        updatedAt: Number.MAX_VALUE
      },
      {
        id: '   ',
        title: 'Cannot be routed',
        content: 'Content',
        format: 'text',
        createdAt: 20,
        updatedAt: 20
      }
    ]);

    expect(await getScript('invalid-date', db)).toMatchObject({
      createdAt: 10,
      updatedAt: 10
    });
    expect((await listScripts(db)).map((script) => script.id)).toEqual(['invalid-date']);
  });

  it('migra la base v1 retirando lastPosition sin alterar el resto del guion', async () => {
    const name = freshDbName();
    const legacy = new Dexie(name);
    dbs.push(legacy);
    legacy.version(1).stores({ scripts: 'id, updatedAt, title', kv: 'key' });
    const legacyScript: Script & { lastPosition?: number; recoveryData: { keep: string } } = {
      id: 'legacy',
      title: 'Legacy',
      content: 'Do not lose this',
      format: 'text',
      createdAt: 10,
      updatedAt: 20,
      lastPosition: 999,
      recoveryData: { keep: 'yes' }
    };
    await legacy.table<typeof legacyScript, string>('scripts').put(legacyScript);
    legacy.close();

    const migrated = new SoliloquioDB(name);
    dbs.push(migrated);
    expect(await getScript('legacy', migrated)).toEqual({
      id: 'legacy',
      title: 'Legacy',
      content: 'Do not lose this',
      format: 'text',
      createdAt: 10,
      updatedAt: 20
    });
    const stored = await migrated
      .table<typeof legacyScript, string>('scripts')
      .get('legacy');
    expect(stored).not.toHaveProperty('lastPosition');
    expect(stored?.recoveryData).toEqual({ keep: 'yes' });
  });
});

describe('ajustes', () => {
  it('devuelve valores por defecto y persiste cambios normalizados', async () => {
    const db = freshDb();
    expect(await getSettings(db)).toEqual(defaultSettings());
    const custom = { ...defaultSettings(), speed: 90, fontSize: 999 };
    await saveSettings(custom, db);
    const loaded = await getSettings(db);
    expect(loaded.speed).toBe(90);
    expect(loaded.fontSize).toBeLessThanOrEqual(120); // recortado al máximo
  });
});

describe('backup restore', () => {
  it('merges scripts and restores settings in one transaction', async () => {
    const database = freshDb();
    const existing = await createScript({ title: 'Existing', content: 'x', format: 'text' }, database);
    const restored: Script & { lastPosition: number } = {
      id: 'restored',
      title: 'Restored',
      content: '# Hello',
      format: 'markdown',
      createdAt: 1,
      updatedAt: 2,
      lastPosition: 300
    };
    await restoreBackup([restored], { ...defaultSettings(), speed: 95 }, database);
    expect((await listScripts(database)).map((script) => script.id)).toEqual(
      expect.arrayContaining([existing.id, restored.id])
    );
    expect((await getSettings(database)).speed).toBe(95);
    expect(
      await database.table<UntrustedScriptRecord, string>('scripts').get(restored.id)
    ).not.toHaveProperty('lastPosition');
  });
});

describe('factory reset', () => {
  it('atomically clears local scripts and restores default settings', async () => {
    const database = freshDb();
    const custom = await createScript(
      { title: 'Private draft', content: 'erase me', format: 'text' },
      database
    );
    await saveSettings({ ...defaultSettings(), speed: 120, countdownSeconds: 7 }, database);

    await resetToFactoryDefaults(database);

    expect(await getScript(custom.id, database)).toBeUndefined();
    expect(await listScripts(database)).toHaveLength(0);
    expect(await getSettings(database)).toEqual(defaultSettings());
  });
});

describe('initialization', () => {
  it('opens a new library without adding scripts', async () => {
    const database = freshDb();
    await openDatabase(database);
    expect(await listScripts(database)).toHaveLength(0);
  });

  it('does not alter scripts already stored on the device', async () => {
    const database = freshDb();
    const existing = await createScript(
      { title: 'Existing script', content: 'Keep me', format: 'text' },
      database
    );
    database.close();

    await openDatabase(database);
    expect(await getScript(existing.id, database)).toEqual(existing);
  });
});

import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TeleprompterDB,
  createScript,
  deleteScript,
  duplicateScript,
  getScript,
  getSettings,
  listScripts,
  savePosition,
  saveSettings,
  seedSampleScripts,
  updateScript
} from './database';
import { defaultSettings } from '../features/settings/settings';

let counter = 0;
const dbs: TeleprompterDB[] = [];

function freshDb(): TeleprompterDB {
  const db = new TeleprompterDB(`test-${Date.now()}-${counter++}`);
  dbs.push(db);
  return db;
}

afterEach(async () => {
  for (const db of dbs.splice(0)) {
    await db.delete();
  }
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

  it('duplica un guion con título «(copia)» y sin posición previa', async () => {
    const db = freshDb();
    const original = await createScript({ title: 'Base', content: 'x', format: 'text' }, db);
    await savePosition(original.id, 123, db);
    const copy = await duplicateScript(original.id, db);
    expect(copy?.title).toBe('Base (copia)');
    expect(copy?.content).toBe('x');
    expect(copy?.lastPosition).toBeUndefined();
    expect(copy?.id).not.toBe(original.id);
  });

  it('persiste la posición de lectura sin tocar updatedAt', async () => {
    const db = freshDb();
    const script = await createScript({ title: 'A', content: 'b', format: 'text' }, db);
    await savePosition(script.id, 456.5, db);
    const loaded = await getScript(script.id, db);
    expect(loaded?.lastPosition).toBe(456.5);
    expect(loaded?.updatedAt).toBe(script.updatedAt);
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

describe('siembra inicial', () => {
  it('crea los ejemplos una sola vez y respeta su borrado', async () => {
    const db = freshDb();
    await seedSampleScripts(db);
    const scripts = await listScripts(db);
    expect(scripts.length).toBeGreaterThanOrEqual(1);

    for (const script of scripts) await deleteScript(script.id, db);
    await seedSampleScripts(db);
    expect(await listScripts(db)).toHaveLength(0); // no re-siembra
  });
});

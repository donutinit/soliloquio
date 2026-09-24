/**
 * Asks the browser to exempt this origin's IndexedDB from automatic eviction.
 * It is best effort: unsupported or denied requests leave storage as it was.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
    if (!storage?.persist) return false;
    if (storage.persisted && (await storage.persisted())) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}

/**
 * Registro de guardados pendientes. Antes de una recarga iniciada por la
 * propia app (p. ej. al aplicar una actualización del Service Worker) se
 * vacían todas las colas registradas para no perder datos del usuario.
 */
type PendingSaveFlush = () => Promise<unknown>;

const flushes = new Set<PendingSaveFlush>();

export function registerPendingSaveFlush(flush: PendingSaveFlush): () => void {
  flushes.add(flush);
  return () => {
    flushes.delete(flush);
  };
}

export async function flushPendingSaves(): Promise<void> {
  await Promise.allSettled(Array.from(flushes, (flush) => flush()));
}

/** Validación compartida de marcas de tiempo persistidas o importadas. */
export function isValidTimestamp(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && Number.isFinite(new Date(value).getTime());
}

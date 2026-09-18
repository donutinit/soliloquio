/** A write must cover changes made while an earlier snapshot was being stored. */
export async function saveUntilUnchanged<T>(
  current: () => T,
  save: (value: T) => Promise<void>
): Promise<void> {
  for (;;) {
    const snapshot = current();
    await save(snapshot);
    if (current() === snapshot) return;
  }
}

export type EditableScript = { title: string; content: string };

function normalizeDraft(draft: EditableScript): EditableScript {
  return { title: draft.title.trim() || 'Untitled', content: draft.content };
}

function sameDraft(a: EditableScript, b: EditableScript): boolean {
  return a.title === b.title && a.content === b.content;
}

/** Serializes editor writes and keeps flushing until the current draft is stored. */
export class DraftSaveQueue {
  private committed: EditableScript;
  private tail: Promise<void> = Promise.resolve();
  private pending = 0;

  constructor(
    initial: EditableScript,
    private readonly latest: () => EditableScript,
    private readonly save: (draft: EditableScript) => Promise<void>,
    private readonly afterSave: () => Promise<void> | void
  ) {
    this.committed = initial;
  }

  isCurrentSaved(): boolean {
    return this.pending === 0 && sameDraft(normalizeDraft(this.latest()), this.committed);
  }

  flush(): Promise<void> {
    this.pending += 1;
    const operation = this.tail
      .then(async () => {
        for (;;) {
          const draft = normalizeDraft(this.latest());
          if (sameDraft(draft, this.committed)) return;
          await this.save(draft);
          this.committed = draft;
          await this.afterSave();
        }
      })
      .finally(() => {
        this.pending -= 1;
      });
    // A failed write must be reported to its caller but must not block a retry.
    this.tail = operation.catch(() => undefined);
    return operation;
  }
}

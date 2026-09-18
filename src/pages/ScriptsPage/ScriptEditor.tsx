import { useCallback, useEffect, useRef, useState } from 'react';
import type { Script } from '../../types';
import { updateScript } from '../../services/database';
import { DraftSaveQueue, type EditableScript } from '../../features/scripts/draftSaveQueue';
import { registerPendingSaveFlush } from '../../services/pendingSaves';
import { useModalFocus } from '../../app/useModalFocus';
import { Icon } from '../../components/Icon';
import styles from './ScriptsPage.module.css';

const AUTOSAVE_DEBOUNCE_MS = 500;

type SaveState = 'saved' | 'pending' | 'saving' | 'error';

export function ScriptEditor({
  script,
  onSaved,
  onClose,
  onOpenPrompter
}: {
  script: Script;
  onSaved: () => Promise<void> | void;
  onClose: () => void;
  onOpenPrompter: () => void;
}) {
  const [title, setTitle] = useState(script.title);
  const [content, setContent] = useState(script.content);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<EditableScript>({ title, content });
  const mountedRef = useRef(true);
  latestRef.current = { title, content };
  const [saveQueue] = useState(
    () => new DraftSaveQueue(
      { title: script.title, content: script.content },
      () => latestRef.current,
      (draft) => updateScript(script.id, draft),
      onSaved
    )
  );

  const persistLatest = useCallback((): Promise<void> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (mountedRef.current) setSaveState('saving');
    return saveQueue.flush().then(
      () => {
        if (mountedRef.current) setSaveState('saved');
      },
      (error: unknown) => {
        if (mountedRef.current) setSaveState('error');
        throw error;
      }
    );
  }, [saveQueue]);

  useEffect(() => {
    if (saveQueue.isCurrentSaved()) return;
    setSaveState('pending');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => void persistLatest().catch(() => undefined),
      AUTOSAVE_DEBOUNCE_MS
    );
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [content, persistLatest, saveQueue, title]);

  // Route changes and page suspension must not discard edits still inside the debounce window.
  useEffect(() => {
    mountedRef.current = true;
    const flushOnPageHide = () => void persistLatest().catch(() => undefined);
    const flushOnHidden = () => {
      if (document.visibilityState === 'hidden') flushOnPageHide();
    };
    const warnOnUnsavedExit = (event: BeforeUnloadEvent) => {
      if (saveQueue.isCurrentSaved()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('pagehide', flushOnPageHide);
    window.addEventListener('beforeunload', warnOnUnsavedExit);
    document.addEventListener('visibilitychange', flushOnHidden);
    // Una recarga automática (actualización) vacía la cola antes de recargar.
    const unregister = registerPendingSaveFlush(() => persistLatest());
    return () => {
      unregister();
      mountedRef.current = false;
      window.removeEventListener('pagehide', flushOnPageHide);
      window.removeEventListener('beforeunload', warnOnUnsavedExit);
      document.removeEventListener('visibilitychange', flushOnHidden);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (!saveQueue.isCurrentSaved()) {
        void saveQueue.flush().catch((error) => {
          console.warn('Save on exit failed', error);
        });
      }
    };
  }, [persistLatest, saveQueue]);

  const close = async () => {
    try {
      await persistLatest();
      onClose();
    } catch {
      // The visible retry state keeps the editor open with its in-memory draft.
    }
  };
  const openPrompter = async () => {
    try {
      await persistLatest();
      onOpenPrompter();
    } catch {
      // Never navigate away from an unsaved draft.
    }
  };
  const dialogRef = useModalFocus<HTMLDivElement>(() => void close());

  const statusText =
    saveState === 'saved'
      ? 'Saved'
      : saveState === 'error'
        ? 'Could not save — try again'
        : saveState === 'pending'
          ? 'Unsaved changes'
          : 'Saving…';

  return (
    <div
      ref={dialogRef}
      className={styles.editorOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="editor-dialog-title"
      tabIndex={-1}
    >
      <header className={styles.editorHeader}>
        <button type="button" data-testid="editor-close" onClick={() => void close()}>
          <Icon name="back" />
          Scripts
        </button>
        {saveState === 'error' ? (
          <button
            type="button"
            data-testid="save-status"
            className={styles.saveError}
            onClick={() => void persistLatest()}
          >
            Retry save
          </button>
        ) : (
          <span data-testid="save-status" className={styles.saveStatus} role="status">
            {statusText}
          </span>
        )}
        <button
          type="button"
          data-testid="editor-open-prompter"
          onClick={() => void openPrompter()}
        >
          Prompter
          <Icon name="play" />
        </button>
      </header>
      <label className={styles.visuallyHidden} htmlFor="editor-title" id="editor-dialog-title">
        Script title
      </label>
      <input
        id="editor-title"
        data-modal-autofocus
        data-testid="editor-title"
        className={styles.editorTitle}
        value={title}
        placeholder="Title"
        onChange={(event) => {
          latestRef.current = { ...latestRef.current, title: event.target.value };
          setTitle(event.target.value);
        }}
      />
      <label className={styles.visuallyHidden} htmlFor="editor-content">
        Script content
      </label>
      <textarea
        id="editor-content"
        data-testid="editor-content"
        className={styles.editorContent}
        value={content}
        placeholder={
          script.format === 'markdown'
            ? 'Write your script here. Markdown headings (#) create sections.'
            : 'Write your plain-text script here. Convert it to Markdown to create sections.'
        }
        onChange={(event) => {
          latestRef.current = { ...latestRef.current, content: event.target.value };
          setContent(event.target.value);
        }}
      />
    </div>
  );
}

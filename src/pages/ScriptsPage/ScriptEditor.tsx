import { useCallback, useEffect, useRef, useState } from 'react';
import type { Script } from '../../types';
import { updateScript } from '../../services/database';
import { useModalFocus } from '../../app/useModalFocus';
import { Icon } from '../../components/Icon';
import styles from './ScriptsPage.module.css';

const AUTOSAVE_DEBOUNCE_MS = 500;

type SaveState = 'saved' | 'pending' | 'saving' | 'error';
type EditableScript = { title: string; content: string };

function normalized(editable: EditableScript): EditableScript {
  return { title: editable.title.trim() || 'Untitled', content: editable.content };
}

function sameEditable(a: EditableScript, b: EditableScript): boolean {
  return a.title === b.title && a.content === b.content;
}

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
  const committedRef = useRef<EditableScript>({ title: script.title, content: script.content });
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const mountedRef = useRef(true);
  latestRef.current = { title, content };

  const persistLatest = useCallback((): Promise<boolean> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const payload = normalized(latestRef.current);
    if (sameEditable(payload, committedRef.current)) {
      if (mountedRef.current) setSaveState('saved');
      return Promise.resolve(true);
    }
    if (mountedRef.current) setSaveState('saving');
    const operation = saveQueueRef.current.then(async () => {
      try {
        await updateScript(script.id, payload);
        committedRef.current = payload;
        await onSaved();
        if (mountedRef.current && sameEditable(normalized(latestRef.current), payload)) {
          setSaveState('saved');
        }
        return true;
      } catch {
        if (mountedRef.current) setSaveState('error');
        return false;
      }
    });
    saveQueueRef.current = operation.then(() => undefined);
    return operation;
  }, [onSaved, script.id]);

  useEffect(() => {
    if (sameEditable(normalized({ title, content }), committedRef.current)) return;
    setSaveState('pending');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void persistLatest(), AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [content, persistLatest, title]);

  // Route changes and page suspension must not discard edits still inside the debounce window.
  useEffect(() => {
    mountedRef.current = true;
    const flushOnPageHide = () => void persistLatest();
    window.addEventListener('pagehide', flushOnPageHide);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('pagehide', flushOnPageHide);
      if (timerRef.current) clearTimeout(timerRef.current);
      const payload = normalized(latestRef.current);
      if (!sameEditable(payload, committedRef.current)) void updateScript(script.id, payload);
    };
  }, [persistLatest, script.id]);

  const close = async () => {
    if (await persistLatest()) onClose();
  };
  const openPrompter = async () => {
    if (await persistLatest()) onOpenPrompter();
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
        onChange={(event) => setTitle(event.target.value)}
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
        onChange={(event) => setContent(event.target.value)}
      />
    </div>
  );
}

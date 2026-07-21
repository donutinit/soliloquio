import { useEffect, useRef, useState } from 'react';
import type { Script } from '../../types';
import { updateScript } from '../../services/database';
import styles from './ScriptsPage.module.css';

const AUTOSAVE_DEBOUNCE_MS = 500;

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
  const [saveState, setSaveState] = useState<'saved' | 'pending' | 'saving'>('saved');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ title, content });
  latestRef.current = { title, content };

  useEffect(() => {
    if (title === script.title && content === script.content) return;
    setSaveState('pending');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setSaveState('saving');
      void updateScript(script.id, {
        title: latestRef.current.title.trim() || 'Sin título',
        content: latestRef.current.content
      })
        .then(() => onSaved())
        .then(() => setSaveState('saved'));
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, script.id]);

  const flushAndClose = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    void updateScript(script.id, {
      title: latestRef.current.title.trim() || 'Sin título',
      content: latestRef.current.content
    })
      .then(() => onSaved())
      .then(() => onClose());
  };

  return (
    <div className={styles.editorOverlay} role="dialog" aria-label="Editor de guion">
      <header className={styles.editorHeader}>
        <button type="button" data-testid="editor-close" onClick={flushAndClose}>
          ‹ Guiones
        </button>
        <span data-testid="save-status" className={styles.saveStatus}>
          {saveState === 'saved' ? 'Guardado' : 'Guardando…'}
        </span>
        <button type="button" data-testid="editor-open-prompter" onClick={onOpenPrompter}>
          Prompter ›
        </button>
      </header>
      <input
        data-testid="editor-title"
        className={styles.editorTitle}
        value={title}
        placeholder="Título"
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        data-testid="editor-content"
        className={styles.editorContent}
        value={content}
        placeholder="Escribe tu guion aquí. Puedes usar encabezados Markdown (#) para crear secciones."
        onChange={(e) => setContent(e.target.value)}
      />
    </div>
  );
}

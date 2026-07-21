import { useCallback, useEffect, useRef, useState } from 'react';
import type { Script } from '../../types';
import {
  createScript,
  deleteScript,
  duplicateScript,
  listScripts
} from '../../services/database';
import { readImportedFiles } from '../../features/import/importFiles';
import { prompterHash } from '../../app/router';
import { ScriptEditor } from './ScriptEditor';
import styles from './ScriptsPage.module.css';

const dateFormat = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' });

function excerpt(content: string): string {
  return content.replace(/[#>*`|-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
}

export function ScriptsPage({ navigate }: { navigate: (hash: string) => void }) {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setScripts(await listScripts());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = query.trim()
    ? scripts.filter((s) =>
        `${s.title}\n${s.content}`.toLowerCase().includes(query.trim().toLowerCase())
      )
    : scripts;

  const handleNew = async () => {
    const script = await createScript({ title: 'Nuevo guion', content: '', format: 'markdown' });
    await refresh();
    setEditingId(script.id);
  };

  const handleImport = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const outcomes = await readImportedFiles(Array.from(fileList));
    const errors: string[] = [];
    for (const outcome of outcomes) {
      if (outcome.ok) {
        await createScript({
          title: outcome.title,
          content: outcome.content,
          format: outcome.format
        });
      } else {
        errors.push(`${outcome.fileName}: ${outcome.error}`);
      }
    }
    setImportErrors(errors);
    await refresh();
  };

  const openMenu = (id: string) => {
    setMenuId(id);
    setConfirmingDelete(false);
  };

  const menuScript = menuId ? scripts.find((s) => s.id === menuId) : undefined;
  const editingScript = editingId ? scripts.find((s) => s.id === editingId) : undefined;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Guiones</h1>
        <div className={styles.headerActions}>
          <button
            type="button"
            data-testid="import-button"
            className={styles.secondaryButton}
            onClick={() => fileInputRef.current?.click()}
          >
            Importar
          </button>
          <button
            type="button"
            data-testid="new-script"
            className={styles.primaryButton}
            onClick={() => void handleNew()}
          >
            + Nuevo
          </button>
        </div>
      </header>

      <input
        ref={fileInputRef}
        data-testid="import-input"
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        multiple
        hidden
        onChange={(e) => {
          void handleImport(e.target.files);
          e.target.value = '';
        }}
      />

      {importErrors.length > 0 && (
        <div className={styles.importErrors} role="alert">
          {importErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
          <button type="button" onClick={() => setImportErrors([])}>
            Cerrar
          </button>
        </div>
      )}

      <div className={styles.searchRow}>
        <input
          data-testid="search-input"
          type="search"
          placeholder="Buscar…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={styles.search}
        />
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty} data-testid="empty-state">
          {scripts.length === 0 ? (
            <>
              <p>No hay guiones todavía.</p>
              <p>Crea uno nuevo o importa archivos .md o .txt.</p>
            </>
          ) : (
            <p>Sin resultados para «{query}».</p>
          )}
        </div>
      ) : (
        <ul className={styles.grid}>
          {filtered.map((script) => (
            <li key={script.id} className={styles.card} data-testid="script-card">
              <button
                type="button"
                className={styles.cardMain}
                data-testid="open-prompter"
                onClick={() => navigate(prompterHash(script.id))}
              >
                <span className={styles.cardTitle} data-testid="card-title">
                  {script.title}
                </span>
                <span className={styles.cardExcerpt}>{excerpt(script.content) || 'Vacío'}</span>
                <span className={styles.cardDate}>
                  {dateFormat.format(new Date(script.updatedAt))}
                </span>
              </button>
              <button
                type="button"
                className={styles.cardMenuButton}
                data-testid="card-menu"
                aria-label={`Opciones de ${script.title}`}
                onClick={() => openMenu(script.id)}
              >
                ⋯
              </button>
            </li>
          ))}
        </ul>
      )}

      {menuScript && (
        <div className={styles.sheetBackdrop} onClick={() => setMenuId(null)}>
          <div
            className={styles.sheet}
            role="dialog"
            aria-label={`Opciones de ${menuScript.title}`}
            onClick={(e) => e.stopPropagation()}
          >
            <p className={styles.sheetTitle}>{menuScript.title}</p>
            <button
              type="button"
              data-testid="menu-edit"
              onClick={() => {
                setEditingId(menuScript.id);
                setMenuId(null);
              }}
            >
              Editar
            </button>
            <button
              type="button"
              data-testid="menu-duplicate"
              onClick={() => {
                void duplicateScript(menuScript.id).then(refresh);
                setMenuId(null);
              }}
            >
              Duplicar
            </button>
            <button
              type="button"
              data-testid="menu-delete"
              className={styles.danger}
              onClick={() => {
                if (!confirmingDelete) {
                  setConfirmingDelete(true);
                  return;
                }
                void deleteScript(menuScript.id).then(refresh);
                setMenuId(null);
              }}
            >
              {confirmingDelete ? '¿Eliminar definitivamente?' : 'Eliminar'}
            </button>
            <button type="button" onClick={() => setMenuId(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {editingScript && (
        <ScriptEditor
          script={editingScript}
          onSaved={refresh}
          onClose={() => setEditingId(null)}
          onOpenPrompter={() => navigate(prompterHash(editingScript.id))}
        />
      )}
    </div>
  );
}

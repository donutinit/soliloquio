import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { PrompterSettings, Script } from '../../types';
import {
  createScript,
  deleteScript,
  duplicateScript,
  getSettings,
  listScripts,
  resetToFactoryDefaults,
  restoreBackup,
  saveSettings,
  updateScript
} from '../../services/database';
import { readImportedFiles } from '../../features/import/importFiles';
import {
  exportBackupFile,
  exportScriptFile,
  makeBackup,
  parseBackup
} from '../../features/export/backup';
import { prompterHash } from '../../app/router';
import { checkForPWAUpdate } from '../../services/pwa';
import { applyKeepScreenAwake } from '../../services/keepAwake';
import { useModalFocus } from '../../app/useModalFocus';
import { Icon } from '../../components/Icon';
import { ScriptEditor } from './ScriptEditor';
import { AppSettingsPanel, type AppUpdateState } from './AppSettingsPanel';
import { HelpPanel } from './HelpPanel';
import styles from './ScriptsPage.module.css';

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

function excerpt(content: string): string {
  return content.replace(/[#>*`|-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
}

function OptionsSheet({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useModalFocus<HTMLDivElement>(onClose);
  return (
    <div className={styles.sheetBackdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="script-options-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <p id="script-options-title" className={styles.sheetTitle}>{title}</p>
        {children}
      </div>
    </div>
  );
}

export function ScriptsPage({
  navigate,
  initialEditingId
}: {
  navigate: (hash: string) => void;
  initialEditingId?: string;
}) {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(initialEditingId ?? null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<PrompterSettings | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [updateState, setUpdateState] = useState<AppUpdateState>('idle');
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const appSettingsSaveRef = useRef<Promise<void>>(Promise.resolve());

  const refresh = useCallback(async () => {
    try {
      setScripts(await listScripts());
    } catch {
      setOperationError('Your local script library could not be opened.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setEditingId(initialEditingId ?? null);
  }, [initialEditingId]);

  const filtered = query.trim()
    ? scripts.filter((script) =>
        `${script.title}\n${script.content}`.toLowerCase().includes(query.trim().toLowerCase())
      )
    : scripts;

  const handleNew = async () => {
    setBusy(true);
    setOperationError(null);
    try {
      const script = await createScript({ title: 'New script', content: '', format: 'markdown' });
      await refresh();
      setEditingId(script.id);
    } catch {
      setOperationError('The new script could not be created. Check available device storage.');
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setBusy(true);
    setOperationError(null);
    setNotice(null);
    const errors: string[] = [];
    let importedCount = 0;
    try {
      const files = Array.from(fileList);
      const backupFiles = files.filter((file) => /\.json$/i.test(file.name));
      const scriptFiles = files.filter((file) => !/\.json$/i.test(file.name));

      for (const file of backupFiles) {
        try {
          const backup = parseBackup(await file.text());
          await restoreBackup(backup.scripts, backup.settings);
          importedCount += backup.scripts.length;
        } catch (error) {
          errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Could not restore backup.'}`);
        }
      }
      if (backupFiles.length > 0) {
        applyKeepScreenAwake((await getSettings()).keepScreenAwake);
      }

      const outcomes = await readImportedFiles(scriptFiles);
      for (const outcome of outcomes) {
        if (outcome.ok) {
          await createScript({
            title: outcome.title,
            content: outcome.content,
            format: outcome.format
          });
          importedCount += 1;
        } else {
          errors.push(`${outcome.fileName}: ${outcome.error}`);
        }
      }
      await refresh();
      if (importedCount > 0) {
        setNotice(`${importedCount} ${importedCount === 1 ? 'script' : 'scripts'} imported.`);
      }
    } catch {
      setOperationError('The selected files could not be imported.');
    } finally {
      setImportErrors(errors);
      setBusy(false);
    }
  };

  const handleBackup = async () => {
    setBusy(true);
    setOperationError(null);
    try {
      await exportBackupFile(makeBackup(await listScripts(), await getSettings()));
      setNotice('Backup prepared. Keep it somewhere safe.');
    } catch {
      setOperationError('The backup could not be exported.');
    } finally {
      setBusy(false);
    }
  };

  const openAppSettings = async () => {
    setBusy(true);
    setOperationError(null);
    setSettingsError(null);
    setUpdateState('idle');
    setUpdateError(null);
    try {
      setAppSettings(await getSettings());
      setSettingsOpen(true);
    } catch {
      setOperationError('App settings could not be opened.');
    } finally {
      setBusy(false);
    }
  };

  const updateAppSettings = async (
    changes: Partial<PrompterSettings>,
    errorMessage: string
  ) => {
    if (!appSettings) return;
    const previous = appSettings;
    const next = { ...previous, ...changes };
    setAppSettings(next);
    applyKeepScreenAwake(next.keepScreenAwake);
    setSettingsError(null);
    setSettingsSaving(true);
    const save = appSettingsSaveRef.current
      .catch(() => undefined)
      .then(() => saveSettings(next));
    appSettingsSaveRef.current = save;
    try {
      await save;
    } catch {
      setAppSettings(previous);
      applyKeepScreenAwake(previous.keepScreenAwake);
      setSettingsError(errorMessage);
    } finally {
      setSettingsSaving(false);
    }
  };

  const updateCountdown = (seconds: number) =>
    updateAppSettings({ countdownSeconds: seconds }, 'The countdown setting could not be saved.');

  const updateKeepAwake = (enabled: boolean) =>
    updateAppSettings({ keepScreenAwake: enabled }, 'The screen setting could not be saved.');

  const handleFactoryReset = async () => {
    setBusy(true);
    setSettingsError(null);
    try {
      await appSettingsSaveRef.current.catch(() => undefined);
      await resetToFactoryDefaults();
      const restored = await getSettings();
      setAppSettings(restored);
      applyKeepScreenAwake(restored.keepScreenAwake);
      setSettingsOpen(false);
      setQuery('');
      setImportErrors([]);
      setOperationError(null);
      await refresh();
      setNotice('Factory defaults restored.');
    } catch {
      setSettingsError('The app could not be reset. No partial reset was kept.');
    } finally {
      setBusy(false);
    }
  };

  const handleCheckForUpdate = async () => {
    setUpdateState('checking');
    setUpdateError(null);
    await appSettingsSaveRef.current.catch(() => undefined);
    try {
      const result = await checkForPWAUpdate();
      setUpdateState(result);
    } catch {
      setUpdateState('error');
      setUpdateError('Could not check for updates. Check your connection and try again.');
    }
  };

  const closeAppSettings = () => {
    void appSettingsSaveRef.current.then(
      () => setSettingsOpen(false),
      () => undefined
    );
  };

  const openMenu = (id: string) => {
    setMenuId(id);
    setConfirmingDelete(false);
  };

  const menuScript = menuId ? scripts.find((script) => script.id === menuId) : undefined;
  const editingScript = editingId ? scripts.find((script) => script.id === editingId) : undefined;

  return (
    <div className={styles.page} aria-busy={busy}>
      <header className={styles.header}>
        <h1>Scripts</h1>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.headerIconButton}
            aria-label="Help"
            title="Help"
            onClick={() => setHelpOpen(true)}
          >
            <Icon name="help" />
          </button>
          <button
            type="button"
            data-testid="app-settings-button"
            className={styles.headerIconButton}
            aria-label="App settings"
            title="Settings"
            onClick={() => void openAppSettings()}
          >
            <Icon name="settings" />
          </button>
          <label
            data-testid="import-button"
            className={styles.importControl}
            title="Import"
          >
            <Icon name="upload" />
            <input
              data-testid="import-input"
              type="file"
              multiple
              aria-label="Import scripts or backup"
              onChange={(event) => {
                void handleImport(event.target.files);
                event.target.value = '';
              }}
            />
          </label>
          <button
            type="button"
            data-testid="backup-button"
            className={styles.headerIconButton}
            aria-label="Export full backup"
            title="Export backup"
            onClick={() => void handleBackup()}
          >
            <Icon name="download" />
          </button>
          <button
            type="button"
            data-testid="new-script"
            className={styles.primaryIconButton}
            aria-label="New script"
            title="New script"
            onClick={() => void handleNew()}
          >
            <Icon name="plus" />
          </button>
        </div>
      </header>

      {operationError && (
        <div className={styles.operationMessage} role="alert">
          <span>{operationError}</span>
          <button type="button" onClick={() => setOperationError(null)}>Dismiss</button>
        </div>
      )}
      {notice && (
        <div className={styles.notice} role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      )}
      {importErrors.length > 0 && (
        <div className={styles.importErrors} role="alert">
          {importErrors.map((error) => <p key={error}>{error}</p>)}
          <button type="button" onClick={() => setImportErrors([])}>Dismiss</button>
        </div>
      )}

      <div className={styles.searchRow}>
        <Icon name="search" />
        <label className={styles.visuallyHidden} htmlFor="script-search">Search scripts</label>
        <input
          id="script-search"
          data-testid="search-input"
          type="search"
          placeholder="Search scripts…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={styles.search}
        />
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty} data-testid="empty-state">
          {scripts.length === 0 ? (
            <>
              <p>No scripts yet.</p>
              <p>Create one or import Markdown, plain text, or a backup.</p>
            </>
          ) : (
            <p>No results for “{query}”.</p>
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
                <span className={styles.cardTitle} data-testid="card-title">{script.title}</span>
                <span className={styles.cardExcerpt}>{excerpt(script.content) || 'Empty'}</span>
                <span className={styles.cardDate}>{dateFormat.format(new Date(script.updatedAt))}</span>
              </button>
              <button
                type="button"
                className={styles.cardMenuButton}
                data-testid="card-menu"
                aria-label={`Options for ${script.title}`}
                onClick={() => openMenu(script.id)}
              >
                <Icon name="more" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {menuScript && (
        <OptionsSheet title={menuScript.title} onClose={() => setMenuId(null)}>
          <button
            type="button"
            data-testid="menu-edit"
            onClick={() => {
              setEditingId(menuScript.id);
              setMenuId(null);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              void exportScriptFile(menuScript).catch(() =>
                setOperationError('The script could not be exported.')
              );
              setMenuId(null);
            }}
          >
            Export
          </button>
          {menuScript.format === 'text' && (
            <button
              type="button"
              onClick={() => {
                void updateScript(menuScript.id, { format: 'markdown' })
                  .then(refresh)
                  .catch(() => setOperationError('The script format could not be changed.'));
                setMenuId(null);
              }}
            >
              Enable Markdown sections
            </button>
          )}
          <button
            type="button"
            data-testid="menu-duplicate"
            onClick={() => {
              void duplicateScript(menuScript.id)
                .then(refresh)
                .catch(() => setOperationError('The script could not be duplicated.'));
              setMenuId(null);
            }}
          >
            Duplicate
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
              void deleteScript(menuScript.id)
                .then(refresh)
                .catch(() => setOperationError('The script could not be deleted.'));
              setMenuId(null);
            }}
          >
            {confirmingDelete ? 'Delete permanently?' : 'Delete'}
          </button>
          <button type="button" onClick={() => setMenuId(null)}>Cancel</button>
        </OptionsSheet>
      )}

      {editingScript && (
        <ScriptEditor
          script={editingScript}
          onSaved={refresh}
          onClose={() => {
            setEditingId(null);
            if (initialEditingId) navigate('#/');
          }}
          onOpenPrompter={() => navigate(prompterHash(editingScript.id))}
        />
      )}
      {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}
      {settingsOpen && appSettings && (
        <AppSettingsPanel
          settings={appSettings}
          error={settingsError}
          updateState={updateState}
          updateError={updateError}
          busy={busy || settingsSaving || updateState === 'checking'}
          onCountdownChange={(seconds) => void updateCountdown(seconds)}
          onKeepAwakeChange={(enabled) => void updateKeepAwake(enabled)}
          onCheckForUpdate={() => void handleCheckForUpdate()}
          onFactoryReset={() => void handleFactoryReset()}
          onClose={closeAppSettings}
        />
      )}
    </div>
  );
}

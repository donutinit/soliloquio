import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react';
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
import {
  MAX_BACKUP_IMPORT_FILE_BYTES,
  readImportedFiles
} from '../../features/import/importFiles';
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
import { scriptExcerpt } from '../../features/scripts/excerpt';
import { SCRIPT_CARD_TITLE_LIMITS } from '../../features/settings/settings';
import { ScriptEditor } from './ScriptEditor';
import { AppSettingsPanel, type AppUpdateState } from './AppSettingsPanel';
import { GamepadSettingsPanel } from './GamepadSettingsPanel';
import { HelpPanel } from './HelpPanel';
import styles from './ScriptsPage.module.css';

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
        className={`${styles.sheet} ${styles.optionsSheet}`}
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
  initialEditingId,
  initialGamepadFocusId
}: {
  navigate: (hash: string) => void;
  initialEditingId?: string;
  initialGamepadFocusId?: string;
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
  const [gamepadOpen, setGamepadOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<PrompterSettings | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [updateState, setUpdateState] = useState<AppUpdateState>('idle');
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const appSettingsSaveRef = useRef<Promise<void>>(Promise.resolve());
  const appSettingsChangeVersionRef = useRef(0);
  const appSettingsRef = useRef(appSettings);
  const persistedAppSettingsRef = useRef(appSettings);
  appSettingsRef.current = appSettings;
  const cardButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const restoredGamepadFocusRef = useRef(false);

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
    let cancelled = false;
    const loadVersion = appSettingsChangeVersionRef.current;
    void getSettings()
      .then((settings) => {
        if (!cancelled && appSettingsChangeVersionRef.current === loadVersion) {
          appSettingsRef.current = settings;
          persistedAppSettingsRef.current = settings;
          setAppSettings(settings);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setEditingId(initialEditingId ?? null);
  }, [initialEditingId]);

  useEffect(() => {
    restoredGamepadFocusRef.current = false;
  }, [initialGamepadFocusId]);

  useEffect(() => {
    if (!initialGamepadFocusId || restoredGamepadFocusRef.current) return;
    const button = cardButtonRefs.current.get(initialGamepadFocusId);
    if (!button) return;
    document.documentElement.dataset.gamepadNav = 'true';
    button.focus({ preventScroll: true });
    button.scrollIntoView({ block: 'nearest' });
    restoredGamepadFocusRef.current = true;
  }, [initialGamepadFocusId, scripts]);

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
    let restoredBackup = false;
    try {
      const files = Array.from(fileList);
      const backupFiles = files.filter((file) => /\.json$/i.test(file.name));
      const scriptFiles = files.filter((file) => !/\.json$/i.test(file.name));

      for (const file of backupFiles) {
        if (file.size > MAX_BACKUP_IMPORT_FILE_BYTES) {
          errors.push(
            `${file.name}: Backup files must be ${MAX_BACKUP_IMPORT_FILE_BYTES / (1024 * 1024)} MB or smaller.`
          );
          continue;
        }

        let raw: string;
        try {
          raw = await file.text();
        } catch {
          errors.push(`${file.name}: The backup file could not be read.`);
          continue;
        }

        let backup: ReturnType<typeof parseBackup>;
        try {
          backup = parseBackup(raw);
        } catch (error) {
          errors.push(
            `${file.name}: ${error instanceof Error ? error.message : 'Invalid backup file.'}`
          );
          continue;
        }

        try {
          await restoreBackup(backup.scripts, backup.settings);
          importedCount += backup.scripts.length;
          restoredBackup = true;
        } catch {
          errors.push(
            `${file.name}: The backup could not be restored. Check available device storage and try again.`
          );
        }
      }
      if (restoredBackup) {
        try {
          const restoredSettings = await getSettings();
          appSettingsChangeVersionRef.current += 1;
          appSettingsRef.current = restoredSettings;
          persistedAppSettingsRef.current = restoredSettings;
          setAppSettings(restoredSettings);
          applyKeepScreenAwake(restoredSettings.keepScreenAwake);
        } catch {
          errors.push('The backup was restored, but its screen setting could not be applied.');
        }
      }

      const outcomes = await readImportedFiles(scriptFiles);
      for (const outcome of outcomes) {
        if (outcome.ok) {
          try {
            await createScript({
              title: outcome.title,
              content: outcome.content,
              format: outcome.format
            });
            importedCount += 1;
          } catch {
            errors.push(
              `${outcome.fileName}: The imported script could not be saved. Check available device storage and try again.`
            );
          }
        } else {
          errors.push(`${outcome.fileName}: ${outcome.error}`);
        }
      }
      if (importedCount > 0) {
        setNotice(`${importedCount} ${importedCount === 1 ? 'script' : 'scripts'} imported.`);
      }
    } catch {
      setOperationError('The selected files could not be imported.');
    } finally {
      await refresh();
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
      const loadedSettings = await getSettings();
      appSettingsChangeVersionRef.current += 1;
      appSettingsRef.current = loadedSettings;
      persistedAppSettingsRef.current = loadedSettings;
      setAppSettings(loadedSettings);
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
    const previous = appSettingsRef.current;
    if (!previous) return;
    const next = { ...previous, ...changes };
    const changeVersion = appSettingsChangeVersionRef.current + 1;
    appSettingsChangeVersionRef.current = changeVersion;
    appSettingsRef.current = next;
    setAppSettings(next);
    applyKeepScreenAwake(next.keepScreenAwake);
    setSettingsError(null);
    const save = appSettingsSaveRef.current
      .catch(() => undefined)
      .then(() => saveSettings(next));
    appSettingsSaveRef.current = save;
    try {
      await save;
      persistedAppSettingsRef.current = next;
      if (appSettingsChangeVersionRef.current === changeVersion) {
        setSettingsError(null);
      }
    } catch {
      if (appSettingsChangeVersionRef.current === changeVersion) {
        const persisted = persistedAppSettingsRef.current ?? previous;
        appSettingsRef.current = persisted;
        setAppSettings(persisted);
        applyKeepScreenAwake(persisted.keepScreenAwake);
        setSettingsError(errorMessage);
      }
    }
  };

  const updateCountdown = (seconds: number) =>
    updateAppSettings({ countdownSeconds: seconds }, 'The countdown setting could not be saved.');

  const updateScriptCardTitleSize = (size: number) =>
    updateAppSettings(
      { scriptCardTitleSize: size },
      'The script card title size could not be saved.'
    );

  const updateKeepAwake = (enabled: boolean) =>
    updateAppSettings({ keepScreenAwake: enabled }, 'The screen setting could not be saved.');

  const updateBindings = (bindings: PrompterSettings['controllerBindings']) =>
    updateAppSettings({ controllerBindings: bindings }, 'The gamepad settings could not be saved.');

  const handleFactoryReset = async () => {
    setBusy(true);
    setSettingsError(null);
    try {
      await appSettingsSaveRef.current.catch(() => undefined);
      await resetToFactoryDefaults();
      const restored = await getSettings();
      appSettingsChangeVersionRef.current += 1;
      appSettingsRef.current = restored;
      persistedAppSettingsRef.current = restored;
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
  const pageStyle = {
    '--script-card-title-size': `${
      appSettings?.scriptCardTitleSize ?? SCRIPT_CARD_TITLE_LIMITS.default
    }px`
  } as CSSProperties;

  return (
    <div className={styles.page} style={pageStyle} aria-busy={busy}>
      <header className={styles.header} data-testid="library-header">
        <h1>Scripts</h1>
        <div className={styles.headerActions} data-testid="library-header-actions">
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
            disabled={busy}
            onClick={() => void openAppSettings()}
          >
            <Icon name="settings" />
          </button>
          <label
            data-testid="import-button"
            className={styles.importControl}
            title="Import"
            aria-disabled={busy}
          >
            <Icon name="upload" />
            <input
              data-testid="import-input"
              data-gamepad-nav-exclude
              type="file"
              multiple
              disabled={busy}
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
            disabled={busy}
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
            disabled={busy}
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
                ref={(element) => {
                  if (element) cardButtonRefs.current.set(script.id, element);
                  else cardButtonRefs.current.delete(script.id);
                }}
                type="button"
                className={styles.cardMain}
                data-testid="open-prompter"
                data-gamepad-script
                disabled={busy}
                onClick={() => navigate(prompterHash(script.id))}
              >
                <span className={styles.cardTitle} data-testid="card-title">{script.title}</span>
                <span className={styles.cardExcerpt}>{scriptExcerpt(script.content) || 'Empty'}</span>
              </button>
              <button
                type="button"
                className={styles.cardMenuButton}
                data-testid="card-menu"
                data-gamepad-nav-exclude
                aria-label={`Options for ${script.title}`}
                disabled={busy}
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
      {settingsOpen && !gamepadOpen && appSettings && (
        <AppSettingsPanel
          settings={appSettings}
          error={settingsError}
          updateState={updateState}
          updateError={updateError}
          busy={busy || updateState === 'checking'}
          onCountdownChange={(seconds) => void updateCountdown(seconds)}
          onScriptCardTitleSizeChange={(size) => void updateScriptCardTitleSize(size)}
          onKeepAwakeChange={(enabled) => void updateKeepAwake(enabled)}
          onOpenGamepad={() => setGamepadOpen(true)}
          onCheckForUpdate={() => void handleCheckForUpdate()}
          onFactoryReset={() => void handleFactoryReset()}
          onClose={closeAppSettings}
        />
      )}
      {gamepadOpen && appSettings && (
        <GamepadSettingsPanel
          bindings={appSettings.controllerBindings}
          error={settingsError}
          onChange={(bindings) => void updateBindings(bindings)}
          onClose={() => setGamepadOpen(false)}
        />
      )}
    </div>
  );
}

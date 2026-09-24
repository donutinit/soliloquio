import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode
} from 'react';
import type { PrompterSettings, Script } from '../../types';
import {
  createScript,
  deleteAllScripts,
  deleteScript,
  duplicateScript,
  getSettings,
  listScripts,
  resetToFactoryDefaults,
  saveSettings,
  updateScript
} from '../../services/database';
import { makeBackup } from '../../features/export/backup';
import { exportBackupFile, exportScriptFile } from '../../services/exportFiles';
import { importSelectedFiles } from '../../services/importScripts';
import { prompterHash } from '../../app/router';
import { checkForPWAUpdate } from '../../services/pwa';
import { applyKeepScreenAwake } from '../../services/keepAwake';
import { useModalFocus } from '../../app/useModalFocus';
import { Icon } from '../../components/Icon';
import {
  buildScriptLibraryIndex,
  filterScriptLibraryIndex
} from '../../features/scripts/libraryIndex';
import { SCRIPT_CARD_TITLE_LIMITS, SPEED_LIMITS } from '../../features/settings/settings';
import {
  formatReadingTime,
  formatWordCount,
  readingSeconds
} from '../../features/prompter/pace';
import { requestPersistentStorage } from '../../services/persistentStorage';
import { cssVars } from '../../styles/cssVars';
import { registerPendingSaveFlush } from '../../services/pendingSaves';
import {
  CANONICAL_APP_ORIGIN,
  isLegacyAppOrigin
} from '../../features/origin/originMigration';
import { ScriptEditor } from './ScriptEditor';
import { AppSettingsPanel, type AppUpdateState } from './AppSettingsPanel';
import { GamepadSettingsPanel } from './GamepadSettingsPanel';
import { HelpPanel } from './HelpPanel';
import styles from './ScriptsPage.module.css';

/** Search appears once the library is long enough to need it. */
const SEARCH_MIN_SCRIPTS = 6;
/** Success notices step aside on their own; errors wait for Dismiss. */
const NOTICE_TIMEOUT_MS = 4000;

function hasDraggedFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes('Files');
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
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [libraryMessage, setLibraryMessage] = useState<string | null>(null);
  const [newScriptId, setNewScriptId] = useState<string | null>(null);
  const [dragDepth, setDragDepth] = useState(0);
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

  useEffect(() => registerPendingSaveFlush(() => appSettingsSaveRef.current), []);

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
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [notice]);

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

  const libraryEntries = useMemo(() => buildScriptLibraryIndex(scripts), [scripts]);
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(
    () => filterScriptLibraryIndex(libraryEntries, deferredQuery),
    [deferredQuery, libraryEntries]
  );
  const legacyOrigin = isLegacyAppOrigin(window.location.hostname);
  const showSearch = scripts.length >= SEARCH_MIN_SCRIPTS || query !== '';

  const handleNew = async () => {
    setBusy(true);
    setOperationError(null);
    try {
      const script = await createScript({ title: 'New script', content: '', format: 'markdown' });
      void requestPersistentStorage();
      await refresh();
      setNewScriptId(script.id);
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
    setImportProgress('Importing…');
    try {
      const { importedCount, errors, restoredSettings } = await importSelectedFiles(
        Array.from(fileList),
        (current, total) =>
          setImportProgress(total > 1 ? `Importing ${current} of ${total}…` : 'Importing…')
      );
      if (restoredSettings) {
        appSettingsChangeVersionRef.current += 1;
        appSettingsRef.current = restoredSettings;
        persistedAppSettingsRef.current = restoredSettings;
        setAppSettings(restoredSettings);
        applyKeepScreenAwake(restoredSettings.keepScreenAwake);
      }
      if (importedCount > 0) {
        void requestPersistentStorage();
        setNotice(`${importedCount} ${importedCount === 1 ? 'script' : 'scripts'} imported.`);
      }
      setImportErrors(errors);
    } catch {
      setOperationError('The selected files could not be imported.');
    } finally {
      await refresh();
      setImportProgress(null);
      setBusy(false);
    }
  };

  /** Reports in App settings when exported from there, otherwise on the page. */
  const handleBackup = async (fromSettings: boolean) => {
    setBusy(true);
    setOperationError(null);
    setLibraryMessage(null);
    const report = fromSettings ? setLibraryMessage : setNotice;
    try {
      const delivery = await exportBackupFile(
        makeBackup(await listScripts(), await getSettings(), new Date().toISOString())
      );
      if (delivery !== 'cancelled') {
        report('Backup exported. Keep it somewhere safe.');
      }
    } catch {
      (fromSettings ? setLibraryMessage : setOperationError)('The backup could not be exported.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveAllScripts = async () => {
    setBusy(true);
    setLibraryMessage(null);
    try {
      await deleteAllScripts();
      setQuery('');
      setLibraryMessage('All scripts removed. Settings were kept.');
    } catch {
      setLibraryMessage('The scripts could not be removed. Try again.');
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const onDragEnter = (event: DragEvent<HTMLElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    setDragDepth((depth) => depth + 1);
  };
  const onDragOver = (event: DragEvent<HTMLElement>) => {
    // Without this the browser opens a dropped file and leaves the app.
    if (hasDraggedFiles(event)) event.preventDefault();
  };
  const onDragLeave = (event: DragEvent<HTMLElement>) => {
    if (hasDraggedFiles(event)) setDragDepth((depth) => Math.max(0, depth - 1));
  };
  const onDrop = (event: DragEvent<HTMLElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    setDragDepth(0);
    if (!canDropImport) return;
    void handleImport(event.dataTransfer.files);
  };

  const openAppSettings = async () => {
    setBusy(true);
    setOperationError(null);
    setSettingsError(null);
    setUpdateState('idle');
    setUpdateError(null);
    setLibraryMessage(null);
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

  const updateSingleColumnLibrary = (enabled: boolean) =>
    updateAppSettings(
      { singleColumnLibrary: enabled },
      'The script card layout could not be saved.'
    );

  const updateKeepAwake = (enabled: boolean) =>
    updateAppSettings({ keepScreenAwake: enabled }, 'The screen setting could not be saved.');

  const updateMirrorText = (enabled: boolean) =>
    updateAppSettings({ mirrorText: enabled }, 'The mirror setting could not be saved.');

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
      void checkForPWAUpdate().catch(() => {
        setNotice('Factory defaults restored. App update check failed; try Update app when online.');
      });
    } catch {
      setSettingsError('The app could not be reset. No partial reset was kept.');
    } finally {
      setBusy(false);
    }
  };

  const handleCheckForUpdate = async () => {
    setUpdateState('checking');
    setUpdateError(null);
    try {
      await appSettingsSaveRef.current;
      const result = await checkForPWAUpdate();
      setUpdateState(result);
    } catch {
      setUpdateState('error');
      setUpdateError(
        'The update was not applied. Make sure your latest settings are saved and that you are online, then try again.'
      );
    }
  };

  const closeAppSettings = () => {
    void appSettingsSaveRef.current.then(
      () => setSettingsOpen(false),
      () => undefined
    );
  };

  /** Keeps the options sheet open until the write finishes, then confirms it. */
  const runMenuAction = async (operation: () => Promise<string | null>, failure: string) => {
    setBusy(true);
    setOperationError(null);
    setNotice(null);
    try {
      const success = await operation();
      setMenuId(null);
      if (success) setNotice(success);
    } catch {
      setMenuId(null);
      setOperationError(failure);
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const importInputProps = {
    type: 'file' as const,
    multiple: true,
    disabled: busy,
    'aria-label': 'Import scripts or backup',
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      void handleImport(event.target.files);
      event.target.value = '';
    }
  };

  const openMenu = (id: string) => {
    setMenuId(id);
    setConfirmingDelete(false);
  };

  const menuScript = menuId ? scripts.find((script) => script.id === menuId) : undefined;
  const editingScript = editingId ? scripts.find((script) => script.id === editingId) : undefined;
  // Files dropped on an open panel or editor are ignored rather than imported behind it.
  const canDropImport =
    !busy && !editingScript && !menuScript && !settingsOpen && !gamepadOpen && !helpOpen;
  // Mientras cargan los ajustes se usa el valor por defecto (una columna) para evitar un salto.
  const singleColumnLibrary = appSettings?.singleColumnLibrary ?? true;
  const wordsPerMinute = appSettings?.speed ?? SPEED_LIMITS.default;
  const pageStyle = cssVars({
    '--script-card-title-size': `${
      appSettings?.scriptCardTitleSize ?? SCRIPT_CARD_TITLE_LIMITS.default
    }px`
  });

  return (
    <main
      className={styles.page}
      style={pageStyle}
      aria-busy={busy}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragDepth > 0 && canDropImport && (
        <div className={styles.dropOverlay} data-testid="drop-overlay" aria-hidden="true">
          <Icon name="upload" />
          <span>Drop documents to import</span>
        </div>
      )}
      <header className={styles.header} data-testid="library-header">
        <h1>Scripts</h1>
        <div className={styles.headerActions} data-testid="library-header-actions">
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
            <span className={styles.desktopActionLabel}>Settings</span>
          </button>
          <label
            data-testid="import-button"
            className={styles.importControl}
            title="Import"
            aria-disabled={busy}
          >
            <Icon name="upload" />
            <span className={styles.desktopActionLabel}>Import</span>
            <input data-testid="import-input" data-gamepad-nav-exclude {...importInputProps} />
          </label>
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
            <span className={styles.desktopActionLabel}>New script</span>
          </button>
        </div>
      </header>

      {legacyOrigin && (
        <aside className={styles.originNotice} data-testid="legacy-origin-notice" role="alert">
          <div>
            <strong>This is the legacy app address.</strong>
            <span>
              Its on-device library is separate. Export a backup here before moving to the current
              address.
            </span>
          </div>
          <div className={styles.originNoticeActions}>
            <button type="button" disabled={busy} onClick={() => void handleBackup(false)}>
              Export backup
            </button>
            <a href={CANONICAL_APP_ORIGIN} target="_blank" rel="noreferrer">
              Open current app
            </a>
          </div>
        </aside>
      )}

      {operationError && (
        <div className={styles.operationMessage} role="alert">
          <span>{operationError}</span>
          <button type="button" onClick={() => setOperationError(null)}>Dismiss</button>
        </div>
      )}
      {importProgress && (
        <div className={styles.progress} data-testid="import-progress" role="status">
          <span>{importProgress}</span>
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
          {importErrors.map((error, index) => (
            <p key={`${index}-${error}`}>{error}</p>
          ))}
          <button type="button" onClick={() => setImportErrors([])}>Dismiss</button>
        </div>
      )}

      {showSearch && (
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
      )}

      {filtered.length === 0 ? (
        <div className={styles.empty} data-testid="empty-state">
          {scripts.length === 0 ? (
            <>
              <p>No scripts yet.</p>
              <p>Import a document — Word, PDF, Markdown, plain text, and more — or write a new script.</p>
              <div className={styles.emptyActions}>
                <label className={styles.emptyImport} aria-disabled={busy}>
                  <Icon name="upload" />
                  Import
                  <input data-testid="empty-import-input" {...importInputProps} />
                </label>
                <button
                  type="button"
                  data-testid="empty-new-script"
                  disabled={busy}
                  onClick={() => void handleNew()}
                >
                  <Icon name="plus" />
                  New script
                </button>
              </div>
            </>
          ) : (
            <p>No results for “{query}”.</p>
          )}
        </div>
      ) : (
        <ul
          className={
            singleColumnLibrary ? `${styles.grid} ${styles.singleColumn}` : styles.grid
          }
          data-testid="script-grid"
          data-layout={singleColumnLibrary ? 'single-column' : 'grid'}
        >
          {filtered.map(({ script, excerpt, words }) => (
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
                <span className={styles.cardExcerpt}>{excerpt}</span>
                <span className={styles.cardMeta} data-testid="card-meta">
                  {formatWordCount(words)} · ≈ {formatReadingTime(readingSeconds(words, wordsPerMinute))}
                </span>
              </button>
              <button
                type="button"
                className={styles.cardMenuButton}
                data-testid="card-menu"
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
            disabled={busy}
            onClick={() =>
              void runMenuAction(
                async () =>
                  (await exportScriptFile(menuScript)) === 'cancelled' ? null : 'Script exported.',
                'The script could not be exported.'
              )
            }
          >
            Export
          </button>
          {menuScript.format === 'text' && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void runMenuAction(
                  async () => {
                    await updateScript(menuScript.id, { format: 'markdown' });
                    return 'Markdown sections enabled.';
                  },
                  'The script format could not be changed.'
                )
              }
            >
              Enable Markdown sections
            </button>
          )}
          <button
            type="button"
            data-testid="menu-duplicate"
            disabled={busy}
            onClick={() =>
              void runMenuAction(
                async () => {
                  await duplicateScript(menuScript.id);
                  return 'Script duplicated.';
                },
                'The script could not be duplicated.'
              )
            }
          >
            Duplicate
          </button>
          <button
            type="button"
            data-testid="menu-delete"
            className={confirmingDelete ? `${styles.danger} ${styles.confirmingButton}` : styles.danger}
            disabled={busy}
            onClick={() => {
              if (!confirmingDelete) {
                setConfirmingDelete(true);
                return;
              }
              void runMenuAction(
                async () => {
                  await deleteScript(menuScript.id);
                  return 'Script deleted.';
                },
                'The script could not be deleted.'
              );
            }}
          >
            {confirmingDelete ? 'Delete permanently?' : 'Delete'}
          </button>
          <p className={styles.visuallyHidden} role="status">
            {confirmingDelete ? 'Tap Delete again to confirm.' : ''}
          </p>
          <button type="button" onClick={() => setMenuId(null)}>Cancel</button>
        </OptionsSheet>
      )}

      {editingScript && (
        <ScriptEditor
          key={editingScript.id}
          script={editingScript}
          isNew={editingScript.id === newScriptId}
          wordsPerMinute={wordsPerMinute}
          onSaved={refresh}
          onClose={() => {
            setEditingId(null);
            setNewScriptId(null);
            void refresh();
            if (initialEditingId) navigate('#/');
          }}
          onOpenPrompter={() => navigate(prompterHash(editingScript.id))}
        />
      )}
      {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}
      {settingsOpen && !gamepadOpen && !helpOpen && appSettings && (
        <AppSettingsPanel
          settings={appSettings}
          error={settingsError}
          updateState={updateState}
          updateError={updateError}
          busy={busy || updateState === 'checking'}
          onCountdownChange={(seconds) => void updateCountdown(seconds)}
          onScriptCardTitleSizeChange={(size) => void updateScriptCardTitleSize(size)}
          onSingleColumnLibraryChange={(enabled) => void updateSingleColumnLibrary(enabled)}
          onKeepAwakeChange={(enabled) => void updateKeepAwake(enabled)}
          onMirrorTextChange={(enabled) => void updateMirrorText(enabled)}
          scriptCount={scripts.length}
          libraryMessage={libraryMessage}
          onBackup={() => void handleBackup(true)}
          onRemoveAllScripts={handleRemoveAllScripts}
          onOpenHelp={() => setHelpOpen(true)}
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
    </main>
  );
}

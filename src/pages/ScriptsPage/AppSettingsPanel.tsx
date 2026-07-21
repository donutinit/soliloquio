import { useState } from 'react';
import type { PrompterSettings } from '../../types';
import { COUNTDOWN_LIMITS } from '../../features/settings/settings';
import { useModalFocus } from '../../app/useModalFocus';
import styles from './ScriptsPage.module.css';

export type AppUpdateState =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'updating'
  | 'unsupported'
  | 'not-ready'
  | 'error';

export function AppSettingsPanel({
  settings,
  error,
  updateState,
  updateError,
  busy,
  onCountdownChange,
  onCheckForUpdate,
  onFactoryReset,
  onClose
}: {
  settings: PrompterSettings;
  error: string | null;
  updateState: AppUpdateState;
  updateError: string | null;
  busy: boolean;
  onCountdownChange: (seconds: number) => void;
  onCheckForUpdate: () => void;
  onFactoryReset: () => void;
  onClose: () => void;
}) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const requestClose = () => {
    if (!busy) onClose();
  };
  const dialogRef = useModalFocus<HTMLDivElement>(requestClose);

  return (
    <div className={styles.sheetBackdrop} onClick={requestClose}>
      <div
        ref={dialogRef}
        className={`${styles.sheet} ${styles.appSettingsSheet}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-settings-title"
        data-testid="app-settings-panel"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="app-settings-title">App settings</h2>

        <section className={styles.settingsSection}>
          <div className={styles.appSettingRow}>
            <label htmlFor="countdown-seconds">
              <strong>Start countdown</strong>
              <span>Used before a fresh start. Resuming from pause stays immediate.</span>
            </label>
            <select
              id="countdown-seconds"
              data-testid="countdown-setting"
              data-modal-autofocus
              value={settings.countdownSeconds}
              disabled={busy}
              onChange={(event) => onCountdownChange(Number(event.target.value))}
            >
              {Array.from(
                { length: COUNTDOWN_LIMITS.max - COUNTDOWN_LIMITS.min + 1 },
                (_, index) => index + COUNTDOWN_LIMITS.min
              ).map((seconds) => (
                <option key={seconds} value={seconds}>
                  {seconds === 0 ? 'Off' : `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`}
                </option>
              ))}
            </select>
          </div>
          {error && <p className={styles.settingsError} role="alert">{error}</p>}
        </section>

        <section className={styles.updateSection}>
          <div>
            <h3>App update</h3>
            <p>Check the server now and install the newest available version.</p>
          </div>
          <button
            type="button"
            className={styles.updateButton}
            data-testid="check-for-update"
            disabled={busy || updateState === 'checking' || updateState === 'updating'}
            onClick={onCheckForUpdate}
          >
            {updateState === 'checking'
              ? 'Checking…'
              : updateState === 'updating'
                ? 'Updating…'
                : 'Update app'}
          </button>
          {updateState !== 'idle' && updateState !== 'checking' && (
            <p className={styles.updateStatus} data-testid="update-status" role="status">
              {updateState === 'up-to-date'
                ? 'You already have the latest version.'
                : updateState === 'updating'
                  ? 'Update found. Reloading the app…'
                  : updateState === 'unsupported'
                    ? 'Update checks are not supported in this browser.'
                    : updateState === 'not-ready'
                      ? 'The update service is still starting. Try again in a moment.'
                      : updateError ?? 'The update check failed.'}
            </p>
          )}
        </section>

        <section className={styles.dangerZone}>
          <h3>Factory reset</h3>
          <p>Permanently erases every script and setting, then restores the original samples and defaults.</p>
          {confirmingReset ? (
            <div className={styles.resetConfirmation} role="alert">
              <strong>This cannot be undone.</strong>
              <div>
                <button type="button" disabled={busy} onClick={() => setConfirmingReset(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.dangerButton}
                  data-testid="factory-reset-confirm"
                  disabled={busy}
                  onClick={onFactoryReset}
                >
                  {busy ? 'Erasing…' : 'Erase everything'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={styles.dangerButton}
              data-testid="factory-reset"
              onClick={() => setConfirmingReset(true)}
            >
              Factory reset…
            </button>
          )}
        </section>

        <button type="button" className={styles.settingsDone} disabled={busy} onClick={requestClose}>
          Done
        </button>
      </div>
    </div>
  );
}

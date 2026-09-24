import { useState } from 'react';
import type { PrompterSettings } from '../../types';
import {
  FONT_LIMITS,
  MARGIN_LIMITS,
  SPEED_LIMITS,
  type Limit
} from '../../features/settings/settings';
import {
  formatReadingTime,
  readingSeconds,
  speedForDuration
} from '../../features/prompter/pace';
import { useModalFocus } from '../../app/useModalFocus';
import styles from './PrompterPage.module.css';

type SettingKey = 'speed' | 'fontSize' | 'horizontalMargin';

/** Common lengths for social clips and short takes. */
const FIT_TARGETS_SECONDS = [30, 60, 90, 120, 180] as const;

/**
 * La retroalimentación visual de ajuste interesa sobre todo cuando el valor lo
 * mueve el mando (click sintético con la navegación activa); con teclado o
 * dedo el propio control ya muestra el cambio.
 */
function isGamepadDriven(event: { nativeEvent: Event }): boolean {
  return (
    !event.nativeEvent.isTrusted &&
    document.documentElement.dataset.gamepadNav === 'true'
  );
}

function SettingRow({
  label,
  testId,
  value,
  limit,
  unit,
  onChange
}: {
  label: string;
  testId: string;
  value: number;
  limit: Limit;
  unit: string;
  onChange: (value: number, showFeedback: boolean) => void;
}) {
  return (
    <div className={styles.settingRow}>
      <span className={styles.settingLabel}>{label}</span>
      <button
        type="button"
        className={styles.stepButton}
        data-testid={`${testId}-minus`}
        aria-label={`Decrease ${label}`}
        onClick={(event) => onChange(value - limit.step, isGamepadDriven(event))}
      >
        −
      </button>
      <input
        type="range"
        data-testid={`${testId}-slider`}
        min={limit.min}
        max={limit.max}
        step={limit.step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value), isGamepadDriven(event))}
      />
      <button
        type="button"
        className={styles.stepButton}
        data-testid={`${testId}-plus`}
        aria-label={`Increase ${label}`}
        onClick={(event) => onChange(value + limit.step, isGamepadDriven(event))}
      >
        +
      </button>
      <span className={styles.settingValue} data-testid={`${testId}-value`}>
        {value}
        {unit}
      </span>
    </div>
  );
}

/**
 * Reader display panel: pace, text size, margins, mirroring, and fitting the
 * script to a target length. Every value here is global, like App settings.
 */
export function SettingsPanel({
  settings,
  spokenWords,
  timedPauseSeconds,
  onChange,
  onMirrorChange,
  onClose
}: {
  settings: PrompterSettings;
  spokenWords: number;
  timedPauseSeconds: number;
  onChange: (key: SettingKey, value: number, showFeedback?: boolean) => void;
  onMirrorChange: (enabled: boolean) => void;
  onClose: () => void;
}) {
  const dialogRef = useModalFocus<HTMLDivElement>(onClose);
  const [fitResult, setFitResult] = useState<string | null>(null);

  const fitTo = (targetSeconds: number) => {
    const speed = speedForDuration(spokenWords, targetSeconds, timedPauseSeconds, SPEED_LIMITS);
    onChange('speed', speed);
    const duration = formatReadingTime(readingSeconds(spokenWords, speed) + timedPauseSeconds);
    const unreachable =
      Math.abs(readingSeconds(spokenWords, speed) + timedPauseSeconds - targetSeconds) > 2;
    setFitResult(
      unreachable
        ? `${speed === SPEED_LIMITS.max ? 'Fastest' : 'Slowest'} pace is ${speed} wpm: about ${duration}.`
        : `${speed} wpm: about ${duration}.`
    );
  };

  return (
    <div className={styles.panelBackdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        data-testid="settings-panel"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="settings-title" className={styles.panelTitle}>Display</h2>
        <SettingRow
          label="Speed"
          testId="speed"
          value={settings.speed}
          limit={SPEED_LIMITS}
          unit=" wpm"
          onChange={(value, showFeedback) => onChange('speed', value, showFeedback)}
        />
        <SettingRow
          label="Text size"
          testId="font"
          value={settings.fontSize}
          limit={FONT_LIMITS}
          unit="px"
          onChange={(value, showFeedback) => onChange('fontSize', value, showFeedback)}
        />
        <SettingRow
          label="Margins"
          testId="margin"
          value={settings.horizontalMargin}
          limit={MARGIN_LIMITS}
          unit="%"
          onChange={(value, showFeedback) =>
            onChange('horizontalMargin', value, showFeedback)
          }
        />
        <div className={styles.toggleRow}>
          <label htmlFor="reader-mirror-text">
            <span className={styles.settingLabel}>Mirror text</span>
            <span className={styles.toggleHint}>For teleprompter glass</span>
          </label>
          <span className={styles.switchControl}>
            <input
              id="reader-mirror-text"
              type="checkbox"
              data-testid="reader-mirror-setting"
              checked={settings.mirrorText}
              onChange={(event) => onMirrorChange(event.target.checked)}
            />
            <span aria-hidden="true" />
          </span>
        </div>
        {spokenWords > 0 && (
          <div className={styles.fitRow} role="group" aria-labelledby="fit-label">
            <span id="fit-label" className={styles.settingLabel}>Fit to time</span>
            <div className={styles.fitTargets}>
              {FIT_TARGETS_SECONDS.map((seconds) => (
                <button
                  key={seconds}
                  type="button"
                  className={styles.fitButton}
                  data-testid={`fit-${seconds}`}
                  aria-label={`Fit script to ${formatReadingTime(seconds)}`}
                  onClick={() => fitTo(seconds)}
                >
                  {formatReadingTime(seconds)}
                </button>
              ))}
            </div>
            <p className={styles.fitResult} data-testid="fit-result" role="status">
              {fitResult ?? ''}
            </p>
          </div>
        )}
        <div className={styles.panelActions}>
          <button type="button" data-testid="settings-close" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
